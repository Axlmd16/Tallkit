"""Interfaz pública de configuración que consume el módulo de taller."""

import hashlib
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

from workshop_configuration.application.numbering import (
    AllocateNumberResult,
    NumberingError,
    allocate_number,
    get_numbering_scope_id,
)
from workshop_configuration.application.operation_context import (
    OperationContextError,
    TaxSnapshot,
    _lock_taxes,
)
from workshop_configuration.domain.validation import DocumentType, FiscalEntityType
from workshop_configuration.models import FiscalEntity

# Errores públicos del contrato para el taller (no importa módulos internos).
ArtisanContextError = OperationContextError
ArtisanNumberingError = NumberingError
ArtisanTaxSnapshot = TaxSnapshot


@dataclass(frozen=True)
class ArtisanEntity:
    id: int
    ruc: str
    legal_name: str


class ArtisanEntityMissingError(Exception):
    def __init__(self) -> None:
        super().__init__("No existe la entidad fiscal artesanal configurada.")


@dataclass(frozen=True)
class LockedArtisanOperationContext:
    entity: ArtisanEntity
    taxes: dict[int, TaxSnapshot]


def get_artisan_entity() -> ArtisanEntity:
    entity = FiscalEntity.objects.filter(entity_type=FiscalEntityType.ARTESANAL.value).first()
    if entity is None:
        raise ArtisanEntityMissingError()
    return ArtisanEntity(id=entity.pk, ruc=entity.ruc, legal_name=entity.legal_name)


def lock_artisan_operation_context(
    *,
    tax_definition_ids: Iterable[int],
    on: date,
) -> LockedArtisanOperationContext:
    """Bloquea la entidad artesanal y resuelve sus tarifas para la fecha documental."""
    entity, taxes = _lock_taxes(
        FiscalEntityType.ARTESANAL.value,
        tax_definition_ids=tax_definition_ids,
        on=on,
    )
    return LockedArtisanOperationContext(
        entity=ArtisanEntity(id=entity.pk, ruc=entity.ruc, legal_name=entity.legal_name),
        taxes=taxes,
    )


def artisan_numbering_scope_id() -> int:
    """Devuelve el ámbito ARTESANAL/SERVICIO aprobado para ART-SER."""
    return get_numbering_scope_id(
        entity_type=FiscalEntityType.ARTESANAL.value,
        document_type=DocumentType.SERVICIO.value,
    )


def allocate_artisan_number(*, request_key: str) -> AllocateNumberResult:
    """Asigna ART-SER de forma idempotente usando la identidad estable de la operación."""
    fingerprint = hashlib.sha256(request_key.encode()).hexdigest()
    return allocate_number(
        scope_id=artisan_numbering_scope_id(),
        consumer_type="service_operation",
        consumer_id=request_key,
        request_key=request_key,
        request_fingerprint=fingerprint,
    )
