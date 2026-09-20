import pytest
from django.contrib.auth import get_user_model

from customer_registry.models import VehicleBrand
from workshop_configuration.models import FiscalEntity, TaxDefinition


@pytest.fixture
def actor(db: None):  # type: ignore[no-untyped-def]
    return get_user_model().objects.create_user(username="cat-actor", password="x" * 14)


@pytest.fixture
def commercial_tax(db: None) -> TaxDefinition:
    entity, _ = FiscalEntity.objects.get_or_create(
        entity_type="COMERCIAL",
        defaults={"legal_name": "Comercial SA", "ruc": "1790000000001"},
    )
    return TaxDefinition.objects.create(fiscal_entity=entity, code="IVA", name="IVA")


@pytest.fixture
def vehicle_brand(db: None) -> VehicleBrand:
    return VehicleBrand.objects.create(name="Toyota")


@pytest.fixture
def artisanal_tax(db: None) -> TaxDefinition:
    entity, _ = FiscalEntity.objects.get_or_create(
        entity_type="ARTESANAL",
        defaults={"legal_name": "Artesanal", "ruc": "1790000000002"},
    )
    return TaxDefinition.objects.create(fiscal_entity=entity, code="ART", name="Artesanal")
