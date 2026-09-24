"""Borradores: sin efectos de inventario, deuda, numeración ni usos fiscales."""

from decimal import Decimal
from itertools import count
from typing import Any

import pytest

from catalog.models import Product
from customer_registry.models import Customer
from identity.application.authorization import BusinessPermissionDeniedError
from inventory.models import (
    InventoryMovement,
    InventoryOperation,
    InventoryPosition,
    InventoryReservation,
)
from sales.application import sales
from sales.application.errors import SalesApplicationError
from sales.application.workshop_links import add_linked_line
from sales.models import CommercialPayment, Sale, SaleLine, SalesCommand
from workshop_configuration.models import ConfigurationUse, NumberAllocation, Warehouse

pytestmark = pytest.mark.django_db
_keys = count(1)


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


def key() -> str:
    return f"draft-key-{next(_keys):06d}"


def payload(customer: Customer, lines: list[dict[str, Any]], **extra: Any) -> dict[str, Any]:
    return {
        "idempotency_key": key(),
        "customer_id": customer.pk,
        "condition": "CREDITO",
        "notes": "",
        "lines": lines,
        **extra,
    }


def create(actor: Any, customer: Any, lines: list[dict[str, Any]], **extra: Any) -> dict[str, Any]:
    return sales.create_draft(actor=actor, payload=payload(customer, lines, **extra)).body


def no_side_effects() -> None:
    assert InventoryOperation.objects.count() == 0
    assert InventoryMovement.objects.count() == 0
    assert InventoryPosition.objects.count() == 0
    assert NumberAllocation.objects.count() == 0
    assert ConfigurationUse.objects.count() == 0
    assert CommercialPayment.objects.count() == 0


def test_create_draft_reserves_nothing_and_consumes_no_number(
    seller: Any, customer: Any, product: Any
) -> None:
    body = create(seller, customer, [{"product_id": product.pk, "quantity": "2"}])
    assert body["state"] == "DRAFT"
    assert body["internal_number"] is None
    assert body["version"] == 1
    assert body["lines"][0]["quantity"] == "2"
    assert "unit_price" not in body["lines"][0]
    assert "cost" not in str(body).lower()
    no_side_effects()


def test_draft_can_be_listed_retrieved_and_edited_with_expected_version(
    seller: Any, customer: Any, product: Any, make_product: Any
) -> None:
    draft = create(seller, customer, [{"product_id": product.pk, "quantity": "1"}])
    other = make_product()
    outcome = sales.update_draft(
        actor=seller,
        sale_id=draft["id"],
        payload={
            "idempotency_key": key(),
            "expected_version": 1,
            "lines": [{"product_id": other.pk, "quantity": "3"}],
            "notes": "Mostrador",
        },
    )
    assert outcome.body["version"] == 2
    assert [line["product_id"] for line in outcome.body["lines"]] == [other.pk]
    assert sales.get_sale(actor=seller, sale_id=draft["id"])["notes"] == "Mostrador"
    listing = sales.list_sales(actor=seller, state="DRAFT")
    assert listing["total_count"] == 1
    assert listing["items"][0]["id"] == draft["id"]
    no_side_effects()


def test_linked_draft_ordinary_edit_only_allows_condition_and_notes(
    seller: Any,
    customer: Any,
    maintenance_order: Any,
    product: Any,
    stock: Any,
    make_product: Any,
) -> None:
    stock(product, 5, "5.00")
    line = add_linked_line(
        actor=seller,
        order_ref=maintenance_order,
        product_id=product.pk,
        quantity="2",
    )
    sale = Sale.objects.get(pk=line.sale_id)
    updated = sales.update_draft(
        actor=seller,
        sale_id=sale.pk,
        payload={
            "idempotency_key": key(),
            "expected_version": sale.version,
            "condition": "CREDITO",
            "notes": "Confirmar con el cliente",
        },
    ).body
    assert (updated["condition"], updated["notes"], updated["lines"][0]["id"]) == (
        "CREDITO",
        "Confirmar con el cliente",
        line.pk,
    )
    assert InventoryReservation.objects.get(source_id=line.pk).state == "ACTIVE"

    other = make_product()
    for change in (
        {"customer_id": customer.pk},
        {"lines": [{"product_id": other.pk, "quantity": "1"}]},
    ):
        with pytest.raises(SalesApplicationError) as error:
            sales.update_draft(
                actor=seller,
                sale_id=sale.pk,
                payload={
                    "idempotency_key": key(),
                    "expected_version": updated["version"],
                    **change,
                },
            )
        assert error.value.code == "linked_sale_locked"
    line.refresh_from_db()
    assert (line.product_id, line.quantity) == (product.pk, Decimal(2))


def test_stale_version_is_rejected_and_the_first_edit_survives(
    seller: Any, customer: Any, product: Any
) -> None:
    draft = create(seller, customer, [{"product_id": product.pk, "quantity": "1"}])
    sales.update_draft(
        actor=seller,
        sale_id=draft["id"],
        payload={"idempotency_key": key(), "expected_version": 1, "notes": "primera"},
    )
    with pytest.raises(SalesApplicationError) as error:
        sales.update_draft(
            actor=seller,
            sale_id=draft["id"],
            payload={"idempotency_key": key(), "expected_version": 1, "notes": "obsoleta"},
        )
    assert error.value.code == "stale_record"
    assert Sale.objects.get(pk=draft["id"]).notes == "primera"


def test_idempotent_replay_returns_the_same_draft_without_duplicating(
    seller: Any, customer: Any, product: Any
) -> None:
    data = payload(customer, [{"product_id": product.pk, "quantity": "1"}])
    first = sales.create_draft(actor=seller, payload=data)
    second = sales.create_draft(actor=seller, payload=data)
    assert second.replayed
    assert second.body["id"] == first.body["id"]
    assert Sale.objects.count() == 1
    assert SalesCommand.objects.count() == 1


def test_missing_or_inactive_customer_is_rejected(seller: Any, customer: Any, product: Any) -> None:
    with pytest.raises(SalesApplicationError) as missing:
        sales.create_draft(
            actor=seller,
            payload={**payload(customer, []), "customer_id": 999999},
        )
    assert missing.value.errors["customer_id"]
    Customer.objects.filter(pk=customer.pk).update(is_active=False)
    with pytest.raises(SalesApplicationError) as inactive:
        create(seller, customer, [])
    assert inactive.value.code == "inactive_reference"
    assert Sale.objects.count() == 0


def test_inactive_or_unknown_products_are_rejected_identifying_the_line(
    seller: Any, customer: Any, product: Any, make_product: Any
) -> None:
    inactive = make_product(is_active=False)
    with pytest.raises(SalesApplicationError) as error:
        create(
            seller,
            customer,
            [
                {"product_id": product.pk, "quantity": "1"},
                {"product_id": inactive.pk, "quantity": "1"},
                {"product_id": 987654, "quantity": "1"},
            ],
        )
    assert error.value.code == "inactive_reference"
    assert set(error.value.errors) == {"lines.1.product_id", "lines.2.product_id"}


def test_artisan_entity_is_explicitly_rejected_in_a_commercial_sale(
    seller: Any, customer: Any, product: Any
) -> None:
    with pytest.raises(SalesApplicationError) as error:
        create(
            seller,
            customer,
            [{"product_id": product.pk, "quantity": "1"}],
            entity_type="ARTESANAL",
        )
    assert "entity_type" in error.value.errors
    assert Sale.objects.count() == 0


@pytest.mark.parametrize("quantity", ["0", "-1", "1.5", "abc", 1.5, None])
def test_quantities_are_positive_whole_presentations_and_the_line_is_identified(
    seller: Any, customer: Any, product: Any, quantity: Any
) -> None:
    with pytest.raises(SalesApplicationError) as error:
        create(
            seller,
            customer,
            [
                {"product_id": product.pk, "quantity": "1"},
                {"product_id": product.pk, "quantity": quantity},
            ],
        )
    assert "lines.1.quantity" in error.value.errors


def test_a_kit_is_sold_intact_and_creates_no_component_lines(
    seller: Any, customer: Any, make_product: Any
) -> None:
    kit = make_product(is_kit=True)
    body = create(seller, customer, [{"product_id": kit.pk, "quantity": "1"}])
    assert [line["product_id"] for line in body["lines"]] == [kit.pk]
    assert SaleLine.objects.count() == 1


@pytest.mark.parametrize("admin_actor", [False, True])
@pytest.mark.parametrize(
    ("top", "line_extra"),
    [
        ({"discount": "0"}, {}),
        ({"discount": "0.00"}, {}),
        ({"total": "1.00"}, {}),
        ({"tax_rate": "0"}, {}),
        ({}, {"unit_price": "1.00"}),
        ({}, {"discount": "0"}),
        ({}, {"tax_definition_id": 1}),
        ({"grand_total": "5.00", "unit_cost": "1"}, {}),
    ],
)
def test_negotiated_price_discount_or_replaced_tax_is_rejected_for_every_role(
    seller: Any,
    admin: Any,
    customer: Any,
    product: Any,
    admin_actor: bool,
    top: dict[str, Any],
    line_extra: dict[str, Any],
) -> None:
    actor = admin if admin_actor else seller
    with pytest.raises(SalesApplicationError) as error:
        sales.create_draft(
            actor=actor,
            payload=payload(
                customer, [{"product_id": product.pk, "quantity": "1", **line_extra}], **top
            ),
        )
    assert error.value.code == "unknown_field"
    assert Sale.objects.count() == 0


def test_product_deactivated_after_adding_keeps_the_draft_readable(
    seller: Any, customer: Any, product: Any
) -> None:
    draft = create(seller, customer, [{"product_id": product.pk, "quantity": "1"}])
    Product.objects.filter(pk=product.pk).update(is_active=False)
    body = sales.get_sale(actor=seller, sale_id=draft["id"])
    assert body["lines"][0]["product_id"] == product.pk
    assert body["state"] == "DRAFT"


def test_permissions_by_role_and_missing_role(
    admin: Any, seller: Any, actor: Any, customer: Any, product: Any, db: None
) -> None:
    lines = [{"product_id": product.pk, "quantity": "1"}]
    create(seller, customer, lines)
    create(admin, customer, lines)
    with pytest.raises(BusinessPermissionDeniedError):
        create(actor, customer, lines)
    with pytest.raises(BusinessPermissionDeniedError):
        sales.get_sale(actor=actor, sale_id=1)
    from django.contrib.auth import get_user_model

    from identity.models import UserRole

    workshop = get_user_model().objects.create_user(username="sal-workshop", password="x" * 14)
    UserRole.objects.create(user=workshop, role="ENCARGADO_TALLER")
    with pytest.raises(BusinessPermissionDeniedError):
        create(workshop, customer, lines)
    both = get_user_model().objects.create_user(username="sal-both", password="x" * 14)
    for role in ("VENDEDOR", "ENCARGADO_TALLER"):
        UserRole.objects.create(user=both, role=role)
    create(both, customer, lines)


def test_missing_configuration_is_reported_without_creating_the_draft(
    seller: Any, customer: Any, product: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    from workshop_configuration.application.operation_context import OperationContextError

    def missing() -> None:
        raise OperationContextError("missing_entity", "No existe la entidad fiscal comercial.")

    monkeypatch.setattr(sales, "get_operation_context", missing)
    with pytest.raises(SalesApplicationError) as error:
        create(seller, customer, [{"product_id": product.pk, "quantity": "1"}])
    assert error.value.code == "configuration_missing"
    assert Sale.objects.count() == 0
