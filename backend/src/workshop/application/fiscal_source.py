"""Interfaz pública de solo lectura para una operación artesanal de servicios."""

from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from types import MappingProxyType
from typing import Any

from workshop.models import ArtisanPaymentPart, ServiceOperation


class FiscalSourceNotFoundError(Exception):
    pass


def _freeze(value: Any) -> Any:
    if isinstance(value, dict):
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    return value


def _collected_by_method(source_id: int) -> Mapping[str, Decimal]:
    """Suma por medio de los pagos vigentes: un original corregido no cuenta; su reemplazo sí."""
    totals: dict[str, Decimal] = {}
    parts = ArtisanPaymentPart.objects.filter(
        payment__service_operation_id=source_id, payment__correction__isnull=True
    ).values_list("method", "amount")
    for method, amount in parts:
        totals[method] = totals.get(method, Decimal("0")) + amount
    return MappingProxyType(dict(sorted(totals.items())))


@dataclass(frozen=True)
class ArtisanFiscalLine:
    position: int
    service_id: int
    description: str
    quantity: str
    tax_definition_id: int
    tax_snapshot: Mapping[str, Any]
    applied_price: str
    tax_rate: str
    base_amount: str
    tax_amount: str
    total_amount: str


@dataclass(frozen=True)
class ArtisanFiscalSource:
    source_id: int
    fiscal_entity_id: int
    customer_id: int
    order_id: int
    order_state: str
    order_version: int
    state: str
    version: int
    operational_date: Any
    internal_number: str
    condition: str
    customer_snapshot: Mapping[str, Any]
    vehicle_snapshot: Mapping[str, Any]
    issuer_snapshot: Mapping[str, Any]
    base_total: str
    tax_total: str
    grand_total: str
    lines: tuple[ArtisanFiscalLine, ...]
    replaces_id: int | None
    void_reason: str
    collected_by_method: Mapping[str, Decimal]


def _project(operation: ServiceOperation) -> ArtisanFiscalSource:
    lines = tuple(
        ArtisanFiscalLine(
            position=line.position,
            service_id=line.service_id,
            description=line.service_name,
            quantity=str(line.quantity),
            tax_definition_id=line.tax_definition_id,
            tax_snapshot=_freeze(line.tax_snapshot),
            applied_price=str(line.applied_price),
            tax_rate=str(line.tax_rate),
            base_amount=str(line.base_amount),
            tax_amount=str(line.tax_amount),
            total_amount=str(line.total_amount),
        )
        for line in operation.lines.order_by("position", "id")
    )
    return ArtisanFiscalSource(
        source_id=operation.pk,
        fiscal_entity_id=operation.fiscal_entity_id,
        customer_id=operation.customer_id,
        order_id=operation.order_id,
        order_state=operation.order.state,
        order_version=operation.order.version,
        state=operation.state,
        version=operation.version,
        operational_date=operation.operational_date,
        internal_number=operation.internal_number,
        condition=operation.condition,
        customer_snapshot=_freeze(operation.customer_snapshot),
        vehicle_snapshot=_freeze(operation.vehicle_snapshot),
        issuer_snapshot=_freeze(operation.fiscal_snapshot),
        base_total=str(operation.base_total),
        tax_total=str(operation.tax_total),
        grand_total=str(operation.grand_total),
        lines=lines,
        replaces_id=operation.replaces_id,
        void_reason=operation.void_reason,
        collected_by_method=_collected_by_method(operation.pk),
    )


def read_fiscal_source(operation_id: int) -> ArtisanFiscalSource:
    operation = ServiceOperation.objects.filter(pk=operation_id).first()
    if operation is None:
        raise FiscalSourceNotFoundError("Operación artesanal no encontrada.")
    return _project(operation)


def lock_fiscal_source(operation_id: int) -> ArtisanFiscalSource:
    """Bloquea la raíz artesanal; el llamador conserva la transacción exterior."""
    operation = (
        ServiceOperation.objects.select_for_update(of=("self",)).filter(pk=operation_id).first()
    )
    if operation is None:
        raise FiscalSourceNotFoundError("Operación artesanal no encontrada.")
    return _project(operation)
