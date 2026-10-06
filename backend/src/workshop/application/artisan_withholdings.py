"""Seguimiento de retenciones recibidas del RUC artesanal: comprobante, corrección y anulación.

La retención nace en el cobro (``artisan_payments.register_payment``). Aquí se completa después
el comprobante, se corrige uno ya completado y se anula la retención. Toda acción bloquea
primero la operación artesanal y después la retención. El importe nunca se edita ni se borra:
anular es terminal y devuelve el importe al saldo.
"""

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db.models import Sum
from django.utils import timezone

from identity.application.authorization import require_permission
from identity.models import User
from shared.withholding import (
    WithholdingValidationError,
    parse_voucher_number,
    validate_breakdown,
)
from workshop.application.commands import CommandOutcome, CommandResult, execute_write
from workshop.application.errors import WorkshopError, field_error
from workshop.application.service_operations import (
    TARGET_TYPE,
    lock_operation,
    operation_detail,
    withholding_dict,
)
from workshop.application.support import business_today
from workshop.models import ArtisanWithholding, ArtisanWithholdingVoucherChange, ServiceOperation

VOUCHER_FIELDS = frozenset(
    {"idempotency_key", "voucher_number", "voucher_date", "income_tax_amount", "vat_amount"}
)
CORRECTION_FIELDS = VOUCHER_FIELDS | {"operation_id", "reason"}
VOID_FIELDS = frozenset({"idempotency_key", "reason"})
REASON_MAX = 500
PAGE_SIZE_MAX = 100


def _reject_unknown(payload: dict[str, Any], allowed: frozenset[str]) -> None:
    unknown = sorted(set(payload) - allowed)
    if unknown:
        raise WorkshopError(
            "unknown_field",
            "La solicitud contiene campos no admitidos.",
            {name: ["Campo no admitido."] for name in unknown},
        )


def _reason(payload: dict[str, Any]) -> str:
    reason = payload.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise field_error("validation_error", "reason", "El motivo es obligatorio.")
    if len(reason.strip()) > REASON_MAX:
        raise field_error(
            "validation_error", "reason", f"El motivo no puede exceder {REASON_MAX} caracteres."
        )
    return reason.strip()


def _voucher_date(value: Any) -> date:
    message = "Indique la fecha de emisión del comprobante (AAAA-MM-DD)."
    if not isinstance(value, str):
        raise field_error("validation_error", "voucher_date", message)
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise field_error("validation_error", "voucher_date", message) from None
    if parsed.isoformat() != value:
        raise field_error("validation_error", "voucher_date", message)
    if parsed > business_today():
        raise field_error(
            "validation_error", "voucher_date", "La fecha del comprobante no puede ser futura."
        )
    return parsed


def _lock(operation: ServiceOperation, withholding_id: int) -> ArtisanWithholding:
    withholding = (
        ArtisanWithholding.objects.select_for_update()
        .filter(pk=withholding_id, service_operation=operation)
        .first()
    )
    if withholding is None:
        raise WorkshopError("not_found", "Retención no encontrada.")
    return withholding


def _require_active(withholding: ArtisanWithholding) -> None:
    if withholding.voided_at is not None:
        raise WorkshopError("invalid_state", "La retención está anulada.")


def _apply_voucher(withholding: ArtisanWithholding, payload: dict[str, Any]) -> None:
    """Valida y asigna número, fecha y desglose; el importe nunca cambia."""
    try:
        number = parse_voucher_number(payload.get("voucher_number"))
        breakdown = validate_breakdown(
            withholding.amount, payload.get("income_tax_amount"), payload.get("vat_amount")
        )
    except WithholdingValidationError as error:
        raise WorkshopError("validation_error", str(error), error.errors) from None
    voucher_date = _voucher_date(payload.get("voucher_date"))
    duplicate = (
        ArtisanWithholding.objects.filter(
            customer_id=withholding.customer_id, voucher_number=number, voided_at__isnull=True
        )
        .exclude(pk=withholding.pk)
        .first()
    )
    if duplicate is not None:
        raise field_error(
            "validation_error",
            "voucher_number",
            f"Ese comprobante ya está registrado en la retención {duplicate.pk} de este cliente.",
        )
    withholding.voucher_number = number
    withholding.voucher_date = voucher_date
    withholding.income_tax_amount = None if breakdown is None else breakdown[0]
    withholding.vat_amount = None if breakdown is None else breakdown[1]
    withholding.save(
        update_fields=["voucher_number", "voucher_date", "income_tax_amount", "vat_amount"]
    )


def _fact_id(raw: Any) -> UUID:
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        raise field_error(
            "validation_error", "operation_id", "Indique un identificador de operación válido."
        ) from None


def complete_voucher(
    *,
    actor: User,
    operation_id: int,
    withholding_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    """Completa por primera vez el comprobante de una retención vigente."""

    def work() -> CommandResult:
        _reject_unknown(payload, VOUCHER_FIELDS)
        operation = lock_operation(operation_id)
        withholding = _lock(operation, withholding_id)
        _require_active(withholding)
        if withholding.voucher_number is not None:
            raise WorkshopError(
                "invalid_state",
                "El comprobante ya fue completado; su corrección corresponde al Administrador.",
            )
        _apply_voucher(withholding, payload)
        return CommandResult(200, operation.pk, ("withholding_voucher",))

    return execute_write(
        actor=actor,
        permissions=("pagos_artesanales.registrar",),
        action="maintenance.artisan_withholding_voucher_complete",
        target_id=str(withholding_id),
        payload=payload,
        work=work,
        project=lambda pk: operation_detail(pk, actor),
        request_id=request_id,
        target_type=TARGET_TYPE,
    )


def correct_voucher(
    *,
    actor: User,
    operation_id: int,
    withholding_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    """Corrige un comprobante ya completado, con motivo y conservando los valores anteriores."""

    def work() -> CommandResult:
        _reject_unknown(payload, CORRECTION_FIELDS)
        fact = _fact_id(payload.get("operation_id"))
        reason = _reason(payload)
        operation = lock_operation(operation_id)
        withholding = _lock(operation, withholding_id)
        existing = ArtisanWithholdingVoucherChange.objects.filter(operation_id=fact).first()
        if existing is not None:
            if existing.withholding_id != withholding.pk:
                raise WorkshopError(
                    "idempotency_conflict",
                    "Este identificador de operación ya se usó con otros datos.",
                )
            return CommandResult(200, operation.pk)
        _require_active(withholding)
        if withholding.voucher_number is None or withholding.voucher_date is None:
            raise WorkshopError("invalid_state", "El comprobante todavía no fue completado.")
        ArtisanWithholdingVoucherChange.objects.create(
            operation_id=fact,
            withholding=withholding,
            previous_voucher_number=withholding.voucher_number,
            previous_voucher_date=withholding.voucher_date,
            previous_income_tax_amount=withholding.income_tax_amount,
            previous_vat_amount=withholding.vat_amount,
            reason=reason,
            created_by=actor,
        )
        _apply_voucher(withholding, payload)
        return CommandResult(200, operation.pk, ("withholding_voucher",))

    return execute_write(
        actor=actor,
        permissions=("pagos_artesanales.anular",),
        action="maintenance.artisan_withholding_voucher_correct",
        target_id=str(withholding_id),
        payload=payload,
        work=work,
        project=lambda pk: operation_detail(pk, actor),
        request_id=request_id,
        target_type=TARGET_TYPE,
    )


def void_withholding(
    *,
    actor: User,
    operation_id: int,
    withholding_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    """Anula una retención con motivo: su importe vuelve al saldo y su número queda libre."""

    def work() -> CommandResult:
        _reject_unknown(payload, VOID_FIELDS)
        reason = _reason(payload)
        operation = lock_operation(operation_id)
        withholding = _lock(operation, withholding_id)
        _require_active(withholding)
        withholding.voided_at = timezone.now()
        withholding.voided_by = actor
        withholding.void_reason = reason
        withholding.save(update_fields=["voided_at", "voided_by", "void_reason"])
        operation.version += 1
        operation.save(update_fields=["version"])
        return CommandResult(200, operation.pk, ("withholding_state",))

    return execute_write(
        actor=actor,
        permissions=("pagos_artesanales.anular",),
        action="maintenance.artisan_withholding_void",
        target_id=str(withholding_id),
        payload=payload,
        work=work,
        project=lambda pk: operation_detail(pk, actor),
        request_id=request_id,
        target_type=TARGET_TYPE,
    )


def pending_voucher_rows() -> Any:
    """Retenciones artesanales vigentes a las que todavía falta el comprobante."""
    return ArtisanWithholding.objects.filter(voided_at__isnull=True, voucher_number__isnull=True)


def pending_vouchers(
    *,
    actor: User,
    customer_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> dict[str, Any]:
    """Retenciones artesanales vigentes sin comprobante, de la más antigua a la más reciente."""
    require_permission(
        actor=actor,
        permission="pagos_artesanales.ver",
        request_id=request_id,
        denial_action="maintenance.artisan_pending_withholdings",
        target_type=TARGET_TYPE,
        target_id="withholdings",
    )
    if page < 1:
        raise field_error("validation_error", "page", "La página debe ser al menos 1.")
    if not 1 <= page_size <= PAGE_SIZE_MAX:
        raise field_error(
            "validation_error", "page_size", f"El tamaño debe estar entre 1 y {PAGE_SIZE_MAX}."
        )
    queryset = pending_voucher_rows().select_related(
        "service_operation", "service_operation__order", "created_by"
    )
    if customer_id:
        queryset = queryset.filter(customer_id=customer_id)
    total = queryset.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    count = queryset.count()
    today = business_today()
    start = (page - 1) * page_size
    items = []
    for item in queryset.order_by("effective_at", "id")[start : start + page_size]:
        operation = item.service_operation
        items.append(
            {
                **withholding_dict(item),
                "operation_number": operation.internal_number,
                "order_id": operation.order_id,
                "order_number": operation.order.number,
                "customer": {
                    "id": item.customer_id,
                    "name": operation.customer_snapshot.get("name", ""),
                    "identification": operation.customer_snapshot.get("identification", ""),
                },
                "age_days": (today - item.effective_date).days,
                "fiscal_scope": "ARTESANAL",
            }
        )
    return {
        "items": items,
        "total_count": count,
        "page": page,
        "page_size": page_size,
        "pending_total": f"{total:.2f}",
    }
