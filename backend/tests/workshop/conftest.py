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

# Convención local de este módulo: las ayudas compartidas viven en ``workshop_helpers`` y se
# importan como ``tests.workshop.workshop_helpers``. Con --import-mode=importlib la raíz de
# ``backend`` no está en sys.path; se añade aquí para que pytest y mypy resuelvan el mismo nombre
# sin convertir ``tests`` en paquete ni cambiar la configuración global.
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
            "code": f"SRV-9{number:05d}",
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


@pytest.fixture
def commercial(db: None) -> dict[str, Any]:
    """Entidad comercial con tarifa de prueba 15 %, bodega y serie COM-VEN para repuestos."""
    from workshop_configuration.models import DocumentSeries, NumberingScope, TaxPeriod, Warehouse

    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    entity, _ = FiscalEntity.objects.get_or_create(
        entity_type="COMERCIAL",
        defaults={"legal_name": "Comercial SA", "ruc": "1790000000001"},
    )
    tax, _ = TaxDefinition.objects.get_or_create(
        fiscal_entity=entity, code="IVA", defaults={"name": "IVA"}
    )
    TaxPeriod.objects.get_or_create(
        tax_definition=tax, starts_on=date(2025, 1, 1), defaults={"rate": Decimal("15")}
    )
    scope, _ = NumberingScope.objects.get_or_create(fiscal_entity=entity, document_type="VENTA")
    DocumentSeries.objects.get_or_create(
        numbering_scope=scope, code="COM-VEN", defaults={"is_active": True}
    )
    warehouse, _ = Warehouse.objects.get_or_create(id=1, defaults={"name": "Principal"})
    return {"entity": entity, "tax": tax, "warehouse": warehouse}


@pytest.fixture
def stocked(commercial: dict[str, Any], admin: Any):  # type: ignore[no-untyped-def]
    """Fábrica de productos comerciales con existencia publicada mediante inventario."""
    from django.db import transaction

    from catalog.application.inventory_references import lock_product_references
    from catalog.models import MeasurementUnit, Product, ProductCategory
    from inventory.application import posting

    category, _ = ProductCategory.objects.get_or_create(name="Repuestos")
    unit, _ = MeasurementUnit.objects.get_or_create(name="Unidad")
    sources = count(5000)

    def factory(quantity: int = 10, price: str = "11.50", **overrides: Any) -> Product:
        number = next(_sequence)
        values: dict[str, Any] = {
            "code": f"REP-{number}",
            "name": f"Repuesto {number}",
            "category": category,
            "unit": unit,
            "content_quantity": Decimal("1"),
            "sale_price": Decimal(price),
            "tax_definition": commercial["tax"],
        }
        values.update(overrides)
        product = Product.objects.create(**values)
        if quantity:
            with transaction.atomic():
                _publish_stock(product, quantity)
        return product

    def _publish_stock(product: Product, quantity: int) -> None:
        if quantity:
            refs = lock_product_references([product.pk])
            operation = posting.prepare_operation(
                kind="PURCHASE_RECEIPT",
                actor=admin,
                source_type="PURCHASE",
                source_id=next(sources),
                entry_lines=[
                    posting.EntryLine(product.pk, Decimal(quantity), Decimal(quantity * 4))
                ],
            )
            posting.post_operation(
                operation,
                posting.lock_positions(refs, warehouse_id=commercial["warehouse"].pk),
                refs,
            )

    return factory


@pytest.fixture
def artisan_billing(artisan: dict[str, Any]) -> dict[str, Any]:
    """Tarifa artesanal de prueba de 15 % vigente y serie activa ART-SER."""
    from workshop_configuration.models import DocumentSeries, NumberingScope, TaxPeriod

    TaxPeriod.objects.get_or_create(
        tax_definition=artisan["tax"], starts_on=date(2025, 1, 1), defaults={"rate": Decimal("15")}
    )
    scope, _ = NumberingScope.objects.get_or_create(
        fiscal_entity=artisan["entity"], document_type="SERVICIO"
    )
    series, _ = DocumentSeries.objects.get_or_create(
        numbering_scope=scope, code="ART-SER", defaults={"is_active": True}
    )
    return {**artisan, "scope": scope, "series": series}
