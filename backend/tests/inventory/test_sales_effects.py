"""Efectos comerciales de inventario: salida por venta y reingreso por devolución de cliente."""

from decimal import Decimal
from typing import Any

import pytest

from catalog.application.inventory_references import lock_product_references
from identity.application.authorization import BusinessPermissionDeniedError
from inventory.application import operations, posting, queries
from inventory.application.errors import InventoryApplicationError
from inventory.application.posting import EntryLine, ExitLine
from inventory.domain.validation import InventoryValidationError
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition, OperationKind

D = Decimal
pytestmark = pytest.mark.django_db


def stock(
    actor: Any, product: Any, warehouse: Any, quantity: int, value: str, source: int = 1
) -> None:
    refs = lock_product_references([product.pk])
    operation = posting.prepare_operation(
        kind="PURCHASE_RECEIPT",
        actor=actor,
        source_type="PURCHASE",
        source_id=source,
        entry_lines=[EntryLine(product.pk, D(quantity), D(value))],
    )
    posting.post_operation(operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs)


def sell(actor: Any, product: Any, warehouse: Any, quantity: int, sale_id: int = 1) -> Any:
    refs = lock_product_references([product.pk])
    operation = posting.prepare_operation(
        kind="SALE_OUT",
        actor=actor,
        source_type="SALE",
        source_id=sale_id,
        exit_lines=[ExitLine(product.pk, D(quantity))],
    )
    locked = posting.lock_positions(refs, warehouse_id=warehouse.pk)
    return posting.post_operation(operation, locked, refs)


def customer_return(
    actor: Any,
    product: Any,
    warehouse: Any,
    quantity: int,
    value: str,
    corrects: int,
    return_id: int,
) -> Any:
    refs = lock_product_references([product.pk])
    operation = posting.prepare_operation(
        kind="CUSTOMER_RETURN_IN",
        actor=actor,
        source_type="SALE_RETURN",
        source_id=return_id,
        entry_lines=[EntryLine(product.pk, D(quantity), D(value))],
        corrects_operation_id=corrects,
    )
    locked = posting.lock_positions(refs, warehouse_id=warehouse.pk)
    return posting.post_operation(operation, locked, refs)


def test_kinds_exist_and_return_is_an_entry_kind() -> None:
    assert OperationKind.SALE_OUT == "SALE_OUT"
    assert OperationKind.CUSTOMER_RETURN_IN == "CUSTOMER_RETURN_IN"
    assert OperationKind.CUSTOMER_RETURN_IN in posting.ENTRY_KINDS
    assert OperationKind.SALE_OUT not in posting.ENTRY_KINDS


def test_sale_out_is_an_exit_valued_at_the_current_average(
    actor: Any, product: Any, warehouse: Any
) -> None:
    stock(actor, product, warehouse, 10, "40.00")
    result = sell(actor, product, warehouse, 3)
    (movement,) = result.movements
    assert (movement.movement_type, movement.quantity_out, movement.value_delta) == (
        "SALE_OUT",
        D(3),
        D("-12.000000"),
    )
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value) == (D(7), D("28.000000"))


def test_sale_out_rejects_insufficient_stock_without_effects(
    actor: Any, product: Any, warehouse: Any
) -> None:
    stock(actor, product, warehouse, 2, "8.00")
    with pytest.raises(InventoryValidationError):
        sell(actor, product, warehouse, 3)
    assert InventoryMovement.objects.count() == 1


def test_return_is_a_new_entry_that_corrects_the_original_exit_without_reversal_links(
    actor: Any, product: Any, warehouse: Any
) -> None:
    stock(actor, product, warehouse, 10, "40.00")
    sold = sell(actor, product, warehouse, 2)
    result = customer_return(actor, product, warehouse, 1, "4.000000", sold.operation.pk, 77)
    operation = result.operation
    assert operation.kind == "CUSTOMER_RETURN_IN"
    assert (operation.source_type, operation.source_id) == ("SALE_RETURN", 77)
    assert operation.corrects_operation_id == sold.operation.pk
    assert operation.reverses_id is None
    (movement,) = result.movements
    assert movement.reverses_movement_id is None
    assert movement.movement_type == "CUSTOMER_RETURN_IN"


def test_fit_reentry_integrates_as_a_new_entry_without_rewriting_history(
    actor: Any, product: Any, warehouse: Any
) -> None:
    stock(actor, product, warehouse, 10, "40.00")
    sold = sell(actor, product, warehouse, 2)
    before = list(InventoryMovement.objects.values())
    customer_return(actor, product, warehouse, 1, "4.000000", sold.operation.pk, 5)
    after = list(InventoryMovement.objects.order_by("id").values())
    assert after[: len(before)] == before
    assert len(after) == len(before) + 1


def test_reentry_with_zero_quantity_creates_no_empty_operation(
    actor: Any, product: Any, warehouse: Any
) -> None:
    stock(actor, product, warehouse, 10, "40.00")
    sold = sell(actor, product, warehouse, 2)
    operations_before = InventoryOperation.objects.count()
    with pytest.raises(InventoryValidationError):
        posting.prepare_operation(
            kind="CUSTOMER_RETURN_IN",
            actor=actor,
            source_type="SALE_RETURN",
            source_id=9,
            entry_lines=[],
            corrects_operation_id=sold.operation.pk,
        )
    assert InventoryOperation.objects.count() == operations_before


def test_historical_cost_return_after_later_purchase_yields_the_published_average(
    actor: Any, product: Any, warehouse: Any
) -> None:
    stock(actor, product, warehouse, 2, "8.00", source=1)
    sold = sell(actor, product, warehouse, 1)  # costo histórico 4.00; queda 1 unidad, 4.00
    stock(actor, product, warehouse, 1, "8.00", source=2)  # existencia 2, valor 12.00
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value) == (D(2), D("12.000000"))
    customer_return(actor, product, warehouse, 1, "4.000000", sold.operation.pk, 3)
    position.refresh_from_db()
    assert (position.quantity, position.value, position.average) == (
        D(3),
        D("16.000000"),
        D("5.333333"),
    )


def test_generic_administrative_access_rejects_commercial_kinds(admin: Any, product: Any) -> None:
    assert set(operations.MANUAL_KINDS) == {"INITIAL_LOAD", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"}
    for kind in ("SALE_OUT", "CUSTOMER_RETURN_IN"):
        with pytest.raises(InventoryApplicationError):
            operations.create_operation(
                actor=admin,
                payload={
                    "idempotency_key": "gen-key-00001",
                    "kind": kind,
                    "product_id": product.pk,
                    "quantity": "1",
                    "reason": "no permitido",
                },
            )


def test_commercial_operations_cannot_be_reversed_through_the_administrative_access(
    admin: Any, actor: Any, product: Any, warehouse: Any
) -> None:
    stock(actor, product, warehouse, 10, "40.00")
    sold = sell(actor, product, warehouse, 2)
    with pytest.raises((InventoryApplicationError, BusinessPermissionDeniedError)):
        operations.reverse_preview(actor=admin, operation_id=sold.operation.pk)
    with pytest.raises((InventoryApplicationError, BusinessPermissionDeniedError)):
        operations.reverse_manual_operation(
            actor=admin,
            operation_id=sold.operation.pk,
            payload={
                "idempotency_key": "rev-key-00001",
                "expected_version": sold.operation.version,
                "reason": "no permitido",
            },
        )


def test_operation_effects_expose_the_value_actually_applied_as_immutable_dto(
    actor: Any, product: Any, warehouse: Any
) -> None:
    stock(actor, product, warehouse, 3, "10.000001")
    sold = sell(actor, product, warehouse, 3)  # agota existencias: el valor incluye el residuo
    (effect,) = queries.operation_effects(sold.operation.pk)
    assert effect.movement_id == sold.movements[0].pk
    assert effect.applied_value == D("10.000001")
    assert effect.applied_unit_cost == sold.movements[0].applied_unit_cost
    assert not hasattr(effect, "position")
    with pytest.raises(AttributeError):
        effect.applied_value = D(0)  # type: ignore[misc]


def test_get_operation_does_not_treat_commercial_origins_as_free_adjustments(
    actor: Any, product: Any, warehouse: Any
) -> None:
    stock(actor, product, warehouse, 10, "40.00")
    sold = sell(actor, product, warehouse, 2)
    projection = queries.get_operation(
        sold.operation.pk, include_valuation=False, can_open_origin=True
    )
    assert "reason" not in projection
    assert "origin_url" not in projection
    assert projection["origin"]["type"] == "SALE"
    assert "movements" not in projection
    assert "unit_cost" not in projection
