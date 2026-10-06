"""Resumen económico por RUC y vista comercial restringida del Vendedor."""

import uuid
from typing import Any

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    add_part,
    confirm_linked_sale,
    confirm_services,
    create,
    error_of,
    key,
)

from identity.application.authorization import BusinessPermissionDeniedError
from workshop.application import artisan_payments, economic_summary, queries, service_operations

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(manager, artisan_billing, commercial, customer, vehicle) -> dict[str, Any]:  # type: ignore[no-untyped-def]
    return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=1)


def summary(actor: Any, order_id: int) -> dict[str, Any]:
    return economic_summary.order_economic_summary(actor=actor, order_id=order_id)


def test_both_blocks_are_separated_by_ruc(  # type: ignore[no-untyped-def]
    admin, manager, seller, order, make_service, stocked
) -> None:
    add_part(manager, order["id"], stocked(5, price="40.00").pk, 1)
    sale = confirm_linked_sale(seller, order["id"], "CREDITO")
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="60.00")
    operation = confirm_services(manager, order["id"], "CONTADO")
    artisan_payments.register_payment(
        actor=manager,
        operation_id=operation["id"],
        payload={
            "operation_id": str(uuid.uuid4()),
            "parts": [{"method": "EFECTIVO", "amount": "60.00"}],
            "idempotency_key": key(),
        },
    )

    body = summary(admin, order["id"])

    [commercial_doc] = body["commercial"]["documents"]
    assert (commercial_doc["internal_number"], commercial_doc["fiscal_entity"]) == (
        sale["internal_number"],
        "COMERCIAL",
    )
    assert (commercial_doc["balance"], commercial_doc["payment_state"]) == ("40.00", "PENDING")
    assert "pay" in commercial_doc["allowed_actions"]
    [artisan_doc] = body["artisan"]["documents"]
    assert (artisan_doc["balance"], artisan_doc["payment_state"]) == ("0.00", "PAID")
    assert body["combined"] == {
        "informative": True,
        "confirmed_total": "100.00",
        "pending_total": "0.00",
    }


def test_only_services_block_and_no_empty_documents(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="25.00")
    confirm_services(manager, order["id"])
    body = summary(manager, order["id"])
    assert body["commercial"]["documents"] == []
    assert body["commercial"]["pending"] is None
    assert len(body["artisan"]["documents"]) == 1


def test_only_parts_with_zero_priced_services(  # type: ignore[no-untyped-def]
    manager, seller, order, make_service, stocked
) -> None:
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="0.00")
    add_part(manager, order["id"], stocked(5).pk, 1)
    confirm_linked_sale(seller, order["id"])
    body = summary(manager, order["id"])
    assert body["artisan"]["documents"] == []
    assert body["artisan"]["pending"] is None
    assert len(body["commercial"]["documents"]) == 1


def test_pending_amounts_are_separated_from_confirmed(  # type: ignore[no-untyped-def]
    manager, order, make_service, stocked
) -> None:
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="60.00")
    confirm_services(manager, order["id"], "CREDITO")
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="15.00")
    add_part(manager, order["id"], stocked(5, price="11.50").pk, 2)

    body = summary(manager, order["id"])

    assert body["artisan"]["confirmed_total"] == "60.00"
    assert body["artisan"]["balance_total"] == "60.00"
    assert body["artisan"]["pending"]["estimated_total"] == "15.00"
    assert body["artisan"]["pending"]["label"] == "Sin comprobante: todavía no genera deuda."
    assert body["commercial"]["pending"]["estimated_total"] == "23.00"
    assert body["commercial"]["pending"]["label"].startswith("Reservado")
    assert body["commercial"]["confirmed_total"] == "0.00"


def test_historical_documents_show_void_and_replacement(  # type: ignore[no-untyped-def]
    admin, manager, order, make_service
) -> None:
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="60.00")
    original = confirm_services(manager, order["id"])
    service_operations.void_operation(
        actor=admin,
        operation_id=original["id"],
        payload={"reason": "Error", "expected_version": 1, "idempotency_key": key()},
    )
    confirm_services(manager, order["id"])

    body = summary(admin, order["id"])

    states = [(d["internal_number"], d["state"]) for d in body["artisan"]["documents"]]
    assert states == [("ART-SER-000001", "VOIDED"), ("ART-SER-000002", "CONFIRMED")]
    assert body["artisan"]["documents"][1]["replaces"]["internal_number"] == "ART-SER-000001"
    assert body["artisan"]["balance_total"] == "60.00"


def test_manager_sees_commercial_block_without_actions_or_combined(  # type: ignore[no-untyped-def]
    manager, seller, order, stocked
) -> None:
    add_part(manager, order["id"], stocked(5).pk, 1)
    confirm_linked_sale(seller, order["id"])
    body = summary(manager, order["id"])
    [doc] = body["commercial"]["documents"]
    assert doc["allowed_actions"] == []
    assert "payments" not in doc
    assert body["combined"] is None


def test_seller_cannot_read_order_summary(seller, order) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(BusinessPermissionDeniedError):
        summary(seller, order["id"])


def test_seller_commercial_view_is_restricted(  # type: ignore[no-untyped-def]
    manager, seller, order, make_service, stocked
) -> None:
    assert (
        error_of(lambda: economic_summary.commercial_view(actor=seller, order_id=order["id"])).code
        == "not_found"
    )
    add_line(manager, order["id"], service_id=make_service().pk)
    add_part(manager, order["id"], stocked(5).pk, 1)

    view = economic_summary.commercial_view(actor=seller, order_id=order["id"])

    assert view["number"] == order["number"]
    assert set(view) == {"id", "number", "state", "opened_on", "customer", "vehicle", "parts"}
    assert view["vehicle"]["plate"]
    assert len(view["parts"]) == 1
    with pytest.raises(BusinessPermissionDeniedError):
        queries.list_orders(actor=seller)


def test_artisan_withholding_never_reduces_the_linked_commercial_sale(  # type: ignore[no-untyped-def]
    admin, manager, seller, order, make_service, stocked
) -> None:
    add_part(manager, order["id"], stocked(5, price="40.00").pk, 1)
    confirm_linked_sale(seller, order["id"], "CREDITO")
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="250.00")
    operation = confirm_services(manager, order["id"], "CONTADO")
    artisan_payments.register_payment(
        actor=manager,
        operation_id=operation["id"],
        payload={
            "operation_id": str(uuid.uuid4()),
            "parts": [{"method": "TRANSFERENCIA", "amount": "245.00"}],
            "withholding": {"amount": "5.00"},
            "idempotency_key": key(),
        },
    )

    body = summary(admin, order["id"])

    [artisan_doc] = body["artisan"]["documents"]
    assert (artisan_doc["paid"], artisan_doc["withheld"], artisan_doc["balance"]) == (
        "245.00",
        "5.00",
        "0.00",
    )
    [commercial_doc] = body["commercial"]["documents"]
    assert (commercial_doc["paid"], commercial_doc["withheld"], commercial_doc["balance"]) == (
        "0.00",
        "0.00",
        "40.00",
    )
    receivables = queries.artisan_receivables(actor=manager)
    assert receivables["results"] == []
