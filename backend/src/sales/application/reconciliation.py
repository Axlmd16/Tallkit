"""Conciliación comercial de solo lectura: números, costos, cantidades, E/P/R y partes.

No corrige nada. Consulta inventario únicamente por su interfaz pública; inventario nunca
importa ventas.
"""

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal

from django.db.models import Sum

import inventory.application.queries as inventory_queries
from sales.application.ledger import ledger_for
from sales.application.reads import read_snapshot
from sales.models import (
    CommercialPayment,
    CommercialRefund,
    PaymentPart,
    RefundPart,
    Sale,
    SaleCostAllocation,
    SaleReturn,
    SaleReturnLine,
)


@dataclass(frozen=True)
class Difference:
    area: str
    detail: str
    sale_id: int | None = None

    def render(self) -> str:
        where = f" (venta {self.sale_id})" if self.sale_id else ""
        return f"[{self.area}]{where} {self.detail}"


def _numbers(sale: Sale) -> list[Difference]:
    found: list[Difference] = []
    if sale.state == "DRAFT":
        if sale.internal_number or sale.number_allocation_id or sale.inventory_operation_id:
            found.append(Difference("número", "un borrador tiene número u operación", sale.pk))
        return found
    series = (sale.fiscal_snapshot or {}).get("series_code")
    if not sale.internal_number or sale.number_allocation_id is None:
        found.append(Difference("número", "la venta confirmada no tiene número asignado", sale.pk))
    elif not series or not sale.internal_number.startswith(f"{series}-"):
        found.append(
            Difference("número", "el número no corresponde a la serie de su snapshot", sale.pk)
        )
    if not sale.fiscal_snapshot or not sale.customer_snapshot:
        found.append(Difference("configuración", "faltan snapshots históricos", sale.pk))
    elif (sale.fiscal_snapshot.get("entity") or {}).get("type") != "COMERCIAL":
        found.append(Difference("configuración", "la entidad no es la comercial", sale.pk))
    return found


def _costs(sale: Sale) -> list[Difference]:
    if sale.state == "DRAFT" or sale.inventory_operation_id is None:
        return []
    found: list[Difference] = []
    lines = list(sale.lines.all())
    by_product: dict[int, Decimal] = defaultdict(Decimal)
    for line in lines:
        by_product[line.product_id] += line.quantity
    effects = inventory_queries.operation_effects(sale.inventory_operation_id)
    if {e.product_id for e in effects} != set(by_product):
        found.append(Difference("movimientos", "los productos vendidos no coinciden", sale.pk))
    for effect in effects:
        allocations = SaleCostAllocation.objects.filter(movement_id=effect.movement_id)
        assigned = allocations.aggregate(v=Sum("applied_value"), q=Sum("quantity"))
        if (assigned["v"] or Decimal(0)) != effect.applied_value:
            found.append(
                Difference(
                    "asignaciones",
                    f"el valor asignado del movimiento {effect.movement_id} difiere del aplicado",
                    sale.pk,
                )
            )
        if (assigned["q"] or Decimal(0)) != effect.quantity_out:
            found.append(
                Difference(
                    "asignaciones", "las cantidades asignadas difieren del movimiento", sale.pk
                )
            )
    return found


def _returns(sale: Sale) -> list[Difference]:
    found: list[Difference] = []
    for line in sale.lines.all():
        totals = SaleReturnLine.objects.filter(sale_line=line).aggregate(
            fit=Sum("fit_quantity"), unfit=Sum("unfit_quantity")
        )
        returned = (totals["fit"] or Decimal(0)) + (totals["unfit"] or Decimal(0))
        if returned > line.quantity:
            found.append(
                Difference(
                    "devoluciones", f"la línea {line.position} devuelve más de lo vendido", sale.pk
                )
            )
    return found


def _money(sale: Sale) -> list[Difference]:
    found: list[Difference] = []
    ledger = ledger_for(sale)
    if sale.state == "DRAFT":
        if CommercialPayment.objects.filter(sale=sale).exists():
            found.append(Difference("pagos huérfanos", "un borrador tiene pagos", sale.pk))
        return found
    if ledger.exigible < 0:
        found.append(Difference("exigible", "el exigible derivado es negativo", sale.pk))
    if ledger.balance.applied < 0:
        found.append(Difference("aplicado", "el reembolsado supera lo pagado", sale.pk))
    if sale.state == "VOIDED" and ledger.balance.applied != 0:
        found.append(
            Difference("pagos huérfanos", "una venta anulada conserva dinero aplicado", sale.pk)
        )
    for payment in CommercialPayment.objects.filter(sale=sale):
        parts = PaymentPart.objects.filter(payment=payment).aggregate(t=Sum("amount"))["t"]
        if (parts or Decimal(0)) != payment.amount:
            found.append(Difference("partes", f"el pago {payment.pk} no suma sus partes", sale.pk))
    for refund in CommercialRefund.objects.filter(sale=sale):
        parts = RefundPart.objects.filter(refund=refund).aggregate(t=Sum("amount"))["t"]
        if (parts or Decimal(0)) != refund.amount:
            found.append(
                Difference("partes", f"el reembolso {refund.pk} no suma sus partes", sale.pk)
            )
    for sale_return in SaleReturn.objects.filter(sale=sale):
        refunded = CommercialRefund.objects.filter(sale_return=sale_return).aggregate(
            t=Sum("amount")
        )["t"] or Decimal(0)
        if refunded > sale_return.grand_total:
            found.append(
                Difference(
                    "reembolsos", f"la devolución {sale_return.pk} excede lo atribuible", sale.pk
                )
            )
    return found


def reconcile() -> list[Difference]:
    """Todas las diferencias encontradas; lista vacía significa conciliado."""
    differences: list[Difference] = []
    with read_snapshot():
        for sale in Sale.objects.order_by("pk").iterator():
            differences += _numbers(sale)
            differences += _costs(sale)
            differences += _returns(sale)
            differences += _money(sale)
    return differences
