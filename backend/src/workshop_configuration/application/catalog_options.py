"""Consultas fiscales de solo lectura para los catálogos de productos y servicios.

No usa ``resolve_configuration`` ni ``allocate_number``: no crea ``ConfigurationUse``,
no toma bloqueos de numeración y no modifica configuración. Los servicios de catálogo
autorizan al actor antes de invocar estas funciones.
"""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from zoneinfo import ZoneInfo

from django.db.models import Prefetch, Q

from workshop_configuration.domain.validation import FiscalEntityType
from workshop_configuration.models import TaxDefinition, TaxPeriod

_TZ = ZoneInfo("America/Guayaquil")

TaxStatus = Literal["applicable", "missing", "ambiguous"]


@dataclass(frozen=True)
class CatalogTaxOption:
    id: int
    code: str
    name: str
    entity_type: str
    rate: Decimal | None
    tax_status: TaxStatus


@dataclass(frozen=True)
class CatalogTaxOptionsPage:
    items: tuple[CatalogTaxOption, ...]
    total_count: int
    page: int
    page_size: int


class CatalogTaxReferenceError(Exception):
    """La definición no existe o pertenece a otro ámbito fiscal."""

    def __init__(self, code: Literal["not_found", "invalid_tax_scope"]) -> None:
        super().__init__(code)
        self.code = code


def operation_date() -> date:
    return datetime.now(tz=_TZ).date()


def _covering_periods(on: date) -> "Prefetch[str]":
    return Prefetch(
        "periods",
        queryset=TaxPeriod.objects.filter(starts_on__lte=on).filter(
            Q(ends_on__isnull=True) | Q(ends_on__gte=on)
        ),
        to_attr="covering_periods",
    )


def _to_option(definition: TaxDefinition) -> CatalogTaxOption:
    periods = definition.covering_periods  # type: ignore[attr-defined]
    status: TaxStatus
    rate: Decimal | None = None
    if len(periods) == 1:
        status, rate = "applicable", periods[0].rate
    elif not periods:
        status = "missing"
    else:
        status = "ambiguous"
    return CatalogTaxOption(
        id=definition.pk,
        code=definition.code,
        name=definition.name,
        entity_type=definition.fiscal_entity.entity_type,
        rate=rate,
        tax_status=status,
    )


def list_catalog_tax_options(
    *,
    entity_type: FiscalEntityType | str,
    search: str = "",
    page: int = 1,
    page_size: int = 20,
    on: date | None = None,
) -> CatalogTaxOptionsPage:
    """Opciones de una sola entidad fiscal, con estado de vigencia a la fecha del servidor."""
    scope = FiscalEntityType(entity_type).value
    queryset = TaxDefinition.objects.filter(fiscal_entity__entity_type=scope)
    if search.strip():
        term = search.strip()
        queryset = queryset.filter(Q(code__icontains=term) | Q(name__icontains=term))
    queryset = queryset.order_by("code", "id")
    total = queryset.count()
    offset = (page - 1) * page_size
    page_qs = queryset.select_related("fiscal_entity").prefetch_related(
        _covering_periods(on or operation_date())
    )[offset : offset + page_size]
    return CatalogTaxOptionsPage(
        items=tuple(_to_option(d) for d in page_qs),
        total_count=total,
        page=page,
        page_size=page_size,
    )


def get_catalog_tax_option(
    tax_definition_id: int, *, on: date | None = None
) -> CatalogTaxOption | None:
    definition = (
        TaxDefinition.objects.select_related("fiscal_entity")
        .prefetch_related(_covering_periods(on or operation_date()))
        .filter(pk=tax_definition_id)
        .first()
    )
    return None if definition is None else _to_option(definition)


def validate_catalog_tax_reference(
    tax_definition_id: int, expected_entity_type: FiscalEntityType | str
) -> CatalogTaxOption:
    """Confirma existencia y ámbito; no exige vigencia hoy para guardar el catálogo."""
    option = get_catalog_tax_option(tax_definition_id)
    if option is None:
        raise CatalogTaxReferenceError("not_found")
    if option.entity_type != FiscalEntityType(expected_entity_type).value:
        raise CatalogTaxReferenceError("invalid_tax_scope")
    return option


def get_catalog_tax_options(
    tax_definition_ids: set[int], *, on: date | None = None
) -> dict[int, CatalogTaxOption]:
    """Proyecciones para varias definiciones con una consulta acotada (sin N+1)."""
    if not tax_definition_ids:
        return {}
    definitions = (
        TaxDefinition.objects.select_related("fiscal_entity")
        .prefetch_related(_covering_periods(on or operation_date()))
        .filter(pk__in=tax_definition_ids)
    )
    return {d.pk: _to_option(d) for d in definitions}
