"""Correspondencias declaradas; una tarifa oficial no acredita el beneficio del emisor."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from types import MappingProxyType

from django.db import transaction
from django.db.models import Q

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import FiscalEntity, FiscalTaxMapping, TaxDefinition

CATALOG_VERSION = "SRI-2.34-IVA-subset-v1"
CATALOG_SOURCE = "https://www.sri.gob.ec/facturacion-electronica"
# Subconjunto soportado, no catálogo tributario completo ni vigencia del beneficio.
IVA_CODES = MappingProxyType(
    {
        "0": (Decimal("0"), "ZERO"),
        "2": (Decimal("12"), "RATE"),
        "3": (Decimal("14"), "RATE"),
        "4": (Decimal("15"), "RATE"),
        "6": (Decimal("0"), "NOT_SUBJECT"),
        "7": (Decimal("0"), "EXEMPT"),
    }
)


@dataclass(frozen=True)
class ResolvedFiscalTax:
    mapping_id: int
    catalog_version: str
    catalog_source: str
    tax_code: str
    percentage_code: str
    rate: Decimal
    treatment: str
    source: str
    starts_on: date
    ends_on: date | None


def create_mapping(
    *,
    actor: User,
    definition_id: int,
    percentage_code: str,
    starts_on: date,
    ends_on: date | None,
    source: str,
) -> FiscalTaxMapping:
    require_permission(actor=actor, permission="parametros.gestionar")
    if not isinstance(percentage_code, str) or percentage_code not in IVA_CODES:
        raise ConfigurationValidationError("Código tributario no soportado.")
    if type(starts_on) is not date or (ends_on is not None and type(ends_on) is not date):
        raise ConfigurationValidationError("Fechas de vigencia inválidas.")
    if ends_on is not None and ends_on < starts_on:
        raise ConfigurationValidationError("El fin de vigencia precede al inicio.")
    if not isinstance(source, str) or not 1 <= len(source.strip()) <= 500:
        raise ConfigurationValidationError("Debe documentar el fundamento de la correspondencia.")
    with transaction.atomic():
        ref = TaxDefinition.objects.filter(pk=definition_id).values("fiscal_entity_id").first()
        if ref is None:
            raise ConfigurationValidationError("Definición tributaria no encontrada.")
        FiscalEntity.objects.select_for_update().get(pk=ref["fiscal_entity_id"])
        definition = TaxDefinition.objects.select_for_update().get(pk=definition_id)
        periods = definition.periods.filter(Q(ends_on__isnull=True) | Q(ends_on__gte=starts_on))
        if ends_on is not None:
            periods = periods.filter(starts_on__lte=ends_on)
        if periods.exclude(rate=IVA_CODES[percentage_code][0]).exists():
            raise ConfigurationValidationError(
                "El código contradice una tarifa interna vigente en el intervalo."
            )
        overlapping = FiscalTaxMapping.objects.filter(tax_definition=definition).filter(
            Q(ends_on__isnull=True) | Q(ends_on__gte=starts_on)
        )
        if ends_on is not None:
            overlapping = overlapping.filter(starts_on__lte=ends_on)
        if overlapping.exists():
            raise ConfigurationValidationError("La correspondencia solapa una vigencia existente.")
        result = FiscalTaxMapping.objects.create(
            tax_definition=definition,
            catalog_version=CATALOG_VERSION,
            percentage_code=percentage_code,
            starts_on=starts_on,
            ends_on=ends_on,
            source=source.strip(),
            created_by=actor,
        )
        record_audit_event(
            actor=actor,
            action="fiscal.tax_mapping_created",
            target_type="fiscal_tax_mapping",
            target_id=str(result.pk),
            result=AuditResult.SUCCESS,
            metadata={"definition_id": definition.pk, "catalog_version": CATALOG_VERSION},
        )
        return result


def resolve_mapping(*, definition_id: int, on: date, historical_rate: Decimal) -> ResolvedFiscalTax:
    """Lectura interna: el consumidor autoriza y serializa sobre entidad/definición."""
    matches = list(
        FiscalTaxMapping.objects.filter(tax_definition_id=definition_id, starts_on__lte=on).filter(
            Q(ends_on__isnull=True) | Q(ends_on__gte=on)
        )
    )
    if len(matches) != 1:
        raise ConfigurationValidationError("Falta una correspondencia única para la fecha.")
    mapping = matches[0]
    if mapping.catalog_version != CATALOG_VERSION or mapping.percentage_code not in IVA_CODES:
        raise ConfigurationValidationError("Versión o código de catálogo no soportados.")
    rate, treatment = IVA_CODES[mapping.percentage_code]
    if (
        not isinstance(historical_rate, Decimal)
        or not historical_rate.is_finite()
        or historical_rate != rate
    ):
        raise ConfigurationValidationError(
            "La correspondencia no coincide con la tarifa histórica."
        )
    return ResolvedFiscalTax(
        mapping.pk,
        mapping.catalog_version,
        CATALOG_SOURCE,
        "2",
        mapping.percentage_code,
        rate,
        treatment,
        mapping.source,
        mapping.starts_on,
        mapping.ends_on,
    )
