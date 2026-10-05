"""Correspondencias declaradas; una tarifa oficial no acredita el beneficio del emisor."""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from workshop_configuration.application.official_catalog import is_current
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import (
    FiscalEntity,
    FiscalTaxMapping,
    OfficialCatalogEntry,
    TaxDefinition,
)


@dataclass(frozen=True)
class ResolvedFiscalTax:
    mapping_id: int
    catalog_entry_id: int
    display_name: str
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
    catalog_entry_id: int,
    starts_on: date,
    ends_on: date | None = None,
    source: str,
) -> FiscalTaxMapping:
    require_permission(actor=actor, permission="parametros.gestionar")
    catalog_entry = OfficialCatalogEntry.objects.filter(
        pk=catalog_entry_id, kind="TAX_RATE", is_active=True, is_selectable=True
    ).first()
    if catalog_entry is None or catalog_entry.rate is None:
        raise ConfigurationValidationError(
            "Seleccione una tarifa vigente del catálogo oficial del SRI."
        )
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
        if periods.exclude(rate=catalog_entry.rate).exists():
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
            catalog_version=catalog_entry.catalog_version,
            percentage_code=catalog_entry.code,
            catalog_entry=catalog_entry,
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
            metadata={
                "definition_id": definition.pk,
                "catalog_version": catalog_entry.catalog_version,
                "catalog_entry_id": catalog_entry.pk,
            },
        )
        return result


def schedule_mapping_successor(
    *,
    actor: User,
    mapping_id: int,
    catalog_entry_id: int,
    starts_on: date,
    source: str,
) -> FiscalTaxMapping:
    """Cierra la correspondencia abierta el día anterior y abre la sucesora, atómicamente.

    Es el equivalente fiscal de la sucesión prospectiva de tarifas: permite que el código del
    SRI cambie a futuro (por ejemplo de IVA 0 % a IVA 15 % al pasar de régimen) sin tocar lo ya
    preparado. El inicio debe ser estrictamente futuro en America/Guayaquil y la tarifa interna
    sucesora debe estar programada antes: el código nuevo no puede contradecirla.
    """
    require_permission(actor=actor, permission="parametros.gestionar")
    if type(starts_on) is not date or starts_on <= timezone.localdate():
        raise ConfigurationValidationError(
            "El cambio debe iniciar en una fecha futura.",
            errors={"starts_on": ["Elija una fecha posterior a hoy."]},
        )
    with transaction.atomic():
        ref = (
            FiscalTaxMapping.objects.filter(pk=mapping_id)
            .values("tax_definition__fiscal_entity_id")
            .first()
        )
        if ref is None:
            raise ConfigurationValidationError("Correspondencia no encontrada.")
        FiscalEntity.objects.select_for_update().get(pk=ref["tax_definition__fiscal_entity_id"])
        mapping = FiscalTaxMapping.objects.select_for_update().get(pk=mapping_id)
        if mapping.ends_on is not None:
            raise ConfigurationValidationError(
                "Solo se programa el cambio de la correspondencia abierta."
            )
        if starts_on <= mapping.starts_on:
            raise ConfigurationValidationError(
                "El cambio debe iniciar después de la correspondencia vigente.",
                errors={"starts_on": ["Elija una fecha posterior al inicio vigente."]},
            )
        mapping.ends_on = starts_on - timedelta(days=1)
        mapping.save(update_fields=["ends_on"])
        successor = create_mapping(
            actor=actor,
            definition_id=mapping.tax_definition_id,
            catalog_entry_id=catalog_entry_id,
            starts_on=starts_on,
            ends_on=None,
            source=source,
        )
        record_audit_event(
            actor=actor,
            action="fiscal.tax_mapping_succession",
            target_type="fiscal_tax_mapping",
            target_id=str(successor.pk),
            result=AuditResult.SUCCESS,
            metadata={"predecessor_id": mapping.pk, "starts_on": starts_on.isoformat()},
        )
        return successor


def list_mappings(*, actor: User, entity_id: int) -> tuple[FiscalTaxMapping, ...]:
    """Correspondencias vigentes e históricas de la entidad, con su entrada oficial."""
    require_permission(actor=actor, permission="parametros.gestionar")
    if not FiscalEntity.objects.filter(pk=entity_id).exists():
        raise ConfigurationValidationError("Entidad fiscal no encontrada.")
    return tuple(
        FiscalTaxMapping.objects.filter(tax_definition__fiscal_entity_id=entity_id)
        .select_related("catalog_entry", "tax_definition")
        .order_by("tax_definition_id", "-starts_on", "-id")
    )


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
    catalog_entry = (
        OfficialCatalogEntry.objects.filter(pk=mapping.catalog_entry_id, kind="TAX_RATE").first()
        if mapping.catalog_entry_id is not None
        else None
    )
    if catalog_entry is None or catalog_entry.rate is None or catalog_entry.treatment is None:
        raise ConfigurationValidationError("La correspondencia no tiene una entrada del catálogo.")
    if not is_current(catalog_entry, on):
        raise ConfigurationValidationError(
            "La entrada del catálogo oficial está inactiva o fuera de vigencia."
        )
    rate = catalog_entry.rate
    if (
        not isinstance(historical_rate, Decimal)
        or not historical_rate.is_finite()
        or historical_rate != rate
    ):
        raise ConfigurationValidationError(
            "La correspondencia no coincide con la tarifa histórica."
        )
    return ResolvedFiscalTax(
        mapping_id=mapping.pk,
        catalog_entry_id=catalog_entry.pk,
        display_name=catalog_entry.display_name,
        catalog_version=catalog_entry.catalog_version,
        catalog_source=catalog_entry.source_url,
        tax_code=catalog_entry.tax_code or "",
        percentage_code=catalog_entry.code,
        rate=rate,
        treatment=catalog_entry.treatment,
        source=mapping.source,
        starts_on=mapping.starts_on,
        ends_on=mapping.ends_on,
    )
