"""Reemplazo vinculado de un documento externo anulado."""

from typing import Any

import pytest

from inventory.models import InventoryMovement
from purchasing.application import purchases
from purchasing.application.errors import PurchaseApplicationError
from purchasing.models import Purchase

from .test_confirm import confirm
from .test_drafts import create

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Any) -> None:
    """Contexto comercial, bodega y serie COM-ING."""


@pytest.fixture
def voided(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> dict[str, Any]:
    draft = create(
        admin, draft_payload([line(product, commercial["ten"])], supplier_reference="F-1")
    )
    confirm(admin, draft, key="confirm-key-301")
    Purchase.objects.filter(pk=draft["id"]).update(state="VOIDED", void_reason="Error")
    return draft


def replacement(
    admin: Any, original: dict[str, Any], key: str = "replace-key-001"
) -> dict[str, Any]:
    return purchases.create_replacement(
        actor=admin, purchase_id=original["id"], payload={"idempotency_key": key}
    ).body


def test_replacement_reuses_the_external_identity_and_links_the_antecedent(
    admin: Any, voided: dict[str, Any]
) -> None:
    body = replacement(admin, voided)
    assert body["state"] == "DRAFT"
    assert body["replaces_id"] == voided["id"]
    assert body["document"]["normalized_reference"] == "F-1"
    assert len(body["lines"]) == len(voided["lines"])
    assert Purchase.objects.get(pk=body["id"]).document_identity_id == (
        Purchase.objects.get(pk=voided["id"]).document_identity_id
    )


def test_confirming_the_replacement_assigns_a_new_number_and_keeps_the_chain(
    admin: Any, voided: dict[str, Any]
) -> None:
    body = replacement(admin, voided)
    confirmed = confirm(admin, body, key="confirm-key-302").body
    assert confirmed["state"] == "CONFIRMED"
    assert confirmed["internal_number"] == "COM-ING-000002"
    original = Purchase.objects.get(pk=voided["id"])
    assert (original.state, original.internal_number) == ("VOIDED", "COM-ING-000001")
    assert confirmed["replaces_id"] == original.pk


def test_replacement_of_an_active_or_draft_purchase_is_not_offered(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    with pytest.raises(PurchaseApplicationError):
        replacement(admin, draft)


def test_replacement_cannot_confirm_while_the_antecedent_is_not_voided(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(
        admin, draft_payload([line(product, commercial["ten"])], supplier_reference="ACT-1")
    )
    confirm(admin, draft, key="confirm-key-303")
    body = replacement(admin, {**draft}, key="replace-key-002")
    review = purchases.preview_confirmation(actor=admin, purchase_id=body["id"])
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.confirm_purchase(
            actor=admin,
            purchase_id=body["id"],
            payload={
                "idempotency_key": "confirm-key-304",
                "expected_version": body["version"],
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "duplicate_supplier_document"
    assert InventoryMovement.objects.count() == 1


def test_competing_replacements_confirm_at_most_one(admin: Any, voided: dict[str, Any]) -> None:
    first = replacement(admin, voided, key="replace-key-003")
    second = replacement(admin, voided, key="replace-key-004")
    confirm(admin, first, key="confirm-key-305")
    review = purchases.preview_confirmation(actor=admin, purchase_id=second["id"])
    assert review["can_confirm"] is True  # el conflicto se resuelve al confirmar
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.confirm_purchase(
            actor=admin,
            purchase_id=second["id"],
            payload={
                "idempotency_key": "confirm-key-306",
                "expected_version": second["version"],
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "duplicate_supplier_document"
    assert InventoryMovement.objects.count() == 2  # original + primer reemplazo
    assert Purchase.objects.filter(state="CONFIRMED").count() == 1


def test_a_replacement_cannot_change_the_inherited_identity(
    admin: Any, voided: dict[str, Any]
) -> None:
    body = replacement(admin, voided, key="replace-key-005")
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.update_draft(
            actor=admin,
            purchase_id=body["id"],
            payload={
                "idempotency_key": "edit-key-300001",
                "expected_version": 1,
                "supplier_reference": "OTRA",
            },
        )
    assert "supplier_reference" in error.value.errors
