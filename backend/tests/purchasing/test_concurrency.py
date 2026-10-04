"""Concurrencia real: entradas simultáneas, reintentos, bajas y anulaciones."""

from decimal import Decimal
from typing import Any

import pytest

from catalog.application import products as catalog_products
from catalog.models import Product
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition
from purchasing.application import entries, purchases
from purchasing.application.commands import IdempotencyConflictError
from purchasing.application.errors import PurchaseApplicationError
from purchasing.models import Purchase
from workshop_configuration.application.series import replace_series
from workshop_configuration.models import DocumentSeries

pytestmark = pytest.mark.django_db(transaction=True)
D = Decimal


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Any) -> None:
    """Contexto comercial, bodega y serie COM-ING."""


def kinds(results: list[tuple[str, Any]]) -> list[str]:
    return sorted("ok" if s == "ok" else getattr(v, "code", type(v).__name__) for s, v in results)


def payload(key: str, *items: tuple[Any, str, str | None], **extra: Any) -> dict[str, Any]:
    lines = []
    for product, quantity, cost in items:
        line: dict[str, Any] = {"product_id": product.pk, "quantity": quantity}
        if cost is not None:
            line["unit_cost"] = cost
        lines.append(line)
    return {"idempotency_key": key, "lines": lines, **extra}


def test_entries_of_the_same_product_by_two_users_settle_with_unique_numbers(
    run_parallel: Any, admin: Any, seller: Any, product: Any
) -> None:
    results = run_parallel(
        lambda: entries.register_entry(
            actor=seller, payload=payload("cc-entry-0001", (product, "4", "2.00"))
        ),
        lambda: entries.register_entry(
            actor=admin, payload=payload("cc-entry-0002", (product, "6", None))
        ),
    )
    assert kinds(results) == ["ok", "ok"]
    assert sorted(str(n) for n in Purchase.objects.values_list("internal_number", flat=True)) == [
        "COM-ING-000001",
        "COM-ING-000002",
    ]
    position = InventoryPosition.objects.get()
    assert position.quantity == D(10)
    movements = list(InventoryMovement.objects.order_by("ordinal"))
    assert [m.quantity_before for m in movements] == [D(0), movements[1].quantity_before]
    assert movements[-1].quantity_after == D(10)


def test_the_same_request_sent_twice_at_once_creates_one_entry(
    run_parallel: Any, seller: Any, product: Any
) -> None:
    body = payload("cc-entry-0003", (product, "3", "1.00"))
    results = run_parallel(
        lambda: entries.register_entry(actor=seller, payload=body),
        lambda: entries.register_entry(actor=seller, payload=body),
    )
    assert Purchase.objects.count() == 1
    assert InventoryOperation.objects.filter(kind="PURCHASE_RECEIPT").count() == 1
    assert InventoryPosition.objects.get().quantity == D(3)
    successes = [v for s, v in results if s == "ok"]
    assert successes
    assert all(v.body["id"] == successes[0].body["id"] for v in successes)
    assert not [v for s, v in results if s != "ok" and not isinstance(v, IdempotencyConflictError)]


def test_reusing_a_key_with_other_content_conflicts_under_concurrency(
    run_parallel: Any, seller: Any, product: Any
) -> None:
    results = run_parallel(
        lambda: entries.register_entry(
            actor=seller, payload=payload("cc-entry-0004", (product, "3", None))
        ),
        lambda: entries.register_entry(
            actor=seller, payload=payload("cc-entry-0004", (product, "5", None))
        ),
    )
    assert Purchase.objects.count() == 1
    assert sorted(s for s, _ in results) == ["error", "ok"]


def test_product_deactivation_versus_an_entry_is_an_equivalent_serial_order(
    run_parallel: Any, admin: Any, seller: Any, product: Any
) -> None:
    def deactivate() -> Any:
        return catalog_products.set_product_active(
            product.pk,
            active=False,
            actor=admin,
            payload={"expected_version": product.version, "idempotency_key": "cc-deact-0001"},
        )

    results = run_parallel(
        lambda: entries.register_entry(
            actor=seller, payload=payload("cc-entry-0005", (product, "2", None))
        ),
        deactivate,
    )
    movements = InventoryMovement.objects.count()
    if Purchase.objects.count() == 1:
        assert movements == 1  # la entrada precede a la baja
    else:
        assert movements == 0  # rechazada después de la baja, sin recepción parcial
        assert kinds(results).count("inactive_reference") == 1
    assert Product.objects.get(pk=product.pk).is_active is False


def test_a_void_versus_a_newer_entry_of_the_same_product_keeps_a_valid_order(
    run_parallel: Any, admin: Any, seller: Any, product: Any
) -> None:
    first = entries.register_entry(
        actor=seller, payload=payload("cc-entry-0006", (product, "5", "1.00"))
    ).body
    review = purchases.void_preview(actor=admin, purchase_id=first["id"])

    def void() -> Any:
        return purchases.void_purchase(
            actor=admin,
            purchase_id=first["id"],
            payload={
                "idempotency_key": "cc-void-0001",
                "expected_version": first["version"],
                "review_token": review["review_token"],
                "reason": "Error",
            },
        )

    results = run_parallel(
        void,
        lambda: entries.register_entry(
            actor=seller, payload=payload("cc-entry-0007", (product, "2", "1.00"))
        ),
    )
    position = InventoryPosition.objects.get()
    state = Purchase.objects.get(pk=first["id"]).state
    if state == "VOIDED":
        assert position.quantity == D(2)
        assert kinds(results) == ["ok", "ok"]
    else:
        assert position.quantity == D(7)  # la anulación se bloqueó por el movimiento posterior
        assert any(isinstance(v, PurchaseApplicationError) for s, v in results if s != "ok")
    assert position.quantity >= 0


def test_series_replacement_versus_an_entry_does_not_conflict(
    run_parallel: Any, admin: Any, seller: Any, commercial: Any, product: Any
) -> None:
    results = run_parallel(
        lambda: entries.register_entry(
            actor=seller, payload=payload("cc-entry-0008", (product, "2", None))
        ),
        lambda: replace_series(
            actor=admin, series_id=commercial["series"].pk, expected_version=1, new_code="COM-ING2"
        ),
    )
    assert kinds(results) == ["ok", "ok"]
    purchase = Purchase.objects.get()
    assert purchase.internal_number in {"COM-ING-000001", "COM-ING2-000001"}
    assert DocumentSeries.objects.filter(is_active=True).count() == 1


def test_entries_with_products_in_reverse_order_do_not_deadlock(
    run_parallel: Any, admin: Any, seller: Any, make_product: Any
) -> None:
    items = [make_product() for _ in range(3)]
    results = run_parallel(
        lambda: entries.register_entry(
            actor=seller,
            payload=payload("cc-entry-0009", *[(p, "1", None) for p in items]),
        ),
        lambda: entries.register_entry(
            actor=admin,
            payload=payload("cc-entry-0010", *[(p, "3", None) for p in reversed(items)]),
        ),
    )
    assert kinds(results) == ["ok", "ok"]
    assert {p.quantity for p in InventoryPosition.objects.all()} == {D(4)}
    assert sorted(str(n) for n in Purchase.objects.values_list("internal_number", flat=True)) == [
        "COM-ING-000001",
        "COM-ING-000002",
    ]


def test_identical_entries_at_once_are_both_allowed_because_the_warning_does_not_block(
    run_parallel: Any, admin: Any, seller: Any, product: Any
) -> None:
    results = run_parallel(
        lambda: entries.register_entry(
            actor=seller, payload=payload("cc-entry-0011", (product, "2", None))
        ),
        lambda: entries.register_entry(
            actor=admin, payload=payload("cc-entry-0012", (product, "2", None))
        ),
    )
    # La advertencia de coincidencia es de ayuda, no un bloqueo: en carrera pueden pasar ambas.
    assert kinds(results).count("ok") >= 1
