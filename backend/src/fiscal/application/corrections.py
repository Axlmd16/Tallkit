"""Solicitudes locales de corrección fiscal, sin transmisión ni efecto comercial."""

from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import NamedTuple
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import Q, Sum
from django.utils import timezone

from fiscal.domain.corrections import (
    CorrectionAction,
    CorrectionEvaluation,
    CorrectionFacts,
    EvaluationOutcome,
    evaluate_correction,
)
from fiscal.models import (
    FiscalCorrectionLine,
    FiscalCorrectionReconciliationHold,
    FiscalCorrectionRequest,
    FiscalDocumentIdentity,
    FiscalXmlDossier,
)
from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from shared.command_values import canonical_fingerprint, validate_idempotency_key


class CorrectionApplicationError(Exception):
    pass


class CorrectionConflictError(CorrectionApplicationError):
    pass


class CorrectionImpedimentError(CorrectionApplicationError):
    def __init__(self, evaluation: dict[str, object]) -> None:
        super().__init__("La solicitud conserva impedimentos de elegibilidad local.")
        self.evaluation = evaluation


class CorrectionRemainderError(CorrectionApplicationError):
    pass


class CorrectionStateError(CorrectionApplicationError):
    pass


class CorrectionCommandResult(NamedTuple):
    request_id: UUID
    state: str
    version: int
    replayed: bool


class _OriginalFacts(NamedTuple):
    issue_date: date
    fiscal_entity_id: int
    total: Decimal
    tax_total: Decimal
    line_facts: list[dict[str, object]]


def _facts_dict(facts: CorrectionFacts) -> dict[str, object]:
    return {
        "consumer_final_transmitted": facts.consumer_final_transmitted,
        "supports_tax_refund": facts.supports_tax_refund,
        "negotiable_traded": facts.negotiable_traded,
        "external_history_complete": facts.external_history_complete,
        "holidays_complete": facts.holidays_complete,
        "holidays": [value.isoformat() for value in facts.holidays],
        "calendar_source": facts.calendar_source,
        "calendar_version": facts.calendar_version,
    }


def _evaluation_dict(evaluation: CorrectionEvaluation) -> dict[str, object]:
    return {
        "outcome": evaluation.outcome.value,
        "normative_version": evaluation.normative_version,
        "evaluated_on": evaluation.evaluated_on.isoformat(),
        "deadline": evaluation.deadline.isoformat() if evaluation.deadline else None,
        "reasons": list(evaluation.reasons),
        "pending_facts": list(evaluation.pending_facts),
        "calendar_source": evaluation.calendar_source,
        "calendar_version": evaluation.calendar_version,
    }


def _decimal(value: object, field: str) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise CorrectionApplicationError(f"Importe inválido en {field}.") from None


def _dossier_facts(dossier: FiscalXmlDossier) -> _OriginalFacts:
    return _OriginalFacts(
        dossier.issue_date,
        dossier.fiscal_entity_id,
        dossier.total,
        dossier.tax_total,
        dossier.line_facts,
    )


def _identity_facts(identity: FiscalDocumentIdentity) -> _OriginalFacts:
    snapshot = identity.preparation.snapshot or {}
    totals = snapshot.get("totals") or {}
    lines = snapshot.get("lines") or []
    try:
        return _OriginalFacts(
            identity.emission_date,
            identity.preparation.fiscal_entity_id,
            Decimal(str(totals["grand"])),
            Decimal(str(totals["tax"])),
            [
                {
                    "position": line["position"],
                    "quantity": line["quantity"],
                    "base_amount": line["base_amount"],
                    "tax_amount": line["tax_amount"],
                    "tax_treatments": (
                        [
                            {
                                "tax_code": line["tax_code"],
                                "percentage_code": line["percentage_code"],
                                "rate": line["tax_rate"],
                                "base_amount": line["base_amount"],
                                "tax_amount": line["tax_amount"],
                            }
                        ]
                        if all(key in line for key in ("tax_code", "percentage_code", "tax_rate"))
                        else []
                    ),
                }
                for line in lines
            ],
        )
    except (KeyError, InvalidOperation, TypeError):
        raise CorrectionApplicationError(
            "La identidad de ensayo no conserva importes suficientes del original."
        ) from None


def _position(value: object) -> int:
    if not isinstance(value, (str, bytes, bytearray, int)):
        raise CorrectionApplicationError("La posición de línea no es válida.")
    try:
        return int(value)
    except (TypeError, ValueError):
        raise CorrectionApplicationError("La posición de línea no es válida.") from None


def _tax_treatments(value: object) -> list[object]:
    if not isinstance(value, list):
        return []
    return list(value)


def _credit_lines(
    *, original: _OriginalFacts, requested_lines: list[dict[str, object]]
) -> tuple[list[dict[str, object]], Decimal, Decimal, Decimal]:
    originals = {_position(line["position"]): line for line in original.line_facts}
    if not requested_lines:
        raise CorrectionApplicationError("La nota de crédito requiere líneas afectadas.")
    normalized: list[dict[str, object]] = []
    seen: set[int] = set()
    base_total = tax_total = total = Decimal("0")
    for item in requested_lines:
        position = _position(item.get("position", 0))
        if position in seen or position not in originals:
            raise CorrectionApplicationError("La línea afectada no pertenece al original.")
        seen.add(position)
        original_line = originals[position]
        quantity = _decimal(item.get("quantity"), "quantity")
        base = _decimal(item.get("base_amount"), "base_amount")
        tax = _decimal(item.get("tax_amount"), "tax_amount")
        line_total = _decimal(item.get("total_amount"), "total_amount")
        if quantity <= 0 or base < 0 or tax < 0 or line_total <= 0 or base + tax != line_total:
            raise CorrectionApplicationError("Los importes de la línea afectada son incoherentes.")
        if (
            quantity > _decimal(original_line["quantity"], "original.quantity")
            or base > _decimal(original_line["base_amount"], "original.base")
            or tax > _decimal(original_line["tax_amount"], "original.tax")
        ):
            raise CorrectionRemainderError("La afectación supera los valores del original.")
        normalized.append(
            {
                "position": position,
                "quantity": quantity,
                "base_amount": base,
                "tax_amount": tax,
                "total_amount": line_total,
                "tax_treatments": _tax_treatments(original_line.get("tax_treatments", [])),
            }
        )
        base_total += base
        tax_total += tax
        total += line_total
    if total > original.total:
        raise CorrectionRemainderError("La afectación supera el total del original.")
    return normalized, base_total, tax_total, total


def create_correction_request(
    *,
    actor: User,
    original_dossier_id: UUID | None,
    action: CorrectionAction,
    reason: str,
    reference_date: date,
    facts: CorrectionFacts,
    requested_lines: list[dict[str, object]],
    idempotency_key: str,
    original_identity_id: int | None = None,
) -> CorrectionCommandResult:
    require_permission(actor=actor, permission="fiscal.correcciones.gestionar")
    reason = reason.strip()
    if not reason:
        raise CorrectionApplicationError("El motivo es obligatorio.")
    key = validate_idempotency_key(idempotency_key)
    if (original_dossier_id is None) == (original_identity_id is None):
        raise CorrectionApplicationError("Debe indicarse exactamente un original fiscal.")
    dossier = (
        FiscalXmlDossier.objects.get(pk=original_dossier_id)
        if original_dossier_id is not None
        else None
    )
    identity = (
        FiscalDocumentIdentity.objects.select_related("preparation").get(pk=original_identity_id)
        if original_identity_id is not None
        else None
    )
    if dossier is not None and dossier.document_type != "01":
        raise CorrectionApplicationError("El original debe ser una factura.")
    if identity is not None and identity.document_type != "01":
        raise CorrectionApplicationError("El original de ensayo debe ser una factura.")
    if dossier is not None:
        original = _dossier_facts(dossier)
    else:
        assert identity is not None
        original = _identity_facts(identity)
    evaluation = evaluate_correction(
        action=action,
        issue_date=original.issue_date,
        reference_date=reference_date,
        facts=facts,
    )
    if action is CorrectionAction.CREDIT_NOTE:
        lines, base, tax, total = _credit_lines(original=original, requested_lines=requested_lines)
    else:
        if requested_lines:
            raise CorrectionApplicationError("La anulación en línea no recibe líneas parciales.")
        lines = []
        base, tax, total = (
            original.total - original.tax_total,
            original.tax_total,
            original.total,
        )

    fingerprint_payload = {
        "original_dossier_id": str(original_dossier_id),
        "original_identity_id": original_identity_id,
        "action": action.value,
        "reason": reason,
        "reference_date": reference_date.isoformat(),
        "facts": _facts_dict(facts),
        "lines": [{name: str(value) for name, value in line.items()} for line in lines],
    }
    fingerprint = canonical_fingerprint(fingerprint_payload)
    with transaction.atomic():
        try:
            with transaction.atomic():
                request = FiscalCorrectionRequest.objects.create(
                    original_dossier=dossier,
                    original_identity=identity,
                    action=action.value,
                    reason=reason,
                    reference_date=reference_date,
                    normative_version=evaluation.normative_version,
                    facts=_facts_dict(facts),
                    evaluation=_evaluation_dict(evaluation),
                    requested_base=base,
                    requested_tax=tax,
                    requested_total=total,
                    idempotency_key=key,
                    input_fingerprint=fingerprint,
                    created_by=actor,
                )
        except IntegrityError:
            request = FiscalCorrectionRequest.objects.get(created_by=actor, idempotency_key=key)
            if request.input_fingerprint != fingerprint:
                raise CorrectionConflictError(
                    "La identidad del intento corresponde a otra solicitud."
                ) from None
            return CorrectionCommandResult(request.id, request.state, request.version, True)

        FiscalCorrectionLine.objects.bulk_create(
            [FiscalCorrectionLine(request=request, **line) for line in lines]
        )
        record_audit_event(
            actor=actor,
            action="fiscal.correction_created",
            target_type="fiscal_correction_request",
            target_id=str(request.id),
            result=AuditResult.SUCCESS,
        )
        return CorrectionCommandResult(request.id, request.state, request.version, False)


def _lock_request_and_original(request_id: UUID) -> FiscalCorrectionRequest:
    initial = FiscalCorrectionRequest.objects.get(pk=request_id)
    if initial.original_dossier_id is not None:
        FiscalXmlDossier.objects.select_for_update().get(pk=initial.original_dossier_id)
    else:
        assert initial.original_identity_id is not None
        FiscalDocumentIdentity.objects.select_for_update().get(pk=initial.original_identity_id)
    return FiscalCorrectionRequest.objects.select_for_update().get(pk=request_id)


def _request_original_facts(request: FiscalCorrectionRequest) -> _OriginalFacts:
    if request.original_dossier_id is not None:
        assert request.original_dossier is not None
        return _dossier_facts(request.original_dossier)
    assert request.original_identity is not None
    return _identity_facts(request.original_identity)


def prepare_correction_request(
    *, actor: User, request_id: UUID, expected_version: int
) -> CorrectionCommandResult:
    require_permission(actor=actor, permission="fiscal.correcciones.gestionar")
    with transaction.atomic():
        request = _lock_request_and_original(request_id)
        if request.state == "PREPARED":
            return CorrectionCommandResult(request.id, request.state, request.version, True)
        if request.state != "DRAFT" or request.version != expected_version:
            raise CorrectionConflictError("La versión o el estado de la solicitud cambió.")
        if (
            request.original_dossier_id is not None
            and FiscalCorrectionReconciliationHold.objects.filter(
                original_dossier_id=request.original_dossier_id, is_active=True
            ).exists()
        ):
            raise CorrectionImpedimentError(
                {
                    "outcome": EvaluationOutcome.PENDING,
                    "pending_facts": ["unreconciled_external_evidence"],
                }
            )
        if request.evaluation.get("outcome") != EvaluationOutcome.ELIGIBLE:
            raise CorrectionImpedimentError(request.evaluation)

        if request.action == CorrectionAction.CREDIT_NOTE:
            reserved = FiscalCorrectionRequest.objects.filter(
                action=CorrectionAction.CREDIT_NOTE,
            )
            reserved = (
                reserved.filter(original_dossier_id=request.original_dossier_id)
                if request.original_dossier_id is not None
                else reserved.filter(original_identity_id=request.original_identity_id)
            )
            reserved = reserved.filter(
                Q(state="PREPARED") | Q(state="CANCELLED", reservation_retained=True)
            )
            totals = reserved.aggregate(
                base=Sum("requested_base"), tax=Sum("requested_tax"), total=Sum("requested_total")
            )
            original = _request_original_facts(request)
            original_lines = {_position(line["position"]): line for line in original.line_facts}
            reserved_lines = {
                int(row["position"]): row
                for row in FiscalCorrectionLine.objects.filter(request__in=reserved)
                .values("position")
                .annotate(
                    quantity=Sum("quantity"),
                    base=Sum("base_amount"),
                    tax=Sum("tax_amount"),
                    total=Sum("total_amount"),
                )
            }
            for line in request.lines.all():
                source = original_lines[line.position]
                used = reserved_lines.get(line.position, {})
                if (
                    Decimal(used.get("quantity") or 0) + line.quantity
                    > _decimal(source["quantity"], "original.quantity")
                    or Decimal(used.get("base") or 0) + line.base_amount
                    > _decimal(source["base_amount"], "original.base")
                    or Decimal(used.get("tax") or 0) + line.tax_amount
                    > _decimal(source["tax_amount"], "original.tax")
                ):
                    raise CorrectionRemainderError(
                        "El remanente de una línea del original es insuficiente."
                    )
            if (
                Decimal(totals["base"] or 0) + request.requested_base
                > original.total - original.tax_total
                or Decimal(totals["tax"] or 0) + request.requested_tax > original.tax_total
                or Decimal(totals["total"] or 0) + request.requested_total > original.total
            ):
                raise CorrectionRemainderError("El remanente del original es insuficiente.")

        request.state = "PREPARED"
        request.version += 1
        request.prepared_by = actor
        request.prepared_at = timezone.now()
        request.save(update_fields=["state", "version", "prepared_by", "prepared_at"])
        record_audit_event(
            actor=actor,
            action="fiscal.correction_prepared",
            target_type="fiscal_correction_request",
            target_id=str(request.id),
            result=AuditResult.SUCCESS,
        )
        return CorrectionCommandResult(request.id, request.state, request.version, False)


def link_correction_evidence(*, actor: User, request_id: UUID, evidence_dossier_id: UUID) -> None:
    require_permission(actor=actor, permission="fiscal.correcciones.gestionar")
    with transaction.atomic():
        request = _lock_request_and_original(request_id)
        evidence = FiscalXmlDossier.objects.select_for_update().get(pk=evidence_dossier_id)
        original_facts = _request_original_facts(request)
        if request.state != "PREPARED" or request.action != CorrectionAction.CREDIT_NOTE:
            raise CorrectionStateError("La evidencia requiere una nota de crédito preparada.")
        if (
            evidence.document_type != "04"
            or evidence.fiscal_entity_id != original_facts.fiscal_entity_id
            or evidence.total != request.requested_total
        ):
            raise CorrectionConflictError("La evidencia no concuerda con la solicitud.")
        if request.evidence_dossier_id not in (None, evidence.id):
            raise CorrectionConflictError("La solicitud ya tiene otra evidencia relacionada.")
        request.evidence_dossier = evidence
        request.reservation_retained = True
        request.save(update_fields=["evidence_dossier", "reservation_retained"])


def cancel_correction_request(
    *, actor: User, request_id: UUID, expected_version: int, reason: str
) -> CorrectionCommandResult:
    require_permission(actor=actor, permission="fiscal.correcciones.gestionar")
    reason = reason.strip()
    if not reason:
        raise CorrectionApplicationError("El motivo de cancelación es obligatorio.")
    with transaction.atomic():
        request = _lock_request_and_original(request_id)
        if request.state == "CANCELLED":
            return CorrectionCommandResult(request.id, request.state, request.version, True)
        if request.state not in {"DRAFT", "PREPARED"} or request.version != expected_version:
            raise CorrectionConflictError("La versión o el estado de la solicitud cambió.")
        request.state = "CANCELLED"
        request.version += 1
        request.cancelled_by = actor
        request.cancelled_at = timezone.now()
        request.cancellation_reason = reason
        request.reservation_retained = request.evidence_dossier_id is not None
        request.save(
            update_fields=[
                "state",
                "version",
                "cancelled_by",
                "cancelled_at",
                "cancellation_reason",
                "reservation_retained",
            ]
        )
        return CorrectionCommandResult(request.id, request.state, request.version, False)


def replace_correction_request(
    *,
    actor: User,
    request_id: UUID,
    expected_version: int,
    action: CorrectionAction,
    reason: str,
    reference_date: date,
    facts: CorrectionFacts,
    requested_lines: list[dict[str, object]],
    idempotency_key: str,
) -> CorrectionCommandResult:
    require_permission(actor=actor, permission="fiscal.correcciones.gestionar")
    with transaction.atomic():
        original = _lock_request_and_original(request_id)
        if original.version != expected_version or original.state not in {"DRAFT", "PREPARED"}:
            raise CorrectionConflictError("La solicitud original ya no puede reemplazarse.")
        if original.evidence_dossier_id is not None:
            raise CorrectionConflictError(
                "Una solicitud con evidencia externa no puede reemplazarse silenciosamente."
            )
        replacement = create_correction_request(
            actor=actor,
            original_dossier_id=original.original_dossier_id,
            original_identity_id=original.original_identity_id,
            action=action,
            reason=reason,
            reference_date=reference_date,
            facts=facts,
            requested_lines=requested_lines,
            idempotency_key=idempotency_key,
        )
        FiscalCorrectionRequest.objects.filter(pk=replacement.request_id).update(
            replaces_id=original.id
        )
        original.state = "CANCELLED"
        original.version += 1
        original.cancelled_by = actor
        original.cancelled_at = timezone.now()
        original.cancellation_reason = f"Reemplazada: {reason.strip()}"
        original.reservation_retained = False
        original.save(
            update_fields=[
                "state",
                "version",
                "cancelled_by",
                "cancelled_at",
                "cancellation_reason",
                "reservation_retained",
            ]
        )
        return replacement


def flag_unreconciled_evidence(
    *,
    actor: User,
    original_dossier_id: UUID,
    evidence_dossier_id: UUID,
    reason: str,
) -> None:
    require_permission(actor=actor, permission="fiscal.correcciones.gestionar")
    reason = reason.strip()
    if not reason:
        raise CorrectionApplicationError("El motivo de conciliación pendiente es obligatorio.")
    with transaction.atomic():
        original = FiscalXmlDossier.objects.select_for_update().get(pk=original_dossier_id)
        evidence = FiscalXmlDossier.objects.select_for_update().get(pk=evidence_dossier_id)
        if original.document_type != "01" or evidence.document_type != "04":
            raise CorrectionConflictError("La conciliación requiere factura y nota de crédito.")
        if original.fiscal_entity_id != evidence.fiscal_entity_id:
            raise CorrectionConflictError("La evidencia pertenece a otro emisor.")
        FiscalCorrectionReconciliationHold.objects.create(
            original_dossier=original,
            evidence_dossier=evidence,
            reason=reason,
            created_by=actor,
        )
