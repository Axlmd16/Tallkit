"""Resumen comercial del inicio: cada indicador coincide con su lista y respeta los permisos."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import pytest

from customer_registry.models import Customer
from identity.models import AuditEvent
from sales.application import home_summary, reads, reviews, sales, withholdings
from sales.application.errors import SalesApplicationError
from sales.models import CommercialPayment, SaleReturn
from workshop_configuration.models import Warehouse

from .test_payment_corrections import correct
from .test_payments import parts, pay
from .test_refunds import do_refund, refund_data
from .test_returns import do_return, item, line_id
from .test_returns import request as return_request
from .test_withholdings import settle

pytestmark = pytest.mark.django_db
D = Decimal


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


def other_customer(n: int = 2) -> Customer:
    return Customer.objects.create(
        person_type="NATURAL",
        name=f"Cliente {n}",
        identification_type="CI",
        identification=f"17123456{n:02d}",
        phone="0999999999",
    )


def draft(seller: Any, customer: Any, product: Any, key: str) -> dict[str, Any]:
    body: dict[str, Any] = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": key,
            "customer_id": customer.pk,
            "condition": "CONTADO",
            "lines": [{"product_id": product.pk, "quantity": "1"}],
        },
    ).body
    return body


# --- Filtros nuevos de las cuentas por cobrar ------------------------------------------------


def test_receivables_filter_by_condition(seller: Any, confirmed_sale: Any) -> None:
    cash = confirmed_sale(price="100.00", condition="CONTADO")
    credit = confirmed_sale(price="50.00", condition="CREDITO")
    listing = reads.receivables(actor=seller, condition="CONTADO")
    assert [row["id"] for row in listing["items"]] == [cash["id"]]
    assert listing["receivable_total"] == "100.00"
    listing = reads.receivables(actor=seller, condition="CREDITO")
    assert [row["id"] for row in listing["items"]] == [credit["id"]]


def test_receivables_without_new_filters_are_unchanged(seller: Any, confirmed_sale: Any) -> None:
    confirmed_sale(price="100.00", condition="CONTADO")
    confirmed_sale(price="50.00", condition="CREDITO")
    listing = reads.receivables(actor=seller)
    assert listing["total_count"] == 2
    assert listing["receivable_total"] == "150.00"


def test_receivables_reject_an_unknown_condition(seller: Any) -> None:
    with pytest.raises(SalesApplicationError) as error:
        reads.receivables(actor=seller, condition="FIADO")
    assert error.value.code == "validation_error"


def test_only_debt_excludes_sales_that_only_have_a_refund_due(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    owed = confirmed_sale(price="100.00", condition="CONTADO")
    refundable = confirmed_sale(price="15.00", condition="CONTADO")
    pay(seller, refundable["id"], parts("15.00"))
    do_return(
        admin,
        refundable["id"],
        return_request([item(line_id(refundable["id"]), fit=1)]),
    )
    assert reads.receivables(actor=seller)["total_count"] == 2
    listing = reads.receivables(actor=seller, only_debt=True)
    assert [row["id"] for row in listing["items"]] == [owed["id"]]
    assert listing["refund_due_total"] == "0.00"


# --- Pendientes ------------------------------------------------------------------------------


def test_cash_sale_with_interrupted_charge_counts_and_credit_does_not(
    seller: Any, confirmed_sale: Any
) -> None:
    confirmed_sale(price="100.00", condition="CONTADO")
    confirmed_sale(price="50.00", condition="CREDITO")
    assert home_summary.cash_sales_unpaid(seller) == 1
    listing = reads.receivables(actor=seller, condition="CONTADO", only_debt=True)
    assert listing["total_count"] == 1


def test_cash_sale_covered_with_a_withholding_does_not_count(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00", condition="CONTADO")
    settle(seller, sale["id"], parts("98.00"), "2.00")
    assert home_summary.cash_sales_unpaid(seller) == 0


def test_sale_drafts_match_the_list(
    seller: Any, customer: Any, make_product: Any, confirmed_sale: Any
) -> None:
    confirmed_sale(price="10.00")
    draft(seller, customer, make_product(), "home-draft-0001")
    draft(seller, customer, make_product(), "home-draft-0002")
    assert home_summary.sale_drafts(seller) == 2
    assert reads.list_sales(actor=seller, state="DRAFT")["total_count"] == 2


def test_pending_withholdings_match_the_list(seller: Any, confirmed_sale: Any) -> None:
    first = confirmed_sale(price="100.00", condition="CONTADO")
    second = confirmed_sale(price="200.00", condition="CONTADO")
    settle(seller, first["id"], parts("98.00"), "2.00")
    settle(seller, second["id"], parts("196.00"), "4.00")
    assert home_summary.pending_withholdings(seller) == 2
    assert withholdings.pending_vouchers(actor=seller)["total_count"] == 2


# --- Por cobrar ------------------------------------------------------------------------------


def test_balance_and_customers_match_the_receivables(seller: Any, confirmed_sale: Any) -> None:
    second = other_customer()
    confirmed_sale(price="100.00")
    confirmed_sale(price="120.00")
    confirmed_sale(price="80.00", sale_customer=second)
    result = home_summary.receivable_balance(seller)
    assert result == home_summary.Receivable(balance=D("300.00"), customers=2)
    assert reads.receivables(actor=seller)["receivable_total"] == "300.00"


def test_withholding_reduces_the_balance(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="100.00")
    settle(seller, sale["id"], parts("60.00"), "2.00")
    result = home_summary.receivable_balance(seller)
    assert result == home_summary.Receivable(balance=D("38.00"), customers=1)


def test_pending_refund_is_neither_added_nor_subtracted(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="15.00", condition="CONTADO")
    pay(seller, sale["id"], parts("15.00"))
    do_return(admin, sale["id"], return_request([item(line_id(sale["id"]), fit=1)]))
    result = home_summary.receivable_balance(seller)
    assert result == home_summary.Receivable(balance=D("0.00"), customers=0)
    assert reads.receivables(actor=seller)["refund_due_total"] == "15.00"


def test_no_debt_is_zero(seller: Any) -> None:
    assert home_summary.receivable_balance(seller) == home_summary.Receivable(
        balance=D("0.00"), customers=0
    )


# --- Cobros de los últimos siete días --------------------------------------------------------


def test_seven_days_with_a_day_without_collections(
    seller: Any, confirmed_sale: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    today = date(2026, 10, 6)
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        if day == date(2026, 10, 3):
            continue
        monkeypatch.setattr(reviews, "today", lambda day=day: day)
        sale = confirmed_sale(price="10.00")
        pay(seller, sale["id"], parts("10.00"))
    days = home_summary.collections_by_day(seller, today=today)
    assert days is not None
    assert [entry.day for entry in days] == [
        date(2026, 9, 30) + timedelta(days=offset) for offset in range(7)
    ]
    assert [entry.amount for entry in days] == [
        D("10.00"),
        D("10.00"),
        D("10.00"),
        D("0.00"),
        D("10.00"),
        D("10.00"),
        D("10.00"),
    ]


def test_payments_outside_the_window_are_ignored(
    seller: Any, confirmed_sale: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    today = date(2026, 10, 6)
    monkeypatch.setattr(reviews, "today", lambda: date(2026, 9, 29))
    sale = confirmed_sale(price="10.00")
    pay(seller, sale["id"], parts("10.00"))
    days = home_summary.collections_by_day(seller, today=today)
    assert days is not None
    assert sum(entry.amount for entry in days) == D("0.00")


def test_payment_uses_its_business_date(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="10.00")
    payment = pay(seller, sale["id"], parts("10.00")).body
    stored = CommercialPayment.objects.get(pk=payment["id"])
    assert stored.effective_date == reviews.today()
    days = home_summary.collections_by_day(seller, today=stored.effective_date)
    assert days is not None
    assert days[-1].amount == D("10.00")


def test_withholding_is_not_collected_money(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="100.00", condition="CONTADO")
    settle(seller, sale["id"], parts("98.00"), "2.00")
    days = home_summary.collections_by_day(seller, today=reviews.today())
    assert days is not None
    assert days[-1].amount == D("98.00")


def test_voided_payment_is_not_counted(seller: Any, admin: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="40.00")
    payment = pay(seller, sale["id"], parts("40.00")).body
    correct(admin, sale["id"], payment["id"])
    days = home_summary.collections_by_day(seller, today=reviews.today())
    assert days is not None
    assert days[-1].amount == D("0.00")


def test_combined_payment_adds_both_parts(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="50.00")
    pay(seller, sale["id"], parts("30.00", "20.00"))
    days = home_summary.collections_by_day(seller, today=reviews.today())
    assert days is not None
    assert days[-1].amount == D("50.00")


def test_refunds_are_not_subtracted(seller: Any, admin: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="15.00", condition="CONTADO")
    pay(seller, sale["id"], parts("15.00"))
    do_return(admin, sale["id"], return_request([item(line_id(sale["id"]), fit=1)]))
    do_refund(admin, sale["id"], refund_data(SaleReturn.objects.get(), "15.00"))
    days = home_summary.collections_by_day(seller, today=reviews.today())
    assert days is not None
    assert days[-1].amount == D("15.00")


# --- Permisos --------------------------------------------------------------------------------


def test_without_permission_nothing_is_computed_nor_audited(
    role_manager: Any, confirmed_sale: Any
) -> None:
    confirmed_sale(price="100.00", condition="CONTADO")
    before = AuditEvent.objects.count()
    assert home_summary.cash_sales_unpaid(role_manager) is None
    assert home_summary.sale_drafts(role_manager) is None
    assert home_summary.pending_withholdings(role_manager) is None
    assert home_summary.receivable_balance(role_manager) is None
    assert home_summary.collections_by_day(role_manager, today=reviews.today()) is None
    assert AuditEvent.objects.count() == before


# --- Recorrido por la API del inicio con datos reales ----------------------------------------


def test_home_routes_show_the_same_numbers_as_the_lists(
    seller: Any, customer: Any, make_product: Any, confirmed_sale: Any
) -> None:
    from rest_framework.test import APIClient

    api = APIClient()
    api.force_authenticate(user=seller)
    confirmed_sale(price="100.00", condition="CONTADO")
    credit = confirmed_sale(price="60.00", condition="CREDITO")
    pay(seller, credit["id"], parts("20.00"))
    draft(seller, customer, make_product(), "home-api-draft-01")

    pending = {
        (item["key"], item["scope"]): item["count"]
        for item in api.get("/api/v1/home/pending/").json()["items"]
    }
    assert pending[("cash_sales_unpaid", "commercial")] == 1
    assert pending[("sale_drafts", "commercial")] == 1
    listed = api.get("/api/v1/sales/receivables/?condition=CONTADO&only_debt=true").json()
    assert listed["count"] == pending[("cash_sales_unpaid", "commercial")]

    receivables = api.get("/api/v1/home/receivables/").json()["items"]
    assert receivables == [{"scope": "commercial", "balance": "140.00", "customers": 1}]
    assert api.get("/api/v1/sales/receivables/").json()["receivable_total"] == "140.00"

    [collected] = api.get("/api/v1/home/collections/").json()["items"]
    assert (collected["scope"], collected["total"]) == ("commercial", "20.00")
    assert collected["days"][-1]["amount"] == "20.00"

    pay(seller, credit["id"], parts("40.00"))
    after = api.get("/api/v1/home/receivables/").json()["items"]
    assert after == [{"scope": "commercial", "balance": "100.00", "customers": 1}]
