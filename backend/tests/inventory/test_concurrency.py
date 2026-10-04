"""Concurrencia real sobre PostgreSQL: saldos, cargas iniciales, anulaciones y Kardex."""

from decimal import Decimal
from typing import Any

import pytest
from django.db import transaction

from catalog.application.inventory_references import lock_product_references
from inventory.application import operations, posting, queries
from inventory.application.errors import InventoryApplicationError
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition

pytestmark = pytest.mark.django_db(transaction=True)
D = Decimal


def post_direct(
    actor: Any, product: Any, warehouse: Any, kind: str, quantity: int, cost: str = "1.00"
) -> Any:
    """Unidad completa del núcleo: bloquea el producto, la posición y publica."""
    with transaction.atomic():
        refs = lock_product_references([product.pk], require_active=False)
        args: dict[str, Any] = (
            {"entry_lines": [posting.EntryLine(product.pk, D(quantity), D(cost) * quantity)]}
            if kind.endswith("_IN")
            else {"exit_lines": [posting.ExitLine(product.pk, D(quantity))]}
        )
        operation = posting.prepare_operation(
            kind=kind, actor=actor, source_type="", source_id=None, **args
        )
        posting.post_operation(
            operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs
        )
    return operation.pk


def seed(actor: Any, product: Any, warehouse: Any, quantity: int) -> None:
    post_direct(actor, product, warehouse, "ADJUSTMENT_IN", quantity)


def kinds(results: list[tuple[str, Any]]) -> list[str]:
    return sorted("ok" if status == "ok" else type(value).__name__ for status, value in results)


def test_two_exits_of_four_on_stock_five_confirm_at_most_one(
    run_parallel: Any, actor: Any, product: Any, warehouse: Any
) -> None:
    seed(actor, product, warehouse, 5)
    results = run_parallel(
        lambda: post_direct(actor, product, warehouse, "ADJUSTMENT_OUT", 4),
        lambda: post_direct(actor, product, warehouse, "ADJUSTMENT_OUT", 4),
    )
    assert kinds(results) == ["InsufficientStockError", "ok"]
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value) == (D(1), D("1.000000"))
    assert InventoryMovement.objects.count() == 2  # entrada inicial + una sola salida
    assert InventoryOperation.objects.filter(state="POSTED").count() == 2


def test_entry_of_three_and_exit_of_four_on_stock_two_never_go_negative(
    run_parallel: Any, actor: Any, product: Any, warehouse: Any
) -> None:
    seed(actor, product, warehouse, 2)
    results = run_parallel(
        lambda: post_direct(actor, product, warehouse, "ADJUSTMENT_IN", 3),
        lambda: post_direct(actor, product, warehouse, "ADJUSTMENT_OUT", 4),
    )
    position = InventoryPosition.objects.get()
    assert position.quantity in {D(1), D(5)}
    assert position.quantity >= 0
    outcome = kinds(results)
    assert outcome in (["ok", "ok"], ["InsufficientStockError", "ok"])
    assert (position.quantity == D(1)) == (outcome == ["ok", "ok"])
    ordinals = list(InventoryMovement.objects.order_by("ordinal").values_list("ordinal", flat=True))
    assert ordinals == list(range(1, len(ordinals) + 1))


def prepared_load(admin: Any, product: Any, key: str) -> dict[str, Any]:
    return operations.create_operation(
        actor=admin,
        payload={
            "idempotency_key": key,
            "kind": "INITIAL_LOAD",
            "product_id": product.pk,
            "quantity": "5",
            "unit_cost": "2.00",
            "reason": "Carga inicial",
        },
    ).body


def confirm_load(admin: Any, body: dict[str, Any], key: str) -> Any:
    review = operations.preview_operation(actor=admin, operation_id=body["id"])
    return operations.confirm_operation(
        actor=admin,
        operation_id=body["id"],
        payload={
            "idempotency_key": key,
            "expected_version": body["version"],
            "review_token": review["review_token"],
        },
    )


def test_two_simultaneous_initial_loads_of_the_same_product_accept_at_most_one(
    run_parallel: Any, admin: Any, product: Any, warehouse: Any
) -> None:
    first = prepared_load(admin, product, "conc-prep-0001")
    second = prepared_load(admin, product, "conc-prep-0002")
    tokens = [
        operations.preview_operation(actor=admin, operation_id=b["id"])["review_token"]
        for b in (first, second)
    ]

    def confirm(body: dict[str, Any], token: str, key: str) -> Any:
        return operations.confirm_operation(
            actor=admin,
            operation_id=body["id"],
            payload={
                "idempotency_key": key,
                "expected_version": body["version"],
                "review_token": token,
            },
        )

    results = run_parallel(
        lambda: confirm(first, tokens[0], "conc-conf-0001"),
        lambda: confirm(second, tokens[1], "conc-conf-0002"),
    )
    assert kinds(results) == ["InventoryApplicationError", "ok"]
    failure = next(v for s, v in results if s == "error")
    assert isinstance(failure, InventoryApplicationError)
    assert failure.code in {"already_initialized", "review_required"}
    assert InventoryMovement.objects.filter(movement_type="INITIAL_LOAD").count() == 1
    assert InventoryPosition.objects.get().quantity == D(5)


def test_a_repeated_confirmation_with_another_key_confirms_only_once(
    run_parallel: Any, admin: Any, product: Any, warehouse: Any
) -> None:
    body = prepared_load(admin, product, "conc-prep-0003")
    token = operations.preview_operation(actor=admin, operation_id=body["id"])["review_token"]

    def confirm(key: str) -> Any:
        return operations.confirm_operation(
            actor=admin,
            operation_id=body["id"],
            payload={
                "idempotency_key": key,
                "expected_version": body["version"],
                "review_token": token,
            },
        )

    results = run_parallel(lambda: confirm("conc-conf-0003"), lambda: confirm("conc-conf-0004"))
    assert kinds(results) == ["ok", "ok"]
    assert InventoryMovement.objects.count() == 1
    assert InventoryPosition.objects.get().quantity == D(5)


def test_two_competing_manual_reversals_produce_one_compensation(
    run_parallel: Any, admin: Any, product: Any, warehouse: Any
) -> None:
    body = prepared_load(admin, product, "conc-prep-0004")
    confirmed = confirm_load(admin, body, "conc-conf-0005").body
    review = operations.reverse_preview(actor=admin, operation_id=confirmed["id"])

    def reverse(key: str) -> Any:
        return operations.reverse_manual_operation(
            actor=admin,
            operation_id=confirmed["id"],
            payload={
                "idempotency_key": key,
                "expected_version": confirmed["version"],
                "review_token": review["review_token"],
                "reason": "Error",
            },
        )

    results = run_parallel(lambda: reverse("conc-rev-0001"), lambda: reverse("conc-rev-0002"))
    assert kinds(results) == ["ok", "ok"]
    assert InventoryOperation.objects.filter(kind="REVERSAL").count() == 1
    assert InventoryPosition.objects.get().quantity == 0


def test_operations_over_several_products_in_reverse_order_do_not_deadlock(
    run_parallel: Any, actor: Any, warehouse: Any, make_product: Any
) -> None:
    products = [make_product() for _ in range(4)]

    def receive(ordered: list[Any]) -> Any:
        with transaction.atomic():
            refs = lock_product_references([p.pk for p in ordered], require_active=False)
            operation = posting.prepare_operation(
                kind="ADJUSTMENT_IN",
                actor=actor,
                source_type="",
                source_id=None,
                entry_lines=[posting.EntryLine(p.pk, D(1), D("1.00")) for p in ordered],
            )
            posting.post_operation(
                operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs
            )

    results = run_parallel(lambda: receive(products), lambda: receive(list(reversed(products))))
    assert kinds(results) == ["ok", "ok"]  # sin ciclos: nunca depende de traducir un deadlock
    assert {p.quantity for p in InventoryPosition.objects.all()} == {D(2)}


def test_kardex_pages_keep_one_cut_while_another_user_posts(
    run_parallel: Any, actor: Any, product: Any, warehouse: Any
) -> None:
    for _ in range(5):
        post_direct(actor, product, warehouse, "ADJUSTMENT_IN", 1)
    first = queries.kardex(product_id=product.pk, include_valuation=False, page_size=2)
    token = first["cut"]["token"]

    def read_pages() -> list[dict[str, Any]]:
        return [
            queries.kardex(
                product_id=product.pk,
                include_valuation=False,
                page=page,
                page_size=2,
                cut_token=token,
            )
            for page in (1, 2, 3)
        ]

    def keep_posting() -> None:
        for _ in range(4):
            post_direct(actor, product, warehouse, "ADJUSTMENT_IN", 1)

    results = run_parallel(read_pages, keep_posting)
    assert kinds(results) == ["ok", "ok"]
    pages = results[0][1]
    assert {p["count"] for p in pages} == {5}
    assert {p["closing_quantity"] for p in pages} == {"5"}
    assert [row["ordinal"] for p in pages for row in p["results"]] == [1, 2, 3, 4, 5]
    assert InventoryPosition.objects.get().quantity == D(9)


def test_a_costed_and_a_costless_entry_of_the_same_product_settle_in_a_valid_order(
    run_parallel: Any, actor: Any, product: Any, warehouse: Any
) -> None:
    seed(actor, product, warehouse, 10)  # 10 unidades a 1.00

    def costless() -> Any:
        with transaction.atomic():
            refs = lock_product_references([product.pk], require_active=False)
            operation = posting.prepare_operation(
                kind="PURCHASE_RECEIPT",
                actor=actor,
                source_type="",
                source_id=None,
                entry_lines=[posting.EntryLine(product.pk, D(5), None)],
            )
            posting.post_operation(
                operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs
            )
        return operation.pk

    results = run_parallel(
        lambda: post_direct(actor, product, warehouse, "ADJUSTMENT_IN", 5, "3.00"),
        costless,
    )
    assert kinds(results) == ["ok", "ok"]
    position = InventoryPosition.objects.get()
    assert position.quantity == D(20)
    assert position.valued is True
    # Con costo primero: 25.00 y luego 5 al promedio 1.666667; sin costo primero: 15.00 + 15.00.
    assert position.value in {D("33.333335"), D("30.000000")}
    movements = list(InventoryMovement.objects.order_by("ordinal"))
    assert [m.quantity_after for m in movements] == [D(10), movements[1].quantity_after, D(20)]
