"""Previsualización de captura: proyección documental sin persistir ni numerar."""

from typing import Any

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from inventory.models import InventoryMovement, InventoryPosition
from sales.application import reviews
from sales.application.errors import SalesApplicationError
from sales.models import Sale, SalesCommand
from workshop_configuration.models import ConfigurationUse, NumberAllocation, Warehouse

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


def preview(actor: Any, **payload: Any) -> dict[str, Any]:
    return reviews.preview_draft_capture(actor=actor, payload=payload)


def test_complete_capture_projects_the_document_without_any_persistence(
    seller: Any, customer: Any, product: Any
) -> None:
    body = preview(
        seller,
        customer_id=customer.pk,
        condition="CREDITO",
        lines=[{"product_id": product.pk, "quantity": "2"}],
    )
    assert body["status"] == "DRAFT_PREVIEW"
    assert body["number_pending"] is True
    assert body["internal_number"] is None
    assert body["totals"] == {"base": "20.00", "tax": "3.00", "total": "23.00"}
    assert body["lines"][0]["unit_price"] == "11.50"
    assert body["customer"]["name"] == customer.name
    assert body["fiscal_entity"]["type"] == "COMERCIAL"
    assert "SRI" in body["notice"]
    assert Sale.objects.count() == 0
    assert SalesCommand.objects.count() == 0
    assert InventoryMovement.objects.count() == 0
    assert InventoryPosition.objects.count() == 0
    assert NumberAllocation.objects.count() == 0
    assert ConfigurationUse.objects.count() == 0


def test_incomplete_capture_returns_field_issues_and_no_invented_amounts(
    seller: Any, product: Any
) -> None:
    body = preview(
        seller,
        lines=[
            {"product_id": product.pk, "quantity": "0"},
            {"product_id": product.pk, "quantity": "1"},
            {"product_id": 987654, "quantity": "1"},
        ],
    )
    fields = {issue["field"] for issue in body["issues"]}
    assert {"customer_id", "condition", "lines.0.quantity", "lines.2.product_id"} <= fields
    assert body["customer"] is None
    assert body["totals"] is None or body["totals"]["total"] != "0.00"
    unresolved = [line for line in body["lines"] if line["product_id"] == 987654]
    assert unresolved[0]["total_amount"] is None


def test_empty_capture_yields_issues_and_null_totals(seller: Any) -> None:
    body = preview(seller)
    assert body["totals"] is None
    assert body["lines"] == []
    assert body["issues"]


def test_capture_preview_never_enables_confirmation(
    seller: Any, customer: Any, product: Any
) -> None:
    body = preview(
        seller,
        customer_id=customer.pk,
        condition="CONTADO",
        lines=[{"product_id": product.pk, "quantity": "1"}],
    )
    assert body["can_confirm"] is False
    assert "review_token" not in body


def test_unknown_fields_and_artisan_scope_are_rejected(
    seller: Any, customer: Any, product: Any
) -> None:
    with pytest.raises(SalesApplicationError) as extra:
        preview(seller, discount="0", lines=[])
    assert extra.value.code == "unknown_field"
    with pytest.raises(SalesApplicationError) as line_extra:
        preview(seller, lines=[{"product_id": product.pk, "quantity": "1", "unit_price": "1"}])
    assert line_extra.value.code == "unknown_field"
    with pytest.raises(SalesApplicationError):
        preview(seller, entity_type="ARTESANAL", lines=[])


def test_capture_preview_requires_the_create_permission(actor: Any) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        preview(actor)
