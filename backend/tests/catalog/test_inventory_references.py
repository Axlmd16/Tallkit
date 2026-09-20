"""Interfaz pública del catálogo para compras e inventario."""

import dataclasses
from decimal import Decimal
from typing import Any

import pytest
from django.db import connection, transaction
from django.test.utils import CaptureQueriesContext

from catalog.application.inventory_references import (
    ProductReference,
    ProductReferenceError,
    get_product_references,
    list_product_references,
    lock_product_references,
)
from catalog.models import MeasurementUnit, Product, ProductCategory
from workshop_configuration.models import FiscalEntity, TaxDefinition


@pytest.fixture
def make_product(db: None):  # type: ignore[no-untyped-def]
    entity, _ = FiscalEntity.objects.get_or_create(
        entity_type="COMERCIAL", defaults={"legal_name": "C", "ruc": "1790000000001"}
    )
    tax = TaxDefinition.objects.create(fiscal_entity=entity, code="IVA", name="IVA")
    category = ProductCategory.objects.create(name="Aceites")
    unit = MeasurementUnit.objects.create(name="Galón", symbol="gal")
    counter = iter(range(1, 1000))

    def factory(**overrides: Any) -> Product:
        n = next(counter)
        values: dict[str, Any] = {
            "code": f"P-{n}",
            "name": f"Producto {n}",
            "category": category,
            "unit": unit,
            "content_quantity": Decimal("4"),
            "sale_price": Decimal("99.99"),
            "tax_definition": tax,
        }
        values.update(overrides)
        return Product.objects.create(**values)

    return factory


@pytest.mark.django_db
def test_references_are_frozen_dtos_with_presentation_and_tax_choice(make_product: Any) -> None:
    product = make_product(code="ACE-1", name="Aceite")
    (ref,) = get_product_references([product.pk]).values()
    assert isinstance(ref, ProductReference)
    assert (ref.id, ref.code, ref.name) == (product.pk, "ACE-1", "Aceite")
    assert (ref.content_quantity, ref.unit_name, ref.unit_symbol) == (Decimal("4"), "Galón", "gal")
    assert ref.is_active is True
    assert ref.tax_definition_id == product.tax_definition_id
    with pytest.raises(dataclasses.FrozenInstanceError):
        ref.code = "otro"  # type: ignore[misc]


@pytest.mark.django_db
def test_sale_price_is_never_exposed(make_product: Any) -> None:
    product = make_product()
    ref = get_product_references([product.pk])[product.pk]
    assert not any("price" in field.name for field in dataclasses.fields(ref))


@pytest.mark.django_db
def test_lookup_by_ids_includes_inactive_and_uses_one_query(make_product: Any) -> None:
    active = make_product()
    inactive = make_product(is_active=False)
    with CaptureQueriesContext(connection) as queries:
        refs = get_product_references([active.pk, inactive.pk, 987654])
    assert set(refs) == {active.pk, inactive.pk}
    assert refs[inactive.pk].is_active is False
    assert len(queries) == 1


@pytest.mark.django_db
def test_search_is_paginated_active_only_by_default(make_product: Any) -> None:
    for i in range(5):
        make_product(name=f"Filtro {i}", is_active=i != 2)
    make_product(name="Bujía")
    page = list_product_references(search="filtro", page=1, page_size=2)
    assert page.total_count == 4
    assert [r.name for r in page.items] == ["Filtro 0", "Filtro 1"]
    everything = list_product_references(search="filtro", include_inactive=True)
    assert everything.total_count == 5
    assert list_product_references(search="bujía").items[0].name == "Bujía"
    assert list_product_references(page=99, page_size=2).items == ()


@pytest.mark.django_db
def test_search_matches_code_and_manufacturer_code(make_product: Any) -> None:
    make_product(code="ZZ-9", manufacturer_code="MFR-777")
    assert list_product_references(search="zz-9").total_count == 1
    assert list_product_references(search="mfr-777").total_count == 1


@pytest.mark.django_db
def test_lock_returns_references_by_ascending_id(make_product: Any) -> None:
    a, b = make_product(), make_product()
    with transaction.atomic():
        locked = lock_product_references([b.pk, a.pk])
    assert list(locked) == sorted([a.pk, b.pk])


@pytest.mark.django_db
def test_lock_reports_missing_and_inactive_products(make_product: Any) -> None:
    active, inactive = make_product(), make_product(is_active=False)
    with transaction.atomic():
        with pytest.raises(ProductReferenceError) as error:
            lock_product_references([active.pk, inactive.pk, 424242])
        assert error.value.missing == (424242,)
        assert error.value.inactive == (inactive.pk,)
        assert inactive.pk in lock_product_references([inactive.pk], require_active=False)


@pytest.mark.django_db(transaction=True)
def test_lock_requires_an_outer_transaction(make_product: Any) -> None:
    product = make_product()
    with pytest.raises(RuntimeError, match="transacción"):
        lock_product_references([product.pk])
