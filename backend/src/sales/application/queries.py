"""Proyecciones de lectura de ventas; los costos nunca forman parte de la proyección base."""

from decimal import Decimal
from typing import Any

from django.db.models import Sum

from catalog.application.sales_references import get_sale_product_references
from customer_registry.application.sales_references import get_customer_reference
from sales.application.ledger import ledger_for
from sales.models import (
    CommercialPayment,
    CommercialRefund,
    CommercialWithholding,
    Sale,
    SaleLine,
    SaleReturn,
    SaleReturnLine,
)


def money(value: Decimal | None) -> str | None:
    return None if value is None else f"{value:.2f}"


def quantity(value: Decimal) -> str:
    return f"{value:.0f}"


def _customer(sale: Sale) -> dict[str, Any]:
    snapshot = sale.customer_snapshot
    if snapshot is not None:
        return {k: v for k, v in snapshot.items() if k != "schema_version"}
    ref = get_customer_reference(sale.customer_id)
    if ref is None:
        return {"id": sale.customer_id}
    return {
        "id": ref.id,
        "name": ref.name,
        "identification_type": ref.identification_type,
        "identification": ref.identification,
        "phone": ref.phone,
        "email": ref.email,
        "address": ref.address,
        "is_active": ref.is_active,
    }


def customer_of(sale: Sale) -> dict[str, Any]:
    """Cliente histórico de la venta para listados de otros hechos comerciales."""
    return _customer(sale)


def returned_by_line(sale: Sale) -> dict[int, Decimal]:
    """Cantidad total devuelta (apta y no apta) por línea, en una sola consulta."""
    rows = (
        SaleReturnLine.objects.filter(sale_line__sale=sale)
        .order_by()
        .values("sale_line")
        .annotate(fit=Sum("fit_quantity"), unfit=Sum("unfit_quantity"))
    )
    return {row["sale_line"]: row["fit"] + row["unfit"] for row in rows}


def line_dict(
    line: SaleLine, products: dict[int, Any], returned: dict[int, Decimal] | None = None
) -> dict[str, Any]:
    snapshot = line.product_snapshot
    ref = products.get(line.product_id)
    result: dict[str, Any] = {
        "id": line.pk,
        "position": line.position,
        "product_id": line.product_id,
        "product_code": snapshot["code"] if snapshot else (ref.code if ref else None),
        "product_name": snapshot["name"] if snapshot else (ref.name if ref else None),
        "quantity": quantity(line.quantity),
    }
    if returned is not None:
        result["returned_quantity"] = quantity(returned.get(line.pk, Decimal(0)))
    if line.unit_price is not None:
        result.update(
            unit_price=money(line.unit_price),
            tax_rate=format(line.tax_rate.normalize(), "f") if line.tax_rate is not None else None,
            base_amount=money(line.base_amount),
            tax_amount=money(line.tax_amount),
            total_amount=money(line.total_amount),
        )
    return result


def sale_base(sale: Sale) -> dict[str, Any]:
    """Datos comunes de la venta sin líneas, pagos ni costos."""
    return {
        "id": sale.pk,
        "state": sale.state,
        "version": sale.version,
        "condition": sale.condition,
        "notes": sale.notes,
        "internal_number": sale.internal_number,
        "origin": {
            "type": sale.origin_type,
            "order_id": sale.origin_order_id,
            "order_number": sale.origin_reference or None,
        },
        "customer": _customer(sale),
        "operational_date": sale.operational_date.isoformat() if sale.operational_date else None,
        "base_total": money(sale.base_total),
        "tax_total": money(sale.tax_total),
        "grand_total": money(sale.grand_total),
        "created_at": sale.created_at.isoformat(),
        "confirmed_at": sale.confirmed_at.isoformat() if sale.confirmed_at else None,
        "voided_at": sale.voided_at.isoformat() if sale.voided_at else None,
        "void_reason": sale.void_reason,
        "fiscal_scope": "COMERCIAL",
    }


def money_summary(sale: Sale) -> dict[str, Any]:
    """Venta, pago, deuda y exceso como campos separados, siempre derivados."""
    ledger = ledger_for(sale)
    return {
        "exigible": money(ledger.exigible),
        "returned_total": money(ledger.returned),
        "paid_total": money(ledger.paid),
        "refunded_total": money(ledger.refunded),
        "applied": money(ledger.balance.applied),
        "balance": money(ledger.balance.balance),
        "refund_due": money(ledger.balance.excess),
        "withheld_total": money(ledger.withheld),
        "withheld_excess": money(ledger.balance.withheld_excess),
        "payment_state": ledger.balance.state.value if sale.state != "DRAFT" else None,
    }


def sale_detail(sale: Sale) -> dict[str, Any]:
    lines = list(sale.lines.order_by("position"))
    products = get_sale_product_references(line.product_id for line in lines)
    returned = returned_by_line(sale)
    return {
        **sale_base(sale),
        "lines": [line_dict(line, products, returned) for line in lines],
        "money": money_summary(sale),
    }


def withholding_summary(withholding: CommercialWithholding) -> dict[str, Any]:
    """Retención sin el resumen económico de la venta; se usa anidada y en listados."""
    voided = withholding.voided_at is not None
    return {
        "id": withholding.pk,
        "operation_id": str(withholding.operation_id),
        "sale_id": withholding.sale_id,
        "payment_id": withholding.payment_id,
        "amount": money(withholding.amount),
        "effective_at": withholding.effective_at.isoformat(),
        "effective_date": withholding.effective_date.isoformat(),
        "created_by": withholding.created_by_id,
        "state": "VOIDED" if voided else "ACTIVE",
        "void_reason": withholding.void_reason or None,
        "voided_at": withholding.voided_at.isoformat() if withholding.voided_at else None,
        "voucher_pending": not voided and withholding.voucher_number is None,
        "voucher_number": withholding.voucher_number,
        "voucher_date": (
            withholding.voucher_date.isoformat() if withholding.voucher_date else None
        ),
        "income_tax_amount": money(withholding.income_tax_amount),
        "vat_amount": money(withholding.vat_amount),
    }


def withholding_detail(withholding: CommercialWithholding) -> dict[str, Any]:
    return {**withholding_summary(withholding), "money": money_summary(withholding.sale)}


def payment_detail(payment: CommercialPayment) -> dict[str, Any]:
    correction = getattr(payment, "correction", None)
    withholding = CommercialWithholding.objects.filter(payment=payment).first()
    return {
        "id": payment.pk,
        "operation_id": str(payment.operation_id),
        "sale_id": payment.sale_id,
        "amount": money(payment.amount),
        "parts": [
            {"method": part.method, "amount": money(part.amount)}
            for part in payment.parts.order_by("method")
        ],
        "effective_at": payment.effective_at.isoformat(),
        "effective_date": payment.effective_date.isoformat(),
        "created_by": payment.created_by_id,
        "state": "CORRECTED" if correction is not None else "ACTIVE",
        "correction": None
        if correction is None
        else {
            "id": correction.pk,
            "operation_id": str(correction.operation_id),
            "reason": correction.reason,
            "replacement_payment_id": correction.replacement_payment_id,
        },
        "withholding": None if withholding is None else withholding_summary(withholding),
        "money": money_summary(payment.sale),
    }


def return_detail(sale_return: SaleReturn) -> dict[str, Any]:
    lines = list(sale_return.lines.select_related("sale_line").order_by("sale_line__position"))
    return {
        "id": sale_return.pk,
        "operation_id": str(sale_return.operation_id),
        "sale_id": sale_return.sale_id,
        "reason": sale_return.reason,
        "effective_at": sale_return.effective_at.isoformat(),
        "effective_date": sale_return.effective_date.isoformat(),
        "base_total": money(sale_return.base_total),
        "tax_total": money(sale_return.tax_total),
        "grand_total": money(sale_return.grand_total),
        "restocked": any(line.fit_quantity > 0 for line in lines),
        "lines": [
            {
                "sale_line_id": line.sale_line_id,
                "position": line.sale_line.position,
                "product_id": line.sale_line.product_id,
                "fit_quantity": quantity(line.fit_quantity),
                "unfit_quantity": quantity(line.unfit_quantity),
                "base_amount": money(line.base_amount),
                "tax_amount": money(line.tax_amount),
                "total_amount": money(line.total_amount),
            }
            for line in lines
        ],
        "money": money_summary(sale_return.sale),
    }


def refund_detail(refund: CommercialRefund) -> dict[str, Any]:
    return {
        "id": refund.pk,
        "operation_id": str(refund.operation_id),
        "sale_id": refund.sale_id,
        "origin": refund.origin,
        "sale_return_id": refund.sale_return_id,
        "amount": money(refund.amount),
        "reason": refund.reason,
        "parts": [
            {"method": part.method, "amount": money(part.amount)}
            for part in refund.parts.order_by("method")
        ],
        "effective_at": refund.effective_at.isoformat(),
        "effective_date": refund.effective_date.isoformat(),
        "created_by": refund.created_by_id,
        "money": money_summary(refund.sale),
    }
