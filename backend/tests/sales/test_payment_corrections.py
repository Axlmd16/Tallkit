"""Corrección administrativa de pagos sin borrar historia."""

import uuid
from decimal import Decimal
from itertools import count
from typing import Any

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import AuditEvent
from sales.application import payments, queries
from sales.application.errors import SalesApplicationError
from sales.models import (
    CommercialPayment,
    CommercialRefund,
    PaymentCorrection,
    PaymentPart,
    Sale,
)
from workshop_configuration.models import Warehouse

from .test_payments import parts, pay, summary

pytestmark = pytest.mark.django_db
D = Decimal
_keys = count(1)


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


def correct(
    admin: Any, sale_id: int, payment_id: int, reason: str = "Monto mal digitado", **extra: Any
) -> Any:
    data: dict[str, Any] = {"operation_id": str(uuid.uuid4()), "reason": reason, **extra}
    review = payments.preview_correction(
        actor=admin, sale_id=sale_id, payment_id=payment_id, payload=data
    )
    assert review["can_correct"], review["issues"]
    return payments.correct_payment(
        actor=admin,
        sale_id=sale_id,
        payment_id=payment_id,
        payload={
            **data,
            "idempotency_key": f"cor-key-{next(_keys):06d}",
            "review_token": review["review_token"],
        },
    )


def make_full_return_and_refund(admin: Any, sale: Sale) -> None:
    """Estado equivalente a una devolución total con su reembolso efectivo registrado."""
    from django.utils import timezone

    from sales.models import RefundPart, SaleReturn

    now = timezone.now()
    sale_return = SaleReturn.objects.create(
        operation_id=uuid.uuid4(),
        sale=sale,
        reason="Devolución total",
        effective_at=now,
        effective_date=timezone.localdate(),
        base_total=D("86.96"),
        tax_total=D("13.04"),
        grand_total=D("100.00"),
        created_by=admin,
    )
    refund = CommercialRefund.objects.create(
        operation_id=uuid.uuid4(),
        sale=sale,
        origin="RETURN",
        sale_return=sale_return,
        amount=D("100.00"),
        effective_at=now,
        effective_date=timezone.localdate(),
        created_by=admin,
    )
    RefundPart.objects.create(refund=refund, method="EFECTIVO", amount=D("100.00"))


def replacement(cash: str | None = None, transfer: str | None = None) -> dict[str, Any]:
    return {"operation_id": str(uuid.uuid4()), "parts": parts(cash, transfer)}


def test_voiding_an_erroneous_payment_keeps_the_original_and_restores_the_balance(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    payment = pay(seller, sale["id"], parts("100.00")).body
    body = correct(admin, sale["id"], payment["id"]).body
    assert body["state"] == "CORRECTED"
    assert body["correction"]["reason"] == "Monto mal digitado"
    original = CommercialPayment.objects.get(pk=payment["id"])
    assert original.amount == D("100.00")
    assert original.parts.get().amount == D("100.00")
    money = summary(sale["id"])
    assert (money["balance"], money["payment_state"], money["paid_total"]) == (
        "100.00",
        "PENDING",
        "0.00",
    )
    assert Sale.objects.get(pk=sale["id"]).state == "CONFIRMED"
    assert AuditEvent.objects.filter(action="sales.payment_corrected", result="SUCCESS").exists()


def test_replacing_the_method_keeps_both_linked_and_never_counts_200(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    payment = pay(seller, sale["id"], parts("100.00")).body
    correct(admin, sale["id"], payment["id"], replacement=replacement(None, "100.00"))
    correction = PaymentCorrection.objects.get()
    assert correction.original_payment_id == payment["id"]
    assert correction.replacement_payment is not None
    assert correction.replacement_payment.parts.get().method == "TRANSFERENCIA"
    money = summary(sale["id"])
    assert (money["paid_total"], money["balance"], money["payment_state"]) == (
        "100.00",
        "0.00",
        "PAID",
    )
    from sales.application import ledger

    totals = ledger.method_totals(Sale.objects.get(pk=sale["id"]))
    assert totals == {"TRANSFERENCIA": D("100.00")}
    assert CommercialPayment.objects.count() == 2


@pytest.mark.parametrize("reason", ["", "   ", None, 5])
def test_a_missing_or_blank_reason_is_rejected(
    seller: Any, admin: Any, confirmed_sale: Any, reason: Any
) -> None:
    sale = confirmed_sale()
    payment = pay(seller, sale["id"], parts("10.00")).body
    with pytest.raises(SalesApplicationError):
        payments.preview_correction(
            actor=admin,
            sale_id=sale["id"],
            payment_id=payment["id"],
            payload={"operation_id": str(uuid.uuid4()), "reason": reason},
        )
    assert PaymentCorrection.objects.count() == 0


@pytest.mark.parametrize(
    "bad",
    [
        {"parts": [{"method": "EFECTIVO", "amount": "10.001"}]},
        {"parts": [{"method": "CREDITO", "amount": "10.00"}]},
        {"parts": [{"method": "EFECTIVO", "amount": "500.00"}]},
    ],
)
def test_an_invalid_replacement_leaves_the_original_in_force(
    seller: Any, admin: Any, confirmed_sale: Any, bad: dict[str, Any]
) -> None:
    sale = confirmed_sale(price="100.00")
    payment = pay(seller, sale["id"], parts("60.00")).body
    data = {
        "operation_id": str(uuid.uuid4()),
        "reason": "Corrección",
        "replacement": {"operation_id": str(uuid.uuid4()), **bad},
    }
    try:
        review = payments.preview_correction(
            actor=admin, sale_id=sale["id"], payment_id=payment["id"], payload=data
        )
        assert review["can_correct"] is False
    except SalesApplicationError:
        pass
    assert PaymentCorrection.objects.count() == 0
    assert summary(sale["id"])["paid_total"] == "60.00"


def test_cash_sale_replacement_must_settle_the_full_balance(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00", condition="CONTADO")
    payment = pay(seller, sale["id"], parts("100.00")).body
    review = payments.preview_correction(
        actor=admin,
        sale_id=sale["id"],
        payment_id=payment["id"],
        payload={
            "operation_id": str(uuid.uuid4()),
            "reason": "Parcial",
            "replacement": replacement("40.00"),
        },
    )
    assert review["can_correct"] is False
    correct(admin, sale["id"], payment["id"], replacement=replacement("100.00"))


def test_a_payment_that_backs_an_effective_refund_cannot_be_voided(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    payment = pay(seller, sale["id"], parts("100.00")).body
    make_full_return_and_refund(admin, Sale.objects.get(pk=sale["id"]))
    review = payments.preview_correction(
        actor=admin,
        sale_id=sale["id"],
        payment_id=payment["id"],
        payload={"operation_id": str(uuid.uuid4()), "reason": "Error"},
    )
    assert review["can_correct"] is False
    assert review["issues"][0]["code"] == "dependency_conflict"
    assert CommercialRefund.objects.count() == 1
    assert PaymentCorrection.objects.count() == 0
    money = summary(sale["id"])
    assert (money["balance"], money["refund_due"]) == ("0.00", "0.00")


def test_a_correction_is_never_a_refund_and_moves_no_money_between_sales(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    first = confirmed_sale(price="100.00")
    second = confirmed_sale(price="50.00")
    payment = pay(seller, first["id"], parts("100.00")).body
    correct(admin, first["id"], payment["id"])
    assert CommercialRefund.objects.count() == 0
    assert summary(first["id"])["refunded_total"] == "0.00"
    assert summary(second["id"])["paid_total"] == "0.00"
    assert CommercialPayment.objects.filter(sale_id=second["id"]).count() == 0


def test_a_payment_can_only_be_corrected_once_and_only_by_its_own_sale(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    other = confirmed_sale(price="10.00")
    payment = pay(seller, sale["id"], parts("50.00")).body
    correct(admin, sale["id"], payment["id"])
    again = payments.preview_correction(
        actor=admin,
        sale_id=sale["id"],
        payment_id=payment["id"],
        payload={"operation_id": str(uuid.uuid4()), "reason": "Otra vez"},
    )
    assert again["can_correct"] is False
    with pytest.raises(SalesApplicationError) as foreign:
        payments.preview_correction(
            actor=admin,
            sale_id=other["id"],
            payment_id=payment["id"],
            payload={"operation_id": str(uuid.uuid4()), "reason": "Cruzado"},
        )
    assert foreign.value.code == "not_found"


def test_the_seller_cannot_correct_payments(seller: Any, admin: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale()
    payment = pay(seller, sale["id"], parts("10.00")).body
    with pytest.raises(BusinessPermissionDeniedError):
        payments.preview_correction(
            actor=seller,
            sale_id=sale["id"],
            payment_id=payment["id"],
            payload={"operation_id": str(uuid.uuid4()), "reason": "No autorizado"},
        )


def test_correction_locks_the_sale_before_the_payment_never_the_reverse(
    seller: Any, admin: Any, confirmed_sale: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    sale = confirmed_sale()
    payment = pay(seller, sale["id"], parts("10.00")).body
    order: list[str] = []
    for name in ("lock_sale", "lock_payment"):
        module = payments
        original = getattr(module, name)

        def wrapper(*args: Any, _name: str = name, _original: Any = original, **kw: Any) -> Any:
            order.append(_name)
            return _original(*args, **kw)

        monkeypatch.setattr(module, name, wrapper)
    correct(admin, sale["id"], payment["id"])
    assert order == ["lock_sale", "lock_payment"]


def test_correction_replay_with_the_same_operation_does_not_correct_twice(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale()
    payment = pay(seller, sale["id"], parts("10.00")).body
    data = {"operation_id": str(uuid.uuid4()), "reason": "Error"}
    review = payments.preview_correction(
        actor=admin, sale_id=sale["id"], payment_id=payment["id"], payload=data
    )
    payload = {**data, "idempotency_key": "cor-replay-0001", "review_token": review["review_token"]}
    payments.correct_payment(
        actor=admin, sale_id=sale["id"], payment_id=payment["id"], payload=payload
    )
    payments.correct_payment(
        actor=admin,
        sale_id=sale["id"],
        payment_id=payment["id"],
        payload={**payload, "idempotency_key": "cor-replay-0002"},
    )
    assert PaymentCorrection.objects.count() == 1
    assert PaymentPart.objects.count() == 1
    assert queries.payment_detail(CommercialPayment.objects.get())["state"] == "CORRECTED"
