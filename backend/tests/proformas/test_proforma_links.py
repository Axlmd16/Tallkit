"""Contrato público de ventas para crear el borrador originado en una proforma (diseño D1/D6)."""

import dataclasses
from decimal import Decimal
from typing import Any

import pytest
from django.db import transaction

from identity.application.authorization import BusinessPermissionDeniedError
from inventory.application.reservations import read_availability
from proformas.models import Proforma
from sales.application import proforma_links
from sales.application.proforma_links import (
    LinkedSaleError,
    ProformaAlreadyLinkedError,
    ProformaOffer,
    QuotedLine,
)
from sales.models import Sale, SalesCommand
from workshop_configuration.models import NumberAllocation

from .factories import issued_values, make_proforma

pytestmark = pytest.mark.django_db
D = Decimal


@pytest.fixture
def issued(customer: Any, commercial: Any, seller: Any) -> Proforma:
    proforma = make_proforma(customer, commercial, seller)
    Proforma.objects.filter(pk=proforma.pk).update(**issued_values(seller))
    proforma.refresh_from_db()
    return proforma


def offer_for(proforma: Proforma, *products: Any, quantity: str = "2") -> ProformaOffer:
    lines = tuple(
        QuotedLine(
            position=index,
            product_id=product.pk,
            product_code=product.code,
            product_name=product.name,
            quantity=D(quantity),
            unit_price=D("10.00"),
            tax_rate=D("15"),
            base_amount=D("17.39"),
            tax_amount=D("2.61"),
            total_amount=D("20.00"),
        )
        for index, product in enumerate(products, start=1)
    )
    return ProformaOffer(
        proforma_id=proforma.pk,
        number=proforma.internal_number or "",
        customer_id=proforma.customer_id or 0,
        issue_date=proforma.issue_date,  # type: ignore[arg-type]
        valid_until=proforma.valid_until,  # type: ignore[arg-type]
        lines=lines,
        base_total=D("17.39") * len(lines),
        tax_total=D("2.61") * len(lines),
        grand_total=D("20.00") * len(lines),
    )


def test_offer_dto_is_immutable(issued: Proforma, product: Any) -> None:
    offer = offer_for(issued, product)
    with pytest.raises(dataclasses.FrozenInstanceError):
        offer.number = "otro"  # type: ignore[misc]
    with pytest.raises(dataclasses.FrozenInstanceError):
        offer.lines[0].unit_price = D(1)  # type: ignore[misc]


@pytest.mark.django_db(transaction=True)
def test_requires_an_outer_transaction(issued: Proforma, product: Any, seller: Any) -> None:
    with pytest.raises(RuntimeError, match="transacción exterior"):
        proforma_links.create_draft_from_proforma(actor=seller, offer=offer_for(issued, product))
    assert not Sale.objects.exists()


def test_creates_an_editable_draft_with_origin_and_historical_copy(
    issued: Proforma, make_product: Any, seller: Any, stock: Any, commercial: Any
) -> None:
    first, second = make_product(), make_product()
    stock(first, 5)
    link = proforma_links.create_draft_from_proforma(
        actor=seller, offer=offer_for(issued, first, second)
    )
    sale = Sale.objects.get(pk=link.sale_id)
    assert (sale.state, sale.condition, sale.internal_number) == ("DRAFT", "CONTADO", None)
    assert (sale.origin_type, sale.origin_proforma_id, sale.origin_reference) == (
        "PROFORMA",
        issued.pk,
        "COM-PRO-000001",
    )
    assert sale.origin_order_id is None
    assert sale.customer_id == issued.customer_id
    assert sale.created_by_id == seller.pk
    assert [(line.product_id, line.quantity) for line in sale.lines.order_by("position")] == [
        (first.pk, D(2)),
        (second.pk, D(2)),
    ]
    snapshot = sale.proforma_snapshot
    assert snapshot is not None
    assert snapshot["schema_version"] == 1
    assert snapshot["number"] == "COM-PRO-000001"
    assert snapshot["totals"] == {"base": "34.78", "tax": "5.22", "total": "40.00"}
    assert snapshot["lines"][0] == {
        "position": 1,
        "product_id": first.pk,
        "product_code": first.code,
        "product_name": first.name,
        "quantity": "2",
        "unit_price": "10.00",
        "tax_rate": "15",
        "base_amount": "17.39",
        "tax_amount": "2.61",
        "total_amount": "20.00",
    }
    assert "cost" not in str(snapshot).lower()
    assert (link.state, link.internal_number, link.proforma_id) == ("DRAFT", None, issued.pk)


def test_does_not_number_reserve_or_claim_another_receipt(
    issued: Proforma, product: Any, seller: Any, stock: Any, commercial: Any
) -> None:
    stock(product, 5)
    proforma_links.create_draft_from_proforma(actor=seller, offer=offer_for(issued, product))
    availability = read_availability([product.pk], warehouse_id=commercial["warehouse"].pk)
    assert (availability[product.pk].quantity, availability[product.pk].reserved) == (D(5), D(0))
    assert not SalesCommand.objects.exists()
    assert not NumberAllocation.objects.exists()
    commercial["sale_series"].refresh_from_db()
    assert commercial["sale_series"].last_number == 0


def test_insufficient_availability_does_not_block_the_draft(
    issued: Proforma, product: Any, seller: Any
) -> None:
    link = proforma_links.create_draft_from_proforma(
        actor=seller, offer=offer_for(issued, product, quantity="3")
    )
    assert Sale.objects.get(pk=link.sale_id).lines.get().quantity == D(3)


def test_requires_permission_to_create_sales(issued: Proforma, product: Any, manager: Any) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        proforma_links.create_draft_from_proforma(actor=manager, offer=offer_for(issued, product))
    assert not Sale.objects.exists()


def test_inactive_customer_leaves_no_partial_sale(
    issued: Proforma, product: Any, seller: Any, customer: Any
) -> None:
    type(customer).objects.filter(pk=customer.pk).update(is_active=False)
    with pytest.raises(LinkedSaleError) as error, transaction.atomic():
        proforma_links.create_draft_from_proforma(actor=seller, offer=offer_for(issued, product))
    assert error.value.code == "inactive_reference"
    assert "customer_id" in error.value.errors
    assert not Sale.objects.exists()


def test_inactive_product_identifies_the_line(
    issued: Proforma, make_product: Any, seller: Any
) -> None:
    active, inactive = make_product(), make_product(is_active=False)
    with pytest.raises(LinkedSaleError) as error, transaction.atomic():
        proforma_links.create_draft_from_proforma(
            actor=seller, offer=offer_for(issued, active, inactive)
        )
    assert error.value.code == "inactive_reference"
    assert list(error.value.errors) == ["lines.1.product_id"]
    assert not Sale.objects.exists()


def test_second_creation_reports_the_existing_sale(
    issued: Proforma, product: Any, seller: Any
) -> None:
    link = proforma_links.create_draft_from_proforma(actor=seller, offer=offer_for(issued, product))
    with pytest.raises(ProformaAlreadyLinkedError) as error:
        proforma_links.create_draft_from_proforma(actor=seller, offer=offer_for(issued, product))
    assert error.value.link == link
    assert Sale.objects.count() == 1


def test_link_can_be_queried_by_offer(issued: Proforma, product: Any, seller: Any) -> None:
    assert proforma_links.get_sale_link(issued.pk) is None
    assert proforma_links.sale_links([issued.pk]) == {}
    link = proforma_links.create_draft_from_proforma(actor=seller, offer=offer_for(issued, product))
    assert proforma_links.get_sale_link(issued.pk) == link
    assert proforma_links.sale_links([issued.pk, 99999]) == {issued.pk: link}


def test_offer_without_lines_or_number_is_rejected(issued: Proforma, seller: Any) -> None:
    with pytest.raises(LinkedSaleError):
        proforma_links.create_draft_from_proforma(actor=seller, offer=offer_for(issued))
    assert not Sale.objects.exists()
