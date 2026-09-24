"""Interfaz pública de configuración para el taller."""

import pytest

from workshop_configuration.application.workshop_references import (
    ArtisanEntityMissingError,
    get_artisan_entity,
)
from workshop_configuration.models import FiscalEntity

pytestmark = pytest.mark.django_db


def test_returns_artisan_entity() -> None:
    entity = FiscalEntity.objects.create(
        entity_type="ARTESANAL", legal_name="Taller", ruc="1790000000002"
    )
    ref = get_artisan_entity()
    assert (ref.id, ref.ruc, ref.legal_name) == (entity.pk, "1790000000002", "Taller")


def test_missing_configuration_is_an_error() -> None:
    FiscalEntity.objects.filter(entity_type="ARTESANAL").delete()
    with pytest.raises(ArtisanEntityMissingError):
        get_artisan_entity()
