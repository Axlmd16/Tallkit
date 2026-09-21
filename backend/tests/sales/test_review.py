"""Revisión firmada: token de 15 minutos ligado a actor, acción, venta, versión y huella."""

from datetime import timedelta
from decimal import Decimal
from itertools import count
from typing import Any

import pytest

from catalog.models import Product
from identity.application.authorization import BusinessPermissionDeniedError
from inventory.models import InventoryMovement
from sales.application import reviews, sales
from sales.application.errors import SalesApplicationError
from sales.models import Sale
from workshop_configuration.models import ConfigurationUse, NumberAllocation, Warehouse

pytestmark = pytest.mark.django_db
D = Decimal
_keys = count(1)


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


def make_draft(
    actor: Any, customer: Any, lines: list[dict[str, Any]], **extra: Any
) -> dict[str, Any]:
    payload = {
        "idempotency_key": f"rev-key-{next(_keys):06d}",
        "customer_id": customer.pk,
        "condition": "CREDITO",
        "lines": lines,
        **extra,
    }
    return sales.create_draft(actor=actor, payload=payload).body


@pytest.fixture
def draft(seller: Any, customer: Any, product: Any, stock: Any) -> dict[str, Any]:
    stock(product, 10, "40.00")
    return make_draft(seller, customer, [{"product_id": product.pk, "quantity": "2"}])


def test_review_returns_amounts_effects_and_a_token_without_costs_for_the_seller(
    seller: Any, draft: dict[str, Any]
) -> None:
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    assert review["can_confirm"] is True
    assert review["totals"] == {"base": "20.00", "tax": "3.00", "total": "23.00"}
    assert review["effects"][0]["resulting_quantity"] == "8"
    assert "current_average_cost" not in review["effects"][0]
    assert "cost" not in str(review["issues"]).lower()
    assert review["expires_in_seconds"] == 900


def test_authorized_role_sees_the_current_average_cost(admin: Any, draft: dict[str, Any]) -> None:
    review = reviews.preview_confirmation(actor=admin, sale_id=draft["id"])
    assert review["effects"][0]["current_average_cost"] == "4.000000"


def test_review_creates_no_receipt_number_use_or_movement(
    seller: Any, draft: dict[str, Any]
) -> None:
    before = InventoryMovement.objects.count()
    reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    assert InventoryMovement.objects.count() == before
    assert NumberAllocation.objects.count() == 0
    assert ConfigurationUse.objects.count() == 0
    assert Sale.objects.get(pk=draft["id"]).internal_number is None


def test_token_is_bound_to_actor_action_sale_and_version(
    seller: Any, admin: Any, draft: dict[str, Any]
) -> None:
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    token = review["review_token"]
    digest = reviews.read_token(
        token, actor=seller, action="sale.confirm", sale_id=draft["id"], version=1
    )
    assert len(digest) == 64
    with pytest.raises(SalesApplicationError):
        reviews.read_token(
            token, actor=admin, action="sale.confirm", sale_id=draft["id"], version=1
        )
    with pytest.raises(SalesApplicationError):
        reviews.read_token(token, actor=seller, action="sale.void", sale_id=draft["id"], version=1)
    with pytest.raises(SalesApplicationError):
        reviews.read_token(token, actor=seller, action="sale.confirm", sale_id=999, version=1)
    with pytest.raises(SalesApplicationError):
        reviews.read_token(
            token, actor=seller, action="sale.confirm", sale_id=draft["id"], version=2
        )


def test_modified_and_expired_tokens_are_rejected(seller: Any, draft: dict[str, Any]) -> None:
    token = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])["review_token"]
    with pytest.raises(SalesApplicationError) as tampered:
        reviews.read_token(
            token[:-2] + "xx", actor=seller, action="sale.confirm", sale_id=draft["id"], version=1
        )
    assert tampered.value.code == "validation_error"
    with pytest.raises(SalesApplicationError) as expired:
        reviews.read_token(
            token,
            actor=seller,
            action="sale.confirm",
            sale_id=draft["id"],
            version=1,
            max_age=-1,
        )
    assert expired.value.code == "review_required"
    assert timedelta(seconds=reviews.REVIEW_MAX_AGE_SECONDS) == timedelta(minutes=15)


def test_missing_token_is_a_validation_error(seller: Any, draft: dict[str, Any]) -> None:
    with pytest.raises(SalesApplicationError):
        reviews.read_token(None, actor=seller, action="sale.confirm", sale_id=1, version=1)


def test_catalog_price_change_produces_a_different_digest_and_current_totals(
    seller: Any, draft: dict[str, Any], product: Any
) -> None:
    first = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    Product.objects.filter(pk=product.pk).update(sale_price=D("12.00"))
    second = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    assert first["totals"]["total"] == "23.00"
    assert second["totals"]["total"] == "24.00"
    assert first["review_token"] != second["review_token"]

    def digest(token: str) -> str:
        return reviews.read_token(
            token, actor=seller, action="sale.confirm", sale_id=draft["id"], version=1
        )

    assert digest(first["review_token"]) != digest(second["review_token"])
    assert InventoryMovement.objects.filter(movement_type="SALE_OUT").count() == 0


@pytest.mark.parametrize(
    "change",
    ["quantity", "customer", "condition", "availability", "rate"],
)
def test_digest_depends_only_on_relevant_content_and_effects(
    seller: Any, draft: dict[str, Any], product: Any, stock: Any, customer: Any, change: str
) -> None:
    def digest() -> str:
        token = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])["review_token"]
        sale = Sale.objects.get(pk=draft["id"])
        return reviews.read_token(
            token, actor=seller, action="sale.confirm", sale_id=sale.pk, version=sale.version
        )

    before = digest()
    assert digest() == before  # estable mientras nada relevante cambie
    if change == "quantity":
        Sale.objects.get(pk=draft["id"]).lines.update(quantity=D(3))
    elif change == "customer":
        from customer_registry.models import Customer

        Customer.objects.filter(pk=customer.pk).update(is_active=False)
    elif change == "condition":
        Sale.objects.filter(pk=draft["id"]).update(condition="CONTADO")
    elif change == "availability":
        stock(product, 1, "4.00")
    elif change == "rate":
        from workshop_configuration.models import TaxPeriod

        TaxPeriod.objects.filter(tax_definition=product.tax_definition).update(rate=D("12"))
    after = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    if change == "customer":
        assert after["can_confirm"] is False
        assert after["issues"][0]["field"] == "customer_id"
    else:
        sale = Sale.objects.get(pk=draft["id"])
        assert (
            reviews.read_token(
                after["review_token"],
                actor=seller,
                action="sale.confirm",
                sale_id=sale.pk,
                version=sale.version,
            )
            != before
        )


def test_review_reports_insufficient_stock_and_deactivated_products_by_line(
    seller: Any, customer: Any, product: Any, stock: Any, make_product: Any
) -> None:
    stock(product, 1, "4.00")
    other = make_product()
    stock(other, 5, "10.00")
    draft = make_draft(
        seller,
        customer,
        [
            {"product_id": product.pk, "quantity": "2"},
            {"product_id": other.pk, "quantity": "1"},
        ],
    )
    Product.objects.filter(pk=other.pk).update(is_active=False)
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    assert review["can_confirm"] is False
    assert review["review_token"] is None
    fields = {(i["code"], i["field"]) for i in review["issues"]}
    assert ("insufficient_stock", "lines.0.quantity") in fields
    assert ("inactive_reference", "lines.1.product_id") in fields


def test_review_requires_permission(actor: Any, draft: dict[str, Any]) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        reviews.preview_confirmation(actor=actor, sale_id=draft["id"])
