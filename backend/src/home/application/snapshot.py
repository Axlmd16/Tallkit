from collections.abc import Iterator
from contextlib import contextmanager

from django.db import connection, transaction


@contextmanager
def read_snapshot() -> Iterator[None]:
    """Transacción corta REPEATABLE READ: los valores de un bloque salen de una misma imagen."""
    if connection.in_atomic_block:
        yield
        return
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        yield
