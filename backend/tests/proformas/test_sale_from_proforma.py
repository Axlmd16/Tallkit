"""La venta de origen proforma: editable, comparada con lo cotizado y confirmada con reglas
ordinarias de ventas. Incluye las regresiones de filtros y de origen manual."""

from collections.abc import Callable
from decimal import Decimal
from typing import Any

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from inventory.application.reservations import read_availability
from proformas.application import conversion, queries
from proformas.models import Proforma
from sales.application import payments, reads, reviews, sales, voids
from sales.application.errors import SalesApplicationError
from sales.models import CommercialPayment, Sale

from .conftest import key

pytestmark = pytest.mark.django_db
D = Decimal


@pytest.fixture
def converted(
    new_draft: Any, issue: Any, convert: Any, make_product: Any, stock: Any, at: Any
) -> dict[str, Any]:
    """Oferta por A (3 uds. a 10.00) y B (1 ud. a 5.00), convertida; devuelve ids y productos."""
    at(2026, 10, 6)
    a, b = make_product(sale_price=D("10.00")), make_product(sale_price=D("5.00"))
    stock(a, 10)
    stock(b, 10)
    offer = issue(new_draft((a, 3), (b, 1)))
    body = convert(offer).body
    return {"proforma": body, "sale_id": body["sale"]["id"], "a": a, "b": b}


def edit(actor: Any, sale_id: int, lines: list[tuple[Any, int]], **extra: Any) -> dict[str, Any]:
    version = Sale.objects.get(pk=sale_id).version
    body: dict[str, Any] = sales.update_draft(
        actor=actor,
        sale_id=sale_id,
        payload={
            "idempotency_key": key("sale"),
            "expected_version": version,
            "lines": [{"product_id": p.pk, "quantity": str(q)} for p, q in lines],
            **extra,
        },
    ).body
    return body


def confirm(actor: Any, sale_id: int) -> dict[str, Any]:
    review = reviews.preview_confirmation(actor=actor, sale_id=sale_id)
    assert review["can_confirm"], review["issues"]
    body: dict[str, Any] = sales.confirm_sale(
        actor=actor,
        sale_id=sale_id,
        payload={
            "idempotency_key": key("confirm"),
            "expected_version": review["version"],
            "review_token": review["review_token"],
        },
    ).body
    return body


def offer_is_intact(converted: dict[str, Any]) -> None:
    proforma = Proforma.objects.get(pk=converted["proforma"]["id"])
    assert proforma.state == "CONVERTED"
    assert proforma.version == converted["proforma"]["version"]
    assert [(line.product_id, line.quantity) for line in proforma.lines.order_by("position")] == [
        (converted["a"].pk, D(3)),
        (converted["b"].pk, D(1)),
    ]
    assert proforma.grand_total == D("35.00")
    assert Sale.objects.filter(origin_proforma_id=proforma.pk).count() == 1


def test_customer_accepts_a_part(converted: dict[str, Any], seller: Any, make_product: Any) -> None:
    c = make_product(sale_price=D("7.00"))
    body = edit(seller, converted["sale_id"], [(converted["a"], 3), (c, 1)])
    assert [line["product_id"] for line in body["lines"]] == [converted["a"].pk, c.pk]
    assert body["origin"]["proforma_number"] == "COM-PRO-000001"
    offer_is_intact(converted)
    review = reviews.preview_confirmation(actor=seller, sale_id=converted["sale_id"])
    statuses = {p["product_id"]: p["status"] for p in review["quote_comparison"]["products"]}
    assert statuses == {converted["a"].pk: "UNCHANGED", converted["b"].pk: "REMOVED", c.pk: "ADDED"}
    assert [line["unit_price"] for line in review["lines"]] == ["10.00", "7.00"]


def test_editing_quantities_changes_only_the_sale_draft(
    converted: dict[str, Any], seller: Any, commercial: Any
) -> None:
    edit(seller, converted["sale_id"], [(converted["a"], 2)])
    offer_is_intact(converted)
    sale = Sale.objects.get(pk=converted["sale_id"])
    assert (sale.state, sale.internal_number) == ("DRAFT", None)
    availability = read_availability(
        [converted["a"].pk, converted["b"].pk], warehouse_id=commercial["warehouse"].pk
    )
    assert all(row.reserved == D(0) and row.quantity == D(10) for row in availability.values())
    detail = reads.sale_detail(actor=seller, sale_id=sale.pk)
    comparison = detail["quote_comparison"]
    by_id = {p["product_id"]: p for p in comparison["products"]}
    assert by_id[converted["a"].pk]["changes"] == ["quantity"]
    assert (
        by_id[converted["a"].pk]["quoted"]["quantity"],
        by_id[converted["a"].pk]["current"]["quantity"],
    ) == ("3", "2")
    assert by_id[converted["b"].pk]["status"] == "REMOVED"
    assert comparison["totals"]["quoted"]["total"] == "35.00"
    assert comparison["totals"]["current"]["total"] == "20.00"
    assert detail["links"]["proforma"] == f"/proformas/{converted['proforma']['id']}"


def test_emptied_sale_keeps_its_link_and_cannot_be_confirmed_or_reconverted(
    converted: dict[str, Any], seller: Any
) -> None:
    body = edit(seller, converted["sale_id"], [])
    assert body["lines"] == []
    assert body["origin"]["proforma_id"] == converted["proforma"]["id"]
    review = reviews.preview_confirmation(actor=seller, sale_id=converted["sale_id"])
    assert review["can_confirm"] is False
    assert review["issues"][0]["field"] == "lines"
    with pytest.raises(SalesApplicationError):
        sales.confirm_sale(
            actor=seller,
            sale_id=converted["sale_id"],
            payload={
                "idempotency_key": key(),
                "expected_version": body["version"],
                "review_token": "x",
            },
        )
    blocked = conversion.preview_conversion(actor=seller, proforma_id=converted["proforma"]["id"])
    assert blocked["blocked_by"]["code"] == "proforma_converted"
    offer_is_intact(converted)


@pytest.mark.parametrize(
    "field",
    [
        "origin",
        "origin_type",
        "origin_proforma_id",
        "proforma_id",
        "origin_order_id",
        "proforma_snapshot",
    ],
)
def test_origin_cannot_be_set_or_changed_through_the_ordinary_api(
    field: str, converted: dict[str, Any], seller: Any, customer: Any, product: Any
) -> None:
    sale = Sale.objects.get(pk=converted["sale_id"])
    with pytest.raises(SalesApplicationError) as error:
        sales.update_draft(
            actor=seller,
            sale_id=sale.pk,
            payload={"idempotency_key": key(), "expected_version": sale.version, field: 1},
        )
    assert error.value.code == "unknown_field"
    with pytest.raises(SalesApplicationError) as error:
        sales.create_draft(
            actor=seller,
            payload={
                "idempotency_key": key(),
                "customer_id": customer.pk,
                "condition": "CONTADO",
                "lines": [],
                field: converted["proforma"]["id"],
            },
        )
    assert error.value.code == "unknown_field"
    sale.refresh_from_db()
    assert (sale.origin_type, sale.origin_proforma_id, sale.origin_order_id) == (
        "PROFORMA",
        converted["proforma"]["id"],
        None,
    )
    assert Sale.objects.count() == 1


def test_price_different_from_the_quoted_one_is_shown_and_never_manual(
    new_draft: Any, issue: Any, convert: Any, seller: Any, make_product: Any, stock: Any, at: Any
) -> None:
    at(2026, 10, 6)
    product = make_product(sale_price=D("10.00"))
    stock(product, 5)
    offer = issue(new_draft((product, 1)))
    type(product).objects.filter(pk=product.pk).update(sale_price=D("12.00"))
    preview = conversion.preview_conversion(actor=seller, proforma_id=offer["id"])
    item = preview["comparison"]["products"][0]
    assert (item["quoted"]["unit_price"], item["current"]["unit_price"]) == ("10.00", "12.00")
    sale_id = convert(offer).body["sale"]["id"]
    assert Sale.objects.get(pk=sale_id).state == "DRAFT"
    review = reviews.preview_confirmation(actor=seller, sale_id=sale_id)
    assert review["lines"][0]["unit_price"] == "12.00"
    assert review["quote_comparison"]["totals"] == {
        "quoted": {"base": "8.70", "tax": "1.30", "total": "10.00"},
        "current": {"base": "10.43", "tax": "1.57", "total": "12.00"},
        "difference": "2.00",
    }
    # Nuevo cambio después de revisar: 13.00 exige otra revisión, sin número, salida ni deuda.
    type(product).objects.filter(pk=product.pk).update(sale_price=D("13.00"))
    with pytest.raises(SalesApplicationError) as error:
        sales.confirm_sale(
            actor=seller,
            sale_id=sale_id,
            payload={
                "idempotency_key": key(),
                "expected_version": review["version"],
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "review_required"
    sale = Sale.objects.get(pk=sale_id)
    assert (sale.state, sale.internal_number, sale.grand_total) == ("DRAFT", None, None)
    assert (
        reviews.preview_confirmation(actor=seller, sale_id=sale_id)["lines"][0]["unit_price"]
        == "13.00"
    )
    assert Proforma.objects.get(pk=offer["id"]).lines.get().unit_price == D("10.00")


def test_tax_rate_change_shows_the_current_breakdown(
    converted: dict[str, Any], seller: Any, commercial: Any
) -> None:
    from workshop_configuration.models import TaxPeriod

    TaxPeriod.objects.filter(pk=commercial["period"].pk).update(rate=D("12"))
    review = reviews.preview_confirmation(actor=seller, sale_id=converted["sale_id"])
    item = review["quote_comparison"]["products"][0]
    assert item["changes"] == ["tax_rate"]
    assert (item["quoted"]["tax_rate"], item["current"]["tax_rate"]) == ("15", "12")
    assert item["quoted"]["unit_price"] == item["current"]["unit_price"] == "10.00"
    assert item["quoted"]["tax_amount"] != item["current"]["tax_amount"]


def test_conversion_without_availability_warns_and_confirmation_is_rejected(
    new_draft: Any,
    issue: Any,
    convert: Any,
    seller: Any,
    make_product: Any,
    stock: Any,
    at: Any,
    commercial: Any,
) -> None:
    at(2026, 10, 6)
    product = make_product()
    stock(product, 1)
    offer = issue(new_draft((product, 3)))
    preview = conversion.preview_conversion(actor=seller, proforma_id=offer["id"])
    assert preview["warnings"][0]["available"] == "1"
    sale_id = convert(offer).body["sale"]["id"]
    review = reviews.preview_confirmation(actor=seller, sale_id=sale_id)
    assert review["can_confirm"] is False
    assert review["issues"][0]["code"] == "insufficient_stock"
    sale = Sale.objects.get(pk=sale_id)
    assert (sale.state, sale.internal_number) == ("DRAFT", None)
    availability = read_availability([product.pk], warehouse_id=commercial["warehouse"].pk)
    assert availability[product.pk].quantity == D(1)


def test_confirm_after_offer_expiry_and_charge_independently(
    converted: dict[str, Any], seller: Any, at: Any, commercial: Any
) -> None:
    at(2026, 11, 20)
    assert (
        queries.get_proforma(actor=seller, proforma_id=converted["proforma"]["id"])["state"]
        == "CONVERTED"
    )
    body = confirm(seller, converted["sale_id"])
    assert (body["state"], body["internal_number"]) == ("CONFIRMED", "COM-VEN-000001")
    assert (body["grand_total"], body["money"]["balance"]) == ("35.00", "35.00")
    assert body["money"]["payment_state"] == "PENDING"
    assert not CommercialPayment.objects.exists()
    availability = read_availability([converted["a"].pk], warehouse_id=commercial["warehouse"].pk)
    assert availability[converted["a"].pk].quantity == D(7)
    offer_is_intact(converted)
    data = {
        "operation_id": "00000000-0000-4000-8000-000000000001",
        "parts": [{"method": "EFECTIVO", "amount": "35.00"}],
    }
    charge = payments.preview_payment(actor=seller, sale_id=converted["sale_id"], payload=data)
    assert charge["can_register"], charge["issues"]
    paid = payments.register_payment(
        actor=seller,
        sale_id=converted["sale_id"],
        payload={
            **data,
            "idempotency_key": key("pay"),
            "review_token": charge["review_token"],
        },
    ).body
    assert paid["money"]["payment_state"] == "PAID"
    detail = reads.sale_detail(actor=seller, sale_id=converted["sale_id"])
    assert detail["quote_comparison"]["has_differences"] is False
    assert detail["origin"] == {
        "type": "PROFORMA",
        "order_id": None,
        "order_number": None,
        "proforma_id": converted["proforma"]["id"],
        "proforma_number": "COM-PRO-000001",
    }
    document = reads.sale_document(actor=seller, sale_id=converted["sale_id"])
    assert document["origin"]["proforma_number"] == "COM-PRO-000001"


def test_later_void_of_the_sale_keeps_the_offer_converted(
    converted: dict[str, Any], seller: Any, admin: Any
) -> None:
    confirm(seller, converted["sale_id"])
    sale = Sale.objects.get(pk=converted["sale_id"])
    review = voids.preview_void(
        actor=admin,
        sale_id=sale.pk,
        payload={"expected_version": sale.version, "reason": "Error de registro"},
    )
    voided = voids.void_sale(
        actor=admin,
        sale_id=sale.pk,
        payload={
            "idempotency_key": key("void"),
            "expected_version": sale.version,
            "reason": "Error de registro",
            "review_token": review["review_token"],
        },
    ).body
    assert voided["state"] == "VOIDED"
    assert voided["origin"]["proforma_id"] == converted["proforma"]["id"]
    offer_is_intact(converted)
    blocked = conversion.preview_conversion(actor=admin, proforma_id=converted["proforma"]["id"])
    assert blocked["blocked_by"]["code"] == "proforma_converted"
    assert blocked["sale"]["state"] == "VOIDED"


def test_origin_filter_lists_only_sales_from_proformas(
    converted: dict[str, Any], seller: Any, customer: Any, product: Any
) -> None:
    sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": key(),
            "customer_id": customer.pk,
            "condition": "CONTADO",
            "lines": [{"product_id": product.pk, "quantity": "1"}],
        },
    )
    listed = reads.list_sales(actor=seller, origin="PROFORMA")["items"]
    assert [row["id"] for row in listed] == [converted["sale_id"]]
    assert listed[0]["origin"]["proforma_number"] == "COM-PRO-000001"
    assert [
        row["origin"]["type"] for row in reads.list_sales(actor=seller, origin="DIRECT")["items"]
    ] == ["DIRECT"]
    assert reads.list_sales(actor=seller, origin="MAINTENANCE")["items"] == []
    assert reads.list_sales(actor=seller)["total_count"] == 2


def test_workshop_manager_gets_no_access_through_the_link(
    converted: dict[str, Any], seller: Any, manager: Any
) -> None:
    assert (
        reads.sale_detail(actor=seller, sale_id=converted["sale_id"])["id"] == converted["sale_id"]
    )
    calls: tuple[Callable[[], Any], ...] = (
        lambda: reads.sale_detail(actor=manager, sale_id=converted["sale_id"]),
        lambda: reads.list_sales(actor=manager, origin="PROFORMA"),
        lambda: reviews.preview_confirmation(actor=manager, sale_id=converted["sale_id"]),
        lambda: edit(manager, converted["sale_id"], []),
        lambda: queries.get_proforma(actor=manager, proforma_id=converted["proforma"]["id"]),
    )
    for call in calls:
        with pytest.raises(BusinessPermissionDeniedError):
            call()
    from sales.application.workshop_links import linked_sales_summary

    assert linked_sales_summary(order_id=999999) == []


def test_direct_sale_has_no_comparison(seller: Any, customer: Any, product: Any) -> None:
    body = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": key(),
            "customer_id": customer.pk,
            "condition": "CONTADO",
            "lines": [{"product_id": product.pk, "quantity": "1"}],
        },
    ).body
    assert "quote_comparison" not in reads.sale_detail(actor=seller, sale_id=body["id"])
    assert "quote_comparison" not in reviews.preview_confirmation(actor=seller, sale_id=body["id"])
    assert body["origin"]["type"] == "DIRECT"
