from collections.abc import Iterator

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_cache() -> Iterator[None]:
    cache.clear()
    yield
    cache.clear()


def _user_with_role(username: str, role: str):  # type: ignore[no-untyped-def]
    from django.contrib.auth import get_user_model

    from identity.models import UserRole

    user = get_user_model().objects.create_user(username=username, password="password123")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def role_admin(db: None):  # type: ignore[no-untyped-def]
    return _user_with_role("role_admin", "ADMINISTRADOR")


@pytest.fixture
def role_manager(db: None):  # type: ignore[no-untyped-def]
    return _user_with_role("role_manager", "ENCARGADO_TALLER")


@pytest.fixture
def role_seller(db: None):  # type: ignore[no-untyped-def]
    return _user_with_role("role_seller", "VENDEDOR")


@pytest.fixture
def run_parallel():  # type: ignore[no-untyped-def]
    """Ejecuta unidades en hilos con conexiones propias, barrera con timeout y cierre explícito."""
    import threading
    from collections.abc import Callable
    from typing import Any

    from django.db import connection

    def runner(*units: Callable[[], Any], timeout: float = 60.0) -> list[tuple[str, Any]]:
        barrier = threading.Barrier(len(units), timeout=15)
        results: list[tuple[str, Any] | None] = [None] * len(units)

        def work(index: int, unit: Callable[[], Any]) -> None:
            try:
                barrier.wait()
                results[index] = ("ok", unit())
            except BaseException as error:
                results[index] = ("error", error)
            finally:
                connection.close()

        threads = [threading.Thread(target=work, args=(i, u)) for i, u in enumerate(units)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout)
        assert not any(thread.is_alive() for thread in threads), "workers sin terminar"
        return [r if r is not None else ("error", RuntimeError("sin resultado")) for r in results]

    return runner
