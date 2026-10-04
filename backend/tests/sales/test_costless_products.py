"""Ventas de productos sin costo registrado: se vende igual y el costo queda ausente."""

from decimal import Decimal
from typing import Any

import pytest

from catalog.application.inventory_references import lock_product_references
from inventory.application import posting
from inventory.models import InventoryMovement, InventoryPosition
from sales.application import reads
from sales.models import Sale, SaleCostAllocation
from workshop_configuration.models import Warehouse

from .test_confirm import confirm, make_draft
from .test_payments import summary
from .test_returns import do_return, item, line_id
from .test_returns import request as return_request

pytestmark = pytest.mark.django_db
D = Decimal


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


@pytest.fixture
def stock_without_cost(actor: Any, warehouse: Warehouse):  # type: ignore[no-untyped-def]
    def add(product: Any, quantity: int) -> None:
        refs = lock_product_references([product.pk])
        operation = posting.prepare_operation(
            kind="PURCHASE_RECEIPT",
            actor=actor,
            source_type="",
            source_id=None,
            entry_lines=[posting.EntryLine(product.pk, D(quantity), None)],
        )
        posting.post_operation(
            operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs
        )

    return add


def test_a_product_without_cost_is_sold_with_the_usual_amounts_and_an_absent_cost(
    seller: Any, customer: Any, make_product: Any, stock_without_cost: Any
) -> None:
    product = make_product()
    stock_without_cost(product, 5)
    body = confirm(seller, make_draft(seller, customer, [(product, "2")])).body
    assert body["state"] == "CONFIRMED"
    assert body["internal_number"] == "COM-VEN-000001"
    assert body["grand_total"] == "23.00"
    allocation = SaleCostAllocation.objects.get()
    assert allocation.cost_known is False
    assert (allocation.published_unit_cost, allocation.applied_value) == (D(0), D(0))
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.valued) == (D(3), False)
    movement = InventoryMovement.objects.get(movement_type="SALE_OUT")
    assert movement.cost_known is False


def test_a_mixed_sale_keeps_the_known_cost_of_one_line_and_the_absence_of_the_other(
    seller: Any, customer: Any, make_product: Any, stock: Any, stock_without_cost: Any
) -> None:
    valued, costless = make_product(), make_product()
    stock(valued, 10, "40.00")
    stock_without_cost(costless, 4)
    confirm(seller, make_draft(seller, customer, [(valued, "2"), (costless, "1")]))
    first, second = SaleCostAllocation.objects.order_by("sale_line__position")
    assert (first.cost_known, first.published_unit_cost, first.applied_value) == (
        True,
        D("4.000000"),
        D("8.000000"),
    )
    assert (second.cost_known, second.applied_value) == (False, D(0))


def test_registering_a_cost_later_does_not_rewrite_the_sale(
    seller: Any, customer: Any, make_product: Any, stock: Any, stock_without_cost: Any
) -> None:
    product = make_product()
    stock_without_cost(product, 5)
    confirm(seller, make_draft(seller, customer, [(product, "2")]))
    stock(product, 5, "10.00")  # la primera entrada con costo regulariza la existencia
    allocation = SaleCostAllocation.objects.get()
    assert (allocation.cost_known, allocation.applied_value) == (False, D(0))
    assert InventoryPosition.objects.get().valued is True


def test_the_administrator_sees_the_missing_cost_and_the_seller_sees_nothing_about_it(
    admin: Any, seller: Any, customer: Any, make_product: Any, stock: Any, stock_without_cost: Any
) -> None:
    valued, costless = make_product(), make_product()
    stock(valued, 10, "40.00")
    stock_without_cost(costless, 4)
    sale_id = confirm(seller, make_draft(seller, customer, [(valued, "2"), (costless, "1")])).body[
        "id"
    ]
    costs = reads.sale_detail(actor=admin, sale_id=sale_id)["costs"]
    assert costs["total_cost"] == "8.000000"
    assert costs["has_missing_cost"] is True
    known, missing = costs["lines"]
    assert (known["cost_known"], known["applied_value"]) == (True, "8.000000")
    assert (missing["cost_known"], missing["published_unit_cost"], missing["applied_value"]) == (
        False,
        None,
        None,
    )
    seller_view = reads.sale_detail(actor=seller, sale_id=sale_id)
    text = str(seller_view).lower()
    assert "costs" not in seller_view
    for word in ("cost_known", "has_missing_cost", "sin costo", "published_unit_cost"):
        assert word not in text


def test_returning_a_line_sold_without_cost_restocks_it_without_inventing_a_cost(
    admin: Any, seller: Any, customer: Any, make_product: Any, stock_without_cost: Any
) -> None:
    product = make_product()
    stock_without_cost(product, 5)
    sale_id = confirm(seller, make_draft(seller, customer, [(product, "2")])).body["id"]
    do_return(admin, sale_id, return_request([item(line_id(sale_id), fit=2)]))
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value, position.valued) == (D(5), D(0), False)
    entry = InventoryMovement.objects.get(movement_type="CUSTOMER_RETURN_IN")
    assert entry.cost_known is False
    assert summary(sale_id)["balance"] == "0.00"
    assert Sale.objects.get(pk=sale_id).state == "CONFIRMED"


def test_returning_a_known_cost_line_still_uses_the_historical_cost(
    admin: Any, seller: Any, customer: Any, make_product: Any, stock: Any
) -> None:
    product = make_product()
    stock(product, 10, "40.00")
    sale_id = confirm(seller, make_draft(seller, customer, [(product, "2")])).body["id"]
    do_return(admin, sale_id, return_request([item(line_id(sale_id), fit=2)]))
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value, position.valued) == (D(10), D("40.000000"), True)
    entry = InventoryMovement.objects.get(movement_type="CUSTOMER_RETURN_IN")
    assert entry.cost_known is True
