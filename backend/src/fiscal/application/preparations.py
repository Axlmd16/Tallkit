"""Comandos locales de preparación; no transmiten ni asignan estado oficial."""

from dataclasses import dataclass
from datetime import date
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from django.core import signing
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from customer_registry.application.customers import update_customer_email
from fiscal.application.draft_prefill import (
    DRAFT_FORMAT,
    initial_draft,
    normalized_draft,
    service_details_from_source,
)
from fiscal.application.impediment_messages import classify_all
from fiscal.application.snapshot_builder import assemble_snapshot
from fiscal.domain.additional_info import AdditionalInfoError, validate_additional_info
from fiscal.domain.payment_term import PaymentTermError, parse_term_days, term_required
from fiscal.domain.receiver import FiscalReceiverError, parse_receiver
from fiscal.domain.service_details import ServiceDetailError, parse_service_details
from fiscal.domain.snapshot_amounts import SnapshotImpedimentError
from fiscal.domain.states import PreparationState
from fiscal.models import (
    FiscalCommandReceipt,
    FiscalPreparation,
    FiscalPreparationHistory,
    FiscalXmlDossier,
)
from identity.application.audit import record_audit_event
from identity.application.authorization import has_permission, require_permission
from identity.models import AuditResult, User
from sales.application.fiscal_source import (
    lock_fiscal_source as lock_commercial_source,
)
from sales.application.fiscal_source import (
    read_fiscal_source as read_commercial_source,
)
from shared.command_values import canonical_fingerprint, validate_idempotency_key
from shared.transactions import retryable_transaction
from workshop.application.fiscal_source import (
    lock_fiscal_source as lock_artisan_source,
)
from workshop.application.fiscal_source import (
    read_fiscal_source as read_artisan_source,
)
from workshop_configuration.application.fiscal_resolver import (
    read_issuer,
    resolve_fiscal_configuration,
)
from workshop_configuration.application.preparation_settings import payment_form_options

ACTION = "fiscal.preparation_created"
PREPARE_ACTION = "fiscal.preparation_prepared"
REPLACE_ACTION = "fiscal.preparation_replaced"
REVIEW_TTL_SECONDS = 900
REVIEW_SALT = "fiscal.preparation.review"
_GUAYAQUIL = ZoneInfo("America/Guayaquil")
_ACTIVE_STATES = (PreparationState.DRAFT, PreparationState.PREPARED)


class FiscalPreparationError(Exception):
    pass


class InvalidSourceKindError(FiscalPreparationError):
    pass


class IneligibleFiscalSourceError(FiscalPreparationError):
    pass


class ActivePreparationConflictError(FiscalPreparationError):
    pass


class IdempotencyConflictError(FiscalPreparationError):
    pass


class FiscalPreparationNotFoundError(FiscalPreparationError):
    pass


class PreparationStateError(FiscalPreparationError):
    pass


class PreparationVersionConflictError(FiscalPreparationError):
    pass


class StaleReviewError(FiscalPreparationError):
    pass


class PreparationImpedimentError(FiscalPreparationError):
    """Impedimentos de suficiencia; la preparación permanece en borrador."""

    def __init__(self, impediments: list[dict[str, str]]) -> None:
        super().__init__("La preparación tiene impedimentos pendientes.")
        self.impediments = impediments


class LinkedExternalEvidenceError(FiscalPreparationError):
    pass


class DraftFieldNotAllowedError(FiscalPreparationError):
    """Campo técnico o no admitido enviado desde la interfaz operativa."""


class DraftValidationError(FiscalPreparationError):
    """Dato del borrador fuera de regla; ``errors`` asocia campo → mensajes."""

    def __init__(self, errors: dict[str, list[str]]) -> None:
        super().__init__("El borrador contiene datos inválidos.")
        self.errors = errors


@dataclass(frozen=True)
class ReviewResult:
    impediments: tuple[dict[str, str], ...]
    token: str | None


@dataclass(frozen=True)
class PreparationCommandResult:
    preparation_id: UUID
    replayed: bool
    customer_email_updated: bool = False


@dataclass(frozen=True)
class FiscalDiscrepancy:
    source_changed: bool
    state_changed: bool
    corrections_changed: bool
    original_state: str
    current_state: str
    original_source_version: int
    current_source_version: int
    current_correction_ids: tuple[int, ...]


@dataclass(frozen=True)
class PreparationDetail:
    preparation_id: UUID
    fiscal_entity_id: int
    source_kind: str
    source_id: int
    state: str
    version: int
    source_version: int
    draft: dict[str, Any] | None
    snapshot: dict[str, Any] | None
    discrepancy: FiscalDiscrepancy
    cancellation_reason: str
    created_at: str
    prepared_at: str | None
    summary: dict[str, Any] | None = None
    issuer: dict[str, str] | None = None
    working: dict[str, Any] | None = None
    payment_options: tuple[dict[str, str], ...] = ()
    missing_fields: tuple[str, ...] = ()
    technical: dict[str, Any] | None = None


def _permission(source_kind: str) -> str:
    if source_kind == "COMMERCIAL":
        return "fiscal.comercial.preparar"
    if source_kind == "ARTISAN":
        return "fiscal.artesanal.preparar"
    raise InvalidSourceKindError("Tipo de origen fiscal no admitido.")


def _active_exists(source_kind: str, source_id: int) -> bool:
    if source_kind == "COMMERCIAL":
        return FiscalPreparation.objects.filter(
            commercial_sale_id=source_id, state__in=("DRAFT", "PREPARED")
        ).exists()
    return FiscalPreparation.objects.filter(
        artisan_operation_id=source_id, state__in=("DRAFT", "PREPARED")
    ).exists()


def _correction_ids(source: object) -> tuple[int, ...]:
    values = getattr(source, "return_ids", ())
    return tuple(int(value) for value in values)


def _source_fingerprint(source: Any) -> str:
    return canonical_fingerprint(
        {
            "state": source.state,
            "version": source.version,
            "correction_ids": _correction_ids(source),
            "order_state": getattr(source, "order_state", None),
            "order_version": getattr(source, "order_version", None),
        }
    )


def create_draft(
    *, actor: User, source_kind: str, source_id: int, idempotency_key: str
) -> PreparationCommandResult:
    permission = _permission(source_kind)
    require_permission(actor=actor, permission=permission)
    key = validate_idempotency_key(idempotency_key)
    fingerprint = canonical_fingerprint({"source_kind": source_kind, "source_id": source_id})

    with retryable_transaction():
        try:
            with transaction.atomic():
                receipt = FiscalCommandReceipt.objects.create(
                    actor=actor,
                    action=ACTION,
                    idempotency_key=key,
                    input_fingerprint=fingerprint,
                )
        except IntegrityError:
            receipt = FiscalCommandReceipt.objects.get(
                actor=actor, action=ACTION, idempotency_key=key
            )
            if receipt.input_fingerprint != fingerprint:
                raise IdempotencyConflictError(
                    "La identidad del intento corresponde a otra entrada."
                ) from None
            if receipt.result_preparation_id is None:
                raise ActivePreparationConflictError(
                    "El intento anterior no dejó un resultado recuperable."
                ) from None
            return PreparationCommandResult(receipt.result_preparation_id, replayed=True)

        source = (
            lock_commercial_source(source_id)
            if source_kind == "COMMERCIAL"
            else lock_artisan_source(source_id)
        )
        if source.state != "CONFIRMED":
            raise IneligibleFiscalSourceError("La operación no está confirmada y vigente.")
        linked_filter = (
            {"commercial_sale_id": source_id}
            if source_kind == "COMMERCIAL"
            else {"artisan_operation_id": source_id}
        )
        if FiscalXmlDossier.objects.filter(**linked_filter).exists():
            raise LinkedExternalEvidenceError(
                "La operación ya tiene evidencia fiscal externa vinculada."
            )
        if _active_exists(source_kind, source_id):
            raise ActivePreparationConflictError("La operación ya tiene una preparación activa.")

        preparation = FiscalPreparation.objects.create(
            fiscal_entity_id=source.fiscal_entity_id,
            commercial_sale_id=source_id if source_kind == "COMMERCIAL" else None,
            artisan_operation_id=source_id if source_kind == "ARTISAN" else None,
            source_version=source.version,
            draft=initial_draft(
                source=source,
                entity_id=source.fiscal_entity_id,
                on=date.fromisoformat(_today_guayaquil()),
            ),
            created_by=actor,
        )
        FiscalPreparationHistory.objects.create(
            preparation=preparation,
            sequence=1,
            event="CREATED",
            actor=actor,
            metadata={
                "source_kind": source_kind,
                "source_id": source_id,
                "source_state": source.state,
                "source_version": source.version,
                "correction_ids": list(_correction_ids(source)),
                "source_fingerprint": _source_fingerprint(source),
            },
        )
        receipt.result_preparation = preparation
        receipt.response_status = 201
        receipt.save(update_fields=["result_preparation", "response_status"])
        record_audit_event(
            actor=actor,
            action=ACTION,
            target_type="fiscal_preparation",
            target_id=str(preparation.pk),
            result=AuditResult.SUCCESS,
            operation_id=preparation.pk,
        )
        return PreparationCommandResult(preparation.pk, replayed=False)


@dataclass(frozen=True)
class ActivePreparationSummary:
    preparation_id: UUID
    state: str


def find_active_preparation(
    *, actor: User, source_kind: str, source_id: int
) -> ActivePreparationSummary | None:
    """Preparación activa (borrador o preparada) de una operación, para su ficha."""
    require_permission(actor=actor, permission=_permission(source_kind).replace("preparar", "ver"))
    field = "commercial_sale_id" if source_kind == "COMMERCIAL" else "artisan_operation_id"
    row = (
        FiscalPreparation.objects.filter(**{field: source_id}, state__in=_ACTIVE_STATES)
        .order_by("-created_at")
        .values("pk", "state")
        .first()
    )
    return ActivePreparationSummary(row["pk"], row["state"]) if row else None


def query_discrepancy(*, actor: User, preparation_id: UUID) -> FiscalDiscrepancy:
    preparation = FiscalPreparation.objects.filter(pk=preparation_id).first()
    if preparation is None:
        raise FiscalPreparationNotFoundError("Preparación fiscal no encontrada.")
    source_kind = "COMMERCIAL" if preparation.commercial_sale_id is not None else "ARTISAN"
    require_permission(actor=actor, permission=_permission(source_kind).replace("preparar", "ver"))
    source_id = preparation.commercial_sale_id or preparation.artisan_operation_id
    assert source_id is not None
    source = (
        read_commercial_source(source_id)
        if source_kind == "COMMERCIAL"
        else read_artisan_source(source_id)
    )
    created = preparation.history.order_by("sequence").first()
    if created is None:
        raise FiscalPreparationError("La preparación no conserva su historia inicial.")
    original_state = str(created.metadata.get("source_state", ""))
    original_corrections = tuple(int(value) for value in created.metadata.get("correction_ids", []))
    current_corrections = _correction_ids(source)
    state_changed = source.state != original_state
    corrections_changed = current_corrections != original_corrections
    original_fingerprint = str(created.metadata.get("source_fingerprint", ""))
    source_changed = _source_fingerprint(source) != original_fingerprint
    return FiscalDiscrepancy(
        source_changed=source_changed,
        state_changed=state_changed,
        corrections_changed=corrections_changed,
        original_state=original_state,
        current_state=source.state,
        original_source_version=preparation.source_version,
        current_source_version=source.version,
        current_correction_ids=current_corrections,
    )


def get_preparation(*, actor: User, preparation_id: UUID) -> PreparationDetail:
    """Consulta una preparación local y su diferencia actual sin inferir estado oficial."""
    preparation = FiscalPreparation.objects.filter(pk=preparation_id).first()
    if preparation is None:
        raise FiscalPreparationNotFoundError("Preparación fiscal no encontrada.")
    source_kind = _kind_of(preparation)
    require_permission(actor=actor, permission=_permission(source_kind).replace("preparar", "ver"))
    source_id = preparation.commercial_sale_id or preparation.artisan_operation_id
    assert source_id is not None
    source = (
        read_commercial_source(source_id)
        if source_kind == "COMMERCIAL"
        else read_artisan_source(source_id)
    )
    today = date.fromisoformat(_today_guayaquil())
    ruc, legal_name = read_issuer(preparation.fiscal_entity_id)
    working = None
    missing: tuple[str, ...] = ()
    options: tuple[dict[str, str], ...] = ()
    if preparation.state == PreparationState.DRAFT:
        working = normalized_draft(
            preparation.draft, source=source, entity_id=preparation.fiscal_entity_id, on=today
        )
        needs_term = term_required(source.condition, source.pending_balance)
        working = {**working, "term_required": needs_term}
        missing = _missing_receiver_fields(working["receiver"])
        if needs_term and working["payments"].get("term_days") is None:
            missing = (*missing, "term_days")
        options = tuple(
            {
                "code": option.code,
                "display_name": option.display_name,
                "description": option.description,
                "internal_method": option.internal_method or "",
            }
            for option in payment_form_options(entity_id=preparation.fiscal_entity_id, on=today)
            if option.enabled
        )
    technical = None
    if preparation.snapshot and has_permission(actor, "parametros.gestionar"):
        snapshot = preparation.snapshot
        technical = {
            "issuer": snapshot.get("issuer"),
            "catalog_versions": snapshot.get("catalog_versions"),
            "configuration": snapshot.get("configuration"),
            "reference_date": snapshot.get("reference_date"),
        }
    return PreparationDetail(
        preparation_id=preparation.pk,
        fiscal_entity_id=preparation.fiscal_entity_id,
        source_kind=source_kind,
        source_id=source_id,
        state=preparation.state,
        version=preparation.version,
        source_version=preparation.source_version,
        draft=preparation.draft,
        snapshot=preparation.snapshot,
        discrepancy=query_discrepancy(actor=actor, preparation_id=preparation_id),
        cancellation_reason=preparation.cancellation_reason,
        created_at=preparation.created_at.isoformat(),
        prepared_at=preparation.prepared_at.isoformat() if preparation.prepared_at else None,
        summary=_summary(source_kind, source),
        issuer={"ruc": ruc, "legal_name": legal_name},
        working=working,
        payment_options=options,
        missing_fields=missing,
        technical=technical,
    )


def _summary(source_kind: str, source: Any) -> dict[str, Any]:
    lines = []
    for line in source.lines:
        snapshot = getattr(line, "product_snapshot", None) or {}
        description = snapshot.get("name") if snapshot else getattr(line, "description", "")
        lines.append(
            {
                "position": line.position,
                "description": str(description or ""),
                "quantity": str(line.quantity),
                "total": str(line.total_amount),
            }
        )
    return {
        "kind": source_kind,
        "internal_number": source.internal_number,
        "operational_date": str(source.operational_date) if source.operational_date else None,
        "condition": source.condition,
        "state": source.state,
        "base_total": str(source.base_total),
        "tax_total": str(source.tax_total),
        "grand_total": str(source.grand_total),
        "lines": lines,
    }


def _missing_receiver_fields(receiver: dict[str, Any]) -> tuple[str, ...]:
    try:
        parsed = parse_receiver(receiver)
    except FiscalReceiverError as error:
        return tuple(sorted(error.errors))
    missing = [] if receiver.get("address") else ["address"]
    # El correo se exige al completar la preparación, no al guardar el borrador (DP-035).
    if parsed.requires_email and not parsed.email:
        missing.append("email")
    return tuple(missing)


# ---------------------------------------------------------------------------
# Edición del borrador, revisión y transiciones
# ---------------------------------------------------------------------------


def _kind_of(preparation: FiscalPreparation) -> str:
    return "COMMERCIAL" if preparation.commercial_sale_id is not None else "ARTISAN"


def _lock_source(preparation: FiscalPreparation) -> Any:
    if preparation.commercial_sale_id is not None:
        return lock_commercial_source(preparation.commercial_sale_id)
    assert preparation.artisan_operation_id is not None
    return lock_artisan_source(preparation.artisan_operation_id)


def _lock_preparation(preparation_id: UUID) -> FiscalPreparation | None:
    return FiscalPreparation.objects.select_for_update().filter(pk=preparation_id).first()


def _next_sequence(preparation: FiscalPreparation) -> int:
    current = preparation.history.aggregate(value=Max("sequence"))["value"] or 0
    return current + 1


def _today_guayaquil() -> str:
    return timezone.now().astimezone(_GUAYAQUIL).date().isoformat()


def update_draft(
    *,
    actor: User,
    preparation_id: UUID,
    expected_version: int,
    receiver: dict[str, Any],
    payments: dict[str, Any],
    additional_info: list[dict[str, str]] | None = None,
    service_details: list[dict[str, Any]] | None = None,
) -> FiscalPreparation:
    """Guarda solo lo que el usuario completa; los datos técnicos los resuelve el sistema.

    ``additional_info`` y ``service_details`` ausentes conservan lo ya guardado; ``receiver`` y
    ``payments`` se reemplazan completos, incluido el plazo.
    """
    with transaction.atomic():
        preparation = _lock_preparation(preparation_id)
        if preparation is None:
            raise FiscalPreparationNotFoundError("Preparación fiscal no encontrada.")
        require_permission(actor=actor, permission=_permission(_kind_of(preparation)))
        if preparation.state != PreparationState.DRAFT:
            raise PreparationStateError("Solo un borrador admite edición.")
        if preparation.version != expected_version:
            raise PreparationVersionConflictError("El borrador cambió; vuelva a consultarlo.")
        forms = payments.get("forms") if isinstance(payments, dict) else None
        _check_draft_fields(receiver, payments, forms)
        source = _read_source(preparation)
        stored = normalized_draft(
            preparation.draft,
            source=source,
            entity_id=preparation.fiscal_entity_id,
            on=date.fromisoformat(_today_guayaquil()),
        )
        term_days = _checked_term(payments, source)
        pairs = _checked_additional_info(additional_info, stored)
        details = _checked_service_details(service_details, stored, source, _kind_of(preparation))
        saved_payments: dict[str, Any] = {
            "forms": forms if isinstance(forms, list) else [],
            "suggested": False,
        }
        if term_days is not None:
            saved_payments["term_days"] = term_days
        preparation.draft = {
            "draft_format": DRAFT_FORMAT,
            "receiver": receiver,
            "payments": saved_payments,
            "additional_info": pairs,
            "service_details": details,
        }
        preparation.version += 1
        preparation.save(update_fields=["draft", "version", "updated_at"])
        return preparation


_RECEIVER_FIELDS = frozenset(
    {"identification_type", "identification", "legal_name", "address", "email"}
)
_FORM_FIELDS = frozenset({"payment_code", "amount"})


def _read_source(preparation: FiscalPreparation) -> Any:
    source_id = preparation.commercial_sale_id or preparation.artisan_operation_id
    assert source_id is not None
    if preparation.commercial_sale_id is not None:
        return read_commercial_source(source_id)
    return read_artisan_source(source_id)


def _checked_term(payments: dict[str, Any], source: Any) -> int | None:
    """Plazo del borrador: entero de días y solo en crédito con saldo pendiente."""
    raw = payments.get("term_days")
    if raw is None:
        return None
    try:
        days = parse_term_days(raw)
    except PaymentTermError as error:
        raise DraftValidationError({"payments.term_days": error.errors["term_days"]}) from None
    if not term_required(source.condition, source.pending_balance):
        raise DraftFieldNotAllowedError(
            "field_not_allowed: el plazo solo se declara en una operación a crédito con saldo "
            "pendiente."
        )
    return days


def _checked_additional_info(
    additional_info: list[dict[str, str]] | None, stored: dict[str, Any]
) -> list[dict[str, str]]:
    if additional_info is None:
        return list(stored["additional_info"])
    try:
        return validate_additional_info(additional_info)
    except AdditionalInfoError as error:
        raise DraftValidationError(error.errors) from None


def _checked_service_details(
    service_details: list[dict[str, Any]] | None,
    stored: dict[str, Any],
    source: Any,
    source_kind: str,
) -> list[dict[str, Any]]:
    if service_details is None:
        return list(stored["service_details"])
    if source_kind == "COMMERCIAL":
        if service_details:
            raise DraftFieldNotAllowedError(
                "field_not_allowed: una venta comercial no admite detalle de servicio."
            )
        return []
    try:
        return parse_service_details(
            service_details, valid_positions=[line.position for line in source.lines]
        )
    except ServiceDetailError as error:
        raise DraftValidationError(error.errors) from None


def _check_draft_fields(receiver: Any, payments: Any, forms: Any) -> None:
    if not isinstance(receiver, dict) or receiver.keys() - _RECEIVER_FIELDS:
        raise DraftFieldNotAllowedError("field_not_allowed: el receptor tiene campos no admitidos.")
    if not isinstance(payments, dict) or payments.keys() - {"forms", "term_days"}:
        raise DraftFieldNotAllowedError(
            "field_not_allowed: las formas de pago no admiten ese dato."
        )
    if not isinstance(forms, list) or any(
        not isinstance(form, dict) or form.keys() - _FORM_FIELDS for form in forms
    ):
        raise DraftFieldNotAllowedError(
            "field_not_allowed: cada forma de pago admite solo código e importe; "
            "el plazo del comprobante se declara una sola vez, no por forma."
        )


def _working_draft(preparation: FiscalPreparation, source: Any, on: date) -> dict[str, Any]:
    return normalized_draft(
        preparation.draft, source=source, entity_id=preparation.fiscal_entity_id, on=on
    )


def review(*, actor: User, preparation_id: UUID) -> ReviewResult:
    """Devuelve impedimentos por campo y, si no hay, un token firmado de 15 minutos."""
    with transaction.atomic():
        preparation = _lock_preparation(preparation_id)
        if preparation is None:
            raise FiscalPreparationNotFoundError("Preparación fiscal no encontrada.")
        require_permission(actor=actor, permission=_permission(_kind_of(preparation)))
        if preparation.state != PreparationState.DRAFT:
            raise PreparationStateError("Solo un borrador admite revisión.")
        source = _lock_source(preparation)
        if source.state != "CONFIRMED":
            return ReviewResult(
                classify_all(
                    [{"field": "source", "message": "La operación no está confirmada y vigente."}]
                ),
                None,
            )
        reference_date = date.fromisoformat(_today_guayaquil())
        config = resolve_fiscal_configuration(
            actor=actor,
            entity_id=preparation.fiscal_entity_id,
            on=reference_date,
        )
        try:
            assembled = assemble_snapshot(
                draft=_working_draft(preparation, source, reference_date),
                source=source,
                config=config,
                reference_date=reference_date,
            )
        except SnapshotImpedimentError as error:
            return ReviewResult(classify_all(error.impediments), None)
        token = signing.dumps(
            {
                "prep": str(preparation.pk),
                "version": preparation.version,
                "fingerprint": assembled.fingerprint,
                "actor": actor.pk,
            },
            salt=REVIEW_SALT,
        )
    return ReviewResult((), token)


def prepare(
    *,
    actor: User,
    preparation_id: UUID,
    review_token: str,
    idempotency_key: str,
    save_email_to_customer: bool = False,
) -> PreparationCommandResult:
    """Revalida bajo bloqueo, guarda el snapshot inmutable y pasa a preparada."""
    key = validate_idempotency_key(idempotency_key)
    fingerprint = canonical_fingerprint({"preparation_id": str(preparation_id)})
    with retryable_transaction():
        try:
            with transaction.atomic():
                receipt = FiscalCommandReceipt.objects.create(
                    actor=actor,
                    action=PREPARE_ACTION,
                    idempotency_key=key,
                    input_fingerprint=fingerprint,
                )
        except IntegrityError:
            receipt = FiscalCommandReceipt.objects.get(
                actor=actor, action=PREPARE_ACTION, idempotency_key=key
            )
            if receipt.input_fingerprint != fingerprint:
                raise IdempotencyConflictError("La clave corresponde a otra entrada.") from None
            if receipt.result_preparation_id is None:
                raise PreparationStateError("El intento anterior no dejó resultado.") from None
            return PreparationCommandResult(receipt.result_preparation_id, replayed=True)

        preparation = _lock_preparation(preparation_id)
        if preparation is None:
            raise FiscalPreparationNotFoundError("Preparación fiscal no encontrada.")
        require_permission(actor=actor, permission=_permission(_kind_of(preparation)))
        if preparation.state != PreparationState.DRAFT:
            raise PreparationStateError("Solo un borrador puede prepararse.")
        source = _lock_source(preparation)
        if source.state != "CONFIRMED":
            raise IneligibleFiscalSourceError("La operación no está confirmada y vigente.")
        reference_date = date.fromisoformat(_today_guayaquil())
        config = resolve_fiscal_configuration(
            actor=actor,
            entity_id=preparation.fiscal_entity_id,
            on=reference_date,
        )
        try:
            assembled = assemble_snapshot(
                draft=_working_draft(preparation, source, reference_date),
                source=source,
                config=config,
                reference_date=reference_date,
            )
        except SnapshotImpedimentError as error:
            raise PreparationImpedimentError(list(classify_all(error.impediments))) from None

        try:
            payload = signing.loads(review_token, salt=REVIEW_SALT, max_age=REVIEW_TTL_SECONDS)
        except signing.SignatureExpired:
            raise StaleReviewError("La revisión caducó; revise nuevamente.") from None
        except signing.BadSignature:
            raise StaleReviewError("La revisión no es válida.") from None
        if (
            payload.get("prep") != str(preparation.pk)
            or payload.get("version") != preparation.version
            or payload.get("fingerprint") != assembled.fingerprint
            or payload.get("actor") != actor.pk
        ):
            raise StaleReviewError("La revisión ya no corresponde a los datos actuales.")

        preparation.snapshot = assembled.snapshot
        preparation.state = PreparationState.PREPARED
        preparation.prepared_at = timezone.now()
        preparation.prepared_by = actor
        preparation.version += 1
        preparation.save(
            update_fields=[
                "snapshot",
                "state",
                "prepared_at",
                "prepared_by",
                "version",
                "updated_at",
            ]
        )
        FiscalPreparationHistory.objects.create(
            preparation=preparation,
            sequence=_next_sequence(preparation),
            event="PREPARED",
            actor=actor,
            metadata={
                "source_version": source.version,
                "snapshot_fingerprint": assembled.fingerprint,
            },
        )
        receipt.result_preparation = preparation
        receipt.response_status = 200
        receipt.save(update_fields=["result_preparation", "response_status"])
        record_audit_event(
            actor=actor,
            action=PREPARE_ACTION,
            target_type="fiscal_preparation",
            target_id=str(preparation.pk),
            result=AuditResult.SUCCESS,
            operation_id=preparation.pk,
        )
        customer_email_updated = False
        if save_email_to_customer:
            receiver_snap = dict(assembled.snapshot.get("receiver") or {})
            receiver_email = str(receiver_snap.get("email") or "").strip()
            id_type = str(receiver_snap.get("identification_type") or "")
            customer_id = getattr(source, "customer_id", None)
            if (
                id_type != "07"
                and receiver_email
                and customer_id is not None
                and has_permission(actor=actor, permission="clientes.gestionar")
            ):
                email_result = update_customer_email(
                    actor=actor,
                    customer_id=int(customer_id),
                    email=receiver_email,
                    source_reference=str(getattr(source, "internal_number", "") or ""),
                )
                customer_email_updated = email_result.updated
        return PreparationCommandResult(
            preparation.pk,
            replayed=False,
            customer_email_updated=customer_email_updated,
        )


def prepare_from_checkout(
    *,
    actor: User,
    source_kind: str,
    source_id: int,
    idempotency_key: str,
    receiver_mode: str = "CUSTOMER",
    receiver_email: str | None = None,
    credit_term_days: int | None = None,
    save_email_to_customer: bool = False,
) -> PreparationCommandResult:
    """Ejecuta crear/actualizar/revisar/preparar como paso interno de «Cobrar y facturar»."""
    existing = find_active_preparation(actor=actor, source_kind=source_kind, source_id=source_id)
    if existing is not None and existing.state == PreparationState.PREPARED:
        return PreparationCommandResult(
            existing.preparation_id, replayed=True, customer_email_updated=False
        )

    if existing is None:
        created = create_draft(
            actor=actor,
            source_kind=source_kind,
            source_id=source_id,
            idempotency_key=f"{idempotency_key}:draft",
        )
        prep_id = created.preparation_id
    else:
        prep_id = existing.preparation_id

    detail = get_preparation(actor=actor, preparation_id=prep_id)
    draft = dict(detail.draft or {})
    if receiver_mode == "FINAL_CONSUMER":
        receiver: dict[str, Any] = {
            "identification_type": "07",
            "identification": "9999999999999",
            "legal_name": "CONSUMIDOR FINAL",
            "address": "",
            "email": "",
            "final_consumer_acknowledged": True,
        }
    else:
        receiver = dict(draft.get("receiver") or {})
        if receiver_email is not None:
            receiver["email"] = receiver_email.strip()

    source = (
        read_commercial_source(source_id)
        if source_kind == "COMMERCIAL"
        else read_artisan_source(source_id)
    )
    raw_payments = dict(draft.get("payments") or {})
    payments: dict[str, Any] = {"forms": list(raw_payments.get("forms") or [])}
    if term_required(source.condition, source.pending_balance):
        if credit_term_days is not None:
            payments["term_days"] = credit_term_days
        elif raw_payments.get("term_days") is not None:
            payments["term_days"] = raw_payments["term_days"]

    update_draft(
        actor=actor,
        preparation_id=prep_id,
        expected_version=detail.version,
        receiver=receiver,
        payments=payments,
    )
    reviewed = review(actor=actor, preparation_id=prep_id)
    if reviewed.impediments or not reviewed.token:
        raise PreparationImpedimentError(list(reviewed.impediments))

    return prepare(
        actor=actor,
        preparation_id=prep_id,
        review_token=reviewed.token,
        idempotency_key=f"{idempotency_key}:prepare",
        save_email_to_customer=save_email_to_customer,
    )


def cancel(
    *, actor: User, preparation_id: UUID, expected_version: int, reason: str
) -> FiscalPreparation:
    """Cancela un borrador o una preparada, conservando su historia e instantánea."""
    if not isinstance(reason, str) or not 1 <= len(reason.strip()) <= 500:
        raise PreparationImpedimentError(
            [{"field": "reason", "message": "Indique el motivo de la cancelación."}]
        )
    with transaction.atomic():
        preparation = _lock_preparation(preparation_id)
        if preparation is None:
            raise FiscalPreparationNotFoundError("Preparación fiscal no encontrada.")
        require_permission(actor=actor, permission=_permission(_kind_of(preparation)))
        if preparation.state not in _ACTIVE_STATES:
            raise PreparationStateError("Solo un borrador o una preparada pueden cancelarse.")
        if preparation.version != expected_version:
            raise PreparationVersionConflictError("La preparación cambió; vuelva a consultarla.")
        preparation.state = PreparationState.CANCELLED
        preparation.cancelled_at = timezone.now()
        preparation.cancelled_by = actor
        preparation.cancellation_reason = reason.strip()
        preparation.version += 1
        preparation.save(
            update_fields=[
                "state",
                "cancelled_at",
                "cancelled_by",
                "cancellation_reason",
                "version",
                "updated_at",
            ]
        )
        FiscalPreparationHistory.objects.create(
            preparation=preparation,
            sequence=_next_sequence(preparation),
            event="CANCELLED",
            actor=actor,
            metadata={"reason": reason.strip()},
        )
        record_audit_event(
            actor=actor,
            action="fiscal.preparation_cancelled",
            target_type="fiscal_preparation",
            target_id=str(preparation.pk),
            result=AuditResult.SUCCESS,
            operation_id=preparation.pk,
        )
        return preparation


def replace(
    *, actor: User, preparation_id: UUID, reason: str, idempotency_key: str
) -> PreparationCommandResult:
    """Cancela la preparación indicada (si sigue activa) y crea un borrador enlazado."""
    key = validate_idempotency_key(idempotency_key)
    if not isinstance(reason, str) or not 1 <= len(reason.strip()) <= 500:
        raise PreparationImpedimentError(
            [{"field": "reason", "message": "Indique el motivo del reemplazo."}]
        )
    fingerprint = canonical_fingerprint({"preparation_id": str(preparation_id)})
    with retryable_transaction():
        try:
            with transaction.atomic():
                receipt = FiscalCommandReceipt.objects.create(
                    actor=actor,
                    action=REPLACE_ACTION,
                    idempotency_key=key,
                    input_fingerprint=fingerprint,
                )
        except IntegrityError:
            receipt = FiscalCommandReceipt.objects.get(
                actor=actor, action=REPLACE_ACTION, idempotency_key=key
            )
            if receipt.input_fingerprint != fingerprint:
                raise IdempotencyConflictError("La clave corresponde a otra entrada.") from None
            if receipt.result_preparation_id is None:
                raise PreparationStateError("El intento anterior no dejó resultado.") from None
            return PreparationCommandResult(receipt.result_preparation_id, replayed=True)

        old = _lock_preparation(preparation_id)
        if old is None:
            raise FiscalPreparationNotFoundError("Preparación fiscal no encontrada.")
        require_permission(actor=actor, permission=_permission(_kind_of(old)))
        if old.state == PreparationState.DRAFT:
            raise PreparationStateError("Un borrador se edita; no se reemplaza.")
        if old.state == PreparationState.PREPARED:
            old.state = PreparationState.CANCELLED
            old.cancelled_at = timezone.now()
            old.cancelled_by = actor
            old.cancellation_reason = reason.strip()
            old.version += 1
            old.save(
                update_fields=[
                    "state",
                    "cancelled_at",
                    "cancelled_by",
                    "cancellation_reason",
                    "version",
                    "updated_at",
                ]
            )
            FiscalPreparationHistory.objects.create(
                preparation=old,
                sequence=_next_sequence(old),
                event="CANCELLED",
                actor=actor,
                metadata={"reason": reason.strip(), "superseded": True},
            )
        source = _lock_source(old)
        # El reemplazo conserva el trabajo del usuario, pero el detalle de servicio vuelve a
        # precargarse con el de la operación: los ajustes de la preparación anterior no pasan.
        draft = (
            {**old.draft, "service_details": service_details_from_source(source)}
            if isinstance(old.draft, dict)
            else old.draft
        )
        replacement = FiscalPreparation.objects.create(
            fiscal_entity_id=old.fiscal_entity_id,
            commercial_sale_id=old.commercial_sale_id,
            artisan_operation_id=old.artisan_operation_id,
            source_version=source.version,
            draft=draft,
            replaces=old,
            created_by=actor,
        )
        FiscalPreparationHistory.objects.create(
            preparation=replacement,
            sequence=1,
            event="CREATED",
            actor=actor,
            metadata={"replaces": str(old.pk), "reason": reason.strip()},
        )
        receipt.result_preparation = replacement
        receipt.response_status = 201
        receipt.save(update_fields=["result_preparation", "response_status"])
        record_audit_event(
            actor=actor,
            action=REPLACE_ACTION,
            target_type="fiscal_preparation",
            target_id=str(replacement.pk),
            result=AuditResult.SUCCESS,
            operation_id=replacement.pk,
        )
        return PreparationCommandResult(replacement.pk, replayed=False)
