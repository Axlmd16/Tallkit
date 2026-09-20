"""Traducción de conflictos de concurrencia de PostgreSQL a conflictos reintentables.

El error se traduce únicamente después del rollback completo de la transacción exterior y
nunca se reintenta automáticamente un fragmento: el cliente repite la unidad completa.
"""

from collections.abc import Iterator
from contextlib import contextmanager

from django.db import OperationalError, transaction

# deadlock_detected, serialization_failure, lock_not_available (lock_timeout / NOWAIT)
RETRYABLE_SQLSTATES = frozenset({"40P01", "40001", "55P03"})


class RetryableConflictError(Exception):
    """Conflicto transitorio: la unidad completa puede repetirse con seguridad."""

    def __init__(self, sqlstate: str) -> None:
        super().__init__(f"Conflicto de concurrencia reintentable ({sqlstate}).")
        self.sqlstate = sqlstate


def _sqlstate(error: BaseException) -> str | None:
    cause = error.__cause__ or error
    return getattr(cause, "sqlstate", None) or getattr(cause, "pgcode", None)


@contextmanager
def retryable_transaction() -> Iterator[None]:
    """Abre la transacción exterior y traduce conflictos tras revertirla por completo."""
    try:
        with transaction.atomic():
            yield
    except OperationalError as error:
        state = _sqlstate(error)
        if state in RETRYABLE_SQLSTATES:
            raise RetryableConflictError(state) from error
        raise
