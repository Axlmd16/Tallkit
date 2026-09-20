"""Servicio de resolución de configuración para la transacción del consumidor.

Este módulo implementa la función pública que los consumidores (ventas, ingresos,
operaciones artesanales) llaman para obtener la configuración fiscal aplicable y
registrar una copia histórica inmutable dentro de su propia transacción.

Trazabilidad: design decisión 5 (numeración y transacción del consumidor),
spec "Configuración obligatoria para operaciones dependientes", ADR-0004.

Contrato transaccional: la resolución confirmada (con ``consumer_type``/``consumer_id``)
exige una transacción exterior activa y bloquea, en este orden, entidad fiscal,
``TaxDefinition`` por ID ascendente y sus ``TaxPeriod`` por definición e ID. Sin consumidor
es una consulta previa sin bloqueos ni ``ConfigurationUse``. Devuelve snapshots inmutables.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Q

from workshop_configuration.models import (
    ConfigurationUse,
    FiscalEntity,
    TaxDefinition,
    TaxPeriod,
)


class ConfigurationResolutionError(Exception):
    pass


class MissingConfigurationError(ConfigurationResolutionError):
    pass


class AmbiguousConfigurationError(ConfigurationResolutionError):
    pass


@dataclass(frozen=True)
class EntitySnapshot:
    id: int
    entity_type: str
    ruc: str
    legal_name: str


@dataclass(frozen=True)
class ResolvedTax:
    code: str
    name: str
    definition_id: int
    period_id: int
    rate: Decimal
    starts_on: date
    ends_on: date | None


@dataclass(frozen=True)
class ConfigurationResolutionResult:
    entity: EntitySnapshot
    tax_periods: tuple[ResolvedTax, ...]


def resolve_configuration(
    *,
    entity_type: str,
    tax_codes: list[str],
    operation_date: date,
    consumer_type: str | None = None,
    consumer_id: str | None = None,
) -> ConfigurationResolutionResult:
    """Resuelve la entidad fiscal y una única vigencia por impuesto para la fecha.

    Con ``consumer_type`` y ``consumer_id`` guarda además un ``ConfigurationUse`` por
    impuesto en la transacción exterior del consumidor, que debe estar abierta. Sin ellos
    es una consulta previa: no bloquea ni escribe. El consumidor valida sus permisos.
    """
    confirmed = consumer_type is not None and consumer_id is not None
    if confirmed and not transaction.get_connection().in_atomic_block:
        raise RuntimeError("La resolución confirmada requiere una transacción exterior activa.")

    entities = FiscalEntity.objects.filter(entity_type=entity_type)
    entity = (entities.select_for_update() if confirmed else entities).first()
    if entity is None:
        raise MissingConfigurationError(f"No existe una entidad fiscal de tipo '{entity_type}'.")

    codes = sorted(set(tax_codes))
    definitions_qs = TaxDefinition.objects.filter(fiscal_entity=entity, code__in=codes).order_by(
        "pk"
    )
    definitions = list(definitions_qs.select_for_update() if confirmed else definitions_qs)
    by_code = {d.code: d for d in definitions}
    for code in codes:
        if code not in by_code:
            raise MissingConfigurationError(
                f"No existe la definición de impuesto '{code}' para la entidad '{entity_type}'."
            )

    periods_qs = (
        TaxPeriod.objects.filter(tax_definition__in=definitions, starts_on__lte=operation_date)
        .filter(Q(ends_on__isnull=True) | Q(ends_on__gte=operation_date))
        .order_by("tax_definition_id", "pk")
    )
    periods: dict[int, list[TaxPeriod]] = {d.pk: [] for d in definitions}
    for period in periods_qs.select_for_update() if confirmed else periods_qs:
        periods[period.tax_definition_id].append(period)

    resolved: list[ResolvedTax] = []
    for code in codes:
        definition = by_code[code]
        applicable = periods[definition.pk]
        if not applicable:
            raise MissingConfigurationError(
                f"No existe vigencia del impuesto '{code}' para la fecha {operation_date}."
            )
        if len(applicable) > 1:
            raise AmbiguousConfigurationError(
                f"Existe más de una vigencia del impuesto '{code}' para la fecha "
                f"{operation_date}; la configuración es ambigua."
            )
        period = applicable[0]
        resolved.append(
            ResolvedTax(
                code=code,
                name=definition.name,
                definition_id=definition.pk,
                period_id=period.pk,
                rate=period.rate,
                starts_on=period.starts_on,
                ends_on=period.ends_on,
            )
        )

    snapshot = EntitySnapshot(
        id=entity.pk,
        entity_type=entity.entity_type,
        ruc=entity.ruc,
        legal_name=entity.legal_name,
    )
    if consumer_type is not None and consumer_id is not None:
        for tax in resolved:
            ConfigurationUse.objects.create(
                tax_period_id=tax.period_id,
                consumer_type=consumer_type,
                consumer_id=consumer_id,
                operation_date=operation_date,
                entity_type_snapshot=snapshot.entity_type,
                ruc_snapshot=snapshot.ruc,
                legal_name_snapshot=snapshot.legal_name,
                tax_code_snapshot=tax.code,
                tax_name_snapshot=tax.name,
                rate_snapshot=tax.rate,
                period_start_snapshot=tax.starts_on,
                period_end_snapshot=tax.ends_on,
            )
    return ConfigurationResolutionResult(entity=snapshot, tax_periods=tuple(resolved))
