from decimal import Decimal
from itertools import count

import pytest
from django.contrib.auth import get_user_model

from catalog.models import MeasurementUnit, Product, ProductCategory
from workshop_configuration.models import FiscalEntity, TaxDefinition, Warehouse

_sequence = count(1)


@pytest.fixture
def actor(db: None):  # type: ignore[no-untyped-def]
    return get_user_model().objects.create_user(username="inv-actor", password="x" * 14)


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
            "code": f"INV-{number}",
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
