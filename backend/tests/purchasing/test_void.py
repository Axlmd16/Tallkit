"""Anulación conservadora: restitución exacta, bloqueo por movimientos posteriores."""

from decimal import Decimal
from typing import Any

import pytest

from catalog.application.inventory_references import lock_product_references
from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import AuditEvent
from inventory.application import posting
from inventory.application.reservations import reserve
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition
from purchasing.application import entries, purchases
from purchasing.application.errors import PurchaseApplicationError
from purchasing.models import Purchase

from .test_models import make_identity, make_purchase

pytestmark = pytest.mark.django_db
D = Decimal


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Any) -> None:
    """Contexto comercial, bodega y serie COM-ING."""


def entry_line(product: Any, quantity: str = "2", cost: str | None = "10.00") -> dict[str, Any]:
    line: dict[str, Any] = {"product_id": product.pk, "quantity": quantity}
    if cost is not None:
        line["unit_cost"] = cost
    return line


def confirmed(admin: Any, lines: list[dict[str, Any]], key: str) -> dict[str, Any]:
    """Registra la entrada reconociendo las coincidencias del día: estos casos repiten contenido."""
    review = entries.review_entry(actor=admin, payload={"lines": lines})
    payload = {
        "idempotency_key": key,
        "lines": lines,
        "acknowledged_entry_ids": [d["purchase_id"] for d in review["duplicates"]],
    }
    return dict(entries.register_entry(actor=admin, payload=payload).body)


def void(
    admin: Any, body: dict[str, Any], key: str = "void-key-0001", reason: str = "Error de captura"
) -> Any:
    review = purchases.void_preview(actor=admin, purchase_id=body["id"])
    assert review["can_void"], review["issues"]
    return purchases.void_purchase(
        actor=admin,
        purchase_id=body["id"],
        payload={
            "idempotency_key": key,
            "expected_version": body["version"],
            "review_token": review["review_token"],
            "reason": reason,
        },
    )


def exit_stock(actor: Any, product: Any, quantity: int, warehouse: Any) -> None:
    from catalog.application.inventory_references import lock_product_references

    refs = lock_product_references([product.pk])
    operation = posting.prepare_operation(
        kind="ADJUSTMENT_OUT",
        actor=actor,
        source_type="",
        source_id=None,
        exit_lines=[posting.ExitLine(product.pk, D(quantity))],
    )
    posting.post_operation(operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs)


def test_void_restores_exact_quantity_value_and_average_and_keeps_the_number(
    admin: Any, commercial: Any, product: Any
) -> None:
    first = confirmed(
        admin,
        [entry_line(product, "10", "2.00")],
        "confirm-key-401",
    )
    second = confirmed(
        admin,
        [entry_line(product, "5", "4.00")],
        "confirm-key-402",
    )
    before_second = InventoryMovement.objects.get(operation_id=second["inventory_operation_id"])
    assert (before_second.quantity_after, before_second.value_after) == (D(15), D("40.000000"))
    outcome = void(admin, second)
    body = outcome.body
    assert body["state"] == "VOIDED"
    assert body["internal_number"] == second["internal_number"]
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value, position.average) == (
        D(10),
        D("20.000000"),
        D("2.000000"),
    )
    reversal = InventoryOperation.objects.get(pk=body["void_operation_id"])
    assert reversal.kind == "REVERSAL"
    assert reversal.reverses_id == second["inventory_operation_id"]
    assert InventoryOperation.objects.get(pk=second["inventory_operation_id"]).state == "REVERSED"
    assert body["void_reason"] == "Error de captura"
    assert first["state"] == "CONFIRMED"
    assert (
        AuditEvent.objects.filter(action="purchasing.purchase_voided", result="SUCCESS").count()
        == 1
    )


def test_reason_is_required_between_one_and_two_thousand_non_blank_characters(
    admin: Any, commercial: Any, product: Any
) -> None:
    body = confirmed(admin, [entry_line(product)], "confirm-key-403")
    review = purchases.void_preview(actor=admin, purchase_id=body["id"])
    for reason in ("", "   ", "x" * 2001, None):
        with pytest.raises(PurchaseApplicationError) as error:
            purchases.void_purchase(
                actor=admin,
                purchase_id=body["id"],
                payload={
                    "idempotency_key": "void-key-0002",
                    "expected_version": body["version"],
                    "review_token": review["review_token"],
                    "reason": reason,
                },
            )
        assert "reason" in error.value.errors
    assert Purchase.objects.get(pk=body["id"]).state == "CONFIRMED"


def test_later_movement_blocks_even_with_enough_stock(
    admin: Any, commercial: Any, product: Any
) -> None:
    first = confirmed(
        admin,
        [entry_line(product, "5", "1.00")],
        "confirm-key-404",
    )
    confirmed(
        admin,
        [entry_line(product, "10", "1.00")],
        "confirm-key-405",
    )
    review = purchases.void_preview(actor=admin, purchase_id=first["id"])
    assert review["can_void"] is False
    assert review["review_token"] is None
    assert review["issues"][0]["code"] == "unsafe_reversal"
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.void_purchase(
            actor=admin,
            purchase_id=first["id"],
            payload={
                "idempotency_key": "void-key-0003",
                "expected_version": first["version"],
                "review_token": "x",
                "reason": "x",
            },
        )
    assert error.value.code in {"unsafe_reversal", "validation_error"}
    assert Purchase.objects.get(pk=first["id"]).state == "CONFIRMED"
    assert InventoryPosition.objects.get().quantity == D(15)


def test_void_is_blocked_when_the_received_stock_is_reserved(
    admin: Any,
    commercial: Any,
    product: Any,
    warehouse: Any,
) -> None:
    body = confirmed(
        admin,
        [entry_line(product, "5", "1.00")],
        "confirm-key-413",
    )
    refs = lock_product_references([product.pk])
    reserve(
        posting.lock_positions(refs, warehouse_id=warehouse.pk),
        product_id=product.pk,
        source_type="SALE_LINE",
        source_id=401,
        source_reference={"sale_id": 41, "order_id": 10},
        quantity=D(2),
    )

    review = purchases.void_preview(actor=admin, purchase_id=body["id"])

    assert review["can_void"] is False
    assert review["review_token"] is None
    assert review["issues"][0]["code"] == "insufficient_stock"
    assert Purchase.objects.get(pk=body["id"]).state == "CONFIRMED"
    position = InventoryPosition.objects.get(product=product)
    assert (position.quantity, position.reserved) == (D(5), D(2))
    assert InventoryOperation.objects.filter(kind="REVERSAL").count() == 0


def test_unsafe_reversal_names_the_product_and_the_first_blocking_reference(
    admin: Any, commercial: Any, product: Any, warehouse: Any
) -> None:
    body = confirmed(
        admin,
        [entry_line(product, "5", "1.00")],
        "confirm-key-406",
    )
    exit_stock(admin, product, 1, warehouse)
    blocking = InventoryOperation.objects.filter(kind="ADJUSTMENT_OUT").get()
    review = purchases.void_preview(actor=admin, purchase_id=body["id"])
    issue = review["issues"][0]
    assert issue["product_id"] == product.pk
    assert issue["blocking_reference"] == f"INV-{blocking.pk}"


def test_one_blocked_product_blocks_the_whole_document_without_partial_compensation(
    admin: Any,
    commercial: Any,
    product: Any,
    make_product: Any,
    warehouse: Any,
) -> None:
    other = make_product()
    body = confirmed(
        admin,
        [
            entry_line(product, "5", "1.00"),
            entry_line(other, "5", "1.00"),
        ],
        "confirm-key-407",
    )
    exit_stock(admin, other, 1, warehouse)
    review = purchases.void_preview(actor=admin, purchase_id=body["id"])
    assert review["can_void"] is False
    assert [i["product_id"] for i in review["issues"]] == [other.pk]
    assert InventoryPosition.objects.get(product=product).quantity == D(5)


def test_a_compensated_later_movement_still_blocks(
    admin: Any, commercial: Any, product: Any
) -> None:
    first = confirmed(
        admin,
        [entry_line(product, "5", "1.00")],
        "confirm-key-408",
    )
    later = confirmed(
        admin,
        [entry_line(product, "2", "1.00")],
        "confirm-key-409",
    )
    void(admin, later, key="void-key-0004")
    review = purchases.void_preview(actor=admin, purchase_id=first["id"])
    assert review["can_void"] is False


def test_discrepant_balances_are_reported_as_inconsistent_not_patched(
    admin: Any, commercial: Any, product: Any
) -> None:
    body = confirmed(
        admin,
        [entry_line(product, "5", "1.00")],
        "confirm-key-410",
    )
    InventoryPosition.objects.update(value=D("9.000000"))
    review = purchases.void_preview(actor=admin, purchase_id=body["id"])
    assert review["can_void"] is False
    assert review["issues"][0]["code"] == "inventory_inconsistent"
    assert InventoryPosition.objects.get().value == D("9.000000")


def test_repeated_void_returns_the_voided_state_without_a_second_compensation(
    admin: Any, commercial: Any, product: Any
) -> None:
    body = confirmed(
        admin,
        [entry_line(product, "5", "1.00")],
        "confirm-key-411",
    )
    first = void(admin, body, key="void-key-0005")
    again = purchases.void_purchase(
        actor=admin,
        purchase_id=body["id"],
        payload={
            "idempotency_key": "void-key-0006",
            "expected_version": body["version"],
            "review_token": "irrelevante",
            "reason": "Error de captura",
        },
    )
    assert again.body["state"] == "VOIDED"
    assert again.body["void_operation_id"] == first.body["void_operation_id"]
    assert InventoryOperation.objects.filter(kind="REVERSAL").count() == 1
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.void_purchase(
            actor=admin,
            purchase_id=body["id"],
            payload={
                "idempotency_key": "void-key-0007",
                "expected_version": body["version"],
                "review_token": "irrelevante",
                "reason": "Otro motivo distinto",
            },
        )
    assert error.value.code == "idempotency_conflict"


def test_drafts_cannot_be_voided_and_only_administrators_can_void(
    admin: Any, seller: Any, supplier: Any
) -> None:
    draft = make_purchase(make_identity(supplier), admin)
    with pytest.raises(PurchaseApplicationError):
        purchases.void_preview(actor=admin, purchase_id=draft.pk)
    with pytest.raises(BusinessPermissionDeniedError):
        purchases.void_preview(actor=seller, purchase_id=draft.pk)


def test_failure_during_void_keeps_the_purchase_confirmed_and_stock_untouched(
    admin: Any, commercial: Any, product: Any, monkeypatch: Any
) -> None:
    body = confirmed(
        admin,
        [entry_line(product, "5", "1.00")],
        "confirm-key-412",
    )
    review = purchases.void_preview(actor=admin, purchase_id=body["id"])

    def boom(*args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("falla simulada")

    monkeypatch.setattr(posting, "reverse_operation", boom)
    with pytest.raises(RuntimeError):
        purchases.void_purchase(
            actor=admin,
            purchase_id=body["id"],
            payload={
                "idempotency_key": "void-key-0008",
                "expected_version": body["version"],
                "review_token": review["review_token"],
                "reason": "Error",
            },
        )
    assert Purchase.objects.get(pk=body["id"]).state == "CONFIRMED"
    assert InventoryPosition.objects.get().quantity == D(5)
    assert InventoryOperation.objects.filter(kind="REVERSAL").count() == 0


# --- Entradas sin costo registrado ------------------------------------------------------


def test_voiding_an_entry_without_cost_restores_the_empty_position(
    admin: Any, seller: Any, product: Any
) -> None:
    body = confirmed(seller, [entry_line(product, "5", None)], "entry-key-501")
    assert InventoryPosition.objects.get().valued is False
    outcome = void(admin, body)
    assert outcome.body["state"] == "VOIDED"
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value, position.average, position.valued) == (
        D(0),
        D(0),
        D(0),
        True,
    )


def test_voiding_the_regularizing_entry_restores_the_position_without_cost(
    admin: Any, product: Any
) -> None:
    confirmed(admin, [entry_line(product, "5", None)], "entry-key-502")
    costed = confirmed(admin, [entry_line(product, "5", "2.00")], "entry-key-503")
    assert InventoryPosition.objects.get().value == D("20.000000")
    void(admin, costed)
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value, position.valued) == (D(5), D(0), False)


def test_a_seller_cannot_void_his_own_or_another_entry(
    admin: Any, seller: Any, product: Any
) -> None:
    body = confirmed(seller, [entry_line(product, "5", "1.00")], "entry-key-504")
    with pytest.raises(BusinessPermissionDeniedError):
        purchases.void_preview(actor=seller, purchase_id=body["id"])
    with pytest.raises(BusinessPermissionDeniedError):
        purchases.void_purchase(
            actor=seller,
            purchase_id=body["id"],
            payload={
                "idempotency_key": "void-key-0090",
                "expected_version": body["version"],
                "review_token": "x",
                "reason": "Quiero deshacerla",
            },
        )
    assert Purchase.objects.get(pk=body["id"]).state == "CONFIRMED"
    assert InventoryPosition.objects.get().quantity == D(5)


def test_a_legacy_confirmed_purchase_remains_voidable(
    admin: Any, supplier: Any, product: Any, warehouse: Any
) -> None:
    from django.utils import timezone

    legacy = make_purchase(make_identity(supplier), admin)
    from purchasing.models import PurchaseLine

    PurchaseLine.objects.create(
        purchase=legacy, position=1, product=product, quantity=D(3), unit_cost=D("2.00")
    )
    from catalog.application.inventory_references import lock_product_references

    refs = lock_product_references([product.pk])
    operation = posting.prepare_operation(
        kind="PURCHASE_RECEIPT",
        actor=admin,
        source_type="PURCHASE",
        source_id=legacy.pk,
        entry_lines=[posting.EntryLine(product.pk, D(3), D("6.00"))],
    )
    posting.post_operation(operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs)
    Purchase.objects.filter(pk=legacy.pk).update(
        state="CONFIRMED",
        internal_number="COM-ING-000900",
        inventory_operation_id=operation.pk,
        confirmed_at=timezone.now(),
        confirmed_by=admin,
        fiscal_snapshot={"schema_version": 1, "warehouse": {"id": warehouse.pk}},
    )
    legacy.refresh_from_db()
    outcome = void(admin, {"id": legacy.pk, "version": legacy.version})
    assert outcome.body["state"] == "VOIDED"
    assert InventoryPosition.objects.get().quantity == D(0)
