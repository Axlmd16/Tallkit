"""Cuentas por cobrar artesanales: filtros, sumas de todas las coincidencias y antigüedad."""

import uuid
from datetime import timedelta
from typing import Any

import pytest
from tests.workshop.workshop_helpers import add_line, confirm_services, create, error_of, key

from identity.application.authorization import BusinessPermissionDeniedError
from workshop.application import artisan_payments, queries
from workshop.models import ServiceOperation

pytestmark = pytest.mark.django_db


@pytest.fixture
def operations(manager, artisan_billing, make_customer, make_vehicle, make_service):  # type: ignore[no-untyped-def]
    built: dict[str, Any] = {}
    for label, price, paid in (
        ("a", "30.00", None),
        ("b", "70.00", "20.00"),
        ("c", "10.00", "10.00"),
    ):
        customer = make_customer()
        vehicle = make_vehicle(customer)
        order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=1)
        add_line(manager, order["id"], service_id=make_service().pk, applied_price=price)
        operation = confirm_services(manager, order["id"], "CREDITO")
        if paid:
            artisan_payments.register_payment(
                actor=manager,
                operation_id=operation["id"],
                payload={
                    "operation_id": str(uuid.uuid4()),
                    "parts": [{"method": "EFECTIVO", "amount": paid}],
                    "idempotency_key": key(),
                },
            )
        built[label] = {"operation": operation, "customer": customer, "order": order}
    return built


def test_receivables_list_pending_debts_with_totals(manager, operations) -> None:  # type: ignore[no-untyped-def]
    body = queries.artisan_receivables(actor=manager)
    numbers = {row["internal_number"] for row in body["results"]}
    assert numbers == {
        operations["a"]["operation"]["internal_number"],
        operations["b"]["operation"]["internal_number"],
    }
    assert body["totals"] == {"grand_total": "100.00", "paid": "20.00", "balance": "80.00"}
    assert (body["count"], body["total_pages"]) == (2, 1)
    assert all(row["fiscal_entity"] == "ARTESANAL" for row in body["results"])
    assert all(row["document_type"] == "SERVICIO" for row in body["results"])


def test_filters_by_customer_order_and_payment_state(manager, operations) -> None:  # type: ignore[no-untyped-def]
    by_customer = queries.artisan_receivables(
        actor=manager, customer_id=operations["b"]["customer"].pk
    )
    assert [row["balance"] for row in by_customer["results"]] == ["50.00"]
    partial = queries.artisan_receivables(actor=manager, payment_state="PARTIAL")
    assert [row["payment_state"] for row in partial["results"]] == ["PARTIAL"]
    paid = queries.artisan_receivables(actor=manager, payment_state="PAID")
    assert [row["balance"] for row in paid["results"]] == ["0.00"]
    by_order = queries.artisan_receivables(actor=manager, order_id=operations["a"]["order"]["id"])
    assert by_order["totals"]["balance"] == "30.00"


def test_page_size_does_not_change_totals(manager, operations) -> None:  # type: ignore[no-untyped-def]
    first = queries.artisan_receivables(actor=manager, page_size=1)
    second = queries.artisan_receivables(actor=manager, page_size=1, page=2)
    assert first["totals"]["balance"] == second["totals"]["balance"] == "80.00"
    assert {row["id"] for row in first["results"]} != {row["id"] for row in second["results"]}


def test_age_is_days_since_confirmation_without_overdue(manager, operations) -> None:  # type: ignore[no-untyped-def]
    operation = ServiceOperation.objects.get(pk=operations["a"]["operation"]["id"])
    operation.operational_date -= timedelta(days=10)
    operation.save(update_fields=["operational_date"])
    row = next(
        r for r in queries.artisan_receivables(actor=manager)["results"] if r["id"] == operation.pk
    )
    assert row["age_days"] == 10
    assert "due_date" not in row
    assert "overdue" not in row


def test_invalid_filters_and_seller_denied(manager, seller, operations) -> None:  # type: ignore[no-untyped-def]
    assert error_of(lambda: queries.artisan_receivables(actor=manager, payment_state="X")).code == (
        "validation_error"
    )
    with pytest.raises(BusinessPermissionDeniedError):
        queries.artisan_receivables(actor=seller)
