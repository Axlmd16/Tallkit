"""Comprobante, corrección, anulación y seguimiento de retenciones comerciales."""

import uuid
from itertools import count
from typing import Any

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from sales.application import refunds, reviews, voids, withholdings
from sales.application.errors import SalesApplicationError
from sales.models import CommercialWithholding, CommercialWithholdingVoucherChange, SaleReturn
from workshop_configuration.models import Warehouse

from .test_refunds import do_refund, refund_data
from .test_returns import do_return, item, line_id
from .test_returns import request as return_request
from .test_void import void_data
from .test_withholdings import parts, settle, summary

pytestmark = pytest.mark.django_db
_keys = count(1)
NUMBER = "001-001-000028564"


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


def key() -> str:
    return f"whf-key-{next(_keys):06d}"


@pytest.fixture
def held(seller: Any, confirmed_sale: Any) -> dict[str, Any]:
    """Venta de 250.00 cerrada con 245.00 en dinero y 5.00 retenidos."""
    sale: dict[str, Any] = confirmed_sale(price="250.00")
    settle(seller, sale["id"], parts(cash="245.00"), "5.00")
    return {"sale_id": sale["id"], "id": CommercialWithholding.objects.get().pk}


def voucher(**changes: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "voucher_number": NUMBER,
        "voucher_date": reviews.today().isoformat(),
        "income_tax_amount": "5.00",
        "vat_amount": "0.00",
    }
    data.update(changes)
    return {name: value for name, value in data.items() if value is not ...}


def complete(actor: Any, held: dict[str, Any], **changes: Any) -> Any:
    return withholdings.complete_voucher(
        actor=actor,
        sale_id=held["sale_id"],
        withholding_id=held["id"],
        payload={**voucher(**changes), "idempotency_key": key()},
    )


def void(actor: Any, held: dict[str, Any], reason: Any = "Registrada por error") -> Any:
    return withholdings.void_withholding(
        actor=actor,
        sale_id=held["sale_id"],
        withholding_id=held["id"],
        payload={"reason": reason, "idempotency_key": key()},
    )


def test_voucher_is_completed_without_changing_amount_or_balance(
    seller: Any, held: dict[str, Any]
) -> None:
    body = complete(seller, held).body
    assert body["voucher_pending"] is False
    assert body["voucher_number"] == NUMBER
    assert (body["income_tax_amount"], body["vat_amount"]) == ("5.00", "0.00")
    assert body["amount"] == "5.00"
    assert body["money"]["balance"] == "0.00"


def test_voucher_breakdown_is_optional(seller: Any, held: dict[str, Any]) -> None:
    body = complete(seller, held, income_tax_amount=..., vat_amount=...).body
    assert body["voucher_number"] == NUMBER
    assert body["income_tax_amount"] is None


@pytest.mark.parametrize(
    "changes",
    [
        {"income_tax_amount": "3.00", "vat_amount": "1.00"},
        {"voucher_number": "1-1-28564"},
        {"voucher_date": "2999-01-01"},
        {"voucher_date": "05/10/2026"},
        {"vat_amount": ...},
    ],
)
def test_invalid_voucher_data_is_rejected(
    seller: Any, held: dict[str, Any], changes: dict[str, Any]
) -> None:
    with pytest.raises(SalesApplicationError) as error:
        complete(seller, held, **changes)
    assert error.value.code == "validation_error"
    assert CommercialWithholding.objects.get().voucher_number is None


def test_same_voucher_number_cannot_be_used_twice_for_the_customer(
    seller: Any, confirmed_sale: Any, held: dict[str, Any]
) -> None:
    complete(seller, held)
    other_sale = confirmed_sale(price="100.00")
    settle(seller, other_sale["id"], parts(cash="98.00"), "2.00")
    other = CommercialWithholding.objects.exclude(pk=held["id"]).get()
    with pytest.raises(SalesApplicationError) as error:
        complete(
            seller,
            {"sale_id": other_sale["id"], "id": other.pk},
            income_tax_amount="2.00",
        )
    assert "voucher_number" in error.value.errors
    assert str(held["id"]) in error.value.errors["voucher_number"][0]


def test_completed_voucher_is_corrected_only_by_the_administrator(
    seller: Any, admin: Any, held: dict[str, Any]
) -> None:
    complete(seller, held)
    with pytest.raises(SalesApplicationError) as again:
        complete(seller, held, voucher_number="001-001-000000002")
    assert again.value.code == "invalid_state"

    correction = {
        **voucher(voucher_number="001-001-000000002"),
        "operation_id": str(uuid.uuid4()),
        "reason": "Número mal digitado",
    }

    def correct(actor: Any, payload: dict[str, Any]) -> Any:
        return withholdings.correct_voucher(
            actor=actor,
            sale_id=held["sale_id"],
            withholding_id=held["id"],
            payload={**payload, "idempotency_key": key()},
        )

    with pytest.raises(BusinessPermissionDeniedError):
        correct(seller, correction)
    with pytest.raises(SalesApplicationError):
        correct(admin, {**correction, "reason": "  "})
    body = correct(admin, correction).body
    assert body["voucher_number"] == "001-001-000000002"
    change = CommercialWithholdingVoucherChange.objects.get()
    assert change.previous_voucher_number == NUMBER
    assert change.reason == "Número mal digitado"
    assert change.created_by_id == admin.pk
    # reintento con el mismo identificador de operación no duplica la historia
    correct(admin, correction)
    assert CommercialWithholdingVoucherChange.objects.count() == 1


def test_pending_voucher_cannot_be_corrected(admin: Any, held: dict[str, Any]) -> None:
    with pytest.raises(SalesApplicationError) as error:
        withholdings.correct_voucher(
            actor=admin,
            sale_id=held["sale_id"],
            withholding_id=held["id"],
            payload={
                **voucher(),
                "operation_id": str(uuid.uuid4()),
                "reason": "x",
                "idempotency_key": key(),
            },
        )
    assert error.value.code == "invalid_state"


def test_void_returns_the_amount_to_the_balance_and_keeps_history(
    seller: Any, admin: Any, held: dict[str, Any]
) -> None:
    complete(seller, held)
    with pytest.raises(BusinessPermissionDeniedError):
        void(seller, held)
    with pytest.raises(SalesApplicationError):
        void(admin, held, reason="")
    body = void(admin, held).body
    assert body["state"] == "VOIDED"
    assert body["void_reason"] == "Registrada por error"
    assert body["voucher_pending"] is False
    money = summary(held["sale_id"])
    assert (money["balance"], money["payment_state"]) == ("5.00", "PARTIAL")
    assert (money["paid_total"], money["withheld_total"]) == ("245.00", "0.00")
    record = CommercialWithholding.objects.get()
    assert record.amount == 5
    assert record.voided_by_id == admin.pk

    with pytest.raises(SalesApplicationError) as again:
        void(admin, held)
    assert again.value.code == "invalid_state"
    with pytest.raises(SalesApplicationError):
        complete(seller, held, voucher_number="001-001-000000009")


def test_voided_withholding_frees_its_voucher_number(
    seller: Any, admin: Any, held: dict[str, Any]
) -> None:
    complete(seller, held)
    void(admin, held)
    settle(seller, held["sale_id"], None, "5.00")
    fresh = CommercialWithholding.objects.filter(voided_at__isnull=True).get()
    body = complete(seller, {"sale_id": held["sale_id"], "id": fresh.pk}).body
    assert body["voucher_number"] == NUMBER


def test_pending_list_shows_only_active_withholdings_without_voucher(
    seller: Any, admin: Any, actor: Any, confirmed_sale: Any, held: dict[str, Any]
) -> None:
    second_sale = confirmed_sale(price="100.00")
    settle(seller, second_sale["id"], None, "2.00")
    third_sale = confirmed_sale(price="50.00")
    settle(seller, third_sale["id"], None, "1.00")
    third = CommercialWithholding.objects.get(sale_id=third_sale["id"])
    void(admin, {"sale_id": third_sale["id"], "id": third.pk})

    page = withholdings.pending_vouchers(actor=seller)
    assert [row["sale_id"] for row in page["items"]] == [held["sale_id"], second_sale["id"]]
    assert page["total_count"] == 2
    assert page["pending_total"] == "7.00"
    first = page["items"][0]
    assert first["fiscal_scope"] == "COMERCIAL"
    assert first["sale_number"].startswith("COM-VEN-")
    assert first["customer"]["name"] == "Cliente Uno"
    assert first["age_days"] == 0

    small = withholdings.pending_vouchers(actor=seller, page=2, page_size=1)
    assert [row["sale_id"] for row in small["items"]] == [second_sale["id"]]
    assert small["pending_total"] == "7.00"

    complete(seller, held)
    after = withholdings.pending_vouchers(actor=seller)
    assert [row["sale_id"] for row in after["items"]] == [second_sale["id"]]

    with pytest.raises(BusinessPermissionDeniedError):
        withholdings.pending_vouchers(actor=actor)


def test_history_lists_active_and_voided_withholdings(
    seller: Any, admin: Any, held: dict[str, Any]
) -> None:
    void(admin, held)
    settle(seller, held["sale_id"], None, "5.00")
    history = withholdings.withholding_history(actor=seller, sale_id=held["sale_id"])
    assert [row["state"] for row in history] == ["VOIDED", "ACTIVE"]
    assert history[0]["void_reason"] == "Registrada por error"
    assert history[1]["voucher_pending"] is True
    from sales.application import sales as sales_service

    detail = sales_service.get_sale(actor=seller, sale_id=held["sale_id"])
    assert [row["state"] for row in detail["withholdings"]] == ["VOIDED", "ACTIVE"]
    assert detail["money"]["withheld_total"] == "5.00"


def test_refund_after_a_full_return_is_limited_to_the_money_collected(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="250.00")
    settle(seller, sale["id"], parts(cash="245.00"), "5.00")
    do_return(admin, sale["id"], return_request([item(line_id(sale["id"]), fit=1)]))
    money = summary(sale["id"])
    assert money["exigible"] == "0.00"
    assert money["refund_due"] == "245.00"
    assert money["withheld_excess"] == "5.00"
    assert money["balance"] == "0.00"

    sale_return = SaleReturn.objects.get()
    review = refunds.preview_refund(
        actor=admin, sale_id=sale["id"], payload=refund_data(sale_return, "250.00")
    )
    assert review["can_register"] is False
    do_refund(admin, sale["id"], refund_data(sale_return, "245.00"))
    money = summary(sale["id"])
    assert (money["refund_due"], money["withheld_excess"]) == ("0.00", "5.00")

    held = CommercialWithholding.objects.get()
    void(admin, {"sale_id": sale["id"], "id": held.pk})
    money = summary(sale["id"])
    assert (money["refund_due"], money["withheld_excess"], money["balance"]) == (
        "0.00",
        "0.00",
        "0.00",
    )


def test_sale_with_active_withholdings_cannot_be_voided(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    settle(seller, sale["id"], None, "2.00")
    held = CommercialWithholding.objects.get()
    review = voids.preview_void(actor=admin, sale_id=sale["id"], payload=void_data())
    assert review["can_void"] is False
    assert review["issues"][0]["code"] == "dependency_conflict"
    assert (
        str(held.pk) in review["issues"][0]["message"]
        or "retenciones" in (review["issues"][0]["message"])
    )

    void(admin, {"sale_id": sale["id"], "id": held.pk})
    assert voids.preview_void(actor=admin, sale_id=sale["id"], payload=void_data())["can_void"]


def test_withholding_of_another_sale_is_not_found(
    seller: Any, confirmed_sale: Any, held: dict[str, Any]
) -> None:
    other = confirmed_sale(price="10.00")
    with pytest.raises(SalesApplicationError) as error:
        complete(seller, {"sale_id": other["id"], "id": held["id"]})
    assert error.value.code == "not_found"
