"""Devoluciones de cliente: corrigen el exigible y reingresan solo lo declarado apto.

Los importes y el costo se calculan sobre los valores históricos de la venta original y de sus
asignaciones, nunca con el catálogo ni el promedio actuales. La devolución es una entrada nueva
que referencia la salida original (``corrects_operation``); no usa la reversión exacta.
"""

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db.models import Sum
from django.utils import timezone

import inventory.application.posting as posting
from catalog.application.sales_references import (
    SaleProductReferenceError,
    lock_product_references,
)
from identity.application.authorization import require_permission
from identity.models import User
from sales.application import reviews
from sales.application.commands import (
    CommandOutcome,
    CommandResult,
    execute_write,
    parse_operation_id,
    reject_unknown_fields,
)
from sales.application.errors import SalesApplicationError, field_error, not_found
from sales.application.ledger import Ledger, ledger_for
from sales.application.projection import project
from sales.application.sales import lock_sale
from sales.domain.amounts import AmountValidationError
from sales.domain.balances import compute_balance
from sales.domain.returns import (
    ReturnValidationError,
    allocate_return_cost,
    calculate_return_amounts,
    ensure_cumulative_amounts,
    ensure_return_quantity,
    receivable_after_returns,
)
from sales.models import Sale, SaleCostAllocation, SaleLine, SaleReturn, SaleReturnLine
from shared.command_values import canonical_fingerprint

RETURN_ACTION = "sale.return"
RETURN_FIELDS = frozenset(
    {"idempotency_key", "operation_id", "reason", "lines", "review_token", "entity_type"}
)
LINE_FIELDS = frozenset({"sale_line_id", "fit_quantity", "unfit_quantity"})
MAX_LINES = 200
REASON_MAX = 500


@dataclass(frozen=True)
class ReturnRequest:
    sale_line_id: int
    fit: Decimal
    unfit: Decimal


@dataclass(frozen=True)
class LinePlan:
    line: SaleLine
    request: ReturnRequest
    previously_returned: Decimal
    total: Decimal
    base: Decimal
    tax: Decimal
    fit_value: Decimal
    unfit_value: Decimal


def _whole(value: Any, field: str) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, int | str):
        raise field_error("validation_error", field, "Indique una cantidad entera.")
    try:
        number = Decimal(str(value).strip())
    except ArithmeticError:
        raise field_error("validation_error", field, "Indique una cantidad entera.") from None
    if not number.is_finite() or number != number.to_integral_value() or number < 0:
        raise field_error("validation_error", field, "La cantidad debe ser un entero no negativo.")
    return Decimal(int(number))


def parse_lines(raw: Any) -> list[ReturnRequest]:
    """Agrupa entradas repetidas de una línea antes de validar el límite acumulado."""
    if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_LINES:
        raise field_error("validation_error", "lines", "Indique al menos una línea a devolver.")
    grouped: dict[int, list[Decimal]] = {}
    for index, item in enumerate(raw):
        prefix = f"lines.{index}"
        if not isinstance(item, dict) or set(item) - LINE_FIELDS:
            raise field_error("validation_error", prefix, "La línea de devolución no es válida.")
        line_id = item.get("sale_line_id")
        if isinstance(line_id, bool) or not isinstance(line_id, int) or line_id < 1:
            raise field_error("validation_error", f"{prefix}.sale_line_id", "Indique la línea.")
        for name in ("fit_quantity", "unfit_quantity"):
            if name not in item:
                raise field_error(
                    "validation_error",
                    f"{prefix}.{name}",
                    "Clasifique la aptitud para reventa de las cantidades devueltas.",
                )
        fit = _whole(item["fit_quantity"], f"{prefix}.fit_quantity")
        unfit = _whole(item["unfit_quantity"], f"{prefix}.unfit_quantity")
        if fit + unfit <= 0:
            raise field_error(
                "validation_error", f"{prefix}.fit_quantity", "Devuelva al menos una unidad."
            )
        totals = grouped.setdefault(line_id, [Decimal(0), Decimal(0)])
        totals[0] += fit
        totals[1] += unfit
    return [ReturnRequest(line_id, fit, unfit) for line_id, (fit, unfit) in grouped.items()]


def _reason(payload: dict[str, Any]) -> str:
    reason = payload.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise field_error("validation_error", "reason", "El motivo es obligatorio.")
    if len(reason.strip()) > REASON_MAX:
        raise field_error(
            "validation_error", "reason", f"El motivo no puede exceder {REASON_MAX} caracteres."
        )
    return reason.strip()


def _returned_so_far(line: SaleLine) -> Decimal:
    totals = SaleReturnLine.objects.filter(sale_line=line).aggregate(
        fit=Sum("fit_quantity"), unfit=Sum("unfit_quantity")
    )
    return (totals["fit"] or Decimal(0)) + (totals["unfit"] or Decimal(0))


def build_plan(sale: Sale, requests: list[ReturnRequest]) -> list[LinePlan]:
    """Importes y costos históricos de cada línea; rechaza todo lo que exceda lo vendido."""
    if sale.state == "DRAFT":
        raise SalesApplicationError(
            "invalid_state", "Una venta en borrador no admite devoluciones."
        )
    if sale.state == "VOIDED":
        raise SalesApplicationError("invalid_state", "Una venta anulada no admite devoluciones.")
    lines = {line.pk: line for line in sale.lines.all()}
    plans: list[LinePlan] = []
    for index, request in enumerate(requests):
        line = lines.get(request.sale_line_id)
        if line is None:
            raise field_error(
                "validation_error",
                f"lines.{index}.sale_line_id",
                "La línea no pertenece a esta venta.",
            )
        previous = _returned_so_far(line)
        quantity = request.fit + request.unfit
        try:
            ensure_return_quantity(line.quantity, previous, quantity)
            assert line.unit_price is not None
            assert line.base_amount is not None
            amounts = calculate_return_amounts(
                line.unit_price, line.base_amount, line.quantity, previous, quantity
            )
            original_value = SaleCostAllocation.objects.filter(sale_line=line).aggregate(
                value=Sum("applied_value")
            )["value"] or Decimal("0.000000")
            cost = allocate_return_cost(
                original_value, line.quantity, previous, request.fit, request.unfit
            )
        except (ReturnValidationError, AmountValidationError) as error:
            raise SalesApplicationError(
                "validation_error",
                next(iter(error.errors.values()))[0],
                {f"lines.{index}.quantity": next(iter(error.errors.values()))},
            ) from None
        plans.append(
            LinePlan(
                line,
                request,
                previous,
                amounts.total,
                amounts.base,
                amounts.tax,
                cost.fit_value,
                cost.unfit_value,
            )
        )
    _check_receivable(sale, plans)
    return plans


def _check_receivable(sale: Sale, plans: list[LinePlan]) -> None:
    prior = SaleReturn.objects.filter(sale=sale).aggregate(t=Sum("grand_total"))["t"] or Decimal(0)
    this = sum((p.total for p in plans), Decimal("0.00"))
    try:
        for plan in plans:
            assert plan.line.total_amount is not None
            assert plan.line.base_amount is not None
            ensure_cumulative_amounts(
                plan.line.total_amount,
                plan.line.base_amount,
                plan.total + plan.previously_returned * (plan.line.unit_price or 0),
                plan.base,
            )
        receivable_after_returns(sale.grand_total or Decimal(0), prior + this)
    except ReturnValidationError as error:
        raise SalesApplicationError(
            "validation_error", str(error), {"amount": next(iter(error.errors.values()))}
        ) from None


def _digest(
    sale: Sale, ledger: Ledger, operation_id: UUID, reason: str, plans: list[LinePlan]
) -> str:
    return canonical_fingerprint(
        {
            "sale_id": sale.pk,
            "version": sale.version,
            "operation_id": str(operation_id),
            "reason": reason,
            "lines": [
                [
                    p.line.pk,
                    f"{p.request.fit:.0f}",
                    f"{p.request.unfit:.0f}",
                    f"{p.previously_returned:.0f}",
                ]
                for p in sorted(plans, key=lambda p: p.line.pk)
            ],
            "exigible": str(ledger.exigible),
            "paid": str(ledger.paid),
            "refunded": str(ledger.refunded),
            "fit_values": [
                [p.line.pk, str(p.fit_value), str(p.unfit_value)]
                for p in sorted(plans, key=lambda p: p.line.pk)
            ],
        }
    )


def _effects(sale: Sale, ledger: Ledger, plans: list[LinePlan]) -> dict[str, Any]:
    this = sum((p.total for p in plans), Decimal("0.00"))
    after = compute_balance(ledger.exigible - this, ledger.paid, ledger.refunded)
    return {
        "return_total": f"{this:.2f}",
        "exigible_after": f"{ledger.exigible - this:.2f}",
        "balance_after": f"{after.balance:.2f}",
        "refund_due_after": f"{after.excess:.2f}",
        "lines": [
            {
                "sale_line_id": p.line.pk,
                "position": p.line.position,
                "fit_quantity": f"{p.request.fit:.0f}",
                "unfit_quantity": f"{p.request.unfit:.0f}",
                "still_returnable": f"{p.line.quantity - p.previously_returned - p.request.fit - p.request.unfit:.0f}",  # noqa: E501
                "base_amount": f"{p.base:.2f}",
                "tax_amount": f"{p.tax:.2f}",
                "total_amount": f"{p.total:.2f}",
            }
            for p in plans
        ],
        "restock_quantity": f"{sum((p.request.fit for p in plans), Decimal(0)):.0f}",
    }


def _check_scope(payload: dict[str, Any]) -> None:
    if payload.get("entity_type", "COMERCIAL") != "COMERCIAL":
        raise field_error(
            "validation_error", "entity_type", "Una venta comercial no admite origen artesanal."
        )


def preview_return(
    *, actor: User, sale_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> dict[str, Any]:
    require_permission(
        actor=actor,
        permission="ventas.devolver",
        request_id=request_id,
        denial_action="sales.return_reviewed",
        target_type="sale",
        target_id=str(sale_id),
    )
    reject_unknown_fields(payload, RETURN_FIELDS - {"review_token"})
    _check_scope(payload)
    operation_id = parse_operation_id(payload)
    reason = _reason(payload)
    requests = parse_lines(payload.get("lines"))
    sale = Sale.objects.filter(pk=sale_id).first()
    if sale is None:
        raise not_found()
    ledger = ledger_for(sale)
    result: dict[str, Any] = {
        "sale_id": sale.pk,
        "version": sale.version,
        "can_return": False,
        "issues": [],
        "review_token": None,
        "expires_in_seconds": reviews.REVIEW_MAX_AGE_SECONDS,
    }
    try:
        plans = build_plan(sale, requests)
    except SalesApplicationError as error:
        result["issues"] = [
            {"code": error.code, "field": field, "message": messages[0]}
            for field, messages in (error.errors or {"": [error.message]}).items()
        ]
        return result
    result.update(_effects(sale, ledger, plans))
    result["can_return"] = True
    result["review_token"] = reviews.issue_token(
        actor=actor,
        action=RETURN_ACTION,
        sale_id=sale.pk,
        version=sale.version,
        digest=_digest(sale, ledger, operation_id, reason, plans),
    )
    return result


def register_return(
    *, actor: User, sale_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Confirma la devolución; repetir el mismo ``operation_id`` no la duplica."""

    def work() -> CommandResult:
        reject_unknown_fields(payload, RETURN_FIELDS)
        _check_scope(payload)
        operation_id = parse_operation_id(payload)
        reason = _reason(payload)
        requests = parse_lines(payload.get("lines"))
        sale = lock_sale(sale_id)
        existing = SaleReturn.objects.filter(operation_id=operation_id).first()
        if existing is not None:
            stored = sorted(
                (line.sale_line_id, line.fit_quantity, line.unfit_quantity)
                for line in existing.lines.all()
            )
            asked = sorted((r.sale_line_id, r.fit, r.unfit) for r in requests)
            if existing.sale_id != sale.pk or stored != asked:
                raise SalesApplicationError(
                    "idempotency_conflict",
                    "Este identificador de operación ya se usó con otros datos.",
                )
            return CommandResult(200, "return", existing.pk)
        original_operation = (
            posting.lock_operation(sale.inventory_operation_id)
            if sale.inventory_operation_id
            else None
        )
        plans = build_plan(sale, requests)
        ledger = ledger_for(sale)
        reviewed = reviews.read_token(
            payload.get("review_token"),
            actor=actor,
            action=RETURN_ACTION,
            sale_id=sale.pk,
            version=None,
        )
        if reviewed != _digest(sale, ledger, operation_id, reason, plans):
            raise SalesApplicationError(
                "review_required", "La venta cambió desde la revisión. Revise nuevamente."
            )
        product_ids = {p.line.product_id for p in plans}
        try:
            products = lock_product_references(product_ids, require_active=False)
        except SaleProductReferenceError:
            raise SalesApplicationError(
                "inactive_reference", "Hay productos inexistentes en la venta original."
            ) from None
        fit_by_product: dict[int, tuple[Decimal, Decimal]] = defaultdict(
            lambda: (Decimal(0), Decimal(0))
        )
        for plan in plans:
            quantity, value = fit_by_product[plan.line.product_id]
            fit_by_product[plan.line.product_id] = (
                quantity + plan.request.fit,
                value + plan.fit_value,
            )
        entries = [
            posting.EntryLine(pid, quantity, value)
            for pid, (quantity, value) in sorted(fit_by_product.items())
            if quantity > 0
        ]
        now = timezone.now()
        sale_return = SaleReturn(
            operation_id=operation_id,
            sale=sale,
            reason=reason,
            effective_at=now,
            effective_date=reviews.today(),
            base_total=sum((p.base for p in plans), Decimal("0.00")),
            tax_total=sum((p.tax for p in plans), Decimal("0.00")),
            grand_total=sum((p.total for p in plans), Decimal("0.00")),
            created_by=actor,
        )
        sale_return.save()
        if entries and original_operation is not None:
            positions = posting.lock_positions(products, warehouse_id=sale.warehouse_id)
            inventory = posting.prepare_operation(
                kind="CUSTOMER_RETURN_IN",
                actor=actor,
                source_type="SALE_RETURN",
                source_id=sale_return.pk,
                entry_lines=entries,
                reason=reason,
                fingerprint=reviewed,
                corrects_operation_id=original_operation.pk,
            )
            posting.post_operation(inventory, positions, products)
        SaleReturnLine.objects.bulk_create(
            SaleReturnLine(
                sale_return=sale_return,
                sale_line=plan.line,
                fit_quantity=plan.request.fit,
                unfit_quantity=plan.request.unfit,
                base_amount=plan.base,
                tax_amount=plan.tax,
                total_amount=plan.total,
                fit_value=plan.fit_value,
                unfit_value=plan.unfit_value,
            )
            for plan in plans
        )
        sale.version += 1
        sale.save(update_fields=["version", "updated_at"])
        return CommandResult(201, "return", sale_return.pk, ("lines", "total"))

    return execute_write(
        actor=actor,
        permission="ventas.devolver",
        action="sales.return_registered",
        target_type="sale",
        target_id=str(sale_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=project,
    )


def return_history(*, actor: User, sale_id: int) -> list[dict[str, Any]]:
    from sales.application import queries

    require_permission(
        actor=actor,
        permission="ventas.ver",
        request_id=None,
        denial_action="sales.returns_viewed",
        target_type="sale",
        target_id=str(sale_id),
    )
    sale = Sale.objects.filter(pk=sale_id).first()
    if sale is None:
        raise not_found()
    return [
        queries.return_detail(r)
        for r in SaleReturn.objects.filter(sale=sale)
        .select_related("sale")
        .order_by("effective_at", "id")
    ]
