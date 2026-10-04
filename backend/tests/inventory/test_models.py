"""Restricciones de persistencia de inventario: posiciones, operaciones y movimientos."""

from decimal import Decimal
from typing import Any

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from inventory.models import (
    InventoryMovement,
    InventoryOperation,
    InventoryOperationLine,
    InventoryPosition,
)

D = Decimal


def make_position(product: Any, warehouse: Any, **overrides: Any) -> InventoryPosition:
    values: dict[str, Any] = {
        "product": product,
        "warehouse": warehouse,
        "quantity": D(0),
        "value": D(0),
        "average": D(0),
    }
    values.update(overrides)
    return InventoryPosition.objects.create(**values)


def make_operation(actor: Any, **overrides: Any) -> InventoryOperation:
    values: dict[str, Any] = {
        "kind": "PURCHASE_RECEIPT",
        "state": "PREPARED",
        "source_type": "PURCHASE",
        "source_id": 1,
        "actor": actor,
        "fingerprint": "f" * 64,
    }
    values.update(overrides)
    return InventoryOperation.objects.create(**values)


def make_movement(
    operation: InventoryOperation, position: InventoryPosition, **overrides: Any
) -> InventoryMovement:
    values: dict[str, Any] = {
        "operation": operation,
        "position": position,
        "product": position.product,
        "warehouse": position.warehouse,
        "ordinal": 1,
        "movement_type": "PURCHASE_RECEIPT",
        "effective_at": timezone.now(),
        "quantity_in": D(5),
        "quantity_out": D(0),
        "value_delta": D("10.000000"),
        "applied_unit_cost": D("2.000000"),
        "quantity_before": D(0),
        "value_before": D(0),
        "average_before": D(0),
        "quantity_after": D(5),
        "value_after": D("10.000000"),
        "average_after": D("2.000000"),
        "product_snapshot": {"version": 1, "code": position.product.code},
        "actor": operation.actor,
    }
    values.update(overrides)
    return InventoryMovement.objects.create(**values)


@pytest.mark.django_db
class TestInventoryPosition:
    def test_product_and_warehouse_pair_is_unique(self, product: Any, warehouse: Any) -> None:
        make_position(product, warehouse)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_position(product, warehouse)

    @pytest.mark.parametrize(
        "overrides",
        [
            {"quantity": D(-1)},
            {"quantity": D(1), "value": D("-0.000001")},
            {"quantity": D(1), "average": D("-1")},
        ],
    )
    def test_quantity_and_value_cannot_be_negative(
        self, product: Any, warehouse: Any, overrides: dict[str, Any]
    ) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_position(product, warehouse, **overrides)

    def test_quantity_must_be_whole(self, product: Any, warehouse: Any) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_position(product, warehouse, quantity=D("1.5"), value=D(1), average=D(1))

    @pytest.mark.parametrize("overrides", [{"value": D("0.000001")}, {"average": D("1")}])
    def test_zero_quantity_implies_zero_value_and_average(
        self, product: Any, warehouse: Any, overrides: dict[str, Any]
    ) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_position(product, warehouse, quantity=D(0), **overrides)

    def test_valid_position_is_stored(self, product: Any, warehouse: Any) -> None:
        position = make_position(
            product, warehouse, quantity=D(15), value=D("40.000000"), average=D("2.666667")
        )
        position.refresh_from_db()
        assert (position.quantity, position.value, position.average) == (
            D(15),
            D("40.000000"),
            D("2.666667"),
        )
        assert position.version == 1
        assert position.last_ordinal == 0
        assert position.valued is True

    def test_position_without_cost_must_carry_no_value_and_have_stock(
        self, product: Any, warehouse: Any, make_product: Any
    ) -> None:
        position = make_position(product, warehouse, quantity=D(5), valued=False)
        position.refresh_from_db()
        assert position.valued is False
        with pytest.raises(IntegrityError), transaction.atomic():
            make_position(make_product(), warehouse, quantity=D(5), value=D("1"), valued=False)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_position(make_product(), warehouse, quantity=D(5), average=D("1"), valued=False)

    def test_an_empty_position_cannot_be_unvalued(self, product: Any, warehouse: Any) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_position(product, warehouse, quantity=D(0), valued=False)


@pytest.mark.django_db
class TestInventoryOperation:
    @pytest.mark.parametrize(
        "kind", ["PURCHASE_RECEIPT", "INITIAL_LOAD", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"]
    )
    def test_documented_kinds_are_accepted(self, actor: Any, kind: str) -> None:
        operation = make_operation(actor, kind=kind, source_type="MANUAL", source_id=None)
        assert operation.kind == kind

    def test_unknown_kind_or_state_is_rejected(self, actor: Any) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_operation(actor, kind="SALE")
        with pytest.raises(IntegrityError), transaction.atomic():
            make_operation(actor, state="CANCELLED", source_id=2)

    def test_source_is_unique(self, actor: Any) -> None:
        make_operation(actor)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_operation(actor)

    def test_operations_without_source_may_repeat(self, actor: Any) -> None:
        make_operation(actor, kind="ADJUSTMENT_IN", source_type="", source_id=None)
        make_operation(actor, kind="ADJUSTMENT_IN", source_type="", source_id=None)

    def test_reversal_relation_is_unique_and_only_for_reversal_kind(self, actor: Any) -> None:
        original = make_operation(actor, state="POSTED")
        make_operation(
            actor,
            kind="REVERSAL",
            state="POSTED",
            source_type="PURCHASE_VOID",
            reverses=original,
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            make_operation(
                actor,
                kind="REVERSAL",
                state="POSTED",
                source_type="PURCHASE_VOID",
                source_id=9,
                reverses=original,
            )
        with pytest.raises(IntegrityError), transaction.atomic():
            make_operation(actor, source_id=3, reverses=original)

    def test_reversal_kind_requires_a_reversed_operation(self, actor: Any) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_operation(actor, kind="REVERSAL", source_type="X", source_id=5)

    def test_lines_are_unique_per_position_and_product(self, actor: Any, product: Any) -> None:
        operation = make_operation(actor)
        InventoryOperationLine.objects.create(
            operation=operation, position=1, product=product, quantity=D(2), entry_value=D(4)
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            InventoryOperationLine.objects.create(
                operation=operation, position=1, product=product, quantity=D(1)
            )
        with pytest.raises(IntegrityError), transaction.atomic():
            InventoryOperationLine.objects.create(
                operation=operation, position=2, product=product, quantity=D(1)
            )

    def test_line_quantity_must_be_positive_and_whole(self, actor: Any, product: Any) -> None:
        operation = make_operation(actor)
        for quantity in (D(0), D("1.5")):
            with pytest.raises(IntegrityError), transaction.atomic():
                InventoryOperationLine.objects.create(
                    operation=operation, position=1, product=product, quantity=quantity
                )


@pytest.mark.django_db
class TestInventoryMovementCostState:
    def test_cost_state_defaults_describe_a_fully_costed_movement(
        self, actor: Any, product: Any, warehouse: Any
    ) -> None:
        movement = make_movement(make_operation(actor), make_position(product, warehouse))
        assert movement.cost_known is True
        assert movement.valued_before is True
        assert movement.valued_after is True
        assert movement.regularization_value == D(0)

    def test_regularization_value_cannot_be_negative(
        self, actor: Any, product: Any, warehouse: Any
    ) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_movement(
                make_operation(actor),
                make_position(product, warehouse),
                regularization_value=D("-0.000001"),
            )


@pytest.mark.django_db
class TestInventoryMovement:
    def test_position_ordinal_and_operation_product_are_unique(
        self, actor: Any, product: Any, warehouse: Any
    ) -> None:
        position = make_position(product, warehouse)
        operation = make_operation(actor)
        make_movement(operation, position)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_movement(make_operation(actor, source_id=2), position)  # mismo ordinal
        with pytest.raises(IntegrityError), transaction.atomic():
            make_movement(operation, position, ordinal=2)  # misma operación y producto

    def test_quantity_moves_in_exactly_one_direction(
        self, actor: Any, product: Any, warehouse: Any
    ) -> None:
        position = make_position(product, warehouse)
        for i, overrides in enumerate(
            [
                {"quantity_in": D(0), "quantity_out": D(0)},
                {"quantity_in": D(1), "quantity_out": D(1)},
                {"quantity_in": D(-1), "quantity_out": D(0)},
                {"quantity_in": D("1.5")},
            ],
            start=10,
        ):
            with pytest.raises(IntegrityError), transaction.atomic():
                make_movement(make_operation(actor, source_id=i), position, **overrides)

    def test_reversed_movement_link_is_unique(
        self, actor: Any, product: Any, warehouse: Any
    ) -> None:
        position = make_position(product, warehouse)
        original = make_movement(make_operation(actor, state="POSTED"), position)
        reversal_op = make_operation(
            actor,
            kind="REVERSAL",
            state="POSTED",
            source_type="PURCHASE_VOID",
            reverses=original.operation,
        )
        make_movement(
            reversal_op,
            position,
            ordinal=2,
            movement_type="REVERSAL",
            quantity_in=D(0),
            quantity_out=D(5),
            value_delta=D("-10.000000"),
            reverses_movement=original,
        )
        other_op = make_operation(actor, source_id=7)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_movement(
                other_op,
                position,
                ordinal=3,
                movement_type="REVERSAL",
                quantity_in=D(0),
                quantity_out=D(1),
                value_delta=D("-1.000000"),
                reverses_movement=original,
            )

    def test_historical_snapshot_survives_catalog_changes(
        self, actor: Any, product: Any, warehouse: Any
    ) -> None:
        position = make_position(product, warehouse)
        movement = make_movement(make_operation(actor), position)
        original_code = product.code
        product.name = "Renombrado"
        product.save()
        movement.refresh_from_db()
        assert movement.product_snapshot["code"] == original_code

    def test_only_one_initial_load_per_product_and_warehouse_even_after_reversal(
        self, actor: Any, product: Any, warehouse: Any
    ) -> None:
        position = make_position(product, warehouse)
        first = make_movement(
            make_operation(actor, kind="INITIAL_LOAD", source_type="", source_id=None),
            position,
            movement_type="INITIAL_LOAD",
        )
        # La compensación (tipo REVERSAL) no libera el cupo de carga inicial.
        reversal_op = make_operation(
            actor,
            kind="REVERSAL",
            source_type="MANUAL_VOID",
            source_id=None,
            reverses=first.operation,
        )
        make_movement(
            reversal_op,
            position,
            ordinal=2,
            movement_type="REVERSAL",
            quantity_in=D(0),
            quantity_out=D(5),
            value_delta=D("-10.000000"),
            reverses_movement=first,
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            make_movement(
                make_operation(actor, kind="INITIAL_LOAD", source_type="", source_id=None),
                position,
                ordinal=3,
                movement_type="INITIAL_LOAD",
            )
