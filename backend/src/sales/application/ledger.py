"""Saldo, exceso y estado de pago derivados de hechos registrados; nada se almacena.

E (exigible) es el total histórico menos las devoluciones válidas, o cero si la venta está
anulada. P son los pagos no corregidos, R los reembolsos efectivos y W las retenciones
recibidas vigentes, que reducen el saldo sin ser dinero. Cada agregado usa su propia
consulta para no multiplicar filas por joins entre líneas, pagos y partes.
"""

from dataclasses import dataclass
from decimal import Decimal

from django.db.models import Sum

from sales.domain.balances import BalanceResult, compute_balance
from sales.models import (
    CommercialPayment,
    CommercialRefund,
    CommercialWithholding,
    PaymentPart,
    Sale,
    SaleReturn,
)

ZERO = Decimal("0.00")


@dataclass(frozen=True)
class Ledger:
    exigible: Decimal
    returned: Decimal
    paid: Decimal
    refunded: Decimal
    balance: BalanceResult
    # Retenciones recibidas vigentes; nunca se suman al dinero cobrado.
    withheld: Decimal = ZERO


def _sum(queryset, field: str = "amount") -> Decimal:  # type: ignore[no-untyped-def]
    return queryset.aggregate(total=Sum(field))["total"] or ZERO


def paid_total(sale: Sale) -> Decimal:
    return _sum(CommercialPayment.objects.filter(sale=sale, correction__isnull=True))


def refunded_total(sale: Sale) -> Decimal:
    return _sum(CommercialRefund.objects.filter(sale=sale))


def withheld_total(sale: Sale) -> Decimal:
    return _sum(CommercialWithholding.objects.filter(sale=sale, voided_at__isnull=True))


def returned_total(sale: Sale) -> Decimal:
    return _sum(SaleReturn.objects.filter(sale=sale), "grand_total")


def ledger_for(sale: Sale) -> Ledger:
    """Estado económico vigente de una venta confirmada o anulada; borrador sin deuda."""
    if sale.state == "CONFIRMED":
        returned = returned_total(sale)
        exigible = (sale.grand_total or ZERO) - returned
    else:
        returned = returned_total(sale)
        exigible = ZERO
    paid = paid_total(sale)
    refunded = refunded_total(sale)
    withheld = withheld_total(sale)
    return Ledger(
        exigible,
        returned,
        paid,
        refunded,
        compute_balance(exigible, paid, refunded, withheld),
        withheld,
    )


def method_totals(sale: Sale) -> dict[str, Decimal]:
    """Importe neto por medio de los pagos vigentes."""
    rows = (
        PaymentPart.objects.filter(payment__sale=sale, payment__correction__isnull=True)
        .values("method")
        .annotate(total=Sum("amount"))
    )
    return {row["method"]: row["total"] for row in rows}
