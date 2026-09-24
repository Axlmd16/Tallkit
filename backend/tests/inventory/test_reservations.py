"""Reservas trazables que reducen disponibilidad sin mover existencia."""

from decimal import Decimal
from typing import Any

import pytest
from django.db import IntegrityError, transaction

from catalog.application.inventory_references import lock_product_references
from inventory.application.posting import ContextNotLockedError, lock_positions
from inventory.application.reservations import (
    InsufficientAvailabilityError,
    read_availability,
    release,
    reserve,
    resize,
)
from inventory.models import InventoryPosition, InventoryReservation

D = Decimal
pytestmark = pytest.mark.django_db


def stock_position(product: Any, warehouse: Any, *, quantity: int = 5) -> InventoryPosition:
    return InventoryPosition.objects.create(
        product=product,
        warehouse=warehouse,
        quantity=D(quantity),
        value=D(quantity),
        average=D(1),
    )


def locked_for(product: Any, warehouse: Any):  # type: ignore[no-untyped-def]
    refs = lock_product_references([product.pk])
    return lock_positions(refs, warehouse_id=warehouse.pk)


def reserve_line(locked: Any, product: Any, *, source_id: int = 101, quantity: int = 2):  # type: ignore[no-untyped-def]
    return reserve(
        locked,
        product_id=product.pk,
        source_type="SALE_LINE",
        source_id=source_id,
        source_reference={"sale_id": 11, "order_id": 7},
        quantity=D(quantity),
    )


@pytest.mark.django_db(transaction=True)
def test_reserve_requires_an_outer_transaction(product: Any) -> None:
    with pytest.raises(RuntimeError, match="transacción"):
        reserve_line(object(), product)


def test_reserve_requires_positions_from_the_inventory_lock(product: Any) -> None:
    with pytest.raises(ContextNotLockedError):
        reserve_line(object(), product)


def test_reserve_resize_and_release_keep_position_aggregate_and_history(
    product: Any, warehouse: Any
) -> None:
    position = stock_position(product, warehouse)
    locked = locked_for(product, warehouse)

    reservation = reserve_line(locked, product)
    position.refresh_from_db()
    assert (position.quantity, position.reserved) == (D(5), D(2))
    assert reservation.state == "ACTIVE"

    resized = resize(
        locked,
        source_type="SALE_LINE",
        source_id=101,
        quantity=D(4),
    )
    position.refresh_from_db()
    assert resized.pk == reservation.pk
    assert position.reserved == D(4)

    released = release(locked, source_type="SALE_LINE", source_id=101)
    position.refresh_from_db()
    reservation.refresh_from_db()
    assert released.pk == reservation.pk
    assert reservation.state == "RELEASED"
    assert position.reserved == D(0)
    assert InventoryReservation.objects.filter(pk=reservation.pk).exists()


def test_reserve_and_resize_reject_insufficient_availability(product: Any, warehouse: Any) -> None:
    position = stock_position(product, warehouse, quantity=3)
    locked = locked_for(product, warehouse)

    with pytest.raises(InsufficientAvailabilityError) as reserve_error:
        reserve_line(locked, product, quantity=4)
    assert (reserve_error.value.available, reserve_error.value.requested) == (D(3), D(4))
    assert not InventoryReservation.objects.exists()

    reserve_line(locked, product, quantity=2)
    with pytest.raises(InsufficientAvailabilityError) as resize_error:
        resize(locked, source_type="SALE_LINE", source_id=101, quantity=D(4))
    position.refresh_from_db()
    assert (resize_error.value.available, resize_error.value.requested) == (D(1), D(2))
    assert position.reserved == D(2)


def test_only_one_active_reservation_exists_per_source(product: Any, warehouse: Any) -> None:
    position = stock_position(product, warehouse)
    reserve_line(locked_for(product, warehouse), product)

    with pytest.raises(IntegrityError), transaction.atomic():
        InventoryReservation.objects.create(
            position=position,
            product=product,
            warehouse=warehouse,
            source_type="SALE_LINE",
            source_id=101,
            source_reference={"sale_id": 11, "order_id": 7},
            quantity=D(1),
            state="ACTIVE",
        )


@pytest.mark.parametrize("reserved", [D(-1), D(6), D("1.5")])
def test_database_rejects_reserved_outside_whole_available_range(
    product: Any, warehouse: Any, reserved: Decimal
) -> None:
    stock_position(product, warehouse, quantity=5)
    rows = InventoryPosition.objects.filter(product=product, warehouse=warehouse)
    with pytest.raises(IntegrityError), transaction.atomic():
        rows.update(reserved=reserved)


def test_read_availability_reports_quantity_reserved_and_available(
    product: Any, warehouse: Any
) -> None:
    stock_position(product, warehouse, quantity=5)
    reserve_line(locked_for(product, warehouse), product, quantity=2)

    availability = read_availability([product.pk], warehouse_id=warehouse.pk)[product.pk]
    assert (availability.quantity, availability.reserved, availability.available) == (
        D(5),
        D(2),
        D(3),
    )
