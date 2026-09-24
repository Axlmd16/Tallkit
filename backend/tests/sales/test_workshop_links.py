"""Contrato de ventas vinculadas administradas desde una orden de mantenimiento."""

from decimal import Decimal
from typing import Any

import pytest
from django.db import transaction
from django.utils import timezone

from catalog.models import Service
from inventory.models import InventoryMovement, InventoryPosition, InventoryReservation
from sales.application.errors import SalesApplicationError
from sales.application.workshop_links import (
    add_linked_line,
    blocking_linked_documents,
    change_linked_line,
    linked_product_options,
    linked_sales_summary,
    open_linked_line_count,
    remove_linked_line,
)
from sales.models import Sale, SaleLine

D = Decimal
pytestmark = pytest.mark.django_db


def add(
    actor: Any,
    order: Any,
    product: Any,
    quantity: Any = "1",
    **unknown: Any,
) -> SaleLine:
    return add_linked_line(
        actor=actor,
        order_ref=order,
        product_id=product.pk,
        quantity=quantity,
        **unknown,
    )


def test_first_line_creates_and_later_lines_reuse_a_linked_draft(
    actor: Any, maintenance_order: Any, product: Any, stock: Any
) -> None:
    stock(product, 5, "5.00")
    movements = InventoryMovement.objects.count()

    first = add(actor, maintenance_order, product, "1")
    second = add(actor, maintenance_order, product, "2")

    sale = Sale.objects.get(pk=first.sale_id)
    assert second.sale_id == sale.pk
    assert (sale.origin_type, sale.origin_order_id, sale.origin_reference) == (
        "MAINTENANCE",
        maintenance_order.pk,
        maintenance_order.number,
    )
    assert sale.customer_id == maintenance_order.customer_id
    assert (sale.condition, sale.state, sale.internal_number, sale.grand_total) == (
        "CONTADO",
        "DRAFT",
        None,
        None,
    )
    assert list(sale.lines.order_by("position").values_list("product_id", "quantity")) == [
        (product.pk, D(1)),
        (product.pk, D(2)),
    ]
    assert InventoryReservation.objects.filter(state="ACTIVE").count() == 2
    position = InventoryPosition.objects.get(product=product)
    assert (position.quantity, position.reserved) == (D(5), D(3))
    assert InventoryMovement.objects.count() == movements


@pytest.mark.parametrize("quantity", [None, "0", "-1", "1.5", 1.0])
def test_linked_line_rejects_invalid_quantity(
    actor: Any, maintenance_order: Any, product: Any, stock: Any, quantity: Any
) -> None:
    stock(product, 5, "5.00")
    with pytest.raises(SalesApplicationError) as error, transaction.atomic():
        add(actor, maintenance_order, product, quantity)
    assert "quantity" in error.value.errors
    assert not Sale.objects.filter(origin_order=maintenance_order).exists()


def test_linked_line_rejects_unavailable_inactive_service_and_client_prices(
    actor: Any,
    maintenance_order: Any,
    product: Any,
    stock: Any,
    make_product: Any,
) -> None:
    stock(product, 2, "2.00")
    with pytest.raises(SalesApplicationError) as unavailable, transaction.atomic():
        add(actor, maintenance_order, product, "3")
    assert unavailable.value.code == "insufficient_availability"

    inactive = make_product(is_active=False)
    with pytest.raises(SalesApplicationError) as inactive_error, transaction.atomic():
        add(actor, maintenance_order, inactive)
    assert inactive_error.value.code == "inactive_reference"

    service = Service.objects.create(
        id=999_999,
        name="Alineación",
        reference_price=D("20.00"),
        tax_definition=product.tax_definition,
    )
    with pytest.raises(SalesApplicationError) as service_error, transaction.atomic():
        add_linked_line(
            actor=actor,
            order_ref=maintenance_order,
            product_id=service.pk,
            quantity="1",
        )
    assert service_error.value.code == "inactive_reference"

    for unknown in ({"unit_price": "1.00"}, {"discount": "10"}):
        with pytest.raises(SalesApplicationError) as field, transaction.atomic():
            add(actor, maintenance_order, product, **unknown)
        assert field.value.code == "unknown_field"


def test_change_and_remove_validate_version_and_adjust_the_reservation(
    actor: Any, maintenance_order: Any, product: Any, stock: Any
) -> None:
    stock(product, 5, "5.00")
    line = add(actor, maintenance_order, product, "2")
    sale = Sale.objects.get(pk=line.sale_id)

    with pytest.raises(SalesApplicationError) as stale, transaction.atomic():
        change_linked_line(
            actor=actor,
            order_ref=maintenance_order,
            line_id=line.pk,
            quantity="3",
            expected_sale_version=sale.version - 1,
        )
    assert stale.value.code == "stale_record"

    changed = change_linked_line(
        actor=actor,
        order_ref=maintenance_order,
        line_id=line.pk,
        quantity="4",
        expected_sale_version=sale.version,
    )
    sale.refresh_from_db()
    assert (changed.quantity, sale.version, InventoryPosition.objects.get().reserved) == (
        D(4),
        3,
        D(4),
    )

    remove_linked_line(
        actor=actor,
        order_ref=maintenance_order,
        line_id=line.pk,
        expected_sale_version=sale.version,
    )
    sale.refresh_from_db()
    reservation = InventoryReservation.objects.get(source_id=line.pk)
    assert (sale.lines.count(), sale.version, reservation.state) == (0, 4, "RELEASED")
    assert InventoryPosition.objects.get().reserved == 0


def test_confirmed_linked_sale_lines_cannot_be_changed(
    actor: Any, maintenance_order: Any, product: Any, stock: Any
) -> None:
    stock(product, 5, "5.00")
    line = add(actor, maintenance_order, product)
    Sale.objects.filter(pk=line.sale_id).update(
        state="CONFIRMED",
        internal_number="COM-VEN-000888",
        operational_date=timezone.localdate(),
        base_total=D(1),
        tax_total=D(0),
        grand_total=D(1),
    )
    sale = Sale.objects.get(pk=line.sale_id)

    with pytest.raises(SalesApplicationError) as error, transaction.atomic():
        change_linked_line(
            actor=actor,
            order_ref=maintenance_order,
            line_id=line.pk,
            quantity="2",
            expected_sale_version=sale.version,
        )
    assert error.value.code == "linked_sale_locked"
    line.refresh_from_db()
    assert line.quantity == 1


def test_linked_queries_return_summaries_counts_blockers_and_availability_without_costs(
    actor: Any, maintenance_order: Any, product: Any, stock: Any
) -> None:
    stock(product, 5, "10.00")
    line = add(actor, maintenance_order, product, "2")

    summary = linked_sales_summary(maintenance_order.pk)
    assert summary[0]["id"] == line.sale_id
    assert summary[0]["lines"][0]["quantity"] == "2"
    assert "cost" not in repr(summary).lower()
    assert open_linked_line_count(maintenance_order.pk) == 1
    assert blocking_linked_documents(maintenance_order.pk) == [f"Borrador {line.sale_id}"]

    options = linked_product_options(search=product.code.lower(), page=1)
    option = options["results"][0]
    assert (option["quantity"], option["reserved"], option["available"]) == ("5", "2", "3")
    assert "cost" not in option
