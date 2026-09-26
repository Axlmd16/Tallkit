"""Comandos locales de preparación; no transmiten ni asignan estado oficial."""

from dataclasses import dataclass
from uuid import UUID

from django.db import IntegrityError, transaction

from fiscal.models import FiscalCommandReceipt, FiscalPreparation, FiscalPreparationHistory
from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from sales.application.fiscal_source import (
    lock_fiscal_source as lock_commercial_source,
    read_fiscal_source as read_commercial_source,
)
from shared.command_values import canonical_fingerprint, validate_idempotency_key
from shared.transactions import retryable_transaction
from workshop.application.fiscal_source import (
    lock_fiscal_source as lock_artisan_source,
    read_fiscal_source as read_artisan_source,
)

ACTION = "fiscal.preparation_created"


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


@dataclass(frozen=True)
class PreparationCommandResult:
    preparation_id: UUID
    replayed: bool


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


def _source_fingerprint(source: object) -> str:
    return canonical_fingerprint(
        {
            "state": getattr(source, "state"),
            "version": getattr(source, "version"),
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
        if _active_exists(source_kind, source_id):
            raise ActivePreparationConflictError("La operación ya tiene una preparación activa.")

        preparation = FiscalPreparation.objects.create(
            fiscal_entity_id=source.fiscal_entity_id,
            commercial_sale_id=source_id if source_kind == "COMMERCIAL" else None,
            artisan_operation_id=source_id if source_kind == "ARTISAN" else None,
            source_version=source.version,
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
