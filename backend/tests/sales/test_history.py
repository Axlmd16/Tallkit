"""La venta confirmada conserva su historia y no admite edición ni eliminación ordinarias."""

from decimal import Decimal
from itertools import count
from typing import Any

import pytest
from django.db import DatabaseError, transaction

from catalog.models import Product
from customer_registry.models import Customer
from sales.application import queries, reviews, sales
from sales.application.errors import SalesApplicationError
from sales.models import Sale, SaleLine
from workshop_configuration.models import FiscalEntity, TaxPeriod, Warehouse

pytestmark = pytest.mark.django_db
D = Decimal
_keys = count(1)


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


@pytest.fixture
def confirmed(seller: Any, customer: Any, product: Any, stock: Any) -> dict[str, Any]:
    stock(product, 10, "40.00")
    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": f"hist-draft-{next(_keys):04d}",
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [{"product_id": product.pk, "quantity": "2"}],
        },
    ).body
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    return sales.confirm_sale(
        actor=seller,
        sale_id=draft["id"],
        payload={
            "idempotency_key": f"hist-conf-{next(_keys):05d}",
            "expected_version": 1,
            "review_token": review["review_token"],
        },
    ).body


def test_changing_master_data_never_alters_a_confirmed_sale(
    confirmed: dict[str, Any], customer: Any, product: Any, commercial: Any
) -> None:
    before = queries.sale_detail(Sale.objects.get(pk=confirmed["id"]))
    Customer.objects.filter(pk=customer.pk).update(name="Nombre nuevo", phone="0000000000")
    Product.objects.filter(pk=product.pk).update(
        name="Producto renombrado", code="NUEVO", sale_price=D("99.00")
    )
    FiscalEntity.objects.filter(pk=commercial["entity"].pk).update(legal_name="Otra razón social")
    TaxPeriod.objects.filter(tax_definition=commercial["tax"]).update(rate=D("5"))
    from inventory.models import InventoryPosition

    InventoryPosition.objects.filter(product=product).update(average=D("99"))
    after = queries.sale_detail(Sale.objects.get(pk=confirmed["id"]))
    assert after == before
    assert after["customer"]["name"] == "Cliente Uno"
    assert after["lines"][0]["product_name"] != "Producto renombrado"
    assert after["lines"][0]["unit_price"] == "11.50"
    assert after["lines"][0]["tax_rate"] == "15"
    sale = Sale.objects.get(pk=confirmed["id"])
    assert sale.fiscal_snapshot is not None
    assert sale.fiscal_snapshot["entity"]["legal_name"] == "Comercial SA"
    assert sale.grand_total == D("23.00")


@pytest.mark.parametrize("actor_name", ["admin", "seller"])
def test_generic_edit_of_a_confirmed_sale_is_rejected_for_every_role(
    request: pytest.FixtureRequest, confirmed: dict[str, Any], actor_name: str, customer: Any
) -> None:
    actor = request.getfixturevalue(actor_name)
    attempts: list[dict[str, Any]] = [
        {"notes": "cambio"},
        {"lines": []},
        {"customer_id": customer.pk},
        {"condition": "CONTADO"},
    ]
    for changes in attempts:
        with pytest.raises(SalesApplicationError) as error:
            sales.update_draft(
                actor=actor,
                sale_id=confirmed["id"],
                payload={
                    "idempotency_key": f"hist-edit-{next(_keys):05d}",
                    "expected_version": confirmed["version"],
                    **changes,
                },
            )
        assert error.value.code == "not_editable"
    assert not any(name.startswith("delete") for name in dir(sales))


def test_direct_persistence_changes_to_a_confirmed_sale_are_rejected(
    confirmed: dict[str, Any],
) -> None:
    sale = Sale.objects.get(pk=confirmed["id"])
    for changes in ({"state": "DRAFT"}, {"grand_total": D("1.00")}, {"internal_number": "X-1"}):
        with pytest.raises(DatabaseError), transaction.atomic():
            Sale.objects.filter(pk=sale.pk).update(**changes)
    with pytest.raises(DatabaseError), transaction.atomic():
        SaleLine.objects.filter(sale=sale).update(quantity=D(9))
    with pytest.raises(DatabaseError), transaction.atomic():
        Sale.objects.filter(pk=sale.pk).delete()


def test_sale_state_payment_state_document_and_billing_are_independent(
    confirmed: dict[str, Any],
) -> None:
    detail = queries.sale_detail(Sale.objects.get(pk=confirmed["id"]))
    assert detail["state"] == "CONFIRMED"
    assert detail["money"]["payment_state"] == "PENDING"
    assert detail["internal_number"] == "COM-VEN-000001"
    assert detail["fiscal_scope"] == "COMERCIAL"
    assert not {"invoice_state", "billing_state", "sri_authorization"} & set(detail)
