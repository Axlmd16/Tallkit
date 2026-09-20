from datetime import date
from decimal import Decimal
from itertools import count
from typing import Any

import pytest
from django.contrib.auth import get_user_model

from catalog.models import MeasurementUnit, Product, ProductCategory
from identity.models import UserRole
from supplier_registry.models import Supplier
from workshop_configuration.models import (
    DocumentSeries,
    FiscalEntity,
    NumberingScope,
    TaxDefinition,
    TaxPeriod,
    Warehouse,
    WorkshopConfiguration,
)

_sequence = count(1)


@pytest.fixture
def actor(db: None):  # type: ignore[no-untyped-def]
    return get_user_model().objects.create_user(username="pur-actor", password="x" * 14)


@pytest.fixture
def warehouse(db: None) -> Warehouse:
    warehouse, _ = Warehouse.objects.get_or_create(id=1, defaults={"name": "Principal"})
    return warehouse


@pytest.fixture
def make_product(db: None):  # type: ignore[no-untyped-def]
    entity, _ = FiscalEntity.objects.get_or_create(
        entity_type="COMERCIAL",
        defaults={"legal_name": "Comercial SA", "ruc": "1790000000001"},
    )
    tax, _ = TaxDefinition.objects.get_or_create(
        fiscal_entity=entity, code="IVA", defaults={"name": "IVA"}
    )
    category, _ = ProductCategory.objects.get_or_create(name="Aceites")
    unit, _ = MeasurementUnit.objects.get_or_create(name="Unidad")

    def factory(**overrides):  # type: ignore[no-untyped-def]
        number = next(_sequence)
        values = {
            "code": f"PUR-{number}",
            "name": f"Producto {number}",
            "category": category,
            "unit": unit,
            "content_quantity": Decimal("1"),
            "sale_price": Decimal("10.00"),
            "tax_definition": tax,
        }
        values.update(overrides)
        return Product.objects.create(**values)

    return factory


@pytest.fixture
def product(make_product):  # type: ignore[no-untyped-def]
    return make_product()


@pytest.fixture
def supplier(db: None) -> Supplier:
    return Supplier.objects.create(name="Proveedor Uno")


@pytest.fixture
def tax_definition(product: Product) -> TaxDefinition:
    return product.tax_definition


# Contexto completo de compras: administrador, configuración comercial y serie

PAST = date(2026, 1, 15)


@pytest.fixture
def admin(db: None):  # type: ignore[no-untyped-def]
    user = get_user_model().objects.create_user(username="pur-admin", password="x" * 14)
    UserRole.objects.create(user=user, role="ADMINISTRADOR")
    return user


@pytest.fixture
def seller(db: None):  # type: ignore[no-untyped-def]
    user = get_user_model().objects.create_user(username="pur-seller", password="x" * 14)
    UserRole.objects.create(user=user, role="VENDEDOR")
    return user


@pytest.fixture
def commercial(db: None) -> dict[str, Any]:
    """Entidad comercial con tarifa de prueba 10 %, tarifa cero y serie COM-ING."""
    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    entity, _ = FiscalEntity.objects.get_or_create(
        entity_type="COMERCIAL",
        defaults={"legal_name": "Comercial SA", "ruc": "1790000000001"},
    )
    ten, _ = TaxDefinition.objects.get_or_create(
        fiscal_entity=entity, code="IVA", defaults={"name": "IVA"}
    )
    TaxPeriod.objects.create(tax_definition=ten, rate=Decimal("10"), starts_on=date(2025, 1, 1))
    zero = TaxDefinition.objects.create(fiscal_entity=entity, code="CERO", name="Tarifa cero")
    TaxPeriod.objects.create(tax_definition=zero, rate=Decimal("0"), starts_on=date(2025, 1, 1))
    scope = NumberingScope.objects.create(fiscal_entity=entity, document_type="INGRESO")
    series = DocumentSeries.objects.create(numbering_scope=scope, code="COM-ING", is_active=True)
    return {"entity": entity, "ten": ten, "zero": zero, "scope": scope, "series": series}


@pytest.fixture
def line() -> Any:
    def build(product: Any, tax: Any, quantity: str = "2", cost: str = "10.00", **extra: Any):  # type: ignore[no-untyped-def]
        return {
            "product_id": product.pk,
            "quantity": quantity,
            "unit_cost": cost,
            "tax_definition_id": tax.pk,
            "tax_recoverability": "RECOVERABLE",
            **extra,
        }

    return build


@pytest.fixture
def draft_payload(supplier: Any) -> Any:
    counter = iter(range(1, 10_000))

    def build(lines: list[dict[str, Any]] | None = None, **overrides: Any) -> dict[str, Any]:
        n = next(counter)
        payload: dict[str, Any] = {
            "idempotency_key": f"draft-key-{n:06d}",
            "supplier_id": supplier.pk,
            "document_type": "FACTURA",
            "supplier_reference": f"001-001-{n:09d}",
            "document_date": PAST.isoformat(),
            "notes": "",
            "lines": lines or [],
        }
        payload.update(overrides)
        return payload

    return build
