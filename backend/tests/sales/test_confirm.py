"""Confirmación atómica: número COM-VEN, salidas, asignaciones de costo e importe exigible."""

from datetime import date
from decimal import Decimal
from itertools import count
from typing import Any

import pytest

from catalog.models import Product
from identity.models import AuditEvent
from inventory.application import posting
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition
from sales.application import reviews, sales
from sales.application.commands import IdempotencyConflictError
from sales.application.errors import SalesApplicationError
from sales.models import (
    CommercialPayment,
    Sale,
    SaleCostAllocation,
    SaleLine,
    SalesCommand,
)
from workshop_configuration.models import (
    ConfigurationUse,
    DocumentSeries,
    NumberAllocation,
    NumberingScope,
    TaxPeriod,
    Warehouse,
)

pytestmark = pytest.mark.django_db
D = Decimal
_keys = count(1)


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Toda confirmación requiere contexto comercial, bodega y serie COM-VEN."""


def make_draft(
    actor: Any, customer: Any, lines: list[tuple[Any, str]], condition: str = "CREDITO"
) -> dict[str, Any]:
    payload = {
        "idempotency_key": f"cf-draft-{next(_keys):06d}",
        "customer_id": customer.pk,
        "condition": condition,
        "lines": [{"product_id": p.pk, "quantity": q} for p, q in lines],
    }
    return sales.create_draft(actor=actor, payload=payload).body


def confirm(actor: Any, draft: dict[str, Any], key: str | None = None, **extra: Any) -> Any:
    review = reviews.preview_confirmation(actor=actor, sale_id=draft["id"])
    assert review["can_confirm"], review["issues"]
    payload = {
        "idempotency_key": key or f"cf-key-{next(_keys):06d}",
        "expected_version": draft["version"],
        "review_token": review["review_token"],
        **extra,
    }
    return sales.confirm_sale(actor=actor, sale_id=draft["id"], payload=payload)


@pytest.fixture
def two_products(make_product: Any, stock: Any) -> tuple[Any, Any]:
    a, b = make_product(), make_product(sale_price=D("5.00"))
    stock(a, 10, "40.00")
    stock(b, 4, "10.00")
    return a, b


def test_valid_confirmation_with_several_products_records_everything_together(
    seller: Any, customer: Any, two_products: Any
) -> None:
    a, b = two_products
    draft = make_draft(seller, customer, [(a, "2"), (b, "3")])
    outcome = confirm(seller, draft)
    body = outcome.body
    assert body["state"] == "CONFIRMED"
    assert body["internal_number"] == "COM-VEN-000001"
    assert body["grand_total"] == "38.00"  # 2 x 11.50 + 3 x 5.00
    assert (body["base_total"], body["tax_total"]) == ("33.04", "4.96")
    first, second = body["lines"]
    assert (first["unit_price"], first["total_amount"], first["tax_rate"]) == (
        "11.50",
        "23.00",
        "15",
    )
    assert (second["total_amount"], second["base_amount"]) == ("15.00", "13.04")
    sale = Sale.objects.get()
    assert sale.customer_snapshot is not None
    assert sale.fiscal_snapshot is not None
    assert sale.customer_snapshot["name"] == customer.name
    assert sale.fiscal_snapshot["series_code"] == "COM-VEN"
    assert sale.fiscal_snapshot["entity"]["type"] == "COMERCIAL"
    line = SaleLine.objects.get(position=1)
    assert line.product_snapshot is not None
    assert line.tax_snapshot is not None
    assert line.product_snapshot["code"] == a.code
    assert line.tax_snapshot["code"] == "IVA"
    movements = InventoryMovement.objects.filter(movement_type="SALE_OUT").order_by("product_id")
    assert [m.quantity_out for m in movements] == [D(2), D(3)]
    operation = InventoryOperation.objects.get(kind="SALE_OUT")
    assert (operation.source_type, operation.source_id) == ("SALE", sale.pk)
    assert sale.inventory_operation_id == operation.pk
    allocations = SaleCostAllocation.objects.order_by("sale_line__position")
    assert [x.applied_value for x in allocations] == [D("8.000000"), D("7.500000")]
    assert InventoryPosition.objects.get(product=a).quantity == D(8)
    assert NumberAllocation.objects.filter(consumer_type="sale").count() == 1
    assert ConfigurationUse.objects.filter(consumer_type="sale").count() == 1
    assert AuditEvent.objects.filter(action="sales.sale_confirmed", target_id=str(sale.pk)).exists()
    assert CommercialPayment.objects.count() == 0
    assert SalesCommand.objects.filter(action="sales.sale_confirmed").count() == 1


def test_repeated_lines_of_the_same_product_split_the_published_value_exactly(
    seller: Any, customer: Any, make_product: Any, stock: Any
) -> None:
    product = make_product()
    stock(product, 3, "10.000001")
    draft = make_draft(seller, customer, [(product, "1"), (product, "2")])
    confirm(seller, draft)
    movement = InventoryMovement.objects.get(movement_type="SALE_OUT")
    allocations = SaleCostAllocation.objects.order_by("sale_line__position")
    assert len(allocations) == 2
    assert sum(x.applied_value for x in allocations) == -movement.value_delta
    assert all(x.movement_id == movement.pk for x in allocations)


def test_confirmed_sale_is_pending_payment_and_an_internal_document(
    seller: Any, customer: Any, two_products: Any
) -> None:
    a, _ = two_products
    body = confirm(seller, make_draft(seller, customer, [(a, "1")])).body
    assert body["state"] == "CONFIRMED"
    assert body["fiscal_scope"] == "COMERCIAL"
    assert CommercialPayment.objects.count() == 0
    assert "sri" not in " ".join(body).lower()


def test_insufficient_stock_in_one_line_rejects_the_whole_sale_without_effects(
    seller: Any, customer: Any, two_products: Any
) -> None:
    a, b = two_products
    draft = make_draft(seller, customer, [(a, "2"), (b, "4")])
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    token = review["review_token"]
    from inventory.application import posting
    from inventory.models import InventoryPosition as Position

    # otra venta agota el segundo producto entre la revisión y la confirmación
    Position.objects.filter(product=b).update(quantity=D(1))
    with pytest.raises(SalesApplicationError) as error:
        sales.confirm_sale(
            actor=seller,
            sale_id=draft["id"],
            payload={
                "idempotency_key": "cf-key-insuff-1",
                "expected_version": 1,
                "review_token": token,
            },
        )
    assert error.value.code == "insufficient_stock"
    assert "lines.1.quantity" in error.value.errors
    assert InventoryMovement.objects.filter(movement_type="SALE_OUT").count() == 0
    assert Position.objects.get(product=a).quantity == D(10)
    assert NumberAllocation.objects.filter(consumer_type="sale").count() == 0
    assert Sale.objects.get().state == "DRAFT"
    assert posting  # interfaz pública usada solo para claridad del escenario


def test_absent_tax_rate_is_never_interpreted_as_zero(
    seller: Any, customer: Any, two_products: Any
) -> None:
    a, _ = two_products
    draft = make_draft(seller, customer, [(a, "1")])
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    TaxPeriod.objects.filter(tax_definition=a.tax_definition).delete()
    with pytest.raises(SalesApplicationError) as error:
        sales.confirm_sale(
            actor=seller,
            sale_id=draft["id"],
            payload={
                "idempotency_key": "cf-key-norate-1",
                "expected_version": 1,
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "configuration_missing"
    assert "lines.0.product_id" in error.value.errors
    assert NumberAllocation.objects.count() == 0
    assert InventoryMovement.objects.filter(movement_type="SALE_OUT").count() == 0
    assert reviews.preview_confirmation(actor=seller, sale_id=draft["id"])["can_confirm"] is False


def test_missing_series_or_entity_is_reported_without_number_or_movement(
    seller: Any, customer: Any, two_products: Any, commercial: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    a, _ = two_products
    draft = make_draft(seller, customer, [(a, "1")])
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    NumberingScope.objects.filter(pk=commercial["scope"].pk).update(document_type="PROFORMA")
    with pytest.raises(SalesApplicationError) as error:
        sales.confirm_sale(
            actor=seller,
            sale_id=draft["id"],
            payload={
                "idempotency_key": "cf-key-noseries",
                "expected_version": 1,
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "configuration_missing"
    assert "series" in error.value.errors
    DocumentSeries.objects.filter(pk=commercial["series"].pk).update(is_active=False)
    assert NumberAllocation.objects.count() == 0
    assert InventoryMovement.objects.filter(movement_type="SALE_OUT").count() == 0
    assert Sale.objects.get().state == "DRAFT"


def test_day_change_after_locking_requires_a_new_review_without_consuming_a_number(
    seller: Any, customer: Any, two_products: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    a, _ = two_products
    draft = make_draft(seller, customer, [(a, "1")])
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    days = iter([date(2026, 9, 20), date(2026, 9, 21)])
    monkeypatch.setattr(reviews, "today", lambda: next(days))
    with pytest.raises(SalesApplicationError) as error:
        sales.confirm_sale(
            actor=seller,
            sale_id=draft["id"],
            payload={
                "idempotency_key": "cf-key-midnight",
                "expected_version": 1,
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "review_required"
    assert NumberAllocation.objects.count() == 0
    assert InventoryMovement.objects.filter(movement_type="SALE_OUT").count() == 0
    assert Sale.objects.get().state == "DRAFT"


def test_rate_change_between_review_and_confirmation_requires_a_new_review(
    seller: Any, customer: Any, two_products: Any
) -> None:
    a, _ = two_products
    draft = make_draft(seller, customer, [(a, "2")])
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    TaxPeriod.objects.filter(tax_definition=a.tax_definition).update(rate=D("12"))
    with pytest.raises(SalesApplicationError) as error:
        sales.confirm_sale(
            actor=seller,
            sale_id=draft["id"],
            payload={
                "idempotency_key": "cf-key-newrate",
                "expected_version": 1,
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "review_required"
    fresh = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    assert fresh["lines"][0]["tax_rate"] == "12"
    assert fresh["totals"]["total"] == "23.00"
    assert fresh["totals"]["tax"] != review["totals"]["tax"]
    body = sales.confirm_sale(
        actor=seller,
        sale_id=draft["id"],
        payload={
            "idempotency_key": "cf-key-newrate2",
            "expected_version": 1,
            "review_token": fresh["review_token"],
        },
    ).body
    assert body["lines"][0]["tax_rate"] == "12"


def test_catalog_price_change_requires_a_new_review_with_current_totals(
    seller: Any, customer: Any, two_products: Any
) -> None:
    a, _ = two_products
    draft = make_draft(seller, customer, [(a, "1")])
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    Product.objects.filter(pk=a.pk).update(sale_price=D("12.00"))
    with pytest.raises(SalesApplicationError) as error:
        sales.confirm_sale(
            actor=seller,
            sale_id=draft["id"],
            payload={
                "idempotency_key": "cf-key-price-1",
                "expected_version": 1,
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "review_required"
    assert InventoryMovement.objects.filter(movement_type="SALE_OUT").count() == 0


@pytest.mark.parametrize(
    "target",
    [
        "sales.application.sales.allocate_number",
        "sales.application.sales.resolve_configuration",
        "sales.application.sales.posting.post_operation",
        "sales.application.sales.record_allocations",
        "sales.application.commands.record_success",
        "receipt",
    ],
)
def test_an_injected_failure_in_any_effect_rolls_back_the_whole_attempt(
    seller: Any,
    customer: Any,
    two_products: Any,
    monkeypatch: pytest.MonkeyPatch,
    target: str,
) -> None:
    a, _ = two_products
    draft = make_draft(seller, customer, [(a, "2")])
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])

    def boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("fallo inyectado")

    if target == "receipt":
        original_save = SalesCommand.save

        def failing_save(self: SalesCommand, *args: Any, **kwargs: Any) -> None:
            if kwargs.get("update_fields"):
                boom()
            original_save(self, *args, **kwargs)

        monkeypatch.setattr(SalesCommand, "save", failing_save)
    else:
        import importlib

        module_path, _, attribute = target.rpartition(".")
        try:
            module = importlib.import_module(module_path)
        except ModuleNotFoundError:
            parent, _, child = module_path.rpartition(".")
            module = getattr(importlib.import_module(parent), child)
        monkeypatch.setattr(module, attribute, boom)
    payload = {
        "idempotency_key": "cf-key-inject-1",
        "expected_version": 1,
        "review_token": review["review_token"],
    }
    with pytest.raises(RuntimeError):
        sales.confirm_sale(actor=seller, sale_id=draft["id"], payload=payload)
    monkeypatch.undo()
    sale = Sale.objects.get()
    assert (sale.state, sale.internal_number, sale.version) == ("DRAFT", None, 1)
    assert InventoryMovement.objects.filter(movement_type="SALE_OUT").count() == 0
    assert InventoryPosition.objects.get(product=a).quantity == D(10)
    assert NumberAllocation.objects.filter(consumer_type="sale").count() == 0
    assert ConfigurationUse.objects.filter(consumer_type="sale").count() == 0
    assert SaleCostAllocation.objects.count() == 0
    assert not SalesCommand.objects.filter(action="sales.sale_confirmed").exists()
    assert not AuditEvent.objects.filter(action="sales.sale_confirmed", result="SUCCESS").exists()
    retried = sales.confirm_sale(actor=seller, sale_id=draft["id"], payload=payload)
    assert retried.body["state"] == "CONFIRMED"


def test_idempotent_replay_and_conflicting_reuse(
    seller: Any, customer: Any, two_products: Any
) -> None:
    a, _ = two_products
    draft = make_draft(seller, customer, [(a, "1")])
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    payload = {
        "idempotency_key": "cf-key-replay-1",
        "expected_version": 1,
        "review_token": review["review_token"],
    }
    first = sales.confirm_sale(actor=seller, sale_id=draft["id"], payload=payload)
    replay = sales.confirm_sale(actor=seller, sale_id=draft["id"], payload=payload)
    assert replay.replayed
    assert replay.body["internal_number"] == first.body["internal_number"] == "COM-VEN-000001"
    assert InventoryMovement.objects.filter(movement_type="SALE_OUT").count() == 1
    with pytest.raises(IdempotencyConflictError):
        sales.confirm_sale(
            actor=seller,
            sale_id=draft["id"],
            payload={**payload, "expected_version": 2},
        )


def test_confirming_an_already_confirmed_sale_with_a_new_key_does_not_duplicate_effects(
    seller: Any, customer: Any, two_products: Any
) -> None:
    a, _ = two_products
    draft = make_draft(seller, customer, [(a, "1")])
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    payload = {"expected_version": 1, "review_token": review["review_token"]}
    sales.confirm_sale(
        actor=seller, sale_id=draft["id"], payload={**payload, "idempotency_key": "cf-key-again-01"}
    )
    again = sales.confirm_sale(
        actor=seller, sale_id=draft["id"], payload={**payload, "idempotency_key": "cf-key-again-02"}
    )
    assert again.body["internal_number"] == "COM-VEN-000001"
    assert InventoryMovement.objects.filter(movement_type="SALE_OUT").count() == 1
    assert NumberAllocation.objects.filter(consumer_type="sale").count() == 1


def test_stale_version_and_wrong_token_are_rejected(
    seller: Any, customer: Any, two_products: Any
) -> None:
    a, _ = two_products
    draft = make_draft(seller, customer, [(a, "1")])
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    with pytest.raises(SalesApplicationError) as stale:
        sales.confirm_sale(
            actor=seller,
            sale_id=draft["id"],
            payload={
                "idempotency_key": "cf-key-stale-01",
                "expected_version": 7,
                "review_token": review["review_token"],
            },
        )
    assert stale.value.code == "stale_record"
    with pytest.raises(SalesApplicationError):
        sales.confirm_sale(
            actor=seller,
            sale_id=draft["id"],
            payload={
                "idempotency_key": "cf-key-stale-02",
                "expected_version": 1,
                "review_token": "no-firmado",
            },
        )


def test_lock_order_never_reacquires_earlier_groups(
    seller: Any, customer: Any, two_products: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Recibo, venta, cliente, productos, posiciones, configuración y numeración, en ese orden."""
    a, b = two_products
    draft = make_draft(seller, customer, [(b, "1"), (a, "1")])
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    order: list[str] = []

    def spy(name: str, module: Any, attribute: str) -> None:
        original = getattr(module, attribute)

        def wrapper(*args: Any, **kwargs: Any) -> Any:
            order.append(name)
            return original(*args, **kwargs)

        monkeypatch.setattr(module, attribute, wrapper)

    spy("sale", sales, "lock_sale")
    spy("customer", sales, "lock_customer_reference")
    spy("products", sales, "lock_product_references")
    spy("positions", posting, "lock_positions")
    spy("configuration", sales, "lock_operation_context")
    spy("numbering", sales, "allocate_number")
    sales.confirm_sale(
        actor=seller,
        sale_id=draft["id"],
        payload={
            "idempotency_key": "cf-key-order-01",
            "expected_version": 1,
            "review_token": review["review_token"],
        },
    )
    assert order == ["sale", "customer", "products", "positions", "configuration", "numbering"]
    assert [
        m.product_id
        for m in InventoryMovement.objects.filter(movement_type="SALE_OUT").order_by("id")
    ] == sorted([a.pk, b.pk])


def test_inactive_product_or_customer_blocks_confirmation_keeping_the_draft(
    seller: Any, customer: Any, two_products: Any
) -> None:
    a, b = two_products
    draft = make_draft(seller, customer, [(a, "1"), (b, "1")])
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    Product.objects.filter(pk=b.pk).update(is_active=False)
    with pytest.raises(SalesApplicationError) as error:
        sales.confirm_sale(
            actor=seller,
            sale_id=draft["id"],
            payload={
                "idempotency_key": "cf-key-inact-01",
                "expected_version": 1,
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "inactive_reference"
    assert "lines.1.product_id" in error.value.errors
    assert Sale.objects.get().state == "DRAFT"


def test_kit_is_sold_intact_and_only_its_own_stock_moves(
    seller: Any, customer: Any, make_product: Any, stock: Any
) -> None:
    kit, component = make_product(is_kit=True), make_product()
    stock(kit, 3, "30.00")
    stock(component, 5, "5.00")
    confirm(seller, make_draft(seller, customer, [(kit, "1")]))
    assert InventoryPosition.objects.get(product=kit).quantity == D(2)
    assert InventoryPosition.objects.get(product=component).quantity == D(5)


def test_zero_total_sale_is_confirmed_without_debt(
    seller: Any, customer: Any, make_product: Any, stock: Any
) -> None:
    free = make_product(sale_price=D("0.00"))
    stock(free, 2, "2.00")
    body = confirm(seller, make_draft(seller, customer, [(free, "1")])).body
    assert body["grand_total"] == "0.00"
    assert CommercialPayment.objects.count() == 0
