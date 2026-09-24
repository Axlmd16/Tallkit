"""Cobros artesanales: contado, crédito, medios reales, correcciones e idempotencia."""

import uuid
from typing import Any

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    confirm_services,
    create,
    error_of,
    key,
)

from identity.application.authorization import BusinessPermissionDeniedError
from workshop.application import artisan_payments, service_operations
from workshop.models import ArtisanPayment, ArtisanPaymentCorrection

pytestmark = pytest.mark.django_db


@pytest.fixture
def make_operation(manager, artisan_billing, customer, vehicle, make_service):  # type: ignore[no-untyped-def]
    def build(condition: str = "CREDITO", price: str = "120.00") -> dict[str, Any]:
        order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=5)
        add_line(manager, order["id"], service_id=make_service().pk, applied_price=price)
        return confirm_services(manager, order["id"], condition)

    return build


def pay(actor: Any, target: int, *parts: tuple[str, str], **payload: Any) -> Any:
    payload.setdefault("operation_id", str(uuid.uuid4()))
    payload.setdefault("idempotency_key", key())
    payload.setdefault("parts", [{"method": m, "amount": a} for m, a in parts])
    return artisan_payments.register_payment(actor=actor, operation_id=target, payload=payload)


def detail(actor: Any, operation_id: int) -> dict[str, Any]:
    return service_operations.get_operation(actor=actor, operation_id=operation_id)


def test_cash_condition_requires_full_payment(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation("CONTADO")
    error = error_of(lambda: pay(manager, operation["id"], ("EFECTIVO", "50.00")))
    assert error.code == "validation_error"
    assert not ArtisanPayment.objects.exists()
    body = pay(manager, operation["id"], ("EFECTIVO", "120.00")).body
    assert (body["balance"], body["payment_state"]) == ("0.00", "PAID")


def test_credit_accepts_installments_and_derives_state(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation("CREDITO")
    assert detail(manager, operation["id"])["payment_state"] == "PENDING"
    first = pay(manager, operation["id"], ("EFECTIVO", "50.00")).body
    assert (first["balance"], first["payment_state"]) == ("70.00", "PARTIAL")
    second = pay(manager, operation["id"], ("TRANSFERENCIA", "70.00")).body
    assert (second["balance"], second["payment_state"]) == ("0.00", "PAID")


def test_combined_payment(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation("CONTADO", "100.00")
    body = pay(manager, operation["id"], ("EFECTIVO", "60.00"), ("TRANSFERENCIA", "40.00")).body
    [payment] = body["payments"]
    assert sorted((p["method"], p["amount"]) for p in payment["parts"]) == [
        ("EFECTIVO", "60.00"),
        ("TRANSFERENCIA", "40.00"),
    ]


@pytest.mark.parametrize(
    "parts",
    [
        [("EFECTIVO", "0.00")],
        [("EFECTIVO", "-5.00")],
        [("EFECTIVO", "10.005")],
        [("CREDITO", "10.00")],
        [("EFECTIVO", "10.00"), ("EFECTIVO", "5.00")],
        [("EFECTIVO", "120.01")],
    ],
)
def test_invalid_payments_are_rejected(manager, make_operation, parts) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation("CREDITO")
    error = error_of(lambda: pay(manager, operation["id"], *parts))
    assert error.code == "validation_error"
    assert not ArtisanPayment.objects.exists()


def test_voided_operation_and_commercial_sale_ids_are_not_payable(  # type: ignore[no-untyped-def]
    manager, admin, make_operation
) -> None:
    operation = make_operation("CREDITO")
    service_operations.void_operation(
        actor=admin,
        operation_id=operation["id"],
        payload={"reason": "Error", "expected_version": 1, "idempotency_key": key()},
    )
    assert error_of(lambda: pay(manager, operation["id"], ("EFECTIVO", "1.00"))).code == (
        "invalid_state"
    )
    assert error_of(lambda: pay(manager, 999_999, ("EFECTIVO", "1.00"))).code == "not_found"


def test_seller_cannot_pay_and_manager_cannot_correct(  # type: ignore[no-untyped-def]
    manager, seller, make_operation
) -> None:
    operation = make_operation("CREDITO")
    with pytest.raises(BusinessPermissionDeniedError):
        pay(seller, operation["id"], ("EFECTIVO", "10.00"))
    body = pay(manager, operation["id"], ("EFECTIVO", "10.00")).body
    with pytest.raises(BusinessPermissionDeniedError):
        artisan_payments.correct_payment(
            actor=manager,
            operation_id=operation["id"],
            payment_id=body["payments"][0]["id"],
            payload={"operation_id": str(uuid.uuid4()), "reason": "x", "idempotency_key": key()},
        )


def test_admin_voids_and_replaces_payments_keeping_history(  # type: ignore[no-untyped-def]
    manager, admin, make_operation
) -> None:
    operation = make_operation("CREDITO")
    first = pay(manager, operation["id"], ("EFECTIVO", "30.00")).body["payments"][0]
    voided = artisan_payments.correct_payment(
        actor=admin,
        operation_id=operation["id"],
        payment_id=first["id"],
        payload={
            "operation_id": str(uuid.uuid4()),
            "reason": "Duplicado",
            "idempotency_key": key(),
        },
    ).body
    assert voided["balance"] == "120.00"
    second = pay(manager, operation["id"], ("EFECTIVO", "50.00")).body["payments"][-1]
    replaced = artisan_payments.correct_payment(
        actor=admin,
        operation_id=operation["id"],
        payment_id=second["id"],
        payload={
            "operation_id": str(uuid.uuid4()),
            "reason": "Era transferencia",
            "replacement": {
                "operation_id": str(uuid.uuid4()),
                "parts": [{"method": "TRANSFERENCIA", "amount": "50.00"}],
            },
            "idempotency_key": key(),
        },
    ).body
    assert replaced["balance"] == "70.00"
    states = [(p["amount"], p["status"]) for p in replaced["payments"]]
    assert states == [("30.00", "VOIDED"), ("50.00", "REPLACED"), ("50.00", "EFFECTIVE")]
    assert ArtisanPaymentCorrection.objects.count() == 2
    assert ArtisanPayment.objects.count() == 3


def test_retry_with_same_operation_id_does_not_duplicate(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation("CREDITO")
    fact = str(uuid.uuid4())
    pay(manager, operation["id"], ("EFECTIVO", "10.00"), operation_id=fact)
    again = pay(manager, operation["id"], ("EFECTIVO", "10.00"), operation_id=fact)
    assert again.body["paid"] == "10.00"
    assert ArtisanPayment.objects.count() == 1
    conflict = error_of(
        lambda: pay(manager, operation["id"], ("EFECTIVO", "11.00"), operation_id=fact)
    )
    assert conflict.code == "idempotency_conflict"
