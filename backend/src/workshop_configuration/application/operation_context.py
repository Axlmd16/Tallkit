"""Contexto de configuración para operaciones de compra e inventario.

Publica dos variantes:

- consulta de revisión (``get_operation_context`` y ``review_tax_options``): solo lectura,
  sin bloqueos ni ``ConfigurationUse``, para editar borradores y revisar;
- variante bloqueante (``lock_operation_context``): exige transacción exterior y bloquea
  entidad, bodega, definiciones tributarias por ID y sus vigencias, devolviendo snapshots
  inmutables. Nunca consume numeración ni escribe usos de configuración; el consumidor lo
  hace después, dentro de su transacción.

Los DTO de bloqueo son internos al proceso y jamás provienen del cliente HTTP.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

from django.db import transaction
from django.db.models import Q

from workshop_configuration.application.catalog_options import (
    CatalogTaxOptionsPage,
    get_catalog_tax_options,
    list_catalog_tax_options,
)
from workshop_configuration.models import FiscalEntity, TaxDefinition, TaxPeriod, Warehouse

COMMERCIAL = "COMERCIAL"

ErrorCode = Literal[
    "missing_entity",
    "missing_warehouse",
    "missing_tax",
    "invalid_tax_scope",
    "missing_rate",
    "ambiguous_rate",
]
ReviewStatus = Literal["applicable", "missing", "ambiguous", "invalid_scope"]


class OperationContextError(Exception):
    def __init__(self, code: ErrorCode, detail: str = "", definition_id: int | None = None) -> None:
        super().__init__(detail or code)
        self.code = code
        self.detail = detail
        self.definition_id = definition_id


@dataclass(frozen=True)
class OperationContext:
    entity_id: int
    entity_type: str
    ruc: str
    legal_name: str
    warehouse_id: int
    warehouse_name: str


@dataclass(frozen=True)
class TaxReview:
    definition_id: int
    code: str
    name: str
    rate: Decimal | None
    status: ReviewStatus


@dataclass(frozen=True)
class TaxSnapshot:
    definition_id: int
    code: str
    name: str
    period_id: int
    rate: Decimal
    starts_on: date
    ends_on: date | None


@dataclass(frozen=True)
class LockedOperationContext:
    context: OperationContext
    taxes: dict[int, TaxSnapshot]


def _context(entity: FiscalEntity, warehouse: Warehouse) -> OperationContext:
    return OperationContext(
        entity_id=entity.pk,
        entity_type=entity.entity_type,
        ruc=entity.ruc,
        legal_name=entity.legal_name,
        warehouse_id=warehouse.pk,
        warehouse_name=warehouse.name,
    )


def get_operation_context() -> OperationContext:
    """Entidad comercial y bodega única, sin bloqueos."""
    entity = FiscalEntity.objects.filter(entity_type=COMMERCIAL).first()
    if entity is None:
        raise OperationContextError("missing_entity", "No existe la entidad fiscal comercial.")
    warehouse = Warehouse.objects.order_by("pk").first()
    if warehouse is None:
        raise OperationContextError("missing_warehouse", "No existe la bodega configurada.")
    return _context(entity, warehouse)


def review_tax_options(tax_definition_ids: Iterable[int], *, on: date) -> dict[int, TaxReview]:
    """Estado de vigencia por definición para la fecha documental; sin efectos."""
    options = get_catalog_tax_options(set(tax_definition_ids), on=on)
    review: dict[int, TaxReview] = {}
    for pk, option in options.items():
        status: ReviewStatus = (
            "invalid_scope" if option.entity_type != COMMERCIAL else option.tax_status
        )
        rate = option.rate if status == "applicable" else None
        review[pk] = TaxReview(pk, option.code, option.name, rate, status)
    return review


def lock_operation_context(
    *, tax_definition_ids: Iterable[int], on: date
) -> LockedOperationContext:
    """Bloquea y resuelve el contexto para confirmar; requiere transacción exterior."""
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("El contexto de operación requiere una transacción atómica.")
    entity = FiscalEntity.objects.select_for_update().filter(entity_type=COMMERCIAL).first()
    if entity is None:
        raise OperationContextError("missing_entity", "No existe la entidad fiscal comercial.")
    warehouse = Warehouse.objects.select_for_update().order_by("pk").first()
    if warehouse is None:
        raise OperationContextError("missing_warehouse", "No existe la bodega configurada.")

    _, taxes = _lock_taxes(
        COMMERCIAL,
        tax_definition_ids=tax_definition_ids,
        on=on,
        locked_entity=entity,
    )
    return LockedOperationContext(context=_context(entity, warehouse), taxes=taxes)


def _lock_taxes(
    entity_type: str,
    *,
    tax_definition_ids: Iterable[int],
    on: date,
    locked_entity: FiscalEntity | None = None,
) -> tuple[FiscalEntity, dict[int, TaxSnapshot]]:
    """Bloquea una entidad fiscal y resuelve sus tarifas vigentes.

    ``locked_entity`` permite que el contexto comercial preserve su orden histórico de
    bloqueos (entidad, bodega, impuestos). Los consumidores sin bodega dejan que este
    helper adquiera el bloqueo de la entidad.
    """
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("El contexto de operación requiere una transacción atómica.")
    entity = locked_entity
    if entity is None:
        entity = FiscalEntity.objects.select_for_update().filter(entity_type=entity_type).first()
    if entity is None:
        label = "comercial" if entity_type == COMMERCIAL else "artesanal"
        raise OperationContextError(
            "missing_entity",
            f"No existe la entidad fiscal {label}.",
        )

    requested = sorted(set(tax_definition_ids))
    definitions = {
        d.pk: d
        for d in TaxDefinition.objects.select_for_update()
        .select_related("fiscal_entity")
        .filter(pk__in=requested)
        .order_by("pk")
    }
    periods_by_definition: dict[int, list[TaxPeriod]] = {pk: [] for pk in definitions}
    covering = (
        TaxPeriod.objects.select_for_update()
        .filter(tax_definition_id__in=definitions, starts_on__lte=on)
        .filter(Q(ends_on__isnull=True) | Q(ends_on__gte=on))
        .order_by("tax_definition_id", "pk")
    )
    for period in covering:
        periods_by_definition[period.tax_definition_id].append(period)

    taxes: dict[int, TaxSnapshot] = {}
    for pk in requested:
        definition = definitions.get(pk)
        if definition is None:
            raise OperationContextError(
                "missing_tax", f"La definición tributaria {pk} no existe.", pk
            )
        if definition.fiscal_entity.entity_type != entity_type:
            label = "comercial" if entity_type == COMMERCIAL else "artesanal"
            raise OperationContextError(
                "invalid_tax_scope",
                f"La definición {definition.code} no es {label}.",
                pk,
            )
        periods = periods_by_definition[pk]
        if not periods:
            raise OperationContextError(
                "missing_rate", f"El impuesto {definition.code} no tiene vigencia el {on}.", pk
            )
        if len(periods) > 1:
            raise OperationContextError(
                "ambiguous_rate",
                f"El impuesto {definition.code} tiene varias vigencias el {on}.",
                pk,
            )
        period = periods[0]
        taxes[pk] = TaxSnapshot(
            definition_id=pk,
            code=definition.code,
            name=definition.name,
            period_id=period.pk,
            rate=period.rate,
            starts_on=period.starts_on,
            ends_on=period.ends_on,
        )
    return entity, taxes


def list_commercial_tax_options(
    *, on: date, search: str = "", page: int = 1, page_size: int = 20
) -> CatalogTaxOptionsPage:
    """Definiciones del ámbito comercial con su estado de vigencia; el ámbito no es configurable."""
    return list_catalog_tax_options(
        entity_type=COMMERCIAL, search=search, page=page, page_size=page_size, on=on
    )
