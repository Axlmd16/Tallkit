"""Lista de existencias y ficha de producto."""

from decimal import Decimal
from typing import Any

import pytest

from catalog.models import MeasurementUnit, ProductCategory
from inventory.application import posting, queries
from inventory.application.errors import InventoryApplicationError
from inventory.models import InventoryPosition

pytestmark = pytest.mark.django_db
D = Decimal


def stock(actor: Any, warehouse: Any, product: Any, quantity: int, cost: str = "2.00") -> None:
    from catalog.application.inventory_references import lock_product_references

    refs = lock_product_references([product.pk], require_active=False)
    operation = posting.prepare_operation(
        kind="ADJUSTMENT_IN",
        actor=actor,
        source_type="",
        source_id=None,
        entry_lines=[posting.EntryLine(product.pk, D(quantity), D(cost) * quantity)],
    )
    posting.post_operation(operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs)


@pytest.fixture
def catalog(make_product: Any, actor: Any, warehouse: Any) -> dict[str, Any]:
    oil_cat = ProductCategory.objects.create(name="Lubricantes")
    unit = MeasurementUnit.objects.get(name="Unidad")
    oil = make_product(
        code="ACE-01", name="Aceite 20W50", category=oil_cat, unit=unit, manufacturer_code="MOT-5"
    )
    filter_ = make_product(code="FIL-01", name="Filtro de aceite")
    plug = make_product(code="BUJ-01", name="Bujía", is_active=False)
    idle = make_product(code="IDLE-1", name="Sin movimientos")
    ghost = make_product(code="OLD-1", name="Inactivo sin historia", is_active=False)
    stock(actor, warehouse, oil, 5)
    stock(actor, warehouse, plug, 2)
    stock(actor, warehouse, filter_, 1)
    from inventory.application import posting as p

    return {
        "oil": oil,
        "filter": filter_,
        "plug": plug,
        "idle": idle,
        "ghost": ghost,
        "cat": oil_cat,
        "p": p,
    }


def names(page: dict[str, Any]) -> list[str]:
    return [row["product"]["name"] for row in page["results"]]


def test_search_is_case_insensitive_over_code_manufacturer_code_and_name(catalog: Any) -> None:
    assert names(queries.list_stock(search="aceite", include_valuation=False)) == [
        "Aceite 20W50",
        "Filtro de aceite",
    ]
    assert names(queries.list_stock(search="acE-01", include_valuation=False)) == ["Aceite 20W50"]
    assert names(queries.list_stock(search="mot-5", include_valuation=False)) == ["Aceite 20W50"]


def test_filters_combine_by_intersection_with_a_correct_total(catalog: Any) -> None:
    page = queries.list_stock(
        search="aceite", category_id=catalog["cat"].pk, stock="positive", include_valuation=False
    )
    assert names(page) == ["Aceite 20W50"]
    assert page["count"] == 1
    zero = queries.list_stock(stock="zero", include_valuation=False)
    assert names(zero) == ["Sin movimientos"]


def test_initial_query_includes_active_and_inactive_with_history_only(catalog: Any) -> None:
    initial = names(queries.list_stock(include_valuation=False))
    assert "Bujía" in initial  # inactivo con saldo
    assert "Inactivo sin historia" not in initial
    assert names(queries.list_stock(active="false", include_valuation=False)) == [
        "Bujía",
        "Inactivo sin historia",
    ]
    assert len(names(queries.list_stock(active="all", include_valuation=False))) == 5
    assert "Bujía" not in names(queries.list_stock(active="true", include_valuation=False))


def test_order_is_stable_and_pagination_reports_totals(catalog: Any) -> None:
    first = queries.list_stock(page=1, page_size=2, include_valuation=False)
    second = queries.list_stock(page=2, page_size=2, include_valuation=False)
    assert (first["count"], first["total_pages"]) == (4, 2)
    assert names(first) + names(second) == sorted(names(first) + names(second))
    assert queries.list_stock(page=9, include_valuation=False)["results"] == []


def test_product_without_movements_projects_a_real_zero_without_creating_a_position(
    catalog: Any,
) -> None:
    before = InventoryPosition.objects.count()
    row = next(
        r
        for r in queries.list_stock(include_valuation=False)["results"]
        if r["product"]["name"] == "Sin movimientos"
    )
    assert (row["quantity"], row["version"], row["last_ordinal"]) == ("0", 0, 0)
    item = queries.get_stock_item(catalog["idle"].pk, include_valuation=False)
    assert item["quantity"] == "0"
    assert InventoryPosition.objects.count() == before


def test_operational_projection_hides_valuation_and_administrative_shows_it(catalog: Any) -> None:
    operative = queries.get_stock_item(catalog["oil"].pk, include_valuation=False)
    assert operative["quantity"] == "5"
    assert not {"average_cost", "inventory_value"} & operative.keys()
    admin_view = queries.get_stock_item(catalog["oil"].pk, include_valuation=True)
    assert (admin_view["average_cost"], admin_view["inventory_value"]) == ("2.000000", "10.000000")


def test_unknown_product_and_invalid_filters_are_corrigible_errors(catalog: Any) -> None:
    with pytest.raises(InventoryApplicationError) as missing:
        queries.get_stock_item(999_999, include_valuation=False)
    assert missing.value.code == "not_found"
    for kwargs in ({"stock": "many"}, {"active": "maybe"}, {"page": 0}, {"page_size": 101}):
        with pytest.raises(InventoryApplicationError) as error:
            queries.list_stock(include_valuation=False, **kwargs)
        assert error.value.code == "validation_error"


def test_inactive_product_depleted_but_with_history_still_appears(
    actor: Any, warehouse: Any, make_product: Any
) -> None:
    from catalog.application.inventory_references import lock_product_references

    depleted = make_product(name="Agotado inactivo", is_active=False)
    stock(actor, warehouse, depleted, 2)
    refs = lock_product_references([depleted.pk], require_active=False)
    operation = posting.prepare_operation(
        kind="ADJUSTMENT_OUT",
        actor=actor,
        source_type="",
        source_id=None,
        exit_lines=[posting.ExitLine(depleted.pk, D(2))],
    )
    posting.post_operation(operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs)
    listed = queries.list_stock(include_valuation=False)
    row = next(r for r in listed["results"] if r["product"]["name"] == "Agotado inactivo")
    assert (row["quantity"], row["product"]["is_active"]) == ("0", False)
