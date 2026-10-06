"""Seguimiento de retenciones recibidas comerciales: comprobante, corrección y anulación.

La retención nace en el cobro (``payments.register_payment``). Aquí se completa después el
comprobante, se corrige uno ya completado y se anula la retención. Toda acción bloquea primero
la venta y después la retención. Nada se edita en el importe ni se borra: anular es terminal y
devuelve el importe al saldo.
"""

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db.models import QuerySet, Sum
from django.utils import timezone

from identity.application.authorization import require_permission
from identity.models import User
from sales.application import queries, reviews
from sales.application.commands import (
    CommandOutcome,
    CommandResult,
    execute_write,
    parse_operation_id,
    reject_unknown_fields,
)
from sales.application.errors import SalesApplicationError, field_error, not_found
from sales.application.projection import project
from sales.application.reads import PAGE_SIZE_MAX, read_snapshot
from sales.application.sales import lock_sale
from sales.models import CommercialWithholding, CommercialWithholdingVoucherChange, Sale
from shared.withholding import (
    WithholdingValidationError,
    parse_voucher_number,
    validate_breakdown,
)

VOUCHER_FIELDS = frozenset(
    {"idempotency_key", "voucher_number", "voucher_date", "income_tax_amount", "vat_amount"}
)
CORRECTION_FIELDS = VOUCHER_FIELDS | {"operation_id", "reason"}
VOID_FIELDS = frozenset({"idempotency_key", "reason"})
REASON_MAX = 500


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
    if parsed > reviews.today():
        raise field_error(
            "validation_error", "voucher_date", "La fecha del comprobante no puede ser futura."
        )
    return parsed


def _lock(sale: Sale, withholding_id: int) -> CommercialWithholding:
    withholding = (
        CommercialWithholding.objects.select_for_update()
        .filter(pk=withholding_id, sale=sale)
        .first()
    )
    if withholding is None:
        raise not_found("Retención")
    return withholding


def _require_active(withholding: CommercialWithholding) -> None:
    if withholding.voided_at is not None:
        raise SalesApplicationError("invalid_state", "La retención está anulada.")


def _apply_voucher(withholding: CommercialWithholding, payload: dict[str, Any]) -> None:
    """Valida y asigna número, fecha y desglose; el importe nunca cambia."""
    try:
        number = parse_voucher_number(payload.get("voucher_number"))
        breakdown = validate_breakdown(
            withholding.amount, payload.get("income_tax_amount"), payload.get("vat_amount")
        )
    except WithholdingValidationError as error:
        raise SalesApplicationError("validation_error", str(error), error.errors) from None
    voucher_date = _voucher_date(payload.get("voucher_date"))
    duplicate = (
        CommercialWithholding.objects.filter(
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


def complete_voucher(
    *,
    actor: User,
    sale_id: int,
    withholding_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    """Completa por primera vez el comprobante de una retención vigente."""

    def work() -> CommandResult:
        reject_unknown_fields(payload, VOUCHER_FIELDS)
        withholding = _lock(lock_sale(sale_id), withholding_id)
        _require_active(withholding)
        if withholding.voucher_number is not None:
            raise SalesApplicationError(
                "invalid_state",
                "El comprobante ya fue completado; su corrección corresponde al Administrador.",
            )
        _apply_voucher(withholding, payload)
        return CommandResult(200, "withholding", withholding.pk, ("voucher",))

    return execute_write(
        actor=actor,
        permission="pagos_comerciales.registrar",
        action="sales.withholding_voucher_completed",
        target_type="sale",
        target_id=str(sale_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=project,
    )


def correct_voucher(
    *,
    actor: User,
    sale_id: int,
    withholding_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    """Corrige un comprobante ya completado, con motivo y conservando los valores anteriores."""

    def work() -> CommandResult:
        reject_unknown_fields(payload, CORRECTION_FIELDS)
        operation_id = parse_operation_id(payload)
        reason = _reason(payload)
        withholding = _lock(lock_sale(sale_id), withholding_id)
        existing = CommercialWithholdingVoucherChange.objects.filter(
            operation_id=operation_id
        ).first()
        if existing is not None:
            if existing.withholding_id != withholding.pk:
                raise SalesApplicationError(
                    "idempotency_conflict",
                    "Este identificador de operación ya se usó con otros datos.",
                )
            return CommandResult(200, "withholding", withholding.pk)
        _require_active(withholding)
        if withholding.voucher_number is None or withholding.voucher_date is None:
            raise SalesApplicationError(
                "invalid_state", "El comprobante todavía no fue completado."
            )
        CommercialWithholdingVoucherChange.objects.create(
            operation_id=operation_id,
            withholding=withholding,
            previous_voucher_number=withholding.voucher_number,
            previous_voucher_date=withholding.voucher_date,
            previous_income_tax_amount=withholding.income_tax_amount,
            previous_vat_amount=withholding.vat_amount,
            reason=reason,
            created_by=actor,
        )
        _apply_voucher(withholding, payload)
        return CommandResult(200, "withholding", withholding.pk, ("voucher",))

    return execute_write(
        actor=actor,
        permission="pagos_comerciales.anular",
        action="sales.withholding_voucher_corrected",
        target_type="sale",
        target_id=str(sale_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=project,
    )


def void_withholding(
    *,
    actor: User,
    sale_id: int,
    withholding_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    """Anula una retención con motivo: su importe vuelve al saldo y su número queda libre."""

    def work() -> CommandResult:
        reject_unknown_fields(payload, VOID_FIELDS)
        reason = _reason(payload)
        sale = lock_sale(sale_id)
        withholding = _lock(sale, withholding_id)
        _require_active(withholding)
        withholding.voided_at = timezone.now()
        withholding.voided_by = actor
        withholding.void_reason = reason
        withholding.save(update_fields=["voided_at", "voided_by", "void_reason"])
        sale.version += 1
        sale.save(update_fields=["version", "updated_at"])
        return CommandResult(200, "withholding", withholding.pk, ("state",))

    return execute_write(
        actor=actor,
        permission="pagos_comerciales.anular",
        action="sales.withholding_voided",
        target_type="sale",
        target_id=str(sale_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=project,
    )


def withholding_history(*, actor: User, sale_id: int) -> list[dict[str, Any]]:
    require_permission(
        actor=actor,
        permission="pagos_comerciales.ver",
        request_id=None,
        denial_action="sales.withholdings_viewed",
        target_type="sale",
        target_id=str(sale_id),
    )
    sale = Sale.objects.filter(pk=sale_id).first()
    if sale is None:
        raise not_found()
    return [
        queries.withholding_summary(item)
        for item in CommercialWithholding.objects.filter(sale=sale).order_by("effective_at", "id")
    ]


def pending_voucher_rows() -> QuerySet[CommercialWithholding]:
    """Retenciones comerciales vigentes a las que todavía falta el comprobante."""
    return CommercialWithholding.objects.filter(voided_at__isnull=True, voucher_number__isnull=True)


def pending_vouchers(
    *,
    actor: User,
    customer_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> dict[str, Any]:
    """Retenciones comerciales vigentes sin comprobante, de la más antigua a la más reciente."""
    require_permission(
        actor=actor,
        permission="pagos_comerciales.ver",
        request_id=request_id,
        denial_action="sales.pending_withholdings_viewed",
        target_type="sale",
        target_id="withholdings",
    )
    if page < 1:
        raise field_error("validation_error", "page", "La página debe ser al menos 1.")
    if not 1 <= page_size <= PAGE_SIZE_MAX:
        raise field_error(
            "validation_error", "page_size", f"El tamaño debe estar entre 1 y {PAGE_SIZE_MAX}."
        )
    today = reviews.today()
    with read_snapshot():
        queryset = pending_voucher_rows().select_related("sale")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        total = queryset.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        count = queryset.count()
        offset = (page - 1) * page_size
        items = []
        for item in queryset.order_by("effective_at", "id")[offset : offset + page_size]:
            items.append(
                {
                    **queries.withholding_summary(item),
                    "sale_number": item.sale.internal_number,
                    "customer": queries.customer_of(item.sale),
                    "age_days": (today - item.effective_date).days,
                    "fiscal_scope": "COMERCIAL",
                }
            )
    return {
        "items": items,
        "total_count": count,
        "page": page,
        "page_size": page_size,
        "pending_total": queries.money(total),
    }
