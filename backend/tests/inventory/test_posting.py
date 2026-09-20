"""Núcleo de publicación de inventario: prepare, lock, post y reversión exacta."""

import re
from datetime import timedelta
from decimal import Decimal
from typing import Any

import pytest
from django.db import connection, transaction
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from catalog.application.inventory_references import lock_product_references
from inventory.application import posting, queries
from inventory.application.posting import (
    ContextNotLockedError,
    EntryLine,
    ExitLine,
    ReversalBlockedError,
    group_entry_lines,
    lock_positions,
    post_operation,
    prepare_operation,
    reverse_operation,
)
from inventory.domain.validation import InsufficientStockError
from inventory.models import (
    InventoryMovement,
    InventoryOperationLine,
    InventoryPosition,
)
from workshop_configuration.application.operation_context import lock_operation_context

D = Decimal
pytestmark = pytest.mark.django_db


def entry(product_id: int, quantity: int, value: str, source: int | None = None) -> EntryLine:
    return EntryLine(product_id, D(quantity), D(value), (source,) if source else ())


def receive(actor: Any, refs: Any, warehouse: Any, lines: list[EntryLine], source_id: int = 1):  # type: ignore[no-untyped-def]
    operation = posting.prepare_operation(
        kind="PURCHASE_RECEIPT",
        actor=actor,
        source_type="PURCHASE",
        source_id=source_id,
        entry_lines=lines,
    )
    locked = posting.lock_positions(refs, warehouse_id=warehouse.pk)
    return operation, posting.post_operation(operation, locked, refs)


@pytest.fixture
def refs_for(product: Any):  # type: ignore[no-untyped-def]
    def build(*products: Any) -> Any:
        return lock_product_references([p.pk for p in products])

    return build


class TestPrepareAndLock:
    def test_prepare_requires_an_outer_transaction_and_creates_no_effects(
        self, actor: Any, product: Any
    ) -> None:
        operation = prepare_operation(
            kind="PURCHASE_RECEIPT",
            actor=actor,
            source_type="PURCHASE",
            source_id=1,
            entry_lines=[entry(product.pk, 2, "4.00", 11)],
        )
        assert operation.state == "PREPARED"
        assert InventoryMovement.objects.count() == 0
        assert InventoryPosition.objects.count() == 0
        line = operation.lines.get()
        assert (line.quantity, line.entry_value, line.source_line_id) == (D(2), D(4), 11)

    @pytest.mark.django_db(transaction=True)
    def test_prepare_lock_and_post_are_rejected_outside_a_transaction(
        self, actor: Any, product: Any, warehouse: Any
    ) -> None:
        with pytest.raises(RuntimeError, match="transacción"):
            prepare_operation(
                kind="PURCHASE_RECEIPT",
                actor=actor,
                source_type="PURCHASE",
                source_id=1,
                entry_lines=[entry(product.pk, 1, "1")],
            )
        with pytest.raises(RuntimeError, match="transacción"):
            lock_positions({}, warehouse_id=warehouse.pk)

    def test_lock_requires_products_already_locked_by_the_owner(
        self, product: Any, warehouse: Any, make_product: Any
    ) -> None:
        other = make_product()
        refs = lock_product_references([product.pk])
        operation = prepare_operation(
            kind="PURCHASE_RECEIPT",
            actor=_actor(),
            source_type="PURCHASE",
            source_id=2,
            entry_lines=[entry(other.pk, 1, "1")],
        )
        locked = lock_positions(refs, warehouse_id=warehouse.pk)
        with pytest.raises(ContextNotLockedError):
            post_operation(operation, locked, refs)

    def test_post_rejects_positions_not_produced_by_lock(
        self, actor: Any, product: Any, refs_for: Any
    ) -> None:
        refs = refs_for(product)
        operation = prepare_operation(
            kind="PURCHASE_RECEIPT",
            actor=actor,
            source_type="PURCHASE",
            source_id=3,
            entry_lines=[entry(product.pk, 1, "1")],
        )
        with pytest.raises(ContextNotLockedError):
            post_operation(operation, {}, refs)  # type: ignore[arg-type]

    def test_missing_position_is_created_under_the_product_lock(
        self, product: Any, warehouse: Any, refs_for: Any
    ) -> None:
        assert not InventoryPosition.objects.exists()
        locked = lock_positions(refs_for(product), warehouse_id=warehouse.pk)
        position = locked.positions[product.pk]
        assert (position.quantity, position.value, position.average) == (D(0), D(0), D(0))
        assert InventoryPosition.objects.count() == 1
        again = lock_positions(refs_for(product), warehouse_id=warehouse.pk)
        assert again.positions[product.pk].pk == position.pk
        assert InventoryPosition.objects.count() == 1

    def test_queries_never_create_positions(self, product: Any, warehouse: Any) -> None:
        assert queries.get_position(product.pk, warehouse_id=warehouse.pk) is None
        assert not InventoryPosition.objects.exists()


class TestPostEntriesAndExits:
    def test_entry_updates_position_and_records_an_immutable_movement(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any
    ) -> None:
        operation, result = receive(
            actor, refs_for(product), warehouse, [entry(product.pk, 10, "20.00")]
        )
        operation.refresh_from_db()
        assert operation.state == "POSTED"
        assert operation.posted_at is not None
        (movement,) = result.movements
        assert (movement.quantity_in, movement.quantity_out) == (D(10), D(0))
        assert movement.value_delta == D("20.000000")
        assert movement.applied_unit_cost == D("2.000000")
        assert (movement.quantity_before, movement.quantity_after) == (D(0), D(10))
        assert movement.product_snapshot["schema_version"] == 1
        assert movement.product_snapshot["code"] == product.code
        position = InventoryPosition.objects.get()
        assert (position.quantity, position.value, position.average) == (
            D(10),
            D("20.000000"),
            D("2.000000"),
        )
        assert (position.version, position.last_ordinal) == (2, 1)

    def test_exit_uses_the_current_average_and_sufficient_stock(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any
    ) -> None:
        receive(actor, refs_for(product), warehouse, [entry(product.pk, 3, "1.00")])
        refs = refs_for(product)
        operation = prepare_operation(
            kind="ADJUSTMENT_OUT",
            actor=actor,
            source_type="",
            source_id=None,
            exit_lines=[ExitLine(product.pk, D(1))],
        )
        result = post_operation(operation, lock_positions(refs, warehouse_id=warehouse.pk), refs)
        (movement,) = result.movements
        assert movement.quantity_out == D(1)
        assert movement.quantity_in == D(0)
        assert movement.value_delta == D("-0.333333")
        assert movement.applied_unit_cost == D("0.333333")

    def test_insufficient_stock_fails_before_valuing_and_leaves_no_effects(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any
    ) -> None:
        receive(actor, refs_for(product), warehouse, [entry(product.pk, 2, "4.00")])
        refs = refs_for(product)
        operation = prepare_operation(
            kind="ADJUSTMENT_OUT",
            actor=actor,
            source_type="",
            source_id=None,
            exit_lines=[ExitLine(product.pk, D(3))],
        )
        locked = lock_positions(refs, warehouse_id=warehouse.pk)
        before = InventoryMovement.objects.count()
        with pytest.raises(InsufficientStockError), transaction.atomic():
            post_operation(operation, locked, refs)
        assert InventoryMovement.objects.count() == before
        position = InventoryPosition.objects.get()
        assert (position.quantity, position.last_ordinal) == (D(2), 1)
        operation.refresh_from_db()
        assert operation.state == "PREPARED"

    def test_negative_balance_is_impossible_within_the_same_operation(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any, make_product: Any
    ) -> None:
        other = make_product()
        refs = refs_for(product, other)
        receive(actor, refs, warehouse, [entry(product.pk, 5, "5.00"), entry(other.pk, 1, "1.00")])
        operation = prepare_operation(
            kind="ADJUSTMENT_OUT",
            actor=actor,
            source_type="",
            source_id=None,
            exit_lines=[ExitLine(product.pk, D(5)), ExitLine(other.pk, D(2))],
        )
        locked = lock_positions(refs, warehouse_id=warehouse.pk)
        with pytest.raises(InsufficientStockError), transaction.atomic():
            post_operation(operation, locked, refs)
        assert InventoryPosition.objects.get(product=product).quantity == D(5)
        assert not InventoryPosition.objects.filter(quantity__lt=0).exists()


class TestOrdinalsAndTime:
    def test_ordinals_are_consecutive_per_position(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any
    ) -> None:
        for source in (1, 2, 3):
            receive(
                actor,
                refs_for(product),
                warehouse,
                [entry(product.pk, 1, "1.00")],
                source_id=source,
            )
        ordinals = list(
            InventoryMovement.objects.order_by("ordinal").values_list("ordinal", flat=True)
        )
        assert ordinals == [1, 2, 3]

    def test_effective_time_is_taken_after_locks_and_never_moves_backwards(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any, monkeypatch: Any
    ) -> None:
        future = timezone.now() + timedelta(hours=2)
        monkeypatch.setattr(posting, "_now", lambda: future)
        receive(actor, refs_for(product), warehouse, [entry(product.pk, 1, "1.00")], source_id=1)
        monkeypatch.setattr(posting, "_now", lambda: future - timedelta(hours=1))  # reloj atrasado
        _, result = receive(
            actor, refs_for(product), warehouse, [entry(product.pk, 1, "1.00")], source_id=2
        )
        assert result.movements[0].effective_at == future
        assert InventoryPosition.objects.get().last_effective_at == future

    def test_clock_is_read_only_after_positions_are_locked(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any, monkeypatch: Any
    ) -> None:
        events: list[str] = []
        original_lock = posting.lock_positions

        def spy_lock(*args: Any, **kwargs: Any) -> Any:
            events.append("lock")
            return original_lock(*args, **kwargs)

        monkeypatch.setattr(posting, "lock_positions", spy_lock)

        def spy_clock() -> Any:
            events.append("clock")
            return timezone.now()

        monkeypatch.setattr(posting, "_now", spy_clock)
        receive(actor, refs_for(product), warehouse, [entry(product.pk, 1, "1.00")])
        assert events.index("lock") < events.index("clock")


class TestGrouping:
    def test_purchase_lines_are_grouped_by_product_into_one_movement(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any, make_product: Any
    ) -> None:
        other = make_product()
        lines = [
            entry(product.pk, 2, "4.00", 101),
            entry(other.pk, 1, "9.00", 102),
            entry(product.pk, 3, "9.00", 103),
        ]
        grouped = group_entry_lines(lines)
        assert [(g.product_id, g.quantity, g.value, g.source_line_ids) for g in grouped] == [
            (product.pk, D(5), D("13.00"), (101, 103)),
            (other.pk, D(1), D("9.00"), (102,)),
        ]
        operation, result = receive(actor, refs_for(product, other), warehouse, lines)
        assert len(result.movements) == 2
        assert InventoryMovement.objects.filter(operation=operation, product=product).count() == 1
        assert InventoryOperationLine.objects.filter(operation=operation).count() == 2
        merged = operation.lines.get(product=product)
        assert (merged.quantity, merged.entry_value) == (D(5), D("13.00"))
        assert InventoryPosition.objects.get(product=product).average == D("2.600000")


class TestExactReversal:
    def test_reversal_restores_quantity_value_and_average_exactly(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any
    ) -> None:
        receive(actor, refs_for(product), warehouse, [entry(product.pk, 3, "1.00")], source_id=1)
        before = InventoryPosition.objects.get()
        original, _ = receive(
            actor, refs_for(product), warehouse, [entry(product.pk, 2, "1.00")], source_id=2
        )
        refs = refs_for(product)
        reversal, result = reverse_operation(
            original,
            actor=actor,
            source_type="PURCHASE_VOID",
            source_id=2,
            reason="Error",
            locked=lock_positions(refs, warehouse_id=warehouse.pk),
            product_refs=refs,
        )
        position = InventoryPosition.objects.get()
        assert (position.quantity, position.value, position.average) == (
            before.quantity,
            before.value,
            before.average,
        )
        original.refresh_from_db()
        assert original.state == "REVERSED"
        assert reversal.kind == "REVERSAL"
        assert reversal.reverses_id == original.pk
        (movement,) = result.movements
        assert movement.movement_type == "REVERSAL"
        assert movement.quantity_out == D(2)
        assert movement.quantity_in == D(0)
        assert movement.reverses_movement is not None
        assert movement.reverses_movement.operation_id == original.pk

    def test_reversal_of_an_exit_that_depleted_stock_restores_its_residue(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any
    ) -> None:
        receive(actor, refs_for(product), warehouse, [entry(product.pk, 3, "1.00")])
        refs = refs_for(product)
        exit_op = prepare_operation(
            kind="ADJUSTMENT_OUT",
            actor=actor,
            source_type="",
            source_id=None,
            exit_lines=[ExitLine(product.pk, D(3))],
        )
        post_operation(exit_op, lock_positions(refs, warehouse_id=warehouse.pk), refs)
        assert InventoryPosition.objects.get().quantity == 0
        reverse_operation(
            exit_op,
            actor=actor,
            source_type="ADJUSTMENT_VOID",
            source_id=None,
            reason="Error",
            locked=lock_positions(refs, warehouse_id=warehouse.pk),
            product_refs=refs,
        )
        position = InventoryPosition.objects.get()
        assert (position.quantity, position.value, position.average) == (
            D(3),
            D("1.000000"),
            D("0.333333"),
        )

    def test_any_later_movement_blocks_the_whole_reversal_even_if_compensated(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any
    ) -> None:
        original, _ = receive(
            actor, refs_for(product), warehouse, [entry(product.pk, 5, "5.00")], source_id=1
        )
        later, _ = receive(
            actor, refs_for(product), warehouse, [entry(product.pk, 1, "1.00")], source_id=2
        )
        refs = refs_for(product)
        reverse_operation(
            later,
            actor=actor,
            source_type="PURCHASE_VOID",
            source_id=2,
            reason="x",
            locked=lock_positions(refs, warehouse_id=warehouse.pk),
            product_refs=refs,
        )
        with pytest.raises(ReversalBlockedError), transaction.atomic():
            reverse_operation(
                original,
                actor=actor,
                source_type="PURCHASE_VOID",
                source_id=1,
                reason="x",
                locked=lock_positions(refs, warehouse_id=warehouse.pk),
                product_refs=refs,
            )
        original.refresh_from_db()
        assert original.state == "POSTED"

    def test_a_reversal_cannot_be_reversed_twice(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any
    ) -> None:
        original, _ = receive(actor, refs_for(product), warehouse, [entry(product.pk, 1, "1.00")])
        refs = refs_for(product)
        kwargs: dict[str, Any] = {
            "actor": actor,
            "source_type": "PURCHASE_VOID",
            "source_id": 1,
            "reason": "x",
            "product_refs": refs,
        }
        reverse_operation(
            original, locked=lock_positions(refs, warehouse_id=warehouse.pk), **kwargs
        )
        with pytest.raises(ReversalBlockedError), transaction.atomic():
            reverse_operation(
                original, locked=lock_positions(refs, warehouse_id=warehouse.pk), **kwargs
            )


class TestResourceOrder:
    def test_posting_acquires_no_lock_of_earlier_groups_or_of_purchasing(
        self, actor: Any, product: Any, warehouse: Any, refs_for: Any
    ) -> None:
        from workshop_configuration.models import FiscalEntity

        FiscalEntity.objects.get_or_create(
            entity_type="COMERCIAL", defaults={"legal_name": "C", "ruc": "1790000000001"}
        )
        with CaptureQueriesContext(connection) as queries:
            refs = refs_for(product)  # grupo 4: catálogo
            operation = prepare_operation(
                kind="PURCHASE_RECEIPT",
                actor=actor,
                source_type="PURCHASE",
                source_id=1,
                entry_lines=[entry(product.pk, 1, "1.00")],
            )
            locked = lock_positions(refs, warehouse_id=warehouse.pk)  # grupo 5: posiciones
            lock_operation_context(tax_definition_ids=[], on=timezone.localdate())  # grupo 6
            marker = len(queries.captured_queries)
            post_operation(operation, locked, refs)  # grupo 7: solo inserciones y actualizaciones
        order = []
        for query in queries.captured_queries[:marker]:
            if "FOR UPDATE" in query["sql"]:
                order.append(re.search(r'FROM "(\w+)"', query["sql"]).group(1))  # type: ignore[union-attr]
        assert order[0] == "catalog_product"
        assert order.index("inventory_inventoryposition") > order.index("catalog_product")
        assert order.index("workshop_configuration_fiscalentity") > order.index(
            "inventory_inventoryposition"
        )
        assert not any("FOR UPDATE" in q["sql"] for q in queries.captured_queries[marker:])
        assert not any("purchasing_" in q["sql"] for q in queries.captured_queries)


def _actor() -> Any:
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create_user(username="inv-other", password="x" * 14)
