"""Concurrencia real: confirmaciones, duplicados, reemplazos, anulaciones y bajas."""

from decimal import Decimal
from typing import Any

import pytest
from django.db import transaction

from catalog.application import products as catalog_products
from inventory.application import posting
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition
from purchasing.application import purchases
from purchasing.application.errors import PurchaseApplicationError
from purchasing.models import Purchase
from workshop_configuration.application.series import replace_series
from workshop_configuration.application.taxes import schedule_successor
from workshop_configuration.models import (
    ConfigurationUse,
    DocumentSeries,
    NumberAllocation,
    TaxPeriod,
)

from .test_drafts import create

pytestmark = pytest.mark.django_db(transaction=True)
D = Decimal


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Any) -> None:
    """Contexto comercial, bodega y serie COM-ING."""


def kinds(results: list[tuple[str, Any]]) -> list[str]:
    return sorted("ok" if s == "ok" else getattr(v, "code", type(v).__name__) for s, v in results)


def reviewed(admin: Any, draft: dict[str, Any], key: str) -> dict[str, Any]:
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    assert review["can_confirm"], review["issues"]
    return {
        "idempotency_key": key,
        "expected_version": draft["version"],
        "review_token": review["review_token"],
    }


def confirmed(admin: Any, draft: dict[str, Any], key: str) -> dict[str, Any]:
    return purchases.confirm_purchase(
        actor=admin, purchase_id=draft["id"], payload=reviewed(admin, draft, key)
    ).body


def test_repeated_confirmation_with_the_same_key_confirms_once(
    run_parallel: Any, admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    payload = reviewed(admin, draft, "cc-confirm-001")
    results = run_parallel(
        lambda: purchases.confirm_purchase(actor=admin, purchase_id=draft["id"], payload=payload),
        lambda: purchases.confirm_purchase(actor=admin, purchase_id=draft["id"], payload=payload),
    )
    assert kinds(results) == ["ok", "ok"]
    assert results[0][1].body == results[1][1].body
    assert InventoryMovement.objects.count() == 1
    assert NumberAllocation.objects.count() == 1


def test_repeated_confirmation_with_another_key_confirms_once(
    run_parallel: Any, admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    base_payload = reviewed(admin, draft, "cc-confirm-002")
    results = run_parallel(
        lambda: purchases.confirm_purchase(
            actor=admin,
            purchase_id=draft["id"],
            payload={**base_payload, "idempotency_key": "cc-confirm-002"},
        ),
        lambda: purchases.confirm_purchase(
            actor=admin,
            purchase_id=draft["id"],
            payload={**base_payload, "idempotency_key": "cc-confirm-003"},
        ),
    )
    assert kinds(results) == ["ok", "ok"]
    assert {r[1].body["internal_number"] for r in results} == {"COM-ING-000001"}
    assert (InventoryMovement.objects.count(), NumberAllocation.objects.count()) == (1, 1)
    assert ConfigurationUse.objects.count() == 1
    assert InventoryPosition.objects.get().quantity == D(2)


def test_simultaneous_duplicate_drafts_persist_at_most_one(
    run_parallel: Any, admin: Any, draft_payload: Any
) -> None:
    results = run_parallel(
        lambda: purchases.create_draft(
            actor=admin, payload=draft_payload(supplier_reference="DUP-1")
        ),
        lambda: purchases.create_draft(
            actor=admin, payload=draft_payload(supplier_reference=" dup-1 ")
        ),
    )
    assert kinds(results) == ["duplicate_supplier_document", "ok"]
    assert Purchase.objects.count() == 1


def test_two_replacements_of_the_same_voided_document_confirm_at_most_one(
    run_parallel: Any, admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    original = create(
        admin, draft_payload([line(product, commercial["ten"])], supplier_reference="F-1")
    )
    done = confirmed(admin, original, "cc-confirm-004")
    review = purchases.void_preview(actor=admin, purchase_id=done["id"])
    purchases.void_purchase(
        actor=admin,
        purchase_id=done["id"],
        payload={
            "idempotency_key": "cc-void-0001",
            "expected_version": done["version"],
            "review_token": review["review_token"],
            "reason": "Error",
        },
    )
    first = purchases.create_replacement(
        actor=admin, purchase_id=done["id"], payload={"idempotency_key": "cc-repl-0001"}
    ).body
    second = purchases.create_replacement(
        actor=admin, purchase_id=done["id"], payload={"idempotency_key": "cc-repl-0002"}
    ).body
    payloads = [reviewed(admin, first, "cc-confirm-005"), reviewed(admin, second, "cc-confirm-006")]
    numbers_before = NumberAllocation.objects.count()
    results = run_parallel(
        lambda: purchases.confirm_purchase(
            actor=admin, purchase_id=first["id"], payload=payloads[0]
        ),
        lambda: purchases.confirm_purchase(
            actor=admin, purchase_id=second["id"], payload=payloads[1]
        ),
    )
    assert kinds(results) == ["duplicate_supplier_document", "ok"]
    assert Purchase.objects.filter(state="CONFIRMED").count() == 1
    assert NumberAllocation.objects.count() == numbers_before + 1  # no se consume otro número
    assert InventoryPosition.objects.get().quantity == D(2)


def confirmed_purchase(
    admin: Any,
    commercial: Any,
    draft_payload: Any,
    product: Any,
    line: Any,
    key: str,
    quantity: str = "5",
) -> dict[str, Any]:
    draft = create(admin, draft_payload([line(product, commercial["ten"], quantity, "1.00")]))
    return confirmed(admin, draft, key)


def exit_units(actor: Any, product: Any, warehouse: Any, quantity: int) -> Any:
    from catalog.application.inventory_references import lock_product_references

    with transaction.atomic():
        refs = lock_product_references([product.pk], require_active=False)
        operation = posting.prepare_operation(
            kind="ADJUSTMENT_OUT",
            actor=actor,
            source_type="",
            source_id=None,
            exit_lines=[posting.ExitLine(product.pk, D(quantity))],
        )
        posting.post_operation(
            operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs
        )


def test_void_and_exit_on_the_same_product_yield_one_valid_order(
    run_parallel: Any,
    admin: Any,
    commercial: Any,
    draft_payload: Any,
    product: Any,
    line: Any,
    warehouse: Any,
) -> None:
    done = confirmed_purchase(admin, commercial, draft_payload, product, line, "cc-confirm-007")
    review = purchases.void_preview(actor=admin, purchase_id=done["id"])
    void_payload = {
        "idempotency_key": "cc-void-0002",
        "expected_version": done["version"],
        "review_token": review["review_token"],
        "reason": "Error",
    }
    results = run_parallel(
        lambda: purchases.void_purchase(actor=admin, purchase_id=done["id"], payload=void_payload),
        lambda: exit_units(admin, product, warehouse, 5),
    )
    outcome = kinds(results)
    assert outcome.count("ok") == 1, outcome  # exactamente una operación prospera
    position = InventoryPosition.objects.get()
    assert position.quantity >= 0
    voided = Purchase.objects.get(pk=done["id"]).state == "VOIDED"
    assert position.quantity == 0
    assert InventoryOperation.objects.filter(kind="REVERSAL").count() == (1 if voided else 0)


def test_two_competing_voids_produce_one_compensation(
    run_parallel: Any, admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    done = confirmed_purchase(admin, commercial, draft_payload, product, line, "cc-confirm-008")
    review = purchases.void_preview(actor=admin, purchase_id=done["id"])

    def void(key: str) -> Any:
        return purchases.void_purchase(
            actor=admin,
            purchase_id=done["id"],
            payload={
                "idempotency_key": key,
                "expected_version": done["version"],
                "review_token": review["review_token"],
                "reason": "Error",
            },
        )

    results = run_parallel(lambda: void("cc-void-0003"), lambda: void("cc-void-0004"))
    assert kinds(results) == ["ok", "ok"]
    assert InventoryOperation.objects.filter(kind="REVERSAL").count() == 1
    assert InventoryPosition.objects.get().quantity == 0


def test_product_deactivation_versus_confirmation_is_an_equivalent_serial_order(
    run_parallel: Any, admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    payload = reviewed(admin, draft, "cc-confirm-009")

    def deactivate() -> Any:
        return catalog_products.set_product_active(
            product.pk,
            active=False,
            actor=admin,
            payload={"expected_version": product.version, "idempotency_key": "cc-deact-0001"},
        )

    results = run_parallel(
        lambda: purchases.confirm_purchase(actor=admin, purchase_id=draft["id"], payload=payload),
        deactivate,
    )
    state = Purchase.objects.get(pk=draft["id"]).state
    movements = InventoryMovement.objects.count()
    if state == "CONFIRMED":
        assert movements == 1  # confirmar antes de la baja
    else:
        assert movements == 0  # rechazada después de la baja, sin recepción parcial
        assert kinds(results).count("inactive_reference") == 1
    from catalog.models import Product

    assert Product.objects.get(pk=product.pk).is_active is False


def test_series_replacement_and_tax_succession_versus_confirmation_do_not_conflict(
    run_parallel: Any, admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    from datetime import date, timedelta

    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    payload = reviewed(admin, draft, "cc-confirm-010")
    period = TaxPeriod.objects.get(tax_definition=commercial["ten"], ends_on__isnull=True)
    results = run_parallel(
        lambda: purchases.confirm_purchase(actor=admin, purchase_id=draft["id"], payload=payload),
        lambda: replace_series(
            actor=admin, series_id=commercial["series"].pk, expected_version=1, new_code="COM-ING2"
        ),
        lambda: schedule_successor(
            actor=admin,
            period_id=period.pk,
            expected_version=period.version,
            new_rate="12",
            successor_starts_on=date.today() + timedelta(days=30),
        ),
    )
    assert kinds(results) == ["ok", "ok", "ok"]
    confirmed_purchase_row = Purchase.objects.get(pk=draft["id"])
    assert confirmed_purchase_row.state == "CONFIRMED"
    assert confirmed_purchase_row.internal_number in {"COM-ING-000001", "COM-ING2-000001"}
    assert DocumentSeries.objects.filter(is_active=True).count() == 1


def test_confirmations_with_products_in_reverse_order_do_not_deadlock(
    run_parallel: Any, admin: Any, commercial: Any, draft_payload: Any, line: Any, make_product: Any
) -> None:
    items = [make_product() for _ in range(3)]
    first = create(admin, draft_payload([line(p, commercial["ten"]) for p in items]))
    second = create(admin, draft_payload([line(p, commercial["ten"]) for p in reversed(items)]))
    payloads = [reviewed(admin, first, "cc-confirm-011"), reviewed(admin, second, "cc-confirm-012")]
    results = run_parallel(
        lambda: purchases.confirm_purchase(
            actor=admin, purchase_id=first["id"], payload=payloads[0]
        ),
        lambda: purchases.confirm_purchase(
            actor=admin, purchase_id=second["id"], payload=payloads[1]
        ),
    )
    assert kinds(results) == ["ok", "ok"]
    assert {p.quantity for p in InventoryPosition.objects.all()} == {D(4)}
    assert sorted(str(n) for n in Purchase.objects.values_list("internal_number", flat=True)) == [
        "COM-ING-000001",
        "COM-ING-000002",
    ]
    assert not [r for r in results if isinstance(r[1], PurchaseApplicationError)]
