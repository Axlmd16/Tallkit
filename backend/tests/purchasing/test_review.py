"""Revisión previa: solo lectura, con token firmado ligado a actor, acción y contenido."""

import time
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.core import signing

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import UserRole
from purchasing.application import purchases
from purchasing.application.errors import PurchaseApplicationError
from purchasing.models import Purchase

from .test_drafts import create, no_side_effects

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Any) -> None:
    """La revisión requiere contexto comercial, bodega y serie COM-ING."""


@pytest.fixture
def draft(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> dict[str, Any]:
    return create(admin, draft_payload([line(product, commercial["ten"])]))


def test_preview_is_read_only_and_returns_totals_and_effects(
    admin: Any, draft: dict[str, Any], product: Any
) -> None:
    before = no_side_effects()
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    assert review["can_confirm"] is True
    assert review["issues"] == []
    assert review["totals"]["total"] == "22.00"
    (effect,) = review["effects"]
    assert (effect["product_id"], effect["quantity_to_receive"]) == (product.pk, "2")
    assert (effect["current_quantity"], effect["resulting_quantity"]) == ("0", "2")
    assert review["version"] == draft["version"]
    assert no_side_effects() == before
    assert Purchase.objects.get(pk=draft["id"]).state == "DRAFT"


def test_token_carries_identifiers_and_digest_only_and_expires_in_fifteen_minutes(
    admin: Any, draft: dict[str, Any], supplier: Any
) -> None:
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    token = review["review_token"]
    payload = signing.loads(token, salt=purchases.REVIEW_SALT)
    assert set(payload) == {"a", "act", "p", "d"}
    assert payload["a"] == admin.pk
    assert payload["p"] == draft["id"]
    assert payload["act"] == "purchase.confirm"
    assert len(payload["d"]) == 64
    decoded_text = str(payload)
    assert supplier.name not in decoded_text
    assert "10.00" not in decoded_text
    assert review["expires_in_seconds"] == 900


def test_expired_token_requires_a_new_review(
    admin: Any, draft: dict[str, Any], monkeypatch: Any
) -> None:
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    real = time.time()
    monkeypatch.setattr(time, "time", lambda: real + 16 * 60)
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.read_review_token(
            review["review_token"], actor=admin, action="purchase.confirm", purchase_id=draft["id"]
        )
    assert error.value.code == "review_required"


def test_modified_token_is_rejected(admin: Any, draft: dict[str, Any]) -> None:
    token = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])["review_token"]
    tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.read_review_token(
            tampered, actor=admin, action="purchase.confirm", purchase_id=draft["id"]
        )
    assert error.value.code == "validation_error"
    assert "review_token" in error.value.errors


def test_token_is_bound_to_actor_action_and_purchase(
    admin: Any, draft: dict[str, Any], commercial: Any, draft_payload: Any
) -> None:
    token = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])["review_token"]
    other_admin = get_user_model().objects.create_user(username="admin-2", password="x" * 14)
    UserRole.objects.create(user=other_admin, role="ADMINISTRADOR")
    other_draft = create(admin, draft_payload())
    for kwargs in (
        {"actor": other_admin, "action": "purchase.confirm", "purchase_id": draft["id"]},
        {"actor": admin, "action": "purchase.void", "purchase_id": draft["id"]},
        {"actor": admin, "action": "purchase.confirm", "purchase_id": other_draft["id"]},
    ):
        with pytest.raises(PurchaseApplicationError) as error:
            purchases.read_review_token(token, **kwargs)
        assert error.value.code == "validation_error"


def test_review_reports_blocking_issues_and_issues_no_token(
    admin: Any, draft: dict[str, Any], product: Any
) -> None:
    from catalog.models import Product

    Product.objects.filter(pk=product.pk).update(is_active=False)
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    assert review["can_confirm"] is False
    assert review["review_token"] is None
    assert [(i["code"], i["field"]) for i in review["issues"]] == [
        ("inactive_reference", "lines.0.product_id")
    ]


def test_draft_without_lines_cannot_be_confirmed(
    admin: Any, commercial: Any, draft_payload: Any
) -> None:
    empty = create(admin, draft_payload())
    review = purchases.preview_confirmation(actor=admin, purchase_id=empty["id"])
    assert review["can_confirm"] is False
    assert review["issues"][0]["field"] == "lines"


def test_preview_requires_the_confirm_permission(seller: Any, draft: dict[str, Any]) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        purchases.preview_confirmation(actor=seller, purchase_id=draft["id"])
