"""Carga inicial: primera entrada de un producto sin historia, con origen propio."""

from decimal import Decimal
from typing import Any

import pytest

from catalog.application.inventory_references import lock_product_references
from inventory.application import operations, posting
from inventory.application.errors import InventoryApplicationError
from inventory.application.reservations import reserve
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition

pytestmark = pytest.mark.django_db
D = Decimal


def prepare(admin: Any, product: Any, key: str, **overrides: Any) -> dict[str, Any]:
    payload = {
        "idempotency_key": key,
        "kind": "INITIAL_LOAD",
        "product_id": product.pk,
        "quantity": "8",
        "unit_cost": "2.50",
        "reason": "Existencia inicial contada",
        **overrides,
    }
    return operations.create_operation(actor=admin, payload=payload).body


def confirm(admin: Any, body: dict[str, Any], key: str) -> Any:
    review = operations.preview_operation(actor=admin, operation_id=body["id"])
    assert review["can_confirm"], review["issues"]
    return operations.confirm_operation(
        actor=admin,
        operation_id=body["id"],
        payload={
            "idempotency_key": key,
            "expected_version": body["version"],
            "review_token": review["review_token"],
        },
    )


def test_first_load_creates_stock_value_and_own_origin_without_a_supplier(
    admin: Any, product: Any, warehouse: Any
) -> None:
    body = prepare(admin, product, "prep-key-0001")
    assert body["state"] == "PREPARED"
    assert not InventoryPosition.objects.exists()  # preparar no cambia stock
    confirmed = confirm(admin, body, "conf-key-0001").body
    assert confirmed["state"] == "POSTED"
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value, position.average) == (
        D(8),
        D("20.000000"),
        D("2.500000"),
    )
    operation = InventoryOperation.objects.get()
    assert operation.kind == "INITIAL_LOAD"
    assert (operation.source_type, operation.source_id) == ("", None)
    movement = InventoryMovement.objects.get()
    assert movement.movement_type == "INITIAL_LOAD"


def test_load_is_rejected_for_products_with_history_even_if_depleted(
    admin: Any, product: Any, warehouse: Any
) -> None:
    confirm(admin, prepare(admin, product, "prep-key-0002"), "conf-key-0002")
    exit_body = operations.create_operation(
        actor=admin,
        payload={
            "idempotency_key": "prep-key-0003",
            "kind": "ADJUSTMENT_OUT",
            "product_id": product.pk,
            "quantity": "8",
            "reason": "Pérdida comprobada",
        },
    ).body
    confirm(admin, exit_body, "conf-key-0003")
    assert InventoryPosition.objects.get().quantity == 0
    with pytest.raises(InventoryApplicationError) as error:
        prepare(admin, product, "prep-key-0004")
    assert error.value.code == "already_initialized"
    assert "ajuste" in error.value.message.lower()


def test_load_already_compensated_cannot_be_repeated(
    admin: Any, product: Any, warehouse: Any
) -> None:
    body = confirm(admin, prepare(admin, product, "prep-key-0005"), "conf-key-0005").body
    review = operations.reverse_preview(actor=admin, operation_id=body["id"])
    operations.reverse_manual_operation(
        actor=admin,
        operation_id=body["id"],
        payload={
            "idempotency_key": "rev-key-00001",
            "expected_version": body["version"],
            "review_token": review["review_token"],
            "reason": "Carga equivocada",
        },
    )
    with pytest.raises(InventoryApplicationError) as error:
        prepare(admin, product, "prep-key-0006")
    assert error.value.code == "already_initialized"


def test_initial_load_reversal_is_blocked_while_stock_is_reserved(
    admin: Any, product: Any, warehouse: Any
) -> None:
    body = confirm(admin, prepare(admin, product, "prep-key-0010"), "conf-key-0010").body
    refs = lock_product_references([product.pk])
    reserve(
        posting.lock_positions(refs, warehouse_id=warehouse.pk),
        product_id=product.pk,
        source_type="SALE_LINE",
        source_id=301,
        source_reference={"sale_id": 31, "order_id": 9},
        quantity=D(3),
    )

    review = operations.reverse_preview(actor=admin, operation_id=body["id"])

    assert review["can_reverse"] is False
    assert review["review_token"] is None
    assert review["issues"][0]["code"] == "insufficient_stock"
    position = InventoryPosition.objects.get(product=product)
    assert (position.quantity, position.reserved) == (D(8), D(3))
    assert InventoryOperation.objects.filter(kind="REVERSAL").count() == 0


def test_confirmation_rechecks_history_under_the_position_lock(
    admin: Any, product: Any, warehouse: Any
) -> None:
    first = prepare(admin, product, "prep-key-0007")
    second = prepare(admin, product, "prep-key-0008")
    confirm(admin, first, "conf-key-0007")
    review = operations.preview_operation(actor=admin, operation_id=second["id"])
    assert review["can_confirm"] is False
    assert review["issues"][0]["code"] == "already_initialized"
    with pytest.raises(InventoryApplicationError) as error:
        operations.confirm_operation(
            actor=admin,
            operation_id=second["id"],
            payload={
                "idempotency_key": "conf-key-0008",
                "expected_version": second["version"],
                "review_token": "x",
            },
        )
    assert error.value.code in {"already_initialized", "validation_error"}
    assert InventoryMovement.objects.count() == 1


def test_load_requires_an_explicit_cost_and_a_whole_positive_quantity(
    admin: Any, product: Any, warehouse: Any
) -> None:
    for overrides, field in (
        ({"unit_cost": None}, "unit_cost"),
        ({"quantity": "0"}, "quantity"),
        ({"quantity": "1.5"}, "quantity"),
        ({"unit_cost": "-1"}, "unit_cost"),
    ):
        with pytest.raises(InventoryApplicationError) as error:
            prepare(admin, product, "prep-key-0009", **overrides)
        assert field in error.value.errors
