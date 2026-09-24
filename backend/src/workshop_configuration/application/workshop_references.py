"""Interfaz pública de configuración para el taller: entidad fiscal artesanal, sin bloqueos."""

from dataclasses import dataclass

from workshop_configuration.domain.validation import FiscalEntityType
from workshop_configuration.models import FiscalEntity


@dataclass(frozen=True)
class ArtisanEntity:
    id: int
    ruc: str
    legal_name: str


class ArtisanEntityMissingError(Exception):
    def __init__(self) -> None:
        super().__init__("No existe la entidad fiscal artesanal configurada.")


def get_artisan_entity() -> ArtisanEntity:
    entity = FiscalEntity.objects.filter(entity_type=FiscalEntityType.ARTESANAL.value).first()
    if entity is None:
        raise ArtisanEntityMissingError()
    return ArtisanEntity(id=entity.pk, ruc=entity.ruc, legal_name=entity.legal_name)
