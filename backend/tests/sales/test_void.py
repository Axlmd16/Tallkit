"""Anulación conservadora: reversión exacta, sin devoluciones y con dinero tratado."""

import uuid
from decimal import Decimal
from itertools import count
from typing import Any

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition
from sales.application import refunds, voids
from sales.application.errors import SalesApplicationError
from sales.models import CommercialPayment, CommercialRefund, Sale, SaleVoid
from workshop_configuration.models import NumberAllocation, Warehouse

from .test_payment_corrections import correct
from .test_payments import parts, pay, summary
from .test_returns import do_return, item, line_id
from .test_returns import request as return_request

pytestmark = pytest.mark.django_db
D = Decimal
_keys = count(1)


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


def void_data(
    reason: str = "Error de captura", refund: dict[str, Any] | None = None
) -> dict[str, Any]:
    data: dict[str, Any] = {"reason": reason}
    if refund is not None:
        data["refund"] = refund
    return data


def refund_payload(cash: str) -> dict[str, Any]:
    return {"operation_id": str(uuid.uuid4()), "parts": parts(cash)}


def do_void(admin: Any, sale_id: int, data: dict[str, Any], key: str | None = None) -> Any:
    review = voids.preview_void(actor=admin, sale_id=sale_id, payload=data)
    assert review["can_void"], review["issues"]
    return voids.void_sale(
        actor=admin,
        sale_id=sale_id,
        payload={
            **data,
            "idempotency_key": key or f"void-key-{next(_keys):06d}",
            "expected_version": review["version"],
            "review_token": review["review_token"],
        },
    )


def test_voiding_an_untouched_sale_restores_stock_and_keeps_the_number(
    admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="10.00", quantity=3)
    body = do_void(admin, sale["id"], void_data()).body
    assert body["state"] == "VOIDED"
    assert body["internal_number"] == "COM-VEN-000001"
    assert body["void_reason"] == "Error de captura"
    money = body["money"]
    assert (money["exigible"], money["balance"], money["refund_due"]) == ("0.00", "0.00", "0.00")
    position = InventoryPosition.objects.get(product=sale["product"])
    assert (position.quantity, position.value, position.average) == (D(20), D("80.000000"), D("4"))
    reversal = InventoryOperation.objects.get(kind="REVERSAL")
    assert reversal.reverses_id == Sale.objects.get(pk=sale["id"]).inventory_operation_id
    movement = InventoryMovement.objects.get(movement_type="REVERSAL")
    assert movement.reverses_movement is not None
    assert SaleVoid.objects.get().sale_id == sale["id"]
    assert NumberAllocation.objects.filter(consumer_type="sale").count() == 1


def test_a_later_movement_in_one_of_several_products_rejects_the_whole_void(
    admin: Any, seller: Any, confirmed_sale: Any, make_product: Any, stock: Any, customer: Any
) -> None:
    from sales.application import reviews, sales

    a, b = make_product(), make_product()
    stock(a, 10, "40.00")
    stock(b, 10, "40.00")
    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": "void-multi-0001",
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [
                {"product_id": a.pk, "quantity": "1"},
                {"product_id": b.pk, "quantity": "1"},
            ],
        },
    ).body
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    sales.confirm_sale(
        actor=seller,
        sale_id=draft["id"],
        payload={
            "idempotency_key": "void-multi-0002",
            "expected_version": 1,
            "review_token": review["review_token"],
        },
    )
    stock(b, 2, "8.00")  # movimiento posterior solo en b
    before = InventoryMovement.objects.count()
    preview = voids.preview_void(actor=admin, sale_id=draft["id"], payload=void_data())
    assert preview["can_void"] is False
    assert preview["issues"][0]["code"] == "unsafe_reversal"
    assert InventoryMovement.objects.count() == before
    assert InventoryPosition.objects.get(product=a).quantity == D(9)
    assert Sale.objects.get(pk=draft["id"]).state == "CONFIRMED"
    assert not InventoryOperation.objects.filter(kind="REVERSAL").exists()


def test_a_sale_with_a_confirmed_return_cannot_be_voided(admin: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="10.00", quantity=3)
    do_return(admin, sale["id"], return_request([item(line_id(sale["id"]), fit=1)]))
    preview = voids.preview_void(actor=admin, sale_id=sale["id"], payload=void_data())
    assert preview["can_void"] is False
    assert preview["issues"][0]["code"] == "dependency_conflict"
    assert "devoluciones adicionales" in preview["issues"][0]["message"]
    assert Sale.objects.get(pk=sale["id"]).state == "CONFIRMED"


def test_money_received_without_treatment_blocks_the_void(
    admin: Any, seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    pay(seller, sale["id"], parts("100.00"))
    preview = voids.preview_void(actor=admin, sale_id=sale["id"], payload=void_data())
    assert preview["can_void"] is False
    assert preview["money_to_return"] == "100.00"
    with pytest.raises(SalesApplicationError):
        voids.void_sale(
            actor=admin,
            sale_id=sale["id"],
            payload={
                **void_data(),
                "idempotency_key": "void-money-0001",
                "expected_version": 2,
                "review_token": "x",
            },
        )
    assert Sale.objects.get(pk=sale["id"]).state == "CONFIRMED"
    assert CommercialPayment.objects.count() == 1
    assert CommercialRefund.objects.count() == 0


def test_void_with_an_explicit_disbursement_keeps_the_payment_and_links_the_refund(
    admin: Any, seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    pay(seller, sale["id"], parts("100.00"))
    body = do_void(admin, sale["id"], void_data(refund=refund_payload("100.00"))).body
    assert body["state"] == "VOIDED"
    money = body["money"]
    assert (money["exigible"], money["balance"], money["refund_due"]) == ("0.00", "0.00", "0.00")
    assert (money["paid_total"], money["refunded_total"], money["applied"]) == (
        "100.00",
        "100.00",
        "0.00",
    )
    refund = CommercialRefund.objects.get()
    assert refund.origin == "VOID"
    assert SaleVoid.objects.get().refund_id == refund.pk
    assert CommercialPayment.objects.count() == 1


@pytest.mark.parametrize("cash", ["99.99", "100.01"])
def test_the_disbursement_must_equal_the_money_applied(
    admin: Any, seller: Any, confirmed_sale: Any, cash: str
) -> None:
    sale = confirmed_sale(price="100.00")
    pay(seller, sale["id"], parts("100.00"))
    preview = voids.preview_void(
        actor=admin, sale_id=sale["id"], payload=void_data(refund=refund_payload(cash))
    )
    assert preview["can_void"] is False
    assert CommercialRefund.objects.count() == 0


def test_a_payment_corrected_before_the_void_needs_no_invented_refund(
    admin: Any, seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    payment = pay(seller, sale["id"], parts("100.00")).body
    correct(admin, sale["id"], payment["id"])
    rejected = voids.preview_void(
        actor=admin, sale_id=sale["id"], payload=void_data(refund=refund_payload("100.00"))
    )
    assert rejected["can_void"] is False
    body = do_void(admin, sale["id"], void_data()).body
    assert body["state"] == "VOIDED"
    assert CommercialRefund.objects.count() == 0
    assert CommercialPayment.objects.get().correction is not None


def test_a_failure_during_the_void_with_payment_treatment_keeps_the_previous_state(
    admin: Any, seller: Any, confirmed_sale: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    sale = confirmed_sale(price="100.00")
    pay(seller, sale["id"], parts("100.00"))
    data = void_data(refund=refund_payload("100.00"))
    review = voids.preview_void(actor=admin, sale_id=sale["id"], payload=data)
    payload = {
        **data,
        "idempotency_key": "void-fail-00001",
        "expected_version": review["version"],
        "review_token": review["review_token"],
    }
    original = refunds.insert_refund

    def failing(**kwargs: Any) -> Any:
        original(**kwargs)
        raise RuntimeError("fallo tras registrar el desembolso")

    monkeypatch.setattr(voids, "insert_refund", failing)
    with pytest.raises(RuntimeError):
        voids.void_sale(actor=admin, sale_id=sale["id"], payload=payload)
    monkeypatch.undo()
    current = Sale.objects.get(pk=sale["id"])
    assert (current.state, current.version) == ("CONFIRMED", review["version"])
    assert CommercialRefund.objects.count() == 0
    assert not InventoryOperation.objects.filter(kind="REVERSAL").exists()
    assert InventoryPosition.objects.get(product=sale["product"]).quantity == D(19)
    assert SaleVoid.objects.count() == 0
    retried = voids.void_sale(actor=admin, sale_id=sale["id"], payload=payload)
    assert retried.body["state"] == "VOIDED"
    assert CommercialRefund.objects.count() == 1
    assert InventoryMovement.objects.filter(movement_type="REVERSAL").count() == 1


def test_repeating_a_completed_void_returns_the_existing_result_without_new_effects(
    admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="10.00")
    data = void_data()
    review = voids.preview_void(actor=admin, sale_id=sale["id"], payload=data)
    payload = {
        **data,
        "idempotency_key": "void-repeat-001",
        "expected_version": review["version"],
        "review_token": review["review_token"],
    }
    first = voids.void_sale(actor=admin, sale_id=sale["id"], payload=payload)
    replay = voids.void_sale(actor=admin, sale_id=sale["id"], payload=payload)
    with_new_key = voids.void_sale(
        actor=admin, sale_id=sale["id"], payload={**payload, "idempotency_key": "void-repeat-002"}
    )
    assert replay.replayed
    assert first.body["id"] == with_new_key.body["id"]
    assert InventoryMovement.objects.filter(movement_type="REVERSAL").count() == 1
    assert SaleVoid.objects.count() == 1
    assert NumberAllocation.objects.filter(consumer_type="sale").count() == 1
    with pytest.raises(SalesApplicationError) as other_reason:
        voids.void_sale(
            actor=admin,
            sale_id=sale["id"],
            payload={**payload, "reason": "Otro motivo", "idempotency_key": "void-repeat-003"},
        )
    assert other_reason.value.code == "idempotency_conflict"


def test_only_the_administrator_can_void_and_drafts_cannot_be_voided(
    seller: Any, admin: Any, confirmed_sale: Any, customer: Any, product: Any
) -> None:
    sale = confirmed_sale(price="10.00")
    with pytest.raises(BusinessPermissionDeniedError):
        voids.preview_void(actor=seller, sale_id=sale["id"], payload=void_data())
    from sales.application import sales

    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": "void-draft-0001",
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [],
        },
    ).body
    review = voids.preview_void(actor=admin, sale_id=draft["id"], payload=void_data())
    assert review["can_void"] is False
    assert review["issues"][0]["code"] == "not_editable"
    assert summary(sale["id"])["exigible"] == "10.00"


@pytest.mark.parametrize("reason", ["", "   ", None])
def test_a_reason_is_mandatory(admin: Any, confirmed_sale: Any, reason: Any) -> None:
    sale = confirmed_sale(price="10.00")
    with pytest.raises(SalesApplicationError):
        voids.preview_void(actor=admin, sale_id=sale["id"], payload={"reason": reason})
