"""Reversión exacta del último efecto y ajustes vinculados por diferencia física."""

from decimal import Decimal
from typing import Any

import pytest

from catalog.application.inventory_references import lock_product_references
from inventory.application import operations, posting
from inventory.application.errors import InventoryApplicationError
from inventory.application.reservations import reserve
from inventory.models import InventoryOperation, InventoryPosition

from .test_initial_load import confirm, prepare

pytestmark = pytest.mark.django_db
D = Decimal


def op(admin: Any, product: Any, kind: str, key: str, **extra: Any) -> dict[str, Any]:
    payload = {
        "idempotency_key": key,
        "kind": kind,
        "product_id": product.pk,
        "quantity": "3",
        "reason": "Corrección",
        **extra,
    }
    return operations.create_operation(actor=admin, payload=payload).body


def reverse(admin: Any, body: dict[str, Any], key: str, reason: str = "Error de captura") -> Any:
    review = operations.reverse_preview(actor=admin, operation_id=body["id"])
    return operations.reverse_manual_operation(
        actor=admin,
        operation_id=body["id"],
        payload={
            "idempotency_key": key,
            "expected_version": body["version"],
            "review_token": review["review_token"],
            "reason": reason,
        },
    )


@pytest.fixture
def stocked(admin: Any, product: Any, warehouse: Any) -> dict[str, Any]:
    outcome = confirm(
        admin,
        prepare(admin, product, "cor-key-0001", quantity="3", unit_cost="1.00"),
        "cor-key-0002",
    )
    return dict(outcome.body)


def test_last_effect_is_reversed_exactly(admin: Any, product: Any, stocked: dict[str, Any]) -> None:
    entry = confirm(
        admin, op(admin, product, "ADJUSTMENT_IN", "cor-key-0003", unit_cost="1.00"), "cor-key-0004"
    ).body
    outcome = reverse(admin, entry, "cor-key-0005")
    assert outcome.body["state"] == "REVERSED"
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value, position.average) == (
        D(3),
        D("3.000000"),
        D("1.000000"),
    )
    assert InventoryOperation.objects.filter(kind="REVERSAL").count() == 1


def test_reversal_of_an_exit_that_depleted_stock_restores_its_residue(
    admin: Any, product: Any, stocked: dict[str, Any]
) -> None:
    depleting = confirm(
        admin, op(admin, product, "ADJUSTMENT_OUT", "cor-key-0006"), "cor-key-0007"
    ).body
    assert InventoryPosition.objects.get().quantity == 0
    reverse(admin, depleting, "cor-key-0008")
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value, position.average) == (
        D(3),
        D("3.000000"),
        D("1.000000"),
    )


def test_later_movements_block_the_reversal(
    admin: Any, product: Any, stocked: dict[str, Any]
) -> None:
    confirm(
        admin, op(admin, product, "ADJUSTMENT_IN", "cor-key-0009", unit_cost="1.00"), "cor-key-0010"
    )
    review = operations.reverse_preview(actor=admin, operation_id=stocked["id"])
    assert review["can_reverse"] is False
    assert review["issues"][0]["code"] == "unsafe_reversal"
    assert review["issues"][0]["blocking_reference"].startswith("INV-")
    with pytest.raises(InventoryApplicationError) as error:
        operations.reverse_manual_operation(
            actor=admin,
            operation_id=stocked["id"],
            payload={
                "idempotency_key": "cor-key-0011",
                "expected_version": stocked["version"],
                "review_token": "x",
                "reason": "x",
            },
        )
    assert error.value.code in {"unsafe_reversal", "validation_error"}


def test_a_physical_difference_can_be_linked_to_the_operation_it_corrects(
    admin: Any, product: Any, stocked: dict[str, Any]
) -> None:
    confirm(
        admin, op(admin, product, "ADJUSTMENT_IN", "cor-key-0012", unit_cost="1.00"), "cor-key-0013"
    )
    linked = op(
        admin,
        product,
        "ADJUSTMENT_OUT",
        "cor-key-0014",
        quantity="2",
        corrects_operation_id=stocked["id"],
    )
    assert linked["corrects_operation_id"] == stocked["id"]
    confirm(admin, linked, "cor-key-0015")
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.average) == (D(4), D("1.000000"))


def test_linked_negative_correction_cannot_consume_reserved_stock(
    admin: Any, product: Any, warehouse: Any, stocked: dict[str, Any]
) -> None:
    refs = lock_product_references([product.pk])
    reserve(
        posting.lock_positions(refs, warehouse_id=warehouse.pk),
        product_id=product.pk,
        source_type="SALE_LINE",
        source_id=201,
        source_reference={"sale_id": 21, "order_id": 8},
        quantity=D(2),
    )
    correction = op(
        admin,
        product,
        "ADJUSTMENT_OUT",
        "cor-key-0024",
        quantity="2",
        corrects_operation_id=stocked["id"],
    )

    review = operations.preview_operation(actor=admin, operation_id=correction["id"])

    assert review["can_confirm"] is False
    assert review["issues"][0]["code"] == "insufficient_stock"
    position = InventoryPosition.objects.get(product=product)
    assert (position.quantity, position.reserved) == (D(3), D(2))
    assert not InventoryOperation.objects.filter(kind="ADJUSTMENT_OUT", state="POSTED").exists()


def test_linked_entry_uses_the_current_average_and_rejects_a_cost_only_correction(
    admin: Any, product: Any, stocked: dict[str, Any]
) -> None:
    with pytest.raises(InventoryApplicationError) as error:
        op(
            admin,
            product,
            "ADJUSTMENT_IN",
            "cor-key-0016",
            quantity="1",
            unit_cost="9.00",
            corrects_operation_id=stocked["id"],
        )
    assert "unit_cost" in error.value.errors
    linked = op(
        admin,
        product,
        "ADJUSTMENT_IN",
        "cor-key-0017",
        quantity="1",
        corrects_operation_id=stocked["id"],
    )
    confirm(admin, linked, "cor-key-0018")
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.average) == (D(4), D("1.000000"))


def test_linked_entry_on_depleted_stock_requires_a_documented_cost(
    admin: Any, product: Any, stocked: dict[str, Any]
) -> None:
    confirm(admin, op(admin, product, "ADJUSTMENT_OUT", "cor-key-0019"), "cor-key-0020")
    with pytest.raises(InventoryApplicationError) as error:
        op(
            admin,
            product,
            "ADJUSTMENT_IN",
            "cor-key-0021",
            quantity="1",
            corrects_operation_id=stocked["id"],
        )
    assert "unit_cost" in error.value.errors
    ok = op(
        admin,
        product,
        "ADJUSTMENT_IN",
        "cor-key-0022",
        quantity="1",
        unit_cost="5.00",
        corrects_operation_id=stocked["id"],
    )
    assert ok["state"] == "PREPARED"


def test_unknown_or_unposted_correction_targets_are_rejected(
    admin: Any, product: Any, stocked: Any
) -> None:
    with pytest.raises(InventoryApplicationError) as error:
        op(admin, product, "ADJUSTMENT_OUT", "cor-key-0023", corrects_operation_id=999_999)
    assert "corrects_operation_id" in error.value.errors


def test_purchase_originated_operations_reject_manual_reversal(
    admin: Any, product: Any, warehouse: Any
) -> None:
    from catalog.application.inventory_references import lock_product_references
    from inventory.application import posting

    refs = lock_product_references([product.pk])
    origin = posting.prepare_operation(
        kind="PURCHASE_RECEIPT",
        actor=admin,
        source_type="PURCHASE",
        source_id=77,
        entry_lines=[posting.EntryLine(product.pk, D(1), D("1.00"), (1,))],
    )
    posting.post_operation(origin, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs)
    with pytest.raises(InventoryApplicationError) as error:
        operations.reverse_preview(actor=admin, operation_id=origin.pk)
    assert "anulación" in error.value.message.lower()
