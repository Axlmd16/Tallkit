"""Los conflictos de concurrencia se traducen solo tras el rollback completo."""

from typing import Any

import pytest
from django.db import OperationalError, connection, transaction

from inventory.models import InventoryOperation
from shared.transactions import RetryableConflictError, retryable_transaction

pytestmark = pytest.mark.django_db(transaction=True)


class _PgError(Exception):
    def __init__(self, sqlstate: str) -> None:
        super().__init__(sqlstate)
        self.sqlstate = sqlstate


def _operational(sqlstate: str) -> OperationalError:
    error = OperationalError("simulado")
    error.__cause__ = _PgError(sqlstate)
    return error


@pytest.mark.parametrize("sqlstate", ["40P01", "40001", "55P03"])
def test_deadlock_serialization_and_lock_timeout_become_retryable(
    actor: Any, sqlstate: str
) -> None:
    def failing_unit() -> None:
        with retryable_transaction():
            InventoryOperation.objects.create(
                kind="ADJUSTMENT_IN", actor=actor, source_type="", fingerprint="f" * 64
            )
            # La traducción ocurre fuera del bloque atómico: el rollback ya fue completo.
            raise _operational(sqlstate)

    with pytest.raises(RetryableConflictError) as raised:
        failing_unit()
    assert raised.value.sqlstate == sqlstate
    assert not connection.in_atomic_block
    assert InventoryOperation.objects.count() == 0  # nada quedó confirmado


def test_translation_happens_only_after_the_full_rollback(actor: Any) -> None:
    observed: list[bool] = []
    try:
        with retryable_transaction():
            raise _operational("40P01")
    except RetryableConflictError:
        observed.append(connection.in_atomic_block)
    assert observed == [False]


def test_other_database_errors_are_not_translated() -> None:
    with pytest.raises(OperationalError), retryable_transaction():
        raise _operational("53300")


def test_successful_units_commit_normally(actor: Any) -> None:
    with retryable_transaction():
        InventoryOperation.objects.create(
            kind="ADJUSTMENT_IN", actor=actor, source_type="", fingerprint="f" * 64
        )
    assert InventoryOperation.objects.count() == 1


def test_a_real_lock_timeout_is_translated(actor: Any) -> None:
    op = InventoryOperation.objects.create(
        kind="ADJUSTMENT_IN", actor=actor, source_type="", fingerprint="f" * 64
    )
    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("SET LOCAL lock_timeout = '50ms'")
        cursor.execute(
            "SELECT id FROM inventory_inventoryoperation WHERE id = %s FOR UPDATE", [op.pk]
        )
        import threading

        outcome: list[Any] = []

        def contender() -> None:
            try:
                with retryable_transaction(), connection.cursor() as other:
                    other.execute("SET LOCAL lock_timeout = '50ms'")
                    other.execute(
                        "SELECT id FROM inventory_inventoryoperation WHERE id = %s FOR UPDATE",
                        [op.pk],
                    )
            except Exception as error:
                outcome.append(error)
            finally:
                connection.close()

        thread = threading.Thread(target=contender)
        thread.start()
        thread.join(timeout=10)
    assert len(outcome) == 1
    assert isinstance(outcome[0], RetryableConflictError)
    assert outcome[0].sqlstate == "55P03"
