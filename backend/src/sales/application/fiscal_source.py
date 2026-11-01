"""Interfaz pública de solo lectura para preparar una venta confirmada."""

from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from types import MappingProxyType
from typing import Any

from sales.application.ledger import ledger_for
from sales.models import PaymentPart, Sale, SaleVoid


class FiscalSourceNotFoundError(Exception):
    pass


def _freeze(value: Any) -> Any:
    if isinstance(value, dict):
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    return value


def _decimal(value: Any) -> str | None:
    return None if value is None else str(value)


def _quantity(value: Any) -> str:
    return format(value.normalize(), "f")


def _collected_by_method(source_id: int) -> Mapping[str, Decimal]:
    """Suma por medio de los pagos vigentes: un original corregido no cuenta; su reemplazo sí."""
    totals: dict[str, Decimal] = {}
    parts = PaymentPart.objects.filter(
        payment__sale_id=source_id, payment__correction__isnull=True
    ).values_list("method", "amount")
    for method, amount in parts:
        totals[method] = totals.get(method, Decimal("0")) + amount
    return MappingProxyType(dict(sorted(totals.items())))


@dataclass(frozen=True)
class CommercialFiscalLine:
    position: int
    product_id: int
    tax_definition_id: int | None
    quantity: str
    product_snapshot: Mapping[str, Any]
    tax_snapshot: Mapping[str, Any]
    unit_price: str | None
    tax_rate: str | None
    base_amount: str | None
    tax_amount: str | None
    total_amount: str | None


@dataclass(frozen=True)
class CommercialFiscalSource:
    source_id: int
    fiscal_entity_id: int
    customer_id: int
    state: str
    version: int
    operational_date: Any
    internal_number: str | None
    condition: str
    customer_snapshot: Mapping[str, Any]
    issuer_snapshot: Mapping[str, Any]
    base_total: str | None
    tax_total: str | None
    grand_total: str | None
    lines: tuple[CommercialFiscalLine, ...]
    return_ids: tuple[int, ...]
    has_void: bool
    collected_by_method: Mapping[str, Decimal]
    # Saldo que sigue pendiente de cobro: descuenta cobros, devoluciones y retenciones recibidas.
    pending_balance: str


def _project(sale: Sale) -> CommercialFiscalSource:
    lines = tuple(
        CommercialFiscalLine(
            position=line.position,
            product_id=line.product_id,
            tax_definition_id=line.tax_definition_id,
            quantity=_quantity(line.quantity),
            product_snapshot=_freeze(line.product_snapshot or {}),
            tax_snapshot=_freeze(line.tax_snapshot or {}),
            unit_price=_decimal(line.unit_price),
            tax_rate=_decimal(line.tax_rate),
            base_amount=_decimal(line.base_amount),
            tax_amount=_decimal(line.tax_amount),
            total_amount=_decimal(line.total_amount),
        )
        for line in sale.lines.order_by("position", "id")
    )
    return CommercialFiscalSource(
        source_id=sale.pk,
        fiscal_entity_id=sale.fiscal_entity_id,
        customer_id=sale.customer_id,
        state=sale.state,
        version=sale.version,
        operational_date=sale.operational_date,
        internal_number=sale.internal_number,
        condition=sale.condition,
        customer_snapshot=_freeze(sale.customer_snapshot or {}),
        issuer_snapshot=_freeze(sale.fiscal_snapshot or {}),
        base_total=_decimal(sale.base_total),
        tax_total=_decimal(sale.tax_total),
        grand_total=_decimal(sale.grand_total),
        lines=lines,
        return_ids=tuple(sale.returns.order_by("id").values_list("id", flat=True)),
        has_void=SaleVoid.objects.filter(sale_id=sale.pk).exists(),
        collected_by_method=_collected_by_method(sale.pk),
        pending_balance=format(ledger_for(sale).balance.balance.quantize(Decimal("0.01")), "f"),
    )


def read_fiscal_source(sale_id: int) -> CommercialFiscalSource:
    sale = Sale.objects.filter(pk=sale_id).first()
    if sale is None:
        raise FiscalSourceNotFoundError("Venta no encontrada.")
    return _project(sale)


def lock_fiscal_source(sale_id: int) -> CommercialFiscalSource:
    """Bloquea la raíz venta; el llamador conserva la transacción exterior."""
    sale = Sale.objects.select_for_update(of=("self",)).filter(pk=sale_id).first()
    if sale is None:
        raise FiscalSourceNotFoundError("Venta no encontrada.")
    return _project(sale)
