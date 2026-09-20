"""Identidad documental externa: duplicados normalizados y coincidencias de SIN_DOCUMENTO."""

from typing import Any

import pytest

from purchasing.application import purchases
from purchasing.application.errors import PurchaseApplicationError
from purchasing.models import Purchase
from supplier_registry.models import Supplier

from .test_confirm import confirm
from .test_drafts import create

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Any) -> None:
    """Contexto comercial, bodega y serie COM-ING."""


def test_repeated_reference_is_rejected_after_normalization(admin: Any, draft_payload: Any) -> None:
    create(admin, draft_payload(supplier_reference="001-001-000123"))
    with pytest.raises(PurchaseApplicationError) as error:
        create(admin, draft_payload(supplier_reference="  001-001-000123  "))
    assert error.value.code == "duplicate_supplier_document"
    assert "supplier_reference" in error.value.errors
    assert Purchase.objects.count() == 1


def test_case_is_compared_uppercased_and_zeros_are_kept(admin: Any, draft_payload: Any) -> None:
    create(admin, draft_payload(supplier_reference="f-000123"))
    with pytest.raises(PurchaseApplicationError):
        create(admin, draft_payload(supplier_reference="F-000123"))
    create(admin, draft_payload(supplier_reference="F-123"))  # otro documento: sin quitar ceros


def test_duplicates_are_detected_even_against_voided_purchases(
    admin: Any, draft_payload: Any
) -> None:
    body = create(admin, draft_payload(supplier_reference="ANULADA-1"))
    Purchase.objects.filter(pk=body["id"]).update(state="VOIDED", internal_number="COM-ING-7")
    with pytest.raises(PurchaseApplicationError) as error:
        create(admin, draft_payload(supplier_reference="ANULADA-1"))
    assert error.value.code == "duplicate_supplier_document"


def test_other_supplier_or_type_is_another_identity(admin: Any, draft_payload: Any) -> None:
    create(admin, draft_payload(supplier_reference="000123"))
    other = Supplier.objects.create(name="Otro proveedor")
    create(admin, draft_payload(supplier_reference="000123", supplier_id=other.pk))
    create(admin, draft_payload(supplier_reference="000123", document_type="NOTA_DE_VENTA"))
    assert Purchase.objects.count() == 3


def test_editing_a_draft_into_an_existing_identity_is_rejected(
    admin: Any, draft_payload: Any
) -> None:
    create(admin, draft_payload(supplier_reference="A-1"))
    second = create(admin, draft_payload(supplier_reference="A-2"))
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.update_draft(
            actor=admin,
            purchase_id=second["id"],
            payload={
                "idempotency_key": "edit-key-100001",
                "expected_version": 1,
                "supplier_reference": "a-1",
            },
        )
    assert error.value.code == "duplicate_supplier_document"


def test_without_document_requires_a_reason_and_carries_no_invented_reference(
    admin: Any, draft_payload: Any
) -> None:
    with pytest.raises(PurchaseApplicationError) as error:
        create(admin, draft_payload(document_type="SIN_DOCUMENTO", supplier_reference=""))
    assert "no_document_reason" in error.value.errors
    body = create(
        admin,
        draft_payload(
            document_type="SIN_DOCUMENTO", supplier_reference="", no_document_reason="Mostrador"
        ),
    )
    assert body["document"]["reference"] == ""
    assert body["internal_number"] is None


@pytest.fixture
def undocumented(admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any) -> Any:
    def build(**overrides: Any) -> dict[str, Any]:
        return create(
            admin,
            draft_payload(
                [line(product, commercial["ten"], "2", "10.00")],
                document_type="SIN_DOCUMENTO",
                supplier_reference="",
                no_document_reason="Compra de mostrador",
                **overrides,
            ),
        )

    return build


def test_matching_undocumented_purchases_are_warned_and_need_acknowledgement(
    admin: Any, undocumented: Any
) -> None:
    first = undocumented()
    confirm(admin, first, key="confirm-key-201")
    second = undocumented()
    review = purchases.preview_confirmation(actor=admin, purchase_id=second["id"])
    assert review["can_confirm"] is True
    assert review["requires_acknowledgement"] is True
    assert [m["purchase_id"] for m in review["matches"]] == [first["id"]]
    payload = {
        "idempotency_key": "confirm-key-202",
        "expected_version": second["version"],
        "review_token": review["review_token"],
    }
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.confirm_purchase(actor=admin, purchase_id=second["id"], payload=payload)
    assert error.value.code == "validation_error"
    assert "acknowledged_matches" in error.value.errors
    outcome = purchases.confirm_purchase(
        actor=admin,
        purchase_id=second["id"],
        payload={
            **payload,
            "idempotency_key": "confirm-key-203",
            "acknowledged_matches": [first["id"]],
        },
    )
    assert outcome.body["state"] == "CONFIRMED"  # legítima: no se fusiona ni se bloquea


def test_purchases_that_differ_do_not_warn(
    admin: Any, undocumented: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    first = undocumented()
    confirm(admin, first, key="confirm-key-204")
    different = create(
        admin,
        draft_payload(
            [line(product, commercial["ten"], "3", "10.00")],
            document_type="SIN_DOCUMENTO",
            supplier_reference="",
            no_document_reason="Otra",
        ),
    )
    review = purchases.preview_confirmation(actor=admin, purchase_id=different["id"])
    assert review["matches"] == []
    assert review["requires_acknowledgement"] is False


def test_new_matches_after_the_review_require_a_new_review(admin: Any, undocumented: Any) -> None:
    candidate = undocumented()
    review = purchases.preview_confirmation(actor=admin, purchase_id=candidate["id"])
    assert review["matches"] == []
    twin = undocumented()
    confirm(admin, twin, key="confirm-key-205")
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.confirm_purchase(
            actor=admin,
            purchase_id=candidate["id"],
            payload={
                "idempotency_key": "confirm-key-206",
                "expected_version": candidate["version"],
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "review_required"
    assert Purchase.objects.get(pk=candidate["id"]).state == "DRAFT"
    fresh = purchases.preview_confirmation(actor=admin, purchase_id=candidate["id"])
    assert [m["purchase_id"] for m in fresh["matches"]] == [twin["id"]]


def test_documented_purchases_never_produce_matches(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    for _ in range(2):
        body = create(admin, draft_payload([line(product, commercial["ten"])]))
    review = purchases.preview_confirmation(actor=admin, purchase_id=body["id"])
    assert review["matches"] == []
