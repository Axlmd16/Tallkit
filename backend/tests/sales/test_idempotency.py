"""Identidad de transporte, identidad estable de operación y replay autorizado."""

import time
import uuid
from typing import Any

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import UserRole
from inventory.models import InventoryMovement
from sales.application import operations, payments, refunds, returns, reviews, sales
from sales.application.commands import IdempotencyConflictError
from sales.application.errors import SalesApplicationError
from sales.models import (
    CommercialPayment,
    CommercialRefund,
    PaymentPart,
    Sale,
    SaleReturn,
    SalesCommand,
)
from workshop_configuration.models import NumberAllocation, Warehouse

from .test_payments import parts, pay, request
from .test_refunds import refund_data
from .test_returns import do_return, item, line_id
from .test_returns import request as return_request

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


@pytest.mark.parametrize("key", ["corta", "x" * 129, "con espacios 123", "ñandú-12345"])
def test_transport_keys_follow_the_existing_format(
    seller: Any, customer: Any, product: Any, key: str
) -> None:
    with pytest.raises(SalesApplicationError) as error:
        sales.create_draft(
            actor=seller,
            payload={"idempotency_key": key, "customer_id": customer.pk, "condition": "CREDITO"},
        )
    assert "idempotency_key" in error.value.errors
    assert Sale.objects.count() == 0


@pytest.mark.parametrize("operation_id", [None, "no-es-uuid", 5, ""])
def test_money_operations_require_a_stable_uuid_distinct_from_the_transport_key(
    seller: Any, confirmed_sale: Any, operation_id: Any
) -> None:
    sale = confirmed_sale()
    with pytest.raises(SalesApplicationError) as error:
        payments.preview_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={"operation_id": operation_id, "parts": parts("10.00")},
        )
    assert "operation_id" in error.value.errors


def test_draft_creation_replays_to_the_same_draft(seller: Any, customer: Any) -> None:
    data = {
        "idempotency_key": "idem-draft-0001",
        "customer_id": customer.pk,
        "condition": "CREDITO",
    }
    first = sales.create_draft(actor=seller, payload=data)
    second = sales.create_draft(actor=seller, payload=data)
    assert second.replayed
    assert second.body["id"] == first.body["id"]
    assert Sale.objects.count() == 1


def test_compatible_reconfirmation_with_another_transport_key_duplicates_nothing(
    seller: Any, customer: Any, product: Any, stock: Any
) -> None:
    stock(product, 5, "20.00")
    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": "idem-reconf-0001",
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [{"product_id": product.pk, "quantity": "1"}],
        },
    ).body
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    base = {"expected_version": 1, "review_token": review["review_token"]}
    first = sales.confirm_sale(
        actor=seller, sale_id=draft["id"], payload={**base, "idempotency_key": "idem-reconf-0002"}
    )
    second = sales.confirm_sale(
        actor=seller, sale_id=draft["id"], payload={**base, "idempotency_key": "idem-reconf-0003"}
    )
    assert second.body["internal_number"] == first.body["internal_number"]
    assert NumberAllocation.objects.filter(consumer_type="sale").count() == 1
    assert InventoryMovement.objects.filter(movement_type="SALE_OUT").count() == 1
    assert CommercialPayment.objects.count() == 0


def test_reused_identity_with_incompatible_content_conflicts_without_effects(
    seller: Any, admin: Any, customer: Any, confirmed_sale: Any
) -> None:
    key = "idem-conflict-01"
    data = {"idempotency_key": key, "customer_id": customer.pk, "condition": "CREDITO"}
    sales.create_draft(actor=seller, payload=data)
    with pytest.raises(IdempotencyConflictError):
        sales.create_draft(actor=seller, payload={**data, "condition": "CONTADO"})
    assert Sale.objects.count() == 1

    sale = confirmed_sale(price="100.00", quantity=2)
    pay_data = request(sale["id"], parts("10.00"))
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=pay_data)
    payload = {
        **pay_data,
        "idempotency_key": "idem-pay-conflict",
        "review_token": review["review_token"],
    }
    payments.register_payment(actor=seller, sale_id=sale["id"], payload=payload)
    with pytest.raises(IdempotencyConflictError):
        payments.register_payment(
            actor=seller, sale_id=sale["id"], payload={**payload, "parts": parts("11.00")}
        )
    assert CommercialPayment.objects.count() == 1

    ret = return_request([item(line_id(sale["id"]), fit=1)])
    ret_review = returns.preview_return(actor=admin, sale_id=sale["id"], payload=ret)
    ret_payload = {
        **ret,
        "idempotency_key": "idem-ret-conflict",
        "review_token": ret_review["review_token"],
    }
    returns.register_return(actor=admin, sale_id=sale["id"], payload=ret_payload)
    with pytest.raises(IdempotencyConflictError):
        returns.register_return(
            actor=admin,
            sale_id=sale["id"],
            payload={**ret_payload, "reason": "Otro motivo distinto"},
        )
    assert SaleReturn.objects.count() == 1

    pay(seller, sale["id"], parts("90.00"))
    do_return(admin, sale["id"], return_request([item(line_id(sale["id"]), fit=1)]))
    latest = SaleReturn.objects.order_by("id").last()
    assert latest is not None
    ref = refund_data(latest, "50.00")
    ref_review = refunds.preview_refund(actor=admin, sale_id=sale["id"], payload=ref)
    ref_payload = {
        **ref,
        "idempotency_key": "idem-ref-conflict",
        "review_token": ref_review["review_token"],
    }
    refunds.register_refund(actor=admin, sale_id=sale["id"], payload=ref_payload)
    with pytest.raises(IdempotencyConflictError):
        refunds.register_refund(
            actor=admin, sale_id=sale["id"], payload={**ref_payload, "parts": parts("60.00")}
        )
    assert CommercialRefund.objects.count() == 1


def test_lost_response_replay_returns_the_existing_facts_without_new_money(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="50.00", quantity=2)
    data = request(sale["id"], parts("25.00"))
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
    payload = {**data, "idempotency_key": "idem-lost-0001", "review_token": review["review_token"]}
    first = payments.register_payment(actor=seller, sale_id=sale["id"], payload=payload)
    retry = payments.register_payment(actor=seller, sale_id=sale["id"], payload=payload)
    assert retry.body["id"] == first.body["id"]
    assert CommercialPayment.objects.count() == 1
    assert PaymentPart.objects.count() == 1
    assert retry.body["money"]["paid_total"] == "25.00"

    ret = return_request([item(line_id(sale["id"]), fit=1)])
    ret_review = returns.preview_return(actor=admin, sale_id=sale["id"], payload=ret)
    ret_payload = {
        **ret,
        "idempotency_key": "idem-lost-0002",
        "review_token": ret_review["review_token"],
    }
    returns.register_return(actor=admin, sale_id=sale["id"], payload=ret_payload)
    again = returns.register_return(actor=admin, sale_id=sale["id"], payload=ret_payload)
    assert again.replayed
    assert SaleReturn.objects.count() == 1


def test_authorization_is_checked_before_returning_a_replayed_result(
    seller: Any, customer: Any
) -> None:
    data = {
        "idempotency_key": "idem-auth-00001",
        "customer_id": customer.pk,
        "condition": "CREDITO",
    }
    sales.create_draft(actor=seller, payload=data)
    UserRole.objects.filter(user=seller).delete()
    with pytest.raises(BusinessPermissionDeniedError):
        sales.create_draft(actor=seller, payload=data)
    assert SalesCommand.objects.count() == 1


def test_replay_is_projected_with_current_permissions_and_without_costs(
    seller: Any, customer: Any, product: Any, stock: Any
) -> None:
    stock(product, 5, "20.00")
    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": "idem-proj-00001",
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [{"product_id": product.pk, "quantity": "1"}],
        },
    ).body
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    payload = {
        "idempotency_key": "idem-proj-00002",
        "expected_version": 1,
        "review_token": review["review_token"],
    }
    sales.confirm_sale(actor=seller, sale_id=draft["id"], payload=payload)
    replay = sales.confirm_sale(actor=seller, sale_id=draft["id"], payload=payload)
    text = str(replay.body).lower()
    assert replay.replayed
    assert "cost" not in text
    assert "applied_value" not in text


def test_expired_review_does_not_force_a_new_delivery_the_same_fact_is_revalidated(
    seller: Any, confirmed_sale: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    sale = confirmed_sale(price="100.00")
    data = request(sale["id"], parts("40.00"))
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
    payload = {**data, "idempotency_key": "idem-exp-000001", "review_token": review["review_token"]}
    real_time = time.time
    monkeypatch.setattr(time, "time", lambda: real_time() + 3600)
    with pytest.raises(SalesApplicationError) as expired:
        payments.register_payment(actor=seller, sale_id=sale["id"], payload=payload)
    monkeypatch.undo()
    assert expired.value.code == "review_required"
    assert CommercialPayment.objects.count() == 0
    fresh = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
    assert fresh["operation_id"] == data["operation_id"]
    registered = payments.register_payment(
        actor=seller,
        sale_id=sale["id"],
        payload={
            **data,
            "idempotency_key": "idem-exp-000002",
            "review_token": fresh["review_token"],
        },
    )
    assert str(CommercialPayment.objects.get().operation_id) == data["operation_id"]
    assert registered.body["operation_id"] == data["operation_id"]


def test_a_completely_rolled_back_attempt_can_be_revalidated_with_the_same_key(
    seller: Any, confirmed_sale: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    sale = confirmed_sale(price="100.00")
    data = request(sale["id"], parts("40.00"))
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
    payload = {
        **data,
        "idempotency_key": "idem-retry-00001",
        "review_token": review["review_token"],
    }

    def boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("fallo inyectado")

    monkeypatch.setattr(payments, "_bump_version", boom)
    with pytest.raises(RuntimeError):
        payments.register_payment(actor=seller, sale_id=sale["id"], payload=payload)
    monkeypatch.undo()
    assert CommercialPayment.objects.count() == 0
    assert SalesCommand.objects.filter(action="sales.payment_registered").count() == 0
    done = payments.register_payment(actor=seller, sale_id=sale["id"], payload=payload)
    assert done.status == 201
    assert CommercialPayment.objects.count() == 1


def test_operation_status_query_resolves_an_uncertain_result_with_the_sale_permissions(
    seller: Any, admin: Any, actor: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    data = request(sale["id"], parts("10.00"))
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
    payments.register_payment(
        actor=seller,
        sale_id=sale["id"],
        payload={
            **data,
            "idempotency_key": "idem-stat-00001",
            "review_token": review["review_token"],
        },
    )
    found = operations.operation_status(actor=seller, operation_id=uuid.UUID(data["operation_id"]))
    assert found["kind"] == "payment"
    assert found["result"]["amount"] == "10.00"
    with pytest.raises(SalesApplicationError) as missing:
        operations.operation_status(actor=seller, operation_id=uuid.uuid4())
    assert missing.value.code == "not_found"
    with pytest.raises(BusinessPermissionDeniedError):
        operations.operation_status(actor=actor, operation_id=uuid.UUID(data["operation_id"]))
    assert operations.operation_status(actor=admin, operation_id=uuid.UUID(data["operation_id"]))
