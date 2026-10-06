"""Concurrencia real sobre PostgreSQL: ventas, cobros, devoluciones, reembolsos y datos maestros."""

import uuid
from datetime import date, timedelta
from decimal import Decimal
from itertools import count
from typing import Any

import pytest
from django.db import OperationalError, transaction

from catalog.application import products as catalog_products
from catalog.models import Product
from customer_registry.application.customers import deactivate_customer
from customer_registry.models import Customer
from identity.models import AuditEvent
from inventory.models import InventoryMovement, InventoryPosition
from sales.application import payments, refunds, returns, reviews, sales, voids
from sales.models import (
    CommercialPayment,
    CommercialRefund,
    Sale,
    SaleCostAllocation,
    SaleReturn,
    SalesCommand,
)
from workshop_configuration.application.series import replace_series
from workshop_configuration.application.taxes import schedule_successor
from workshop_configuration.models import (
    ConfigurationUse,
    DocumentSeries,
    NumberAllocation,
    TaxPeriod,
)

from .test_payments import parts
from .test_refunds import refund_data
from .test_returns import item, line_id
from .test_returns import request as return_request

pytestmark = pytest.mark.django_db(transaction=True)
D = Decimal
_keys = count(1)


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Any) -> None:
    """Contexto comercial, bodega y serie COM-VEN."""


def key(prefix: str = "cc") -> str:
    return f"{prefix}-{next(_keys):08d}"


def kinds(results: list[tuple[str, Any]]) -> list[str]:
    return sorted("ok" if s == "ok" else getattr(v, "code", type(v).__name__) for s, v in results)


def draft(actor: Any, customer: Any, lines: list[tuple[Any, str]]) -> dict[str, Any]:
    return sales.create_draft(
        actor=actor,
        payload={
            "idempotency_key": key("draft"),
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [{"product_id": p.pk, "quantity": q} for p, q in lines],
        },
    ).body


def confirm_payload(actor: Any, body: dict[str, Any]) -> dict[str, Any]:
    review = reviews.preview_confirmation(actor=actor, sale_id=body["id"])
    assert review["can_confirm"], review["issues"]
    return {
        "idempotency_key": key("confirm"),
        "expected_version": body["version"],
        "review_token": review["review_token"],
    }


def confirm(actor: Any, body: dict[str, Any], payload: dict[str, Any] | None = None) -> Any:
    data = payload or confirm_payload(actor, body)
    return lambda: sales.confirm_sale(actor=actor, sale_id=body["id"], payload=data)


def no_deadlocks(results: list[tuple[str, Any]]) -> None:
    assert not [v for s, v in results if s == "error" and isinstance(v, OperationalError)], results


def confirmed(seller: Any, customer: Any, product: Any, quantity: str = "1") -> dict[str, Any]:
    body = draft(seller, customer, [(product, quantity)])
    return sales.confirm_sale(
        actor=seller, sale_id=body["id"], payload=confirm_payload(seller, body)
    ).body


def add_stock(product: Any, quantity: int, value: str, source: int) -> None:
    from catalog.application.inventory_references import lock_product_references
    from inventory.application import posting

    with transaction.atomic():
        refs = lock_product_references([product.pk])
        operation = posting.prepare_operation(
            kind="PURCHASE_RECEIPT",
            actor=_actor(),
            source_type="PURCHASE",
            source_id=source,
            entry_lines=[posting.EntryLine(product.pk, D(quantity), D(value))],
        )
        positions = posting.lock_positions(refs, warehouse_id=1)
        posting.post_operation(operation, positions, refs)


def _actor() -> Any:
    from django.contrib.auth import get_user_model

    return get_user_model().objects.filter(username="sal-actor").first() or (
        get_user_model().objects.create_user(username="sal-actor", password="x" * 14)
    )


def stocked(make_product: Any, quantity: int, price: str = "10.00") -> Any:
    product = make_product(sale_price=D(price))
    add_stock(product, quantity, f"{quantity * 4}.00", next(_keys))
    return product


def test_two_sales_competing_for_the_last_unit_confirm_at_most_one(
    run_parallel: Any, seller: Any, customer: Any, make_product: Any
) -> None:
    product = stocked(make_product, 1)
    first = draft(seller, customer, [(product, "1")])
    second = draft(seller, customer, [(product, "1")])
    results = run_parallel(confirm(seller, first), confirm(seller, second))
    no_deadlocks(results)
    assert kinds(results) == ["insufficient_stock", "ok"]
    assert Sale.objects.filter(state="CONFIRMED").count() == 1
    assert Sale.objects.filter(state="DRAFT").count() == 1
    assert InventoryPosition.objects.get(product=product).quantity == D(0)
    assert InventoryMovement.objects.filter(movement_type="SALE_OUT").count() == 1
    assert NumberAllocation.objects.filter(consumer_type="sale").count() == 1
    assert ConfigurationUse.objects.filter(consumer_type="sale").count() == 1
    assert SaleCostAllocation.objects.count() == 1
    assert CommercialPayment.objects.count() == 0
    assert SalesCommand.objects.filter(action="sales.sale_confirmed").count() == 1
    assert AuditEvent.objects.filter(action="sales.sale_confirmed", result="SUCCESS").count() == 1


def test_concurrent_confirmations_get_distinct_consecutive_numbers_of_the_active_series(
    run_parallel: Any, seller: Any, customer: Any, make_product: Any
) -> None:
    a, b = stocked(make_product, 5), stocked(make_product, 5)
    first = draft(seller, customer, [(a, "1")])
    second = draft(seller, customer, [(b, "1")])
    results = run_parallel(confirm(seller, first), confirm(seller, second))
    no_deadlocks(results)
    assert kinds(results) == ["ok", "ok"]
    numbers = sorted(str(n) for n in Sale.objects.values_list("internal_number", flat=True))
    assert numbers == ["COM-VEN-000001", "COM-VEN-000002"]
    assert not any(str(n).startswith("ART-SER") for n in numbers)
    assert InventoryMovement.objects.filter(movement_type="SALE_OUT").count() == 2
    assert NumberAllocation.objects.filter(consumer_type="sale").count() == 2


def test_two_payments_of_70_against_a_balance_of_100_accept_at_most_one(
    run_parallel: Any, seller: Any, customer: Any, make_product: Any
) -> None:
    product = stocked(make_product, 5, "100.00")
    sale = confirmed(seller, customer, product)

    def attempt() -> Any:
        data = {"operation_id": str(uuid.uuid4()), "parts": parts("70.00")}
        review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
        payload = {**data, "idempotency_key": key("pay"), "review_token": review["review_token"]}
        return lambda: payments.register_payment(actor=seller, sale_id=sale["id"], payload=payload)

    first, second = attempt(), attempt()
    results = run_parallel(first, second)
    no_deadlocks(results)
    assert kinds(results).count("ok") == 1
    assert CommercialPayment.objects.count() == 1
    assert CommercialPayment.objects.get().amount == D("70.00")
    assert sales.get_sale(actor=seller, sale_id=sale["id"])["money"]["balance"] == "30.00"
    assert (
        AuditEvent.objects.filter(action="sales.payment_registered", result="SUCCESS").count() == 1
    )


def test_a_payment_and_a_withholding_racing_for_the_same_balance_accept_only_one(
    run_parallel: Any, seller: Any, customer: Any, make_product: Any
) -> None:
    from sales.models import CommercialWithholding

    product = stocked(make_product, 5, "100.00")
    sale = confirmed(seller, customer, product)
    first_data = {"operation_id": str(uuid.uuid4()), "parts": parts("95.00")}
    first_review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=first_data)
    payments.register_payment(
        actor=seller,
        sale_id=sale["id"],
        payload={
            **first_data,
            "idempotency_key": key("pay"),
            "review_token": first_review["review_token"],
        },
    )

    def attempt(data: dict[str, Any]) -> Any:
        data = {"operation_id": str(uuid.uuid4()), **data}
        review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
        payload = {**data, "idempotency_key": key("pay"), "review_token": review["review_token"]}
        return lambda: payments.register_payment(actor=seller, sale_id=sale["id"], payload=payload)

    results = run_parallel(
        attempt({"parts": parts("5.00")}), attempt({"withholding": {"amount": "5.00"}})
    )
    no_deadlocks(results)
    assert kinds(results).count("ok") == 1
    assert CommercialPayment.objects.count() + CommercialWithholding.objects.count() == 2
    money = sales.get_sale(actor=seller, sale_id=sale["id"])["money"]
    assert money["balance"] == "0.00"
    assert D(money["paid_total"]) + D(money["withheld_total"]) == D("100.00")


def test_a_payment_racing_a_void_leaves_a_coherent_order_without_orphan_payments(
    run_parallel: Any, seller: Any, admin: Any, customer: Any, make_product: Any
) -> None:
    product = stocked(make_product, 5, "100.00")
    sale = confirmed(seller, customer, product)
    pay_data = {"operation_id": str(uuid.uuid4()), "parts": parts("100.00")}
    pay_review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=pay_data)
    void_data = {"reason": "Error de captura"}
    void_review = voids.preview_void(actor=admin, sale_id=sale["id"], payload=void_data)
    results = run_parallel(
        lambda: payments.register_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={
                **pay_data,
                "idempotency_key": key("pay"),
                "review_token": pay_review["review_token"],
            },
        ),
        lambda: voids.void_sale(
            actor=admin,
            sale_id=sale["id"],
            payload={
                **void_data,
                "idempotency_key": key("void"),
                "expected_version": void_review["version"],
                "review_token": void_review["review_token"],
            },
        ),
    )
    no_deadlocks(results)
    assert kinds(results).count("ok") == 1
    current = Sale.objects.get(pk=sale["id"])
    if current.state == "VOIDED":
        assert CommercialPayment.objects.count() == 0
        assert InventoryPosition.objects.get(product=product).quantity == D(5)
    else:
        assert current.state == "CONFIRMED"
        assert CommercialPayment.objects.count() == 1
        assert not InventoryMovement.objects.filter(movement_type="REVERSAL").exists()


def test_payment_and_return_never_accept_an_overpayment(
    run_parallel: Any, seller: Any, admin: Any, customer: Any, make_product: Any
) -> None:
    product = stocked(make_product, 10, "20.00")
    sale = confirmed(seller, customer, product, "5")  # total 100.00
    first = payments.preview_payment(
        actor=seller,
        sale_id=sale["id"],
        payload={"operation_id": str(uuid.uuid4()), "parts": parts("60.00")},
    )
    payments.register_payment(
        actor=seller,
        sale_id=sale["id"],
        payload={
            "operation_id": first["operation_id"],
            "parts": parts("60.00"),
            "idempotency_key": key("pay"),
            "review_token": first["review_token"],
        },
    )
    pay_data = {"operation_id": str(uuid.uuid4()), "parts": parts("40.00")}
    pay_review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=pay_data)
    ret_data = return_request([item(line_id(sale["id"]), fit=1)])
    ret_review = returns.preview_return(actor=admin, sale_id=sale["id"], payload=ret_data)
    results = run_parallel(
        lambda: payments.register_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={
                **pay_data,
                "idempotency_key": key("pay"),
                "review_token": pay_review["review_token"],
            },
        ),
        lambda: returns.register_return(
            actor=admin,
            sale_id=sale["id"],
            payload={
                **ret_data,
                "idempotency_key": key("ret"),
                "review_token": ret_review["review_token"],
            },
        ),
    )
    no_deadlocks(results)
    assert kinds(results).count("ok") == 1
    money = sales.get_sale(actor=seller, sale_id=sale["id"])["money"]
    if SaleReturn.objects.exists():
        assert (money["paid_total"], money["exigible"], money["balance"]) == (
            "60.00",
            "80.00",
            "20.00",
        )
    else:
        assert (money["paid_total"], money["balance"], money["refund_due"]) == (
            "100.00",
            "0.00",
            "0.00",
        )


def test_two_returns_competing_for_the_last_returnable_unit_accept_at_most_one(
    run_parallel: Any, admin: Any, seller: Any, customer: Any, make_product: Any
) -> None:
    product = stocked(make_product, 10, "10.00")
    sale = confirmed(seller, customer, product, "1")
    data = [return_request([item(line_id(sale["id"]), fit=1)]) for _ in range(2)]
    reviews_ = [returns.preview_return(actor=admin, sale_id=sale["id"], payload=d) for d in data]
    results = run_parallel(
        *[
            (
                lambda d=d, r=r: returns.register_return(
                    actor=admin,
                    sale_id=sale["id"],
                    payload={**d, "idempotency_key": key("ret"), "review_token": r["review_token"]},
                )
            )
            for d, r in zip(data, reviews_, strict=True)
        ]
    )
    no_deadlocks(results)
    assert kinds(results).count("ok") == 1
    assert SaleReturn.objects.count() == 1
    assert InventoryMovement.objects.filter(movement_type="CUSTOMER_RETURN_IN").count() == 1
    assert InventoryPosition.objects.get(product=product).quantity == D(10)


def test_two_refunds_of_30_against_an_excess_of_40_accept_at_most_one(
    run_parallel: Any, admin: Any, seller: Any, customer: Any, make_product: Any
) -> None:
    from .test_payments import pay
    from .test_returns import do_return

    product = stocked(make_product, 10, "20.00")
    sale = confirmed(seller, customer, product, "5")
    pay(seller, sale["id"], parts("100.00"))
    do_return(admin, sale["id"], return_request([item(line_id(sale["id"]), fit=2)]))  # exceso 40
    sale_return = SaleReturn.objects.get()
    data = [refund_data(sale_return, "30.00") for _ in range(2)]
    previews = [refunds.preview_refund(actor=admin, sale_id=sale["id"], payload=d) for d in data]
    results = run_parallel(
        *[
            (
                lambda d=d, r=r: refunds.register_refund(
                    actor=admin,
                    sale_id=sale["id"],
                    payload={**d, "idempotency_key": key("ref"), "review_token": r["review_token"]},
                )
            )
            for d, r in zip(data, previews, strict=True)
        ]
    )
    no_deadlocks(results)
    assert kinds(results).count("ok") == 1
    assert CommercialRefund.objects.count() == 1
    money = sales.get_sale(actor=seller, sale_id=sale["id"])["money"]
    assert (money["refunded_total"], money["refund_due"]) == ("30.00", "10.00")


def test_sales_with_several_products_in_reverse_order_never_form_lock_cycles(
    run_parallel: Any, seller: Any, customer: Any, make_product: Any
) -> None:
    items = [stocked(make_product, 10) for _ in range(3)]
    first = draft(seller, customer, [(p, "1") for p in items])
    second = draft(seller, customer, [(p, "1") for p in reversed(items)])
    payloads = [confirm_payload(seller, first), confirm_payload(seller, second)]
    results = run_parallel(
        confirm(seller, first, payloads[0]), confirm(seller, second, payloads[1])
    )
    no_deadlocks(results)
    assert set(kinds(results)) <= {"ok", "review_required"}
    for body in (first, second):  # quien vio disponibilidad cambiada revisa de nuevo
        if Sale.objects.get(pk=body["id"]).state == "DRAFT":
            confirm(seller, body)()
    assert Sale.objects.filter(state="CONFIRMED").count() == 2
    for product in items:
        assert InventoryPosition.objects.get(product=product).quantity == D(8)
    assert sorted(str(n) for n in Sale.objects.values_list("internal_number", flat=True)) == [
        "COM-VEN-000001",
        "COM-VEN-000002",
    ]


def test_sale_versus_a_purchase_entry_keeps_the_shared_lock_order(
    run_parallel: Any, seller: Any, customer: Any, make_product: Any
) -> None:
    product = stocked(make_product, 5)
    body = draft(seller, customer, [(product, "2")])
    payload = confirm_payload(seller, body)
    results = run_parallel(
        confirm(seller, body, payload),
        lambda: add_stock(product, 3, "12.00", next(_keys)),
    )
    no_deadlocks(results)
    assert results[1][0] == "ok"
    assert set(kinds(results)) <= {"ok", "review_required"}
    position = InventoryPosition.objects.get(product=product)
    sold = Sale.objects.get(pk=body["id"]).state == "CONFIRMED"
    assert position.quantity == D(6 if sold else 8)


def test_sale_versus_customer_deactivation_and_product_deactivation(
    run_parallel: Any, seller: Any, admin: Any, customer: Any, make_product: Any
) -> None:
    product = stocked(make_product, 5)
    body = draft(seller, customer, [(product, "1")])
    payload = confirm_payload(seller, body)
    fresh_customer = Customer.objects.get(pk=customer.pk)
    results = run_parallel(
        confirm(seller, body, payload),
        lambda: deactivate_customer(
            customer_id=customer.pk, expected_version=fresh_customer.version, actor=admin
        ),
        lambda: catalog_products.set_product_active(
            product.pk,
            active=False,
            actor=admin,
            payload={"expected_version": product.version, "idempotency_key": key("deact")},
        ),
    )
    no_deadlocks(results)
    sale_state = Sale.objects.get(pk=body["id"]).state
    movements = InventoryMovement.objects.filter(movement_type="SALE_OUT").count()
    assert movements == (1 if sale_state == "CONFIRMED" else 0)
    if sale_state != "CONFIRMED":
        assert results[0][0] == "error"
        assert NumberAllocation.objects.filter(consumer_type="sale").count() == 0
    assert Customer.objects.get(pk=customer.pk).is_active is False
    assert Product.objects.get(pk=product.pk).is_active is False


def test_series_replacement_and_tax_succession_versus_confirmation_do_not_conflict(
    run_parallel: Any, seller: Any, admin: Any, customer: Any, make_product: Any, commercial: Any
) -> None:
    product = stocked(make_product, 5)
    body = draft(seller, customer, [(product, "1")])
    payload = confirm_payload(seller, body)
    period = TaxPeriod.objects.get(tax_definition=commercial["tax"], ends_on__isnull=True)
    results = run_parallel(
        confirm(seller, body, payload),
        lambda: replace_series(
            actor=admin, series_id=commercial["series"].pk, expected_version=1, new_code="COM-VEN2"
        ),
        lambda: schedule_successor(
            actor=admin,
            period_id=period.pk,
            expected_version=period.version,
            new_rate="12",
            successor_starts_on=date.today() + timedelta(days=30),
        ),
    )
    no_deadlocks(results)
    assert kinds(results) == ["ok", "ok", "ok"]
    sale = Sale.objects.get(pk=body["id"])
    assert sale.state == "CONFIRMED"
    assert sale.internal_number in {"COM-VEN-000001", "COM-VEN2-000001"}
    assert DocumentSeries.objects.filter(is_active=True).count() == 1


def test_concurrent_edits_of_a_draft_keep_one_change_and_reject_the_stale_one(
    run_parallel: Any, seller: Any, customer: Any, make_product: Any
) -> None:
    product = stocked(make_product, 5)
    body = draft(seller, customer, [(product, "1")])

    def edit(note: str) -> Any:
        return lambda: sales.update_draft(
            actor=seller,
            sale_id=body["id"],
            payload={"idempotency_key": key("edit"), "expected_version": 1, "notes": note},
        )

    results = run_parallel(edit("A"), edit("B"))
    no_deadlocks(results)
    assert kinds(results) == ["ok", "stale_record"]
    current = Sale.objects.get(pk=body["id"])
    assert current.version == 2
    assert current.notes in {"A", "B"}
