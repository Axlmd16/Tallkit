"""Idempotencia persistente: misma semántica en catálogo y proveedores."""

import threading
from collections.abc import Callable
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.db import connection, connections

from catalog.application import commands as catalog_commands
from catalog.models import CatalogCommand
from shared.command_values import InvalidIdempotencyKeyError
from supplier_registry.application import commands as supplier_commands
from supplier_registry.models import SupplierCommand

MODULES = [
    pytest.param(catalog_commands, CatalogCommand, id="catalog"),
    pytest.param(supplier_commands, SupplierCommand, id="suppliers"),
]
KEY = "key-0000001"


@pytest.fixture
def user(db: None) -> Any:
    return get_user_model().objects.create_user(username="idem-actor", password="x" * 14)


def _counter() -> tuple[list[int], Callable[[], tuple[int, dict[str, Any]]]]:
    calls: list[int] = []

    def execute() -> tuple[int, dict[str, Any]]:
        calls.append(1)
        return 201, {"id": len(calls)}

    return calls, execute


@pytest.mark.django_db
@pytest.mark.parametrize(("mod", "model"), MODULES)
def test_replay_returns_original_and_executes_once(mod: Any, model: Any, user: Any) -> None:
    calls, execute = _counter()
    args = {"actor": user, "action": "x.created", "idempotency_key": KEY, "execute": execute}
    first = mod.run_idempotent_command(payload={"name": "a"}, **args)
    second = mod.run_idempotent_command(payload={"name": "a"}, **args)
    assert (first.status, first.body, first.replayed) == (201, {"id": 1}, False)
    assert (second.status, second.body, second.replayed) == (201, {"id": 1}, True)
    assert len(calls) == 1
    assert model.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize(("mod", "model"), MODULES)
def test_different_payload_conflicts(mod: Any, model: Any, user: Any) -> None:
    calls, execute = _counter()
    args = {"actor": user, "action": "x.created", "idempotency_key": KEY, "execute": execute}
    mod.run_idempotent_command(payload={"name": "a"}, **args)
    with pytest.raises(mod.IdempotencyConflictError):
        mod.run_idempotent_command(payload={"name": "b"}, **args)
    assert len(calls) == 1


@pytest.mark.django_db
@pytest.mark.parametrize(("mod", "model"), MODULES)
def test_scope_is_actor_action_key(mod: Any, model: Any, user: Any) -> None:
    other = get_user_model().objects.create_user(username="idem-other", password="x" * 14)
    calls, execute = _counter()
    for actor, action in [(user, "a.one"), (user, "a.two"), (other, "a.one")]:
        out = mod.run_idempotent_command(
            actor=actor,
            action=action,
            idempotency_key=KEY,
            payload={"n": 1},
            execute=execute,
        )
        assert out.replayed is False
    assert len(calls) == 3


@pytest.mark.django_db
@pytest.mark.parametrize(("mod", "model"), MODULES)
def test_invalid_key_rejected(mod: Any, model: Any, user: Any) -> None:
    with pytest.raises(InvalidIdempotencyKeyError):
        mod.run_idempotent_command(
            actor=user, action="a", idempotency_key="bad", payload={}, execute=lambda: (200, {})
        )


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(("mod", "model"), MODULES)
def test_failure_rolls_back_receipt_and_key_can_be_reclaimed(
    mod: Any, model: Any, user: Any
) -> None:
    def boom() -> tuple[int, dict[str, Any]]:
        raise RuntimeError("fallo inyectado")

    args = {"actor": user, "action": "x.created", "idempotency_key": KEY, "payload": {"a": 1}}
    with pytest.raises(RuntimeError):
        mod.run_idempotent_command(execute=boom, **args)
    assert model.objects.count() == 0  # ningún recibo provisional queda confirmado
    calls, execute = _counter()
    out = mod.run_idempotent_command(execute=execute, **args)
    assert (out.replayed, len(calls)) == (False, 1)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(("mod", "model"), MODULES)
@pytest.mark.parametrize("same_payload", [True, False], ids=["same", "different"])
def test_concurrent_same_key(mod: Any, model: Any, user: Any, same_payload: bool) -> None:
    """Dos conexiones independientes: un solo efecto; el otro reproduce o entra en conflicto."""
    executed: list[int] = []
    inside = threading.Event()
    release = threading.Event()
    results: dict[str, Any] = {}

    def slow() -> tuple[int, dict[str, Any]]:
        executed.append(1)
        inside.set()
        release.wait(timeout=10)
        return 201, {"id": 1}

    def fast() -> tuple[int, dict[str, Any]]:
        executed.append(2)
        return 201, {"id": 2}

    def first() -> None:
        try:
            results["first"] = mod.run_idempotent_command(
                actor=user, action="x.created", idempotency_key=KEY, payload={"a": 1}, execute=slow
            )
        finally:
            connections.close_all()

    def second() -> None:
        try:
            results["second"] = mod.run_idempotent_command(
                actor=user,
                action="x.created",
                idempotency_key=KEY,
                payload={"a": 1 if same_payload else 2},
                execute=fast,
            )
        except Exception as exc:
            results["second"] = exc
        finally:
            connections.close_all()

    t1 = threading.Thread(target=first)
    t1.start()
    assert inside.wait(timeout=10)
    t2 = threading.Thread(target=second)
    t2.start()
    t2.join(timeout=0.5)
    assert t2.is_alive(), "el segundo debe esperar al primero, no ejecutarse"
    release.set()
    t1.join(timeout=10)
    t2.join(timeout=10)
    connection.close()

    assert executed == [1]
    assert results["first"].replayed is False
    if same_payload:
        assert results["second"].replayed is True
        assert results["second"].body == {"id": 1}
    else:
        assert isinstance(results["second"], mod.IdempotencyConflictError)
    assert model.objects.count() == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(("mod", "model"), MODULES)
def test_second_claims_after_first_rolls_back(mod: Any, model: Any, user: Any) -> None:
    inside = threading.Event()
    release = threading.Event()
    results: dict[str, Any] = {}

    def failing() -> tuple[int, dict[str, Any]]:
        inside.set()
        release.wait(timeout=10)
        raise RuntimeError("primero revierte")

    def first() -> None:
        try:
            mod.run_idempotent_command(
                actor=user, action="x.c", idempotency_key=KEY, payload={"a": 1}, execute=failing
            )
        except RuntimeError as exc:
            results["first"] = exc
        finally:
            connections.close_all()

    def second() -> None:
        try:
            results["second"] = mod.run_idempotent_command(
                actor=user,
                action="x.c",
                idempotency_key=KEY,
                payload={"a": 1},
                execute=lambda: (201, {"id": 9}),
            )
        finally:
            connections.close_all()

    t1 = threading.Thread(target=first)
    t1.start()
    assert inside.wait(timeout=10)
    t2 = threading.Thread(target=second)
    t2.start()
    t2.join(timeout=0.5)
    assert t2.is_alive()
    release.set()
    t1.join(timeout=10)
    t2.join(timeout=10)
    connection.close()
    assert isinstance(results["first"], RuntimeError)
    assert results["second"].replayed is False
    assert model.objects.count() == 1
