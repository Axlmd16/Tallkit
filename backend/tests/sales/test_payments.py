"""Cobros comerciales: partes por medio, saldo, condición y estado derivados."""

import uuid
from itertools import count
from typing import Any

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from sales.application import payments, queries, sales
from sales.application.commands import IdempotencyConflictError
from sales.application.errors import SalesApplicationError
from sales.models import CommercialPayment, PaymentPart, Sale, SalesCommand
from workshop_configuration.models import Warehouse

pytestmark = pytest.mark.django_db
_keys = count(1)


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


def parts(cash: str | None = None, transfer: str | None = None) -> list[dict[str, str]]:
    items = []
    if cash is not None:
        items.append({"method": "EFECTIVO", "amount": cash})
    if transfer is not None:
        items.append({"method": "TRANSFERENCIA", "amount": transfer})
    return items


def request(sale_id: int, items: list[dict[str, Any]], **extra: Any) -> dict[str, Any]:
    return {"operation_id": str(uuid.uuid4()), "parts": items, **extra}


def pay(actor: Any, sale_id: int, items: list[dict[str, Any]], **extra: Any) -> Any:
    data = request(sale_id, items, **extra)
    review = payments.preview_payment(actor=actor, sale_id=sale_id, payload=data)
    assert review["can_register"], review["issues"]
    return payments.register_payment(
        actor=actor,
        sale_id=sale_id,
        payload={
            **data,
            "idempotency_key": f"pay-key-{next(_keys):06d}",
            "review_token": review["review_token"],
        },
    )


def summary(sale_id: int) -> dict[str, Any]:
    money: dict[str, Any] = queries.sale_detail(Sale.objects.get(pk=sale_id))["money"]
    return money


def test_combined_payment_creates_one_payment_with_both_parts(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    outcome = pay(seller, sale["id"], parts("40.00", "60.00"))
    body = outcome.body
    assert outcome.status == 201
    assert body["amount"] == "100.00"
    assert body["parts"] == [
        {"method": "EFECTIVO", "amount": "40.00"},
        {"method": "TRANSFERENCIA", "amount": "60.00"},
    ]
    assert CommercialPayment.objects.count() == 1
    payment = CommercialPayment.objects.get()
    assert payment.created_by_id == seller.pk
    assert payment.effective_at is not None
    assert payment.sale.fiscal_entity.entity_type == "COMERCIAL"
    assert body["money"]["balance"] == "0.00"
    assert body["money"]["payment_state"] == "PAID"


@pytest.mark.parametrize(
    "items",
    [
        [{"method": "EFECTIVO", "amount": "10.00"}, {"method": "EFECTIVO", "amount": "5.00"}],
        [{"method": "EFECTIVO", "amount": "0.00"}],
        [{"method": "EFECTIVO", "amount": "-5.00"}],
        [{"method": "CHEQUE", "amount": "10.00"}],
        [{"method": "CREDITO", "amount": "10.00"}],
        [{"method": "EFECTIVO", "amount": "10.001"}],
        [{"method": "EFECTIVO", "amount": 10.5}],
        [{"method": "EFECTIVO"}],
        [],
    ],
)
def test_invalid_parts_are_rejected_without_silent_rounding(
    seller: Any, confirmed_sale: Any, items: list[dict[str, Any]]
) -> None:
    sale = confirmed_sale()
    with pytest.raises(SalesApplicationError):
        payments.preview_payment(
            actor=seller, sale_id=sale["id"], payload=request(sale["id"], items)
        )
    assert CommercialPayment.objects.count() == 0


def test_a_draft_sale_rejects_advance_payments(seller: Any, customer: Any, product: Any) -> None:
    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": "pay-draft-0001",
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [{"product_id": product.pk, "quantity": "1"}],
        },
    ).body
    review = payments.preview_payment(
        actor=seller, sale_id=draft["id"], payload=request(draft["id"], parts("5.00"))
    )
    assert review["can_register"] is False
    assert review["issues"][0]["code"] == "invalid_state"
    with pytest.raises(SalesApplicationError):
        payments.register_payment(
            actor=seller,
            sale_id=draft["id"],
            payload={
                **request(draft["id"], parts("5.00")),
                "idempotency_key": "pay-draft-0002",
                "review_token": "x",
            },
        )
    assert CommercialPayment.objects.count() == 0


def test_settled_sale_rejects_more_payments_and_amount_over_the_balance(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="35.00")
    over = payments.preview_payment(
        actor=seller, sale_id=sale["id"], payload=request(sale["id"], parts("40.00"))
    )
    assert over["can_register"] is False
    assert CommercialPayment.objects.count() == 0
    pay(seller, sale["id"], parts("35.00"))
    settled = payments.preview_payment(
        actor=seller, sale_id=sale["id"], payload=request(sale["id"], parts("1.00"))
    )
    assert settled["can_register"] is False
    assert CommercialPayment.objects.count() == 1


def test_overpayment_is_rejected_entirely_without_registering_the_balance_or_a_credit(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="35.00", condition="CREDITO")
    data = request(sale["id"], parts("40.00"))
    with pytest.raises(SalesApplicationError) as error:
        payments.register_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={**data, "idempotency_key": "pay-over-00001", "review_token": "x"},
        )
    assert error.value.code == "validation_error"
    assert CommercialPayment.objects.count() == 0
    money = summary(sale["id"])
    assert (money["paid_total"], money["balance"], money["refund_due"]) == ("0.00", "35.00", "0.00")


def test_a_payment_for_two_sales_requires_separate_payments_chosen_by_the_user(
    seller: Any, confirmed_sale: Any
) -> None:
    first = confirmed_sale(price="30.00")
    second = confirmed_sale(price="70.00")
    combined = request(first["id"], parts("100.00"))
    assert (
        payments.preview_payment(actor=seller, sale_id=first["id"], payload=combined)[
            "can_register"
        ]
        is False
    )
    pay(seller, first["id"], parts("30.00"))
    pay(seller, second["id"], parts("70.00"))
    assert CommercialPayment.objects.count() == 2
    assert summary(first["id"])["balance"] == "0.00"
    assert summary(second["id"])["balance"] == "0.00"


def test_an_artisan_operation_cannot_be_charged_through_the_commercial_registry(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale()
    with pytest.raises(SalesApplicationError) as error:
        payments.preview_payment(
            actor=seller,
            sale_id=sale["id"],
            payload=request(sale["id"], parts("10.00"), entity_type="ARTESANAL"),
        )
    assert "entity_type" in error.value.errors
    with pytest.raises(SalesApplicationError):
        payments.preview_payment(
            actor=seller, sale_id=987654, payload=request(987654, parts("10.00"))
        )


@pytest.mark.parametrize("field", ["effective_date", "effective_at", "date", "actor_id"])
def test_a_manipulated_date_is_rejected_and_the_charge_stays_pending(
    seller: Any, confirmed_sale: Any, field: str
) -> None:
    sale = confirmed_sale()
    with pytest.raises(SalesApplicationError) as error:
        payments.preview_payment(
            actor=seller,
            sale_id=sale["id"],
            payload=request(sale["id"], parts("100.00"), **{field: "2020-01-01"}),
        )
    assert error.value.code == "unknown_field"
    assert CommercialPayment.objects.count() == 0
    assert summary(sale["id"])["balance"] == "100.00"


def test_cash_sale_requires_the_full_balance_without_switching_to_credit(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00", condition="CONTADO")
    partial = payments.preview_payment(
        actor=seller, sale_id=sale["id"], payload=request(sale["id"], parts("40.00"))
    )
    assert partial["can_register"] is False
    assert Sale.objects.get(pk=sale["id"]).condition == "CONTADO"
    money = summary(sale["id"])
    assert (money["balance"], money["payment_state"]) == ("100.00", "PENDING")
    pay(seller, sale["id"], parts("100.00"))
    assert summary(sale["id"])["payment_state"] == "PAID"


def test_credit_sale_accepts_installments_without_due_dates_or_plans(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00", condition="CREDITO")
    money = summary(sale["id"])
    assert (money["balance"], money["payment_state"]) == ("100.00", "PENDING")
    assert "due_date" not in str(queries.sale_detail(Sale.objects.get(pk=sale["id"])))
    pay(seller, sale["id"], parts("30.00"))
    money = summary(sale["id"])
    assert (money["applied"], money["balance"], money["payment_state"]) == (
        "30.00",
        "70.00",
        "PARTIAL",
    )
    pay(seller, sale["id"], parts(None, "70.00"))
    assert summary(sale["id"])["payment_state"] == "PAID"


def test_balance_and_state_are_derived_from_persisted_data_and_never_editable(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    assert not hasattr(Sale, "balance")
    assert not {"balance", "paid_total", "payment_state"} & {
        f.name for f in Sale._meta.get_fields()
    }
    for forbidden in ("balance", "paid_total", "payment_state"):
        with pytest.raises(SalesApplicationError) as error:
            sales.update_draft(
                actor=seller,
                sale_id=sale["id"],
                payload={
                    "idempotency_key": f"pay-edit-{next(_keys):06d}",
                    "expected_version": 1,
                    forbidden: "0",
                },
            )
        assert error.value.code == "unknown_field"
    pay(seller, sale["id"], parts("60.00"))
    money = summary(sale["id"])
    assert (money["paid_total"], money["balance"]) == ("60.00", "40.00")


def test_same_operation_id_does_not_duplicate_even_with_a_different_http_key(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale()
    data = request(sale["id"], parts("40.00"))
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
    first = payments.register_payment(
        actor=seller,
        sale_id=sale["id"],
        payload={
            **data,
            "idempotency_key": "pay-http-key-1",
            "review_token": review["review_token"],
        },
    )
    second = payments.register_payment(
        actor=seller,
        sale_id=sale["id"],
        payload={
            **data,
            "idempotency_key": "pay-http-key-2",
            "review_token": review["review_token"],
        },
    )
    assert first.body["id"] == second.body["id"]
    assert CommercialPayment.objects.count() == 1
    assert PaymentPart.objects.count() == 1
    with pytest.raises(SalesApplicationError) as reuse:
        payments.register_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={
                **request(sale["id"], parts("50.00")),
                "operation_id": data["operation_id"],
                "idempotency_key": "pay-http-key-3",
                "review_token": review["review_token"],
            },
        )
    assert reuse.value.code == "idempotency_conflict"


def test_same_http_key_with_other_content_conflicts_and_replay_returns_the_same_payment(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale()
    data = request(sale["id"], parts("40.00"))
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
    payload = {**data, "idempotency_key": "pay-same-key-1", "review_token": review["review_token"]}
    first = payments.register_payment(actor=seller, sale_id=sale["id"], payload=payload)
    replay = payments.register_payment(actor=seller, sale_id=sale["id"], payload=payload)
    assert replay.replayed
    assert replay.body["id"] == first.body["id"]
    with pytest.raises(IdempotencyConflictError):
        payments.register_payment(
            actor=seller, sale_id=sale["id"], payload={**payload, "parts": parts("41.00")}
        )
    assert SalesCommand.objects.filter(action="sales.payment_registered").count() == 1


def test_two_legitimate_payments_of_the_same_amount_carry_distinct_uuids(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    pay(seller, sale["id"], parts("10.00"))
    pay(seller, sale["id"], parts("10.00"))
    assert CommercialPayment.objects.count() == 2
    assert summary(sale["id"])["paid_total"] == "20.00"


def test_stale_review_is_rejected_after_another_payment(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="100.00")
    data = request(sale["id"], parts("10.00"))
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
    pay(seller, sale["id"], parts("20.00"))
    with pytest.raises(SalesApplicationError) as error:
        payments.register_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={
                **data,
                "idempotency_key": "pay-stale-0001",
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "review_required"
    assert CommercialPayment.objects.count() == 1


def test_only_roles_with_the_permission_can_charge(actor: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale()
    with pytest.raises(BusinessPermissionDeniedError):
        payments.preview_payment(
            actor=actor, sale_id=sale["id"], payload=request(sale["id"], parts("1.00"))
        )


def test_a_failure_saving_one_part_of_a_combined_payment_leaves_no_payment_or_part(
    seller: Any, confirmed_sale: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    sale = confirmed_sale(price="100.00")
    data = request(sale["id"], parts("40.00", "60.00"))
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)

    def boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("falla al guardar la segunda parte")

    monkeypatch.setattr(PaymentPart.objects, "bulk_create", boom)
    with pytest.raises(RuntimeError):
        payments.register_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={
                **data,
                "idempotency_key": "pay-atomic-0001",
                "review_token": review["review_token"],
            },
        )
    monkeypatch.undo()
    assert CommercialPayment.objects.count() == 0
    assert PaymentPart.objects.count() == 0
    assert summary(sale["id"])["balance"] == "100.00"
    assert SalesCommand.objects.filter(action="sales.payment_registered").count() == 0


def test_a_voided_sale_rejects_payments_without_creating_applied_money(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    from sales.application import voids

    sale = confirmed_sale(price="10.00")
    data = {"reason": "Error de captura"}
    review = voids.preview_void(actor=admin, sale_id=sale["id"], payload=data)
    voids.void_sale(
        actor=admin,
        sale_id=sale["id"],
        payload={
            **data,
            "idempotency_key": "pay-voided-0001",
            "expected_version": review["version"],
            "review_token": review["review_token"],
        },
    )
    check = payments.preview_payment(
        actor=seller, sale_id=sale["id"], payload=request(sale["id"], parts("5.00"))
    )
    assert check["can_register"] is False
    assert check["issues"][0]["code"] == "invalid_state"
    assert CommercialPayment.objects.count() == 0
    assert summary(sale["id"])["paid_total"] == "0.00"
