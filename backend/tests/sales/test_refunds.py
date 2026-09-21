"""Reembolsos efectivos del exceso pagado tras una devolución."""

import uuid
from decimal import Decimal
from itertools import count
from typing import Any

import pytest
from django.db import DatabaseError, transaction

from identity.application.authorization import BusinessPermissionDeniedError
from sales.application import refunds
from sales.application.errors import SalesApplicationError
from sales.models import CommercialRefund, RefundPart, Sale, SaleReturn
from workshop_configuration.models import Warehouse

from .test_payments import parts, pay, summary
from .test_returns import do_return, item, line_id
from .test_returns import request as return_request

pytestmark = pytest.mark.django_db
D = Decimal
_keys = count(1)


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


@pytest.fixture
def paid_sale(seller: Any, admin: Any, confirmed_sale: Any) -> dict[str, Any]:
    """Venta de 100.00 pagada; devolver dos de cinco unidades deja el exigible en 60.00."""
    sale: dict[str, Any] = confirmed_sale(price="20.00", quantity=5)
    pay(seller, sale["id"], parts("100.00"))
    do_return(admin, sale["id"], return_request([item(line_id(sale["id"]), fit=2)]))
    return sale


def refund_data(
    sale_return: SaleReturn, cash: str, reason: str = "Devolución al cliente"
) -> dict[str, Any]:
    return {
        "operation_id": str(uuid.uuid4()),
        "sale_return_id": sale_return.pk,
        "reason": reason,
        "parts": parts(cash),
    }


def do_refund(admin: Any, sale_id: int, data: dict[str, Any]) -> Any:
    review = refunds.preview_refund(actor=admin, sale_id=sale_id, payload=data)
    assert review["can_register"], review["issues"]
    return refunds.register_refund(
        actor=admin,
        sale_id=sale_id,
        payload={
            **data,
            "idempotency_key": f"ref-key-{next(_keys):06d}",
            "review_token": review["review_token"],
        },
    )


def test_excess_is_visible_and_separate_from_collectable_balance(paid_sale: dict[str, Any]) -> None:
    money = summary(paid_sale["id"])
    assert money["exigible"] == "60.00"
    assert money["balance"] == "0.00"
    assert money["refund_due"] == "40.00"
    assert money["payment_state"] == "PAID"
    assert money["refunded_total"] == "0.00"
    assert CommercialRefund.objects.count() == 0


def test_registering_the_disbursement_zeroes_the_excess_without_new_debt(
    admin: Any, paid_sale: dict[str, Any]
) -> None:
    sale_return = SaleReturn.objects.get()
    body = do_refund(admin, paid_sale["id"], refund_data(sale_return, "40.00")).body
    assert body["amount"] == "40.00"
    assert body["origin"] == "RETURN"
    assert body["sale_return_id"] == sale_return.pk
    assert body["reason"] == "Devolución al cliente"
    money = body["money"]
    assert (money["applied"], money["balance"], money["refund_due"]) == ("60.00", "0.00", "0.00")
    refund = CommercialRefund.objects.get()
    assert refund.sale_id == paid_sale["id"]
    assert refund.created_by_id == admin.pk


@pytest.mark.parametrize(
    "parts_payload",
    [
        [{"method": "CREDITO", "amount": "10.00"}],
        [{"method": "EFECTIVO", "amount": "0.00"}],
        [{"method": "EFECTIVO", "amount": "-1.00"}],
        [{"method": "EFECTIVO", "amount": "10.001"}],
        [{"method": "EFECTIVO", "amount": "10.00"}, {"method": "EFECTIVO", "amount": "5.00"}],
        [],
    ],
)
def test_incoherent_parts_are_rejected(
    admin: Any, paid_sale: dict[str, Any], parts_payload: list[dict[str, Any]]
) -> None:
    data = {**refund_data(SaleReturn.objects.get(), "10.00"), "parts": parts_payload}
    with pytest.raises(SalesApplicationError):
        refunds.preview_refund(actor=admin, sale_id=paid_sale["id"], payload=data)
    assert CommercialRefund.objects.count() == 0


def test_a_refund_above_the_current_excess_is_rejected(
    admin: Any, paid_sale: dict[str, Any]
) -> None:
    review = refunds.preview_refund(
        actor=admin,
        sale_id=paid_sale["id"],
        payload=refund_data(SaleReturn.objects.get(), "40.01"),
    )
    assert review["can_register"] is False
    assert CommercialRefund.objects.count() == 0


def test_a_sale_that_never_received_payments_has_nothing_to_refund(
    admin: Any, confirmed_sale: Any
) -> None:
    sale: dict[str, Any] = confirmed_sale(price="20.00", quantity=5)
    do_return(admin, sale["id"], return_request([item(line_id(sale["id"]), fit=2)]))
    review = refunds.preview_refund(
        actor=admin, sale_id=sale["id"], payload=refund_data(SaleReturn.objects.get(), "1.00")
    )
    assert review["can_register"] is False
    assert CommercialRefund.objects.count() == 0


def test_artisan_destination_and_foreign_returns_are_rejected(
    admin: Any, paid_sale: dict[str, Any], confirmed_sale: Any
) -> None:
    data = refund_data(SaleReturn.objects.get(), "10.00")
    with pytest.raises(SalesApplicationError) as artisan:
        refunds.preview_refund(
            actor=admin,
            sale_id=paid_sale["id"],
            payload={**data, "entity_type": "ARTESANAL"},
        )
    assert "entity_type" in artisan.value.errors
    other = confirmed_sale(price="10.00")
    review = refunds.preview_refund(actor=admin, sale_id=other["id"], payload=data)
    assert review["can_register"] is False


def test_cumulative_refunds_never_exceed_the_return_obligation_or_the_global_excess(
    admin: Any, seller: Any, confirmed_sale: Any
) -> None:
    sale: dict[str, Any] = confirmed_sale(price="20.00", quantity=5)
    pay(seller, sale["id"], parts("100.00"))
    lid = line_id(sale["id"])
    do_return(admin, sale["id"], return_request([item(lid, fit=1)]))  # 20.00
    do_return(admin, sale["id"], return_request([item(lid, fit=2)]))  # 40.00
    first, second = SaleReturn.objects.order_by("id")
    do_refund(admin, sale["id"], refund_data(first, "20.00"))
    too_much = refunds.preview_refund(
        actor=admin, sale_id=sale["id"], payload=refund_data(first, "1.00")
    )
    assert too_much["can_register"] is False  # lo atribuible a la primera ya se reembolsó
    do_refund(admin, sale["id"], refund_data(second, "40.00"))
    money = summary(sale["id"])
    assert (money["refund_due"], money["refunded_total"], money["balance"]) == (
        "0.00",
        "60.00",
        "0.00",
    )


def test_a_confirmed_refund_cannot_be_edited_or_deleted(
    admin: Any, paid_sale: dict[str, Any]
) -> None:
    body = do_refund(admin, paid_sale["id"], refund_data(SaleReturn.objects.get(), "40.00")).body
    with pytest.raises(DatabaseError), transaction.atomic():
        CommercialRefund.objects.filter(pk=body["id"]).update(amount=D("1.00"))
    with pytest.raises(DatabaseError), transaction.atomic():
        CommercialRefund.objects.filter(pk=body["id"]).delete()
    with pytest.raises(DatabaseError), transaction.atomic():
        RefundPart.objects.filter(refund_id=body["id"]).update(method="TRANSFERENCIA")
    assert not [n for n in dir(refunds) if n.startswith(("update_", "delete_"))]


def test_a_failure_while_registering_keeps_the_state_and_allows_retrying_the_same_fact(
    admin: Any, paid_sale: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    data = refund_data(SaleReturn.objects.get(), "40.00")
    review = refunds.preview_refund(actor=admin, sale_id=paid_sale["id"], payload=data)
    payload = {
        **data,
        "idempotency_key": "ref-retry-0001",
        "review_token": review["review_token"],
    }
    original = refunds.insert_refund

    def failing(**kwargs: Any) -> Any:
        original(**kwargs)
        raise RuntimeError("fallo tras insertar")

    monkeypatch.setattr(refunds, "insert_refund", failing)
    with pytest.raises(RuntimeError):
        refunds.register_refund(actor=admin, sale_id=paid_sale["id"], payload=payload)
    monkeypatch.undo()
    assert CommercialRefund.objects.count() == 0
    assert RefundPart.objects.count() == 0
    assert summary(paid_sale["id"])["refund_due"] == "40.00"
    version = Sale.objects.get(pk=paid_sale["id"]).version
    assert version == review["version"]
    retried = refunds.register_refund(actor=admin, sale_id=paid_sale["id"], payload=payload)
    assert retried.body["amount"] == "40.00"
    again = refunds.register_refund(
        actor=admin,
        sale_id=paid_sale["id"],
        payload={**payload, "idempotency_key": "ref-retry-0002"},
    )
    assert again.body["id"] == retried.body["id"]
    assert CommercialRefund.objects.count() == 1


def test_a_reason_is_required_and_only_the_administrator_may_refund(
    admin: Any, seller: Any, paid_sale: dict[str, Any]
) -> None:
    sale_return = SaleReturn.objects.get()
    with pytest.raises(SalesApplicationError):
        refunds.preview_refund(
            actor=admin,
            sale_id=paid_sale["id"],
            payload=refund_data(sale_return, "40.00", reason="  "),
        )
    with pytest.raises(BusinessPermissionDeniedError):
        refunds.preview_refund(
            actor=seller, sale_id=paid_sale["id"], payload=refund_data(sale_return, "40.00")
        )


def test_reusing_an_operation_id_with_other_data_conflicts(
    admin: Any, paid_sale: dict[str, Any]
) -> None:
    sale_return = SaleReturn.objects.get()
    data = refund_data(sale_return, "10.00")
    do_refund(admin, paid_sale["id"], data)
    other = {**refund_data(sale_return, "20.00"), "operation_id": data["operation_id"]}
    review = refunds.preview_refund(actor=admin, sale_id=paid_sale["id"], payload=other)
    with pytest.raises(SalesApplicationError) as error:
        refunds.register_refund(
            actor=admin,
            sale_id=paid_sale["id"],
            payload={
                **other,
                "idempotency_key": "ref-reuse-0001",
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "idempotency_conflict"
    assert CommercialRefund.objects.count() == 1
