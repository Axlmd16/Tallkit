"""Configuración de pruebas para workshop_configuration.

Asegura que el singleton WorkshopConfiguration(pk=1) exista en pruebas transaccionales.
"""

import pytest


@pytest.fixture(autouse=True)
def ensure_workshop_singleton(db: None) -> None:
    """Garantiza que el singleton de WorkshopConfiguration existe.

    En tests con transaction=True, el singleton creado por la migración puede
    haberse perdido tras el truncate del test anterior. Esta fixture lo recrea.
    """
    from workshop_configuration.models import WorkshopConfiguration

    WorkshopConfiguration.objects.get_or_create(pk=1)
