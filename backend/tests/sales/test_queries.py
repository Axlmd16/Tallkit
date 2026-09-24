"""Listas, cuentas por cobrar y documento interno: filtros, agregados y ausencia de N+1."""

import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

import pytest

from customer_registry.models import Customer
from sales.application import reads, reviews, sales
from sales.application.errors import SalesApplicationError
from sales.application.workshop_links import add_linked_line
from sales.models import Sale, SaleReturn
from workshop_configuration.models import Warehouse

from .test_payments import parts, pay
from .test_refunds import do_refund, refund_data
from .test_returns import do_return, item, line_id
from .test_returns import request as return_request

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


def test_list_shows_number_customer_origin_date_total_and_independent_states(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    pay(seller, sale["id"], parts("30.00"))
    listing = reads.list_sales(actor=seller)
    row = listing["items"][0]
    assert row["internal_number"] == "COM-VEN-000001"
    assert row["customer"]["name"] == "Cliente Uno"
    assert row["origin"] == {"type": "DIRECT", "order_id": None, "order_number": None}
    assert row["grand_total"] == "100.00"
    assert row["state"] == "CONFIRMED"
    assert row["money"]["payment_state"] == "PARTIAL"
    assert row["money"]["balance"] == "70.00"
    assert row["sale_date"]
    assert listing["total_count"] == 1


def test_filters_by_customer_state_date_and_payment_state(
    seller: Any, confirmed_sale: Any, customer: Any
) -> None:
    second = other_customer()
    a = confirmed_sale(price="10.00")
    b = confirmed_sale(price="20.00", sale_customer=second)
    pay(seller, a["id"], parts("10.00"))
    assert [r["id"] for r in reads.list_sales(actor=seller, customer_id=second.pk)["items"]] == [
        b["id"]
    ]
    assert [r["id"] for r in reads.list_sales(actor=seller, payment_state="PAID")["items"]] == [
        a["id"]
    ]
    assert [r["id"] for r in reads.list_sales(actor=seller, payment_state="PENDING")["items"]] == [
        b["id"]
    ]
    assert reads.list_sales(actor=seller, state="VOIDED")["total_count"] == 0
    today = reviews.today()
    assert reads.list_sales(actor=seller, date_from=today, date_to=today)["total_count"] == 2
    assert reads.list_sales(actor=seller, date_to=today - timedelta(days=1))["total_count"] == 0
    assert reads.list_sales(actor=seller, date_from=today + timedelta(days=1))["total_count"] == 0


def test_origin_filter_and_projection_cover_list_detail_document_and_receivables(
    seller: Any,
    customer: Any,
    maintenance_order: Any,
    product: Any,
    stock: Any,
    confirmed_sale: Any,
) -> None:
    direct = confirmed_sale(price="10.00")
    stock(product, 2, "8.00")
    line = add_linked_line(
        actor=seller,
        order_ref=maintenance_order,
        product_id=product.pk,
        quantity="1",
    )
    linked = Sale.objects.get(pk=line.sale_id)
    sales.update_draft(
        actor=seller,
        sale_id=linked.pk,
        payload={
            "idempotency_key": "query-linked-edit-1",
            "expected_version": linked.version,
            "condition": "CREDITO",
        },
    )
    linked.refresh_from_db()
    review = reviews.preview_confirmation(actor=seller, sale_id=linked.pk)
    sales.confirm_sale(
        actor=seller,
        sale_id=linked.pk,
        payload={
            "idempotency_key": "query-linked-conf-1",
            "expected_version": linked.version,
            "review_token": review["review_token"],
        },
    )

    listed = reads.list_sales(actor=seller, origin="MAINTENANCE")
    assert [row["id"] for row in listed["items"]] == [linked.pk]
    expected = {
        "type": "MAINTENANCE",
        "order_id": maintenance_order.pk,
        "order_number": maintenance_order.number,
    }
    assert listed["items"][0]["origin"] == expected
    assert [row["id"] for row in reads.list_sales(actor=seller, origin="DIRECT")["items"]] == [
        direct["id"]
    ]
    assert reads.sale_detail(actor=seller, sale_id=linked.pk)["origin"] == expected
    assert reads.sale_document(actor=seller, sale_id=linked.pk)["origin"] == expected
    items = reads.receivables(actor=seller, origin="MAINTENANCE")["items"]
    assert [row["id"] for row in items] == [linked.pk]
    with pytest.raises(SalesApplicationError):
        reads.list_sales(actor=seller, origin="OTHER")


def test_full_pagination_walk_returns_each_match_exactly_once(
    seller: Any, confirmed_sale: Any
) -> None:
    ids = {confirmed_sale(price="5.00")["id"] for _ in range(7)}
    seen: list[int] = []
    for page in range(1, 5):
        result = reads.list_sales(actor=seller, page=page, page_size=2)
        seen += [row["id"] for row in result["items"]]
        assert result["total_count"] == 7
    assert len(seen) == len(set(seen)) == 7
    assert set(seen) == ids
    assert seen == sorted(seen, reverse=True)  # misma fecha: desempate estable por ID


@pytest.mark.parametrize(("page", "size"), [(0, 20), (1, 0), (1, 101)])
def test_invalid_pagination_is_rejected(seller: Any, page: int, size: int) -> None:
    from sales.application.errors import SalesApplicationError

    with pytest.raises(SalesApplicationError):
        reads.list_sales(actor=seller, page=page, page_size=size)


def test_detail_distinguishes_active_and_corrected_payments_without_summing_both(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    from .test_payment_corrections import correct

    sale = confirmed_sale(price="100.00")
    first = pay(seller, sale["id"], parts("100.00")).body
    correct(
        admin,
        sale["id"],
        first["id"],
        replacement={"operation_id": str(uuid.uuid4()), "parts": parts(None, "100.00")},
    )
    detail = reads.sale_detail(actor=seller, sale_id=sale["id"])
    states = sorted(p["state"] for p in detail["payments"])
    assert states == ["ACTIVE", "CORRECTED"]
    assert detail["money"]["paid_total"] == "100.00"
    assert detail["links"]["document"].endswith("/document")
    corrected = next(p for p in detail["payments"] if p["state"] == "CORRECTED")
    assert corrected["correction"]["replacement_payment_id"] is not None


def test_receivables_show_both_sales_of_the_customer_and_exclude_artisan_operations(
    seller: Any, confirmed_sale: Any
) -> None:
    a = confirmed_sale(price="100.00")
    b = confirmed_sale(price="200.00")
    pay(seller, a["id"], parts("70.00"))
    pay(seller, b["id"], parts("130.00"))
    result = reads.receivables(actor=seller)
    assert {r["id"] for r in result["items"]} == {a["id"], b["id"]}
    assert result["receivable_total"] == "100.00"  # 30.00 + 70.00
    assert result["refund_due_total"] == "0.00"
    assert all(r["fiscal_scope"] == "COMERCIAL" for r in result["items"])
    from sales.models import CommercialPayment

    assert CommercialPayment.objects.filter(sale=a["id"]).count() == 1  # sin reparto automático


def test_receivable_and_refund_due_are_separate_never_netted(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    owed = confirmed_sale(price="40.00")
    over = confirmed_sale(price="20.00", quantity=5)  # total 100.00
    pay(seller, over["id"], parts("100.00"))
    do_return(admin, over["id"], return_request([item(line_id(over["id"]), fit=1)]))  # exigible 80
    do_refund(admin, over["id"], refund_data(SaleReturn.objects.get(), "0.01"))
    result = reads.receivables(actor=seller)
    assert result["receivable_total"] == "40.00"
    assert result["refund_due_total"] == "19.99"
    by_id = {r["id"]: r for r in result["items"]}
    assert by_id[owed["id"]]["money"]["balance"] == "40.00"
    assert by_id[over["id"]]["money"]["balance"] == "0.00"
    assert by_id[over["id"]]["money"]["refund_due"] == "19.99"


def test_totals_cover_every_match_not_only_the_visible_page_and_filters_apply_first(
    seller: Any, confirmed_sale: Any, customer: Any
) -> None:
    second = other_customer()
    for _ in range(3):
        confirmed_sale(price="10.00")
    confirmed_sale(price="50.00", sale_customer=second)
    page = reads.receivables(actor=seller, page=1, page_size=2)
    assert len(page["items"]) == 2
    assert page["total_count"] == 4
    assert page["receivable_total"] == "80.00"
    filtered = reads.receivables(actor=seller, customer_id=customer.pk, page=1, page_size=1)
    assert filtered["total_count"] == 3
    assert filtered["receivable_total"] == "30.00"


def test_aging_is_counted_in_local_dates_without_due_dates_or_delinquency_labels(
    seller: Any, confirmed_sale: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    real_today = reviews.today()
    ten_days_ago = real_today - timedelta(days=10)
    monkeypatch.setattr(reviews, "today", lambda: ten_days_ago)
    confirmed_sale(price="10.00", condition="CREDITO")
    monkeypatch.setattr(reviews, "today", lambda: real_today)
    row = reads.receivables(actor=seller)["items"][0]
    assert row["age_days"] == 10
    assert not {"due_date", "overdue", "surcharge", "delinquent"} & set(row)
    assert reads.receivables(actor=seller, min_age_days=11)["total_count"] == 0
    assert reads.receivables(actor=seller, min_age_days=10)["total_count"] == 1


def test_internal_document_identifies_issuer_customer_lines_and_omits_costs(
    seller: Any, admin: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00", quantity=2)
    document = reads.sale_document(actor=seller, sale_id=sale["id"])
    assert document["issuer"]["ruc"] == "1790000000001"
    assert document["issuer"]["type"] == "COMERCIAL"
    assert document["number"] == "COM-VEN-000001"
    assert document["customer"]["name"] == "Cliente Uno"
    assert "SRI" in document["notice"]
    assert document["lines"][0]["total_amount"] == "200.00"
    assert document["grand_total"] == "200.00"
    text = str(document).lower()
    assert "cost" not in text
    assert "applied_value" not in text


def test_a_voided_sale_keeps_number_and_original_values_and_indicates_the_void(
    admin: Any, confirmed_sale: Any
) -> None:
    from .test_void import do_void, void_data

    sale = confirmed_sale(price="10.00")
    do_void(admin, sale["id"], void_data("Error de captura"))
    document = reads.sale_document(actor=admin, sale_id=sale["id"])
    assert document["voided"] is True
    assert document["void_reason"] == "Error de captura"
    assert document["number"] == "COM-VEN-000001"
    assert document["grand_total"] == "10.00"


def test_list_detail_and_receivables_do_not_grow_queries_with_the_number_of_rows(
    seller: Any, confirmed_sale: Any, django_assert_max_num_queries: Any
) -> None:
    for _ in range(5):
        confirmed_sale(price="10.00")
    sale = confirmed_sale(price="10.00")
    pay(seller, sale["id"], parts("5.00"))
    with django_assert_max_num_queries(12):
        reads.list_sales(actor=seller, page_size=50)
    with django_assert_max_num_queries(14):
        reads.receivables(actor=seller, page_size=50)
    with django_assert_max_num_queries(30):
        reads.sale_detail(actor=seller, sale_id=sale["id"])
