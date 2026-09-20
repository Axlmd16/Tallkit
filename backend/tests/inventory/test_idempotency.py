"""Idempotencia de los comandos manuales de inventario."""

from decimal import Decimal
from typing import Any

import pytest

from identity.models import AuditEvent
from inventory.application import operations
from inventory.application.commands import IdempotencyConflictError
from inventory.models import (
    InventoryCommand,
    InventoryMovement,
    InventoryOperation,
    InventoryPosition,
)

from .test_initial_load import prepare

pytestmark = pytest.mark.django_db
D = Decimal


def test_same_key_and_payload_replays_the_stored_result(
    admin: Any, product: Any, warehouse: Any
) -> None:
    payload = {
        "idempotency_key": "idem-key-0001",
        "kind": "INITIAL_LOAD",
        "product_id": product.pk,
        "quantity": "8",
        "unit_cost": "2.50",
        "reason": "Existencia inicial",
    }
    first = operations.create_operation(actor=admin, payload=payload)
    again = operations.create_operation(actor=admin, payload=payload)
    assert again.replayed
    assert again.body == first.body
    assert InventoryOperation.objects.count() == 1


def test_incompatible_reuse_of_a_key_is_a_conflict(
    admin: Any, product: Any, warehouse: Any
) -> None:
    payload = {
        "idempotency_key": "idem-key-0002",
        "kind": "INITIAL_LOAD",
        "product_id": product.pk,
        "quantity": "8",
        "unit_cost": "2.50",
        "reason": "Existencia inicial",
    }
    operations.create_operation(actor=admin, payload=payload)
    with pytest.raises(IdempotencyConflictError):
        operations.create_operation(actor=admin, payload={**payload, "quantity": "9"})
    assert InventoryCommand.objects.count() == 1


def test_repeated_confirmation_with_another_key_returns_the_existing_operation(
    admin: Any, product: Any, warehouse: Any
) -> None:
    body = prepare(admin, product, "idem-key-0003")
    review = operations.preview_operation(actor=admin, operation_id=body["id"])
    payload = {
        "expected_version": body["version"],
        "review_token": review["review_token"],
    }
    first = operations.confirm_operation(
        actor=admin,
        operation_id=body["id"],
        payload={**payload, "idempotency_key": "idem-key-0004"},
    )
    again = operations.confirm_operation(
        actor=admin,
        operation_id=body["id"],
        payload={**payload, "idempotency_key": "idem-key-0005"},
    )
    assert again.body["id"] == first.body["id"]
    assert again.body["state"] == "POSTED"
    assert InventoryMovement.objects.count() == 1
    assert InventoryPosition.objects.get().quantity == D(8)


def test_audit_failure_keeps_the_previous_balance_and_leaves_no_receipt(
    admin: Any, product: Any, warehouse: Any, monkeypatch: Any
) -> None:
    body = prepare(admin, product, "idem-key-0006")
    review = operations.preview_operation(actor=admin, operation_id=body["id"])

    def broken_audit(**kwargs: Any) -> Any:
        if kwargs.get("result") == "SUCCESS":
            raise RuntimeError("auditoría no disponible")

    import inventory.application.commands as commands

    monkeypatch.setattr(commands, "record_audit_event", broken_audit)
    receipts = InventoryCommand.objects.count()
    with pytest.raises(RuntimeError):
        operations.confirm_operation(
            actor=admin,
            operation_id=body["id"],
            payload={
                "idempotency_key": "idem-key-0007",
                "expected_version": body["version"],
                "review_token": review["review_token"],
            },
        )
    assert not InventoryPosition.objects.exists()
    assert InventoryMovement.objects.count() == 0
    assert InventoryOperation.objects.get(pk=body["id"]).state == "PREPARED"
    assert InventoryCommand.objects.count() == receipts
    assert not AuditEvent.objects.filter(action="inventory.operation_confirmed").exists()
