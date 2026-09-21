"""Interfaz pública del catálogo para ventas comerciales."""

import dataclasses
from decimal import Decimal
from typing import Any

import pytest
from django.db import connection, transaction
from django.test.utils import CaptureQueriesContext

from catalog.application.sales_references import (
    SaleProductReference,
    SaleProductReferenceError,
    get_sale_product_references,
    list_sale_product_options,
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
            "sale_price": Decimal("11.50"),
            "tax_definition": tax,
        }
        values.update(overrides)
        return Product.objects.create(**values)

    return factory


@pytest.mark.django_db
def test_reference_is_a_frozen_dto_with_current_final_price_and_tax_choice(
    make_product: Any,
) -> None:
    product = make_product(code="ACE-1", name="Aceite", is_kit=True)
    (ref,) = get_sale_product_references([product.pk]).values()
    assert isinstance(ref, SaleProductReference)
    assert (ref.id, ref.code, ref.name) == (product.pk, "ACE-1", "Aceite")
    assert ref.sale_price == Decimal("11.50")
    assert ref.tax_definition_id == product.tax_definition_id
    assert (ref.unit_name, ref.unit_symbol, ref.content_quantity) == ("Galón", "gal", Decimal(4))
    assert ref.is_active is True
    assert ref.is_kit is True
    with pytest.raises(dataclasses.FrozenInstanceError):
        ref.sale_price = Decimal(1)  # type: ignore[misc]


@pytest.mark.django_db
def test_lookup_includes_inactive_history_in_one_query(make_product: Any) -> None:
    active, inactive = make_product(), make_product(is_active=False)
    with CaptureQueriesContext(connection) as queries:
        refs = get_sale_product_references([active.pk, inactive.pk, 987654])
    assert set(refs) == {active.pk, inactive.pk}
    assert refs[inactive.pk].is_active is False
    assert len(queries) == 1


@pytest.mark.django_db
def test_search_is_paginated_active_only_and_stable(make_product: Any) -> None:
    for i in range(5):
        make_product(name=f"Filtro {i}", is_active=i != 2)
    make_product(code="ZZ-9", manufacturer_code="MFR-777", name="Bujía")
    page = list_sale_product_options(search="filtro", page=1, page_size=2)
    assert page.total_count == 4
    assert [r.name for r in page.items] == ["Filtro 0", "Filtro 1"]
    assert list_sale_product_options(search="mfr-777").total_count == 1
    assert list_sale_product_options(search="zz-9").total_count == 1
    assert list_sale_product_options(page=99, page_size=2).items == ()


@pytest.mark.django_db
def test_lock_returns_references_by_ascending_id(make_product: Any) -> None:
    a, b = make_product(), make_product()
    with transaction.atomic():
        locked = lock_product_references([b.pk, a.pk])
    assert list(locked) == sorted([a.pk, b.pk])


@pytest.mark.django_db
def test_lock_reports_missing_and_inactive_but_historic_query_allows_inactive(
    make_product: Any,
) -> None:
    active, inactive = make_product(), make_product(is_active=False)
    with transaction.atomic():
        with pytest.raises(SaleProductReferenceError) as error:
            lock_product_references([active.pk, inactive.pk, 424242])
        assert error.value.missing == (424242,)
        assert error.value.inactive == (inactive.pk,)
        assert inactive.pk in lock_product_references([inactive.pk], require_active=False)


@pytest.mark.django_db(transaction=True)
def test_lock_requires_an_outer_transaction(make_product: Any) -> None:
    product = make_product()
    with pytest.raises(RuntimeError, match="transacción"):
        lock_product_references([product.pk])
