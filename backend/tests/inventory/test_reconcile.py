"""Conciliación de solo lectura: reconstrucción, cadena, posiciones y operaciones."""

from decimal import Decimal
from io import StringIO
from typing import Any

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection

from catalog.application.inventory_references import lock_product_references
from inventory.application import posting
from inventory.application.reconciliation import reconcile
from inventory.application.reservations import reserve
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition

pytestmark = pytest.mark.django_db
D = Decimal


def post(
    actor: Any,
    product: Any,
    warehouse: Any,
    kind: str,
    qty: int,
    cost: str = "2.00",
    source: tuple[str, int | None] = ("", None),
) -> Any:
    refs = lock_product_references([product.pk], require_active=False)
    args: dict[str, Any] = (
        {"entry_lines": [posting.EntryLine(product.pk, D(qty), D(cost) * qty, (1,))]}
        if kind.endswith("_IN") or kind == "PURCHASE_RECEIPT"
        else {"exit_lines": [posting.ExitLine(product.pk, D(qty))]}
    )
    operation = posting.prepare_operation(
        kind=kind, actor=actor, source_type=source[0], source_id=source[1], **args
    )
    posting.post_operation(operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs)
    return operation


def run() -> tuple[str, str, bool]:
    out, err = StringIO(), StringIO()
    try:
        call_command("reconcile_inventory", stdout=out, stderr=err)
        return out.getvalue(), err.getvalue(), True
    except CommandError:
        return out.getvalue(), err.getvalue(), False


@pytest.fixture
def history(actor: Any, product: Any, warehouse: Any) -> dict[str, Any]:
    entry = post(actor, product, warehouse, "PURCHASE_RECEIPT", 10, source=("PURCHASE", 1))
    post(actor, product, warehouse, "ADJUSTMENT_OUT", 3)
    third = post(actor, product, warehouse, "ADJUSTMENT_IN", 2, "3.00")
    refs = lock_product_references([product.pk], require_active=False)
    posting.reverse_operation(
        third,
        actor=actor,
        source_type="MANUAL_VOID",
        source_id=None,
        reason="Error",
        locked=posting.lock_positions(refs, warehouse_id=warehouse.pk),
        product_refs=refs,
    )
    return {"entry": entry, "third": third}


def disable_immutability() -> None:
    """Simula corrupción externa (solo pruebas): suspende los triggers en esta transacción."""
    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL session_replication_role = replica")


def test_consistent_history_reconciles_to_zero_differences(history: dict[str, Any]) -> None:
    assert reconcile() == []
    out, err, ok = run()
    assert ok
    assert "sin diferencias" in out
    assert err == ""


def test_empty_positions_reconcile_to_zero_without_creating_stock(
    product: Any, warehouse: Any, make_product: Any
) -> None:
    InventoryPosition.objects.create(product=product, warehouse=warehouse)
    before = (InventoryPosition.objects.count(), InventoryMovement.objects.count())
    assert reconcile() == []
    assert (InventoryPosition.objects.count(), InventoryMovement.objects.count()) == before
    assert not InventoryPosition.objects.filter(quantity__gt=0).exists()


def test_a_position_that_differs_from_the_rebuilt_state_is_reported(
    history: dict[str, Any],
) -> None:
    InventoryPosition.objects.update(quantity=D(99), value=D("198.000000"))
    differences = reconcile()
    assert [d.scope for d in differences] == ["posición"]
    assert "difiere de la reconstruida" in differences[0].message
    _, err, ok = run()
    assert not ok
    assert "posición" in err


def test_stock_without_history_is_a_difference(product: Any, warehouse: Any) -> None:
    InventoryPosition.objects.create(
        product=product, warehouse=warehouse, quantity=D(5), value=D(5), average=D(1)
    )
    assert [d.scope for d in reconcile()] == ["posición"]


def test_reserved_aggregate_must_match_active_reservations(
    history: dict[str, Any], product: Any, warehouse: Any
) -> None:
    refs = lock_product_references([product.pk], require_active=False)
    reserve(
        posting.lock_positions(refs, warehouse_id=warehouse.pk),
        product_id=product.pk,
        source_type="SALE_LINE",
        source_id=601,
        source_reference={"sale_id": 61, "order_id": 12},
        quantity=D(2),
    )
    assert reconcile() == []

    InventoryPosition.objects.filter(product=product).update(reserved=D(1))

    differences = reconcile()
    assert [difference.scope for difference in differences] == ["reserva"]
    assert "reservada" in differences[0].message


def test_a_broken_previous_next_chain_and_bad_average_are_detected(
    history: dict[str, Any],
) -> None:
    disable_immutability()
    movement = InventoryMovement.objects.filter(ordinal=2).get()
    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE inventory_inventorymovement SET quantity_before = quantity_before + 1"
            " WHERE id = %s",
            [movement.pk],
        )
    messages = " ".join(d.message for d in reconcile())
    assert "cadena anterior/posterior" in messages
    disable_immutability()
    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE inventory_inventorymovement SET quantity_before = quantity_before - 1,"
            " average_after = average_after + 1 WHERE id = %s",
            [movement.pk],
        )
    assert "promedio" in " ".join(d.message for d in reconcile())


def test_non_consecutive_ordinals_are_detected(history: dict[str, Any]) -> None:
    disable_immutability()
    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE inventory_inventorymovement SET ordinal = ordinal + 10 WHERE ordinal = 3"
        )
    assert "ordinal" in " ".join(d.message for d in reconcile())


def test_reversed_operation_without_its_compensation_is_reported(history: dict[str, Any]) -> None:
    third = history["third"]
    disable_immutability()
    with connection.cursor() as cursor:
        cursor.execute(
            "DELETE FROM inventory_inventorymovement WHERE operation_id = %s",
            [InventoryOperation.objects.get(reverses=third).pk],
        )
    messages = " ".join(d.message for d in reconcile())
    assert "compensación" in messages or "movimientos frente a" in messages


def test_purchase_receipt_without_effects_is_reported(history: dict[str, Any], actor: Any) -> None:
    hollow = InventoryOperation.objects.create(
        kind="PURCHASE_RECEIPT",
        state="POSTED",
        source_type="PURCHASE",
        source_id=77,
        actor=actor,
        fingerprint="f" * 64,
    )
    messages = [d.message for d in reconcile() if d.operation_id == hollow.pk]
    assert any("sin efectos" in m or "no tiene efectos" in m for m in messages)


def test_command_is_read_only_and_offers_no_fix(history: dict[str, Any]) -> None:
    snapshot = list(
        InventoryPosition.objects.values_list("id", "quantity", "value", "version", "updated_at")
    )
    movements = InventoryMovement.objects.count()
    run()
    assert (
        list(
            InventoryPosition.objects.values_list(
                "id", "quantity", "value", "version", "updated_at"
            )
        )
        == snapshot
    )
    assert InventoryMovement.objects.count() == movements
    with pytest.raises((CommandError, SystemExit)):
        call_command("reconcile_inventory", "--fix")


# --- Existencias sin costo registrado ---------------------------------------------------


def post_without_cost(
    actor: Any, product: Any, warehouse: Any, qty: int, source_id: int | None = None
) -> Any:
    refs = lock_product_references([product.pk], require_active=False)
    operation = posting.prepare_operation(
        kind="PURCHASE_RECEIPT",
        actor=actor,
        source_type="PURCHASE" if source_id else "",
        source_id=source_id,
        entry_lines=[posting.EntryLine(product.pk, D(qty), None)],
    )
    posting.post_operation(operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs)
    return operation


@pytest.fixture
def costless_history(actor: Any, product: Any, warehouse: Any) -> dict[str, Any]:
    first = post_without_cost(actor, product, warehouse, 5, 1)
    post(actor, product, warehouse, "ADJUSTMENT_OUT", 2)
    costed = post(actor, product, warehouse, "PURCHASE_RECEIPT", 3, "4.00", ("PURCHASE", 2))
    post(actor, product, warehouse, "ADJUSTMENT_OUT", 6)
    post_without_cost(actor, product, warehouse, 2, 3)
    return {"first": first, "costed": costed}


def test_history_with_costless_entries_regularization_and_exits_reconciles(
    costless_history: dict[str, Any],
) -> None:
    assert reconcile() == []
    position = InventoryPosition.objects.get()
    assert position.valued is True


def test_reversals_of_costless_and_regularizing_entries_reconcile(
    actor: Any, product: Any, warehouse: Any
) -> None:
    post_without_cost(actor, product, warehouse, 5, 1)
    costed = post(actor, product, warehouse, "PURCHASE_RECEIPT", 5, "2.00", ("PURCHASE", 2))
    refs = lock_product_references([product.pk], require_active=False)
    posting.reverse_operation(
        costed,
        actor=actor,
        source_type="PURCHASE_VOID",
        source_id=2,
        reason="Error",
        locked=posting.lock_positions(refs, warehouse_id=warehouse.pk),
        product_refs=refs,
    )
    assert reconcile() == []
    assert InventoryPosition.objects.get().valued is False


def test_an_unvalued_position_flag_that_drifts_is_reported(
    actor: Any, product: Any, warehouse: Any
) -> None:
    post_without_cost(actor, product, warehouse, 5, 1)
    InventoryPosition.objects.update(valued=True)
    messages = [d.render() for d in reconcile()]
    assert any("difiere de la reconstruida" in m for m in messages)


def test_a_costless_entry_that_carries_value_without_a_valued_position_is_reported(
    actor: Any, product: Any, warehouse: Any
) -> None:
    post_without_cost(actor, product, warehouse, 5, 1)
    disable_immutability()
    with connection.cursor() as cursor:
        cursor.execute("UPDATE inventory_inventorymovement SET value_delta = 1, value_after = 1")
    assert any("promedio inconsistente" in d.render() for d in reconcile())
