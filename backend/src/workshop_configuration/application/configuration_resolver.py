"""Servicio de resolución de configuración para la transacción del consumidor.

Este módulo implementa la función pública que los consumidores (ventas, ingresos,
operaciones artesanales) llaman para obtener la configuración fiscal aplicable y
registrar una copia histórica inmutable dentro de su propia transacción.

Trazabilidad: design decisión 5 (numeración y transacción del consumidor),
spec "Configuración obligatoria para operaciones dependientes".
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from django.db import transaction

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
class ConfigurationResolutionResult:
    entity: FiscalEntity
    tax_periods: list[dict[str, Any]] = field(default_factory=list)


def resolve_configuration(
    *,
    entity_type: str,
    tax_codes: list[str],
    operation_date: date,
    consumer_type: str | None = None,
    consumer_id: str | None = None,
) -> ConfigurationResolutionResult:
    """Resuelve la entidad fiscal y los períodos tributarios para una operación.

    Reglas (design decisiones 4 y 5):
    - Si la entidad no existe: MissingConfigurationError antes de efectos.
    - Por cada código en tax_codes: debe existir exactamente una vigencia activa
      en operation_date; de lo contrario MissingConfigurationError o
      AmbiguousConfigurationError.
    - Si se proporcionan consumer_type y consumer_id: guarda una ConfigurationUse
      por cada código dentro de la misma transacción (el consumidor debe tener
      la transacción ya abierta o se abrirá aquí).
    - El orden de bloqueos: entidad (en orden de entity_type), impuestos (en orden
      de código), siguiendo el contrato del ADR.

    Este servicio NO asigna permisos propios al consumidor: el servicio del consumidor
    valida sus propios permisos antes de llamar a este.
    """
    with transaction.atomic():
        # Resolver entidad fiscal con bloqueo (orden: entity_type)
        entity = (
            FiscalEntity.objects.select_for_update()
            .filter(entity_type=entity_type)
            .first()
        )
        if entity is None:
            raise MissingConfigurationError(
                f"No existe una entidad fiscal de tipo '{entity_type}'."
            )

        # Resolver períodos en orden de código (orden de bloqueo consistente)
        tax_periods: list[dict[str, Any]] = []
        for code in sorted(tax_codes):
            tax_def = TaxDefinition.objects.filter(
                fiscal_entity=entity,
                code=code,
            ).first()
            if tax_def is None:
                raise MissingConfigurationError(
                    f"No existe la definición de impuesto '{code}' para la entidad "
                    f"'{entity_type}'."
                )

            # Buscar vigencia única para la fecha de operación
            matching_periods = list(
                TaxPeriod.objects.select_for_update()
                .filter(
                    tax_definition=tax_def,
                    starts_on__lte=operation_date,
                )
                .filter(
                    # ends_on es None (abierto) o >= operation_date
                    **{}
                )
                .order_by("starts_on")
            )
            # Filtrar los que también cumplen el ends_on
            applicable = [
                p
                for p in matching_periods
                if p.ends_on is None or p.ends_on >= operation_date
            ]

            if len(applicable) == 0:
                raise MissingConfigurationError(
                    f"No existe vigencia del impuesto '{code}' para la fecha "
                    f"{operation_date}."
                )
            if len(applicable) > 1:
                raise AmbiguousConfigurationError(
                    f"Existe más de una vigencia del impuesto '{code}' para la fecha "
                    f"{operation_date}; la configuración es ambigua."
                )

            tax_periods.append({"code": code, "tax_def": tax_def, "period": applicable[0]})

        # Guardar copia histórica si se proporcionan identificadores del consumidor
        if consumer_type is not None and consumer_id is not None:
            for tp in tax_periods:
                period: TaxPeriod = tp["period"]
                ConfigurationUse.objects.create(
                    tax_period=period,
                    consumer_type=consumer_type,
                    consumer_id=consumer_id,
                    operation_date=operation_date,
                    entity_type_snapshot=entity.entity_type,
                    ruc_snapshot=entity.ruc,
                    legal_name_snapshot=entity.legal_name,
                    tax_code_snapshot=tp["code"],
                    tax_name_snapshot=tp["tax_def"].name,
                    rate_snapshot=period.rate,
                    period_start_snapshot=period.starts_on,
                    period_end_snapshot=period.ends_on,
                )

        return ConfigurationResolutionResult(entity=entity, tax_periods=tax_periods)
