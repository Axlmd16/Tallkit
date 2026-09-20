"""Ajustes justificados y ciclo PREPARED → vista previa → confirmación."""

from decimal import Decimal
from typing import Any

import pytest

from catalog.models import Product
from identity.application.authorization import BusinessPermissionDeniedError
from inventory.application import operations
from inventory.application.errors import InventoryApplicationError
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition

from .test_initial_load import confirm, prepare

pytestmark = pytest.mark.django_db
D = Decimal


@pytest.fixture
def stocked(admin: Any, product: Any, warehouse: Any) -> Any:
    confirm(
        admin,
        prepare(admin, product, "seed-key-0001", quantity="10", unit_cost="2.00"),
        "seed-key-0002",
    )
    return product


def adjust(admin: Any, product: Any, kind: str, key: str, **overrides: Any) -> dict[str, Any]:
    payload = {
        "idempotency_key": key,
        "kind": kind,
        "product_id": product.pk,
        "quantity": "3",
        "reason": "Pérdida comprobada",
        **overrides,
    }
    return operations.create_operation(actor=admin, payload=payload).body


def test_exit_adjustment_values_at_the_current_average(admin: Any, stocked: Any) -> None:
    body = adjust(admin, stocked, "ADJUSTMENT_OUT", "adj-key-00001")
    confirm(admin, body, "adj-key-00002")
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value) == (D(7), D("14.000000"))
    movement = InventoryMovement.objects.filter(movement_type="ADJUSTMENT_OUT").get()
    assert (movement.applied_unit_cost, movement.value_delta) == (D("2.000000"), D("-6.000000"))


def test_entry_adjustment_needs_an_explicit_inventoriable_cost(admin: Any, stocked: Any) -> None:
    with pytest.raises(InventoryApplicationError) as error:
        adjust(admin, stocked, "ADJUSTMENT_IN", "adj-key-00003")
    assert "unit_cost" in error.value.errors
    body = adjust(
        admin, stocked, "ADJUSTMENT_IN", "adj-key-00004", unit_cost="4.00", reason="Hallazgo físico"
    )
    confirm(admin, body, "adj-key-00005")
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value, position.average) == (
        D(13),
        D("32.000000"),
        D("2.461538"),
    )


@pytest.mark.parametrize("reason", ["", "   ", None])
def test_adjustments_require_a_reason(admin: Any, stocked: Any, reason: Any) -> None:
    with pytest.raises(InventoryApplicationError) as error:
        adjust(admin, stocked, "ADJUSTMENT_OUT", "adj-key-00006", reason=reason)
    assert "reason" in error.value.errors


def test_preparing_and_abandoning_changes_no_stock(admin: Any, stocked: Any) -> None:
    before = (InventoryMovement.objects.count(), InventoryPosition.objects.get().quantity)
    body = adjust(admin, stocked, "ADJUSTMENT_OUT", "adj-key-00007")
    operations.preview_operation(actor=admin, operation_id=body["id"])
    assert (InventoryMovement.objects.count(), InventoryPosition.objects.get().quantity) == before
    assert InventoryOperation.objects.get(pk=body["id"]).state == "PREPARED"


def test_prepared_operation_can_be_edited_with_the_expected_version(
    admin: Any, stocked: Any
) -> None:
    body = adjust(admin, stocked, "ADJUSTMENT_OUT", "adj-key-00008")
    edited = operations.update_operation(
        actor=admin,
        operation_id=body["id"],
        payload={
            "idempotency_key": "adj-key-00009",
            "expected_version": body["version"],
            "quantity": "4",
        },
    ).body
    assert (edited["quantity"], edited["version"]) == ("4", body["version"] + 1)
    with pytest.raises(InventoryApplicationError) as error:
        operations.update_operation(
            actor=admin,
            operation_id=body["id"],
            payload={
                "idempotency_key": "adj-key-00010",
                "expected_version": body["version"],
                "quantity": "5",
            },
        )
    assert error.value.code == "stale_record"


def test_posted_operations_cannot_be_edited(admin: Any, stocked: Any) -> None:
    body = adjust(admin, stocked, "ADJUSTMENT_OUT", "adj-key-00011")
    confirm(admin, body, "adj-key-00012")
    with pytest.raises(InventoryApplicationError) as error:
        operations.update_operation(
            actor=admin,
            operation_id=body["id"],
            payload={"idempotency_key": "adj-key-00013", "expected_version": 2, "quantity": "1"},
        )
    assert error.value.code == "not_editable"


def test_a_relevant_change_since_the_preview_requires_an_updated_review(
    admin: Any, stocked: Any
) -> None:
    first = adjust(admin, stocked, "ADJUSTMENT_OUT", "adj-key-00014", quantity="2")
    second = adjust(admin, stocked, "ADJUSTMENT_OUT", "adj-key-00015", quantity="2")
    review = operations.preview_operation(actor=admin, operation_id=first["id"])
    confirm(admin, second, "adj-key-00016")  # cambia el saldo entre revisión y confirmación
    with pytest.raises(InventoryApplicationError) as error:
        operations.confirm_operation(
            actor=admin,
            operation_id=first["id"],
            payload={
                "idempotency_key": "adj-key-00017",
                "expected_version": first["version"],
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "review_required"
    assert InventoryPosition.objects.get().quantity == D(8)


def test_confirmation_revalidates_stock(admin: Any, stocked: Any) -> None:
    big = adjust(admin, stocked, "ADJUSTMENT_OUT", "adj-key-00018", quantity="9")
    other = adjust(admin, stocked, "ADJUSTMENT_OUT", "adj-key-00019", quantity="5")
    review = operations.preview_operation(actor=admin, operation_id=big["id"])
    assert review["can_confirm"] is True
    confirm(admin, other, "adj-key-00020")
    review_now = operations.preview_operation(actor=admin, operation_id=big["id"])
    assert review_now["can_confirm"] is False
    assert review_now["issues"][0]["code"] == "insufficient_stock"
    with pytest.raises(InventoryApplicationError) as error:
        operations.confirm_operation(
            actor=admin,
            operation_id=big["id"],
            payload={
                "idempotency_key": "adj-key-00021",
                "expected_version": big["version"],
                "review_token": review["review_token"],
            },
        )
    assert error.value.code in {"insufficient_stock", "review_required"}
    assert InventoryPosition.objects.get().quantity == D(5)


def test_exit_of_an_inactive_product_with_stock_is_allowed_but_new_entries_are_not(
    admin: Any, stocked: Any
) -> None:
    Product.objects.filter(pk=stocked.pk).update(is_active=False)
    body = adjust(admin, stocked, "ADJUSTMENT_OUT", "adj-key-00022")
    confirm(admin, body, "adj-key-00023")
    with pytest.raises(InventoryApplicationError) as error:
        adjust(admin, stocked, "ADJUSTMENT_IN", "adj-key-00024", unit_cost="1.00")
    assert error.value.code == "inactive_reference"


def test_purchase_receipts_and_reversals_cannot_be_submitted_freely(
    admin: Any, stocked: Any
) -> None:
    for kind in ("PURCHASE_RECEIPT", "REVERSAL", "SALE"):
        with pytest.raises(InventoryApplicationError) as error:
            adjust(admin, stocked, kind, "adj-key-00025")
        assert "kind" in error.value.errors


def test_client_supplied_warehouse_or_entity_is_an_unknown_field(admin: Any, stocked: Any) -> None:
    for name in ("warehouse_id", "entity_id", "value"):
        with pytest.raises(InventoryApplicationError) as error:
            adjust(admin, stocked, "ADJUSTMENT_OUT", "adj-key-00026", **{name: 1})
        assert error.value.code == "unknown_field"


def test_only_administrators_can_adjust(seller: Any, stocked: Any) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        adjust(seller, stocked, "ADJUSTMENT_OUT", "adj-key-00027")
