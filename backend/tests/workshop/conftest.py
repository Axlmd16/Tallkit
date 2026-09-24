import sys
from datetime import date, timedelta
from decimal import Decimal
from itertools import count
from pathlib import Path
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from catalog.models import Service
from customer_registry.models import Customer, OwnershipPeriod, Vehicle, VehicleBrand
from identity.models import UserRole
from workshop_configuration.models import FiscalEntity, TaxDefinition, WorkshopConfiguration

# Permite importar ``tests.workshop.workshop_helpers`` con --import-mode=importlib.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

_sequence = count(1)


def _user(username: str, *roles: str):  # type: ignore[no-untyped-def]
    user = get_user_model().objects.create_user(username=username, password="x" * 14)
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def admin(db: None):  # type: ignore[no-untyped-def]
    return _user("wk-admin", "ADMINISTRADOR")


@pytest.fixture
def manager(db: None):  # type: ignore[no-untyped-def]
    return _user("wk-manager", "ENCARGADO_TALLER")


@pytest.fixture
def seller(db: None):  # type: ignore[no-untyped-def]
    return _user("wk-seller", "VENDEDOR")


@pytest.fixture
def seller_manager(db: None):  # type: ignore[no-untyped-def]
    return _user("wk-seller-manager", "VENDEDOR", "ENCARGADO_TALLER")


@pytest.fixture
def artisan(db: None) -> dict[str, Any]:
    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    entity, _ = FiscalEntity.objects.get_or_create(
        entity_type="ARTESANAL",
        defaults={"legal_name": "Taller Artesanal", "ruc": "1790000000002"},
    )
    tax, _ = TaxDefinition.objects.get_or_create(
        fiscal_entity=entity, code="IVA-ART", defaults={"name": "IVA servicios"}
    )
    return {"entity": entity, "tax": tax}


@pytest.fixture
def make_service(artisan: dict[str, Any]):  # type: ignore[no-untyped-def]
    def factory(**overrides: Any) -> Service:
        number = next(_sequence)
        values: dict[str, Any] = {
            "name": f"Servicio {number}",
            "reference_price": Decimal("25.00"),
            "tax_definition": artisan["tax"],
        }
        values.update(overrides)
        return Service.objects.create(**values)

    return factory


@pytest.fixture
def make_customer(db: None):  # type: ignore[no-untyped-def]
    def factory(**overrides: Any) -> Customer:
        number = next(_sequence)
        values: dict[str, Any] = {
            "person_type": "NATURAL",
            "name": f"Cliente {number}",
            "identification_type": "CI",
            "identification": f"{1700000000 + number}",
            "phone": "0999999999",
        }
        values.update(overrides)
        return Customer.objects.create(**values)

    return factory


@pytest.fixture
def brand(db: None) -> VehicleBrand:
    return VehicleBrand.objects.create(name="Toyota")


@pytest.fixture
def make_vehicle(brand: VehicleBrand):  # type: ignore[no-untyped-def]
    def factory(owner: Customer, **overrides: Any) -> Vehicle:
        number = next(_sequence)
        values: dict[str, Any] = {"plate": f"ABC-{1000 + number}", "brand": brand, "model": "Hilux"}
        values.update(overrides)
        vehicle = Vehicle.objects.create(**values)
        OwnershipPeriod.objects.create(
            vehicle=vehicle, customer=owner, started_at=timezone.now() - timedelta(days=30)
        )
        return vehicle

    return factory


@pytest.fixture
def customer(make_customer):  # type: ignore[no-untyped-def]
    return make_customer(name="Ana Pérez", identification="1712345678")


@pytest.fixture
def vehicle(make_vehicle, customer):  # type: ignore[no-untyped-def]
    return make_vehicle(customer, plate="ABC-1234")


@pytest.fixture
def today() -> date:
    from zoneinfo import ZoneInfo

    return timezone.now().astimezone(ZoneInfo("America/Guayaquil")).date()


@pytest.fixture(autouse=True)
def private_media(tmp_path: Path, settings: Any) -> Path:
    """Raíz privada aislada por prueba; nunca escribe en la carpeta real."""
    root = tmp_path / "private-media"
    settings.PRIVATE_MEDIA_ROOT = root
    return root
