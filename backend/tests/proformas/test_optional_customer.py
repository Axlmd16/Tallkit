"""Cliente opcional en la proforma y obligatorio al convertirla en venta (ajuste 2026-10-06)."""

from typing import Any

import pytest

from proformas.application import conversion, drafts, queries, reviews
from proformas.application.errors import ProformaApplicationError
from proformas.domain.draft_input import DraftValidationError, parse_draft
from proformas.models import Proforma
from sales.models import Sale

from .conftest import key

pytestmark = pytest.mark.django_db


def anonymous(seller: Any, product: Any, quantity: str = "2") -> dict[str, Any]:
    body: dict[str, Any] = drafts.create_draft(
        actor=seller,
        payload={
            "idempotency_key": key("anon"),
            "lines": [{"product_id": product.pk, "quantity": quantity}],
        },
    ).body
    return body


def test_customer_is_optional_but_never_malformed() -> None:
    assert parse_draft({"lines": []}).customer_id is None
    assert parse_draft({"customer_id": None, "lines": []}).customer_id is None
    for bad in (0, -1, "7", True):
        with pytest.raises(DraftValidationError) as error:
            parse_draft({"customer_id": bad, "lines": []})
        assert "customer_id" in error.value.errors


def test_draft_without_customer_is_saved_previewed_and_issued(
    seller: Any, product: Any, issue: Any, at: Any
) -> None:
    at(2026, 10, 6)
    capture = reviews.preview_draft(
        actor=seller, payload={"lines": [{"product_id": product.pk, "quantity": "2"}]}
    )
    assert capture["issues"] == []
    assert capture["customer"] is None
    draft = anonymous(seller, product)
    assert draft["customer"] is None
    assert draft["totals"]["total"] == "23.00"
    review = reviews.preview_issue(actor=seller, proforma_id=draft["id"])
    assert review["can_issue"] is True
    issued = issue(draft)
    assert (issued["state"], issued["internal_number"], issued["customer"]) == (
        "VALID",
        "COM-PRO-000001",
        None,
    )
    stored = Proforma.objects.get(pk=issued["id"])
    assert stored.customer_id is None
    assert stored.header_snapshot is not None
    assert stored.header_snapshot["customer"] is None
    document = queries.document(actor=seller, proforma_id=issued["id"])
    assert document["customer"] is None
    assert document["grand_total"] == "23.00"


def test_customer_can_be_added_and_removed_while_draft(
    seller: Any, product: Any, customer: Any
) -> None:
    draft = anonymous(seller, product)
    added = drafts.update_draft(
        actor=seller,
        proforma_id=draft["id"],
        payload={"idempotency_key": key(), "expected_version": 1, "customer_id": customer.pk},
    ).body
    assert added["customer"]["id"] == customer.pk
    removed = drafts.update_draft(
        actor=seller,
        proforma_id=draft["id"],
        payload={"idempotency_key": key(), "expected_version": 2, "customer_id": None},
    ).body
    assert removed["customer"] is None


def test_chosen_inactive_customer_still_blocks_issuing(
    new_draft: Any, seller: Any, product: Any, customer: Any, at: Any
) -> None:
    at(2026, 10, 6)
    draft = new_draft((product, 1))
    type(customer).objects.filter(pk=customer.pk).update(is_active=False)
    review = reviews.preview_issue(actor=seller, proforma_id=draft["id"])
    assert [item["field"] for item in review["issues"]] == ["customer_id"]


def test_list_shows_and_searches_offers_without_customer(
    seller: Any, product: Any, new_draft: Any
) -> None:
    anonymous_draft = anonymous(seller, product)
    with_customer = new_draft((product, 1))
    rows = {row["id"]: row for row in queries.list_proformas(actor=seller)["items"]}
    assert rows[anonymous_draft["id"]]["customer"] is None
    assert rows[with_customer["id"]]["customer"]["name"] == "Cliente Proforma"
    found = queries.list_proformas(actor=seller, search="Cliente Proforma")["items"]
    assert [row["id"] for row in found] == [with_customer["id"]]


def test_copy_keeps_the_absence_of_customer(seller: Any, product: Any, issue: Any, at: Any) -> None:
    at(2026, 10, 6)
    issued = issue(anonymous(seller, product))
    copy = drafts.copy_proforma(
        actor=seller, proforma_id=issued["id"], payload={"idempotency_key": key()}
    ).body
    assert copy["customer"] is None


def test_conversion_requires_choosing_a_customer(
    seller: Any, product: Any, customer: Any, issue: Any, at: Any
) -> None:
    at(2026, 10, 6)
    issued = issue(anonymous(seller, product))
    missing = conversion.preview_conversion(actor=seller, proforma_id=issued["id"])
    assert (missing["can_convert"], missing["requires_customer"]) == (False, True)
    assert missing["review_token"] is None
    assert [item["field"] for item in missing["issues"]] == ["customer_id"]
    assert missing["comparison"] is not None
    with pytest.raises(ProformaApplicationError) as error:
        conversion.convert_proforma(
            actor=seller,
            proforma_id=issued["id"],
            payload={
                "idempotency_key": key(),
                "expected_version": issued["version"],
                "review_token": "x",
            },
        )
    assert error.value.code == "validation_error"
    assert "customer_id" in error.value.errors
    assert not Sale.objects.exists()

    review = conversion.preview_conversion(
        actor=seller, proforma_id=issued["id"], customer_id=customer.pk
    )
    assert review["can_convert"] is True
    body = conversion.convert_proforma(
        actor=seller,
        proforma_id=issued["id"],
        payload={
            "idempotency_key": key(),
            "expected_version": review["version"],
            "review_token": review["review_token"],
            "customer_id": customer.pk,
        },
    ).body
    sale = Sale.objects.get()
    assert sale.customer_id == customer.pk
    assert (sale.origin_proforma_id, body["state"]) == (issued["id"], "CONVERTED")
    # La oferta emitida no se reescribe: sigue sin cliente y enlaza la venta.
    assert body["customer"] is None
    assert body["sale"]["id"] == sale.pk


def test_review_is_bound_to_the_chosen_customer(
    seller: Any, product: Any, customer: Any, issue: Any, at: Any
) -> None:
    from customer_registry.models import Customer

    at(2026, 10, 6)
    issued = issue(anonymous(seller, product))
    other = Customer.objects.create(
        person_type="NATURAL",
        name="Otro Cliente",
        identification_type="CI",
        identification="0912345678",
        phone="0988888888",
    )
    review = conversion.preview_conversion(
        actor=seller, proforma_id=issued["id"], customer_id=customer.pk
    )
    with pytest.raises(ProformaApplicationError) as error:
        conversion.convert_proforma(
            actor=seller,
            proforma_id=issued["id"],
            payload={
                "idempotency_key": key(),
                "expected_version": review["version"],
                "review_token": review["review_token"],
                "customer_id": other.pk,
            },
        )
    assert error.value.code == "review_required"
    assert not Sale.objects.exists()


def test_inactive_chosen_customer_is_reported(
    seller: Any, product: Any, customer: Any, issue: Any, at: Any
) -> None:
    at(2026, 10, 6)
    issued = issue(anonymous(seller, product))
    type(customer).objects.filter(pk=customer.pk).update(is_active=False)
    review = conversion.preview_conversion(
        actor=seller, proforma_id=issued["id"], customer_id=customer.pk
    )
    assert review["can_convert"] is False
    assert review["issues"][0]["code"] == "inactive_reference"


def test_offer_with_customer_cannot_be_converted_for_another(
    issued: dict[str, Any], seller: Any, customer: Any
) -> None:
    review = conversion.preview_conversion(actor=seller, proforma_id=issued["id"])
    assert review["requires_customer"] is False
    with pytest.raises(ProformaApplicationError) as error:
        conversion.convert_proforma(
            actor=seller,
            proforma_id=issued["id"],
            payload={
                "idempotency_key": key(),
                "expected_version": review["version"],
                "review_token": review["review_token"],
                "customer_id": customer.pk + 999,
            },
        )
    assert "customer_id" in error.value.errors
    assert not Sale.objects.exists()
