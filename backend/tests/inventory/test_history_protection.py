"""La historia contabilizada no se altera ni por ORM ni por SQL directo."""

from decimal import Decimal
from typing import Any

import pytest
from django.db import DatabaseError, connection, transaction

from inventory.models import (
    ImmutableHistoryError,
    InventoryMovement,
    InventoryOperation,
    InventoryOperationLine,
)

from .test_models import make_movement, make_operation, make_position

D = Decimal


@pytest.fixture
def posted(actor: Any, product: Any, warehouse: Any) -> dict[str, Any]:
    position = make_position(
        product, warehouse, quantity=D(5), value=D("10.000000"), average=D("2.000000")
    )
    operation = make_operation(actor)
    line = InventoryOperationLine.objects.create(
        operation=operation, position=1, product=product, quantity=D(5), entry_value=D(10)
    )
    movement = make_movement(operation, position)
    InventoryOperation.objects.filter(pk=operation.pk).update(state="POSTED")
    operation.refresh_from_db()
    return {"operation": operation, "line": line, "movement": movement, "position": position}


def raw(sql: str, params: list[Any]) -> None:
    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(sql, params)


@pytest.mark.django_db
class TestMovementsAreImmutable:
    def test_orm_save_delete_and_queryset_mutators_are_blocked(
        self, posted: dict[str, Any]
    ) -> None:
        movement = posted["movement"]
        movement.quantity_in = D(6)
        with pytest.raises(ImmutableHistoryError):
            movement.save()
        with pytest.raises(ImmutableHistoryError):
            movement.delete()
        with pytest.raises(ImmutableHistoryError):
            InventoryMovement.objects.filter(pk=movement.pk).update(quantity_in=D(6))
        with pytest.raises(ImmutableHistoryError):
            InventoryMovement.objects.all().delete()

    def test_direct_sql_update_and_delete_are_rejected(self, posted: dict[str, Any]) -> None:
        pk = posted["movement"].pk
        with pytest.raises(DatabaseError, match="inmutable"):
            raw("UPDATE inventory_inventorymovement SET quantity_in = 6 WHERE id = %s", [pk])
        with pytest.raises(DatabaseError, match="inmutable"):
            raw("DELETE FROM inventory_inventorymovement WHERE id = %s", [pk])
        assert InventoryMovement.objects.filter(pk=pk, quantity_in=5).exists()


@pytest.mark.django_db
class TestPostedLinesAreImmutable:
    def test_direct_sql_cannot_change_or_delete_lines_of_posted_operations(
        self, posted: dict[str, Any]
    ) -> None:
        pk = posted["line"].pk
        with pytest.raises(DatabaseError, match="contabilizada"):
            raw("UPDATE inventory_inventoryoperationline SET quantity = 9 WHERE id = %s", [pk])
        with pytest.raises(DatabaseError, match="contabilizada"):
            raw("DELETE FROM inventory_inventoryoperationline WHERE id = %s", [pk])

    def test_lines_cannot_be_added_after_posting(
        self, posted: dict[str, Any], make_product: Any
    ) -> None:
        other = make_product()
        with pytest.raises(DatabaseError, match="contabilizada"):
            InventoryOperationLine.objects.create(
                operation=posted["operation"], position=2, product=other, quantity=D(1)
            )

    def test_lines_of_prepared_operations_remain_editable(self, actor: Any, product: Any) -> None:
        operation = make_operation(actor, source_id=50)
        line = InventoryOperationLine.objects.create(
            operation=operation, position=1, product=product, quantity=D(1)
        )
        InventoryOperationLine.objects.filter(pk=line.pk).update(quantity=D(2))
        line.refresh_from_db()
        assert line.quantity == D(2)
        line.delete()


@pytest.mark.django_db
class TestOperationTransitions:
    def test_posted_operation_can_only_transition_to_reversed(
        self, posted: dict[str, Any], actor: Any
    ) -> None:
        operation = posted["operation"]
        with pytest.raises(DatabaseError, match="contabilizada"), transaction.atomic():
            InventoryOperation.objects.filter(pk=operation.pk).update(source_id=99)
        with pytest.raises(DatabaseError, match="contabilizada"), transaction.atomic():
            InventoryOperation.objects.filter(pk=operation.pk).update(state="PREPARED")
        with pytest.raises(DatabaseError, match="contabilizada"), transaction.atomic():
            raw("DELETE FROM inventory_inventoryoperation WHERE id = %s", [operation.pk])

    def test_legitimate_transition_to_reversed_with_compensating_relation(
        self, posted: dict[str, Any], actor: Any
    ) -> None:
        operation = posted["operation"]
        make_operation(
            actor,
            kind="REVERSAL",
            state="POSTED",
            source_type="PURCHASE_VOID",
            reverses=operation,
        )
        InventoryOperation.objects.filter(pk=operation.pk).update(state="REVERSED", version=2)
        operation.refresh_from_db()
        assert operation.state == "REVERSED"
        assert operation.reversal.kind == "REVERSAL"

    def test_reversed_operation_is_final(self, posted: dict[str, Any], actor: Any) -> None:
        operation = posted["operation"]
        make_operation(
            actor, kind="REVERSAL", state="POSTED", source_type="PURCHASE_VOID", reverses=operation
        )
        InventoryOperation.objects.filter(pk=operation.pk).update(state="REVERSED")
        with pytest.raises(DatabaseError, match="contabilizada"), transaction.atomic():
            InventoryOperation.objects.filter(pk=operation.pk).update(reason="x")

    def test_prepared_operations_can_be_posted_and_discarded(self, actor: Any) -> None:
        operation = make_operation(actor, source_id=70)
        InventoryOperation.objects.filter(pk=operation.pk).update(state="POSTED")
        discarded = make_operation(actor, source_id=71)
        discarded.delete()


@pytest.mark.django_db
def test_reference_and_correction_link_are_frozen_once_posted(posted: dict[str, Any]) -> None:
    operation = posted["operation"]
    for changes in ({"external_reference": "otra"}, {"corrects_operation": operation}):
        with pytest.raises(DatabaseError, match="contabilizada"), transaction.atomic():
            InventoryOperation.objects.filter(pk=operation.pk).update(**changes)
