"""Concurrencia real sobre PostgreSQL de la integración: reservas, ventas, servicios y cobros."""

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.db import transaction
from tests.workshop.workshop_helpers import (
    add_line,
    add_part,
    confirm_services,
    create,
    key,
    lines_of,
    open_linked_sale,
    preview_services,
    update_line,
    version,
)

from catalog.application.inventory_references import lock_product_references
from inventory.application import posting
from inventory.models import InventoryMovement, InventoryPosition, InventoryReservation
from sales.application import reviews, sales
from sales.models import Sale
from workshop.application import artisan_payments, orders, parts, service_operations
from workshop.models import ArtisanPayment, ServiceOperation, ServiceOperationLine

pytestmark = pytest.mark.django_db(transaction=True)
D = Decimal


def outcome(results: list[tuple[str, Any]]) -> list[str]:
    return sorted("ok" if s == "ok" else getattr(v, "code", type(v).__name__) for s, v in results)


def position(product: Any) -> InventoryPosition:
    return InventoryPosition.objects.get(product=product)


def assert_non_negative(product: Any) -> None:
    pos = position(product)
    assert pos.quantity >= 0
    assert pos.quantity - pos.reserved >= 0


def open_order(manager: Any, customer: Any, vehicle: Any) -> dict[str, Any]:
    return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=1)


def complete(manager: Any, order_id: int, service: Any, price: str = "60.00") -> None:
    add_line(manager, order_id, service_id=service.pk, applied_price=price)
    orders.update_order(
        actor=manager,
        order_id=order_id,
        payload={
            "diagnosis": "Frenos",
            "expected_version": version(order_id),
            "idempotency_key": key(),
        },
    )


def reviewed_confirmation(seller: Any, sale_id: int) -> dict[str, Any]:
    sale = Sale.objects.get(pk=sale_id)
    token = reviews.preview_confirmation(actor=seller, sale_id=sale_id)["review_token"]
    return {"expected_version": sale.version, "review_token": token}


def confirm_sale(seller: Any, sale_id: int, reviewed: dict[str, Any]) -> Any:
    return sales.confirm_sale(
        actor=seller, sale_id=sale_id, payload={**reviewed, "idempotency_key": key()}
    )


def test_two_orders_reserving_the_last_unit(  # type: ignore[no-untyped-def]
    run_parallel, manager, artisan, commercial, make_customer, make_vehicle, stocked
) -> None:
    product = stocked(1)
    first, second = make_customer(), make_customer()
    orders_ = [open_order(manager, c, make_vehicle(c)) for c in (first, second)]
    results = run_parallel(
        *(lambda o=o: add_part(manager, o["id"], product.pk, 1) for o in orders_)
    )
    assert outcome(results) == ["insufficient_availability", "ok"]
    assert position(product).reserved == 1
    assert InventoryReservation.objects.filter(state="ACTIVE").count() == 1
    assert_non_negative(product)


def test_direct_sale_and_reservation_compete_for_last_unit(  # type: ignore[no-untyped-def]
    run_parallel, manager, seller, artisan, commercial, customer, vehicle, stocked
) -> None:
    product = stocked(1)
    order = open_order(manager, customer, vehicle)
    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": key(),
            "customer_id": customer.pk,
            "condition": "CONTADO",
            "lines": [{"product_id": product.pk, "quantity": "1"}],
        },
    ).body
    reviewed = reviewed_confirmation(seller, draft["id"])
    results = run_parallel(
        lambda: confirm_sale(seller, draft["id"], reviewed),
        lambda: add_part(manager, order["id"], product.pk, 1),
    )
    assert outcome(results) in (
        ["insufficient_availability", "ok"],
        ["insufficient_stock", "ok"],
    )
    assert_non_negative(product)
    pos = position(product)
    assert (pos.quantity, pos.reserved) in {(D(0), D(0)), (D(1), D(1))}


def test_reservation_against_negative_adjustment(  # type: ignore[no-untyped-def]
    run_parallel, manager, admin, artisan, commercial, customer, vehicle, stocked
) -> None:
    product = stocked(3)
    order = open_order(manager, customer, vehicle)

    def adjust() -> Any:
        with transaction.atomic():
            refs = lock_product_references([product.pk], require_active=False)
            operation = posting.prepare_operation(
                kind="ADJUSTMENT_OUT",
                actor=admin,
                source_type="",
                source_id=None,
                exit_lines=[posting.ExitLine(product.pk, D(2))],
            )
            posting.post_operation(
                operation,
                posting.lock_positions(refs, warehouse_id=commercial["warehouse"].pk),
                refs,
            )

    results = run_parallel(adjust, lambda: add_part(manager, order["id"], product.pk, 2))
    assert outcome(results).count("ok") == 1
    assert_non_negative(product)


def test_add_part_against_finalize(  # type: ignore[no-untyped-def]
    run_parallel, manager, admin, artisan, commercial, customer, vehicle, stocked, make_service
) -> None:
    product = stocked(5)
    order = open_order(manager, customer, vehicle)
    complete(manager, order["id"], make_service())
    current = version(order["id"])

    def finish() -> Any:
        return orders_finalize(admin, order["id"], current)

    results = run_parallel(finish, lambda: add_part(manager, order["id"], product.pk, 1))
    assert outcome(results).count("ok") == 1
    state = orders_state(order["id"])
    if state == "FINALIZED":
        assert not Sale.objects.filter(origin_order_id=order["id"], lines__isnull=False).exists()
        assert position(product).reserved == 0
    else:
        assert position(product).reserved == 1


def orders_finalize(actor: Any, order_id: int, current: int) -> Any:
    from workshop.application import transitions

    return transitions.finalize_order(
        actor=actor,
        order_id=order_id,
        payload={"expected_version": current, "idempotency_key": key()},
    )


def orders_state(order_id: int) -> str:
    from workshop.models import MaintenanceOrder

    return MaintenanceOrder.objects.get(pk=order_id).state


def test_change_line_against_confirming_linked_sale(  # type: ignore[no-untyped-def]
    run_parallel, manager, seller, artisan, commercial, customer, vehicle, stocked
) -> None:
    product = stocked(10)
    order = open_order(manager, customer, vehicle)
    add_part(manager, order["id"], product.pk, 2)
    sale = open_linked_sale(order["id"])
    line = sale.lines.get()
    reviewed = reviewed_confirmation(seller, sale.pk)

    def change() -> Any:
        return parts.change_part(
            actor=manager,
            order_id=order["id"],
            line_id=line.pk,
            payload={
                "quantity": "4",
                "expected_version": version(order["id"]),
                "idempotency_key": key(),
            },
        )

    run_parallel(change, lambda: confirm_sale(seller, sale.pk, reviewed))
    sale.refresh_from_db()
    if sale.state == "CONFIRMED":
        assert sale.lines.get().quantity == 2
        assert position(product).quantity == 8
    else:
        assert sale.lines.get().quantity == 4
        assert position(product).quantity == 10
    assert_non_negative(product)


def test_repeated_linked_confirmation_confirms_once(  # type: ignore[no-untyped-def]
    run_parallel, manager, seller, artisan, commercial, customer, vehicle, stocked
) -> None:
    product = stocked(10)
    order = open_order(manager, customer, vehicle)
    add_part(manager, order["id"], product.pk, 3)
    sale = open_linked_sale(order["id"])
    reviewed = reviewed_confirmation(seller, sale.pk)
    run_parallel(
        lambda: confirm_sale(seller, sale.pk, reviewed),
        lambda: confirm_sale(seller, sale.pk, reviewed),
    )
    sale.refresh_from_db()
    assert sale.state == "CONFIRMED"
    assert InventoryMovement.objects.filter(operation__source_type="SALE").count() == 1
    assert position(product).quantity == 7
    assert position(product).reserved == 0


def test_two_artisan_confirmations_of_the_same_order(  # type: ignore[no-untyped-def]
    run_parallel, manager, admin, artisan_billing, customer, vehicle, make_service
) -> None:
    order = open_order(manager, customer, vehicle)
    add_line(manager, order["id"], service_id=make_service().pk)
    digest = preview_services(manager, order["id"])["review_digest"]
    current = version(order["id"])

    def confirm(actor: Any) -> Any:
        return confirm_services(actor, order["id"], review_digest=digest, expected_version=current)

    results = run_parallel(lambda: confirm(manager), lambda: confirm(admin))
    assert outcome(results).count("ok") == 1
    assert ServiceOperation.objects.count() == 1
    assert ServiceOperationLine.objects.filter(is_current=True).count() == 1


def test_editing_a_service_line_against_documenting_it(  # type: ignore[no-untyped-def]
    run_parallel, manager, admin, artisan_billing, customer, vehicle, make_service
) -> None:
    order = open_order(manager, customer, vehicle)
    [line] = lines_of(
        add_line(manager, order["id"], service_id=make_service().pk, applied_price="25.00")
    )
    digest = preview_services(manager, order["id"])["review_digest"]
    current = version(order["id"])
    run_parallel(
        lambda: update_line(
            admin, order["id"], line["id"], applied_price="30.00", expected_version=current
        ),
        lambda: confirm_services(
            manager, order["id"], review_digest=digest, expected_version=current
        ),
    )
    documented = ServiceOperationLine.objects.filter(is_current=True).first()
    if documented is not None:
        assert documented.applied_price == D("25.00")


def test_two_full_artisan_payments_do_not_overpay(  # type: ignore[no-untyped-def]
    run_parallel, manager, admin, artisan_billing, customer, vehicle, make_service
) -> None:
    order = open_order(manager, customer, vehicle)
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="80.00")
    operation = confirm_services(manager, order["id"], "CREDITO")

    def pay(actor: Any) -> Any:
        return artisan_payments.register_payment(
            actor=actor,
            operation_id=operation["id"],
            payload={
                "operation_id": str(uuid.uuid4()),
                "parts": [{"method": "EFECTIVO", "amount": "80.00"}],
                "idempotency_key": key(),
            },
        )

    results = run_parallel(lambda: pay(manager), lambda: pay(admin))
    assert outcome(results) == ["ok", "validation_error"]
    assert ArtisanPayment.objects.count() == 1


def test_payment_against_voiding_the_operation(  # type: ignore[no-untyped-def]
    run_parallel, manager, admin, artisan_billing, customer, vehicle, make_service
) -> None:
    order = open_order(manager, customer, vehicle)
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="80.00")
    operation = confirm_services(manager, order["id"], "CREDITO")

    def pay() -> Any:
        return artisan_payments.register_payment(
            actor=manager,
            operation_id=operation["id"],
            payload={
                "operation_id": str(uuid.uuid4()),
                "parts": [{"method": "EFECTIVO", "amount": "10.00"}],
                "idempotency_key": key(),
            },
        )

    def void() -> Any:
        return service_operations.void_operation(
            actor=admin,
            operation_id=operation["id"],
            payload={"reason": "Error", "expected_version": 1, "idempotency_key": key()},
        )

    run_parallel(pay, void)
    final = ServiceOperation.objects.get(pk=operation["id"])
    paid = ArtisanPayment.objects.filter(service_operation=final).count()
    assert (final.state, paid) in {("VOIDED", 0), ("CONFIRMED", 1)}


def test_removing_the_last_line_against_confirming_the_linked_sale(  # type: ignore[no-untyped-def]
    run_parallel, manager, seller, artisan, commercial, customer, vehicle, stocked
) -> None:
    product = stocked(10)
    order = open_order(manager, customer, vehicle)
    add_part(manager, order["id"], product.pk, 2)
    sale = open_linked_sale(order["id"])
    line = sale.lines.get()
    reviewed = reviewed_confirmation(seller, sale.pk)

    def remove() -> Any:
        return parts.remove_part(
            actor=manager,
            order_id=order["id"],
            line_id=line.pk,
            payload={"expected_version": version(order["id"]), "idempotency_key": key()},
        )

    run_parallel(remove, lambda: confirm_sale(seller, sale.pk, reviewed))
    remaining = Sale.objects.filter(pk=sale.pk).first()
    if remaining is None:
        # Ganó el retiro: no hay venta, ni salida, ni reserva activa.
        assert position(product).quantity == 10
        assert not InventoryMovement.objects.filter(operation__source_type="SALE").exists()
    else:
        # Ganó la confirmación: la línea se conserva y salió una sola vez.
        assert remaining.state == "CONFIRMED"
        assert position(product).quantity == 8
    assert position(product).reserved == 0
    assert InventoryReservation.objects.filter(state="ACTIVE").count() == 0
