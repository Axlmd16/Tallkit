"""Conciliación comercial: solo lectura, con código de salida distinto de cero ante diferencias."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager, redirect_stderr, redirect_stdout
from decimal import Decimal
from io import StringIO
from typing import Any

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.utils import timezone

from inventory.models import InventoryPosition, InventoryReservation
from sales.application import reconciliation
from sales.application.workshop_links import add_linked_line
from sales.models import (
    CommercialPayment,
    CommercialRefund,
    PaymentPart,
    Sale,
    SaleCostAllocation,
    SaleLine,
    SaleReturnLine,
)
from workshop_configuration.models import Warehouse

from .test_payments import parts, pay
from .test_refunds import do_refund, refund_data
from .test_returns import do_return, item, line_id
from .test_returns import request as return_request

pytestmark = pytest.mark.django_db
D = Decimal


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


@contextmanager
def bypass_history() -> Iterator[None]:
    """Simula corrupción: desactiva los triggers de la sesión para introducir un desajuste."""
    with connection.cursor() as cursor:
        cursor.execute("SET session_replication_role = replica")
    try:
        yield
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SET session_replication_role = DEFAULT")


@pytest.fixture
def healthy(seller: Any, admin: Any, confirmed_sale: Any) -> dict[str, Any]:
    sale: dict[str, Any] = confirmed_sale(price="20.00", quantity=5)
    pay(seller, sale["id"], parts("100.00"))
    do_return(admin, sale["id"], return_request([item(line_id(sale["id"]), fit=2)]))
    from sales.models import SaleReturn

    do_refund(admin, sale["id"], refund_data(SaleReturn.objects.get(), "40.00"))
    return sale


def areas() -> list[str]:
    return sorted({d.area for d in reconciliation.reconcile()})


def test_consistent_data_is_reconciled_and_the_command_exits_cleanly(
    healthy: dict[str, Any], confirmed_sale: Any
) -> None:
    confirmed_sale(price="10.00")
    assert reconciliation.reconcile() == []
    out = StringIO()
    with redirect_stdout(out):
        call_command("reconcile_sales")
    assert "sin diferencias" in out.getvalue()


def test_number_and_configuration_are_verified_per_confirmed_sale(healthy: dict[str, Any]) -> None:
    with bypass_history():
        Sale.objects.filter(pk=healthy["id"]).update(internal_number="XXX-1")
    assert "número" in areas()
    with bypass_history():
        Sale.objects.filter(pk=healthy["id"]).update(
            internal_number="COM-VEN-000001", fiscal_snapshot=None
        )
    assert "configuración" in areas()


def test_movements_are_verified_against_cost_allocations(healthy: dict[str, Any]) -> None:
    with bypass_history():
        SaleCostAllocation.objects.filter(sale_line__sale=healthy["id"]).update(
            applied_value=D("1.000000")
        )
    assert "asignaciones" in areas()


def test_returned_quantities_cannot_exceed_sold(healthy: dict[str, Any]) -> None:
    with bypass_history():
        SaleReturnLine.objects.filter(sale_line__sale=healthy["id"]).update(fit_quantity=D(9))
    assert "devoluciones" in areas()


def test_e_p_r_parts_refunds_and_orphan_payments_are_verified(
    seller: Any, healthy: dict[str, Any]
) -> None:
    with bypass_history():
        PaymentPart.objects.filter(payment__sale=healthy["id"]).update(amount=D("1.00"))
    assert "partes" in areas()
    with bypass_history():
        PaymentPart.objects.filter(payment__sale=healthy["id"]).update(amount=D("100.00"))
        CommercialRefund.objects.filter(sale=healthy["id"]).update(amount=D("500.00"))
    found = areas()
    assert "reembolsos" in found
    assert "partes" in found
    with bypass_history():
        CommercialRefund.objects.filter(sale=healthy["id"]).update(amount=D("40.00"))
        Sale.objects.filter(pk=healthy["id"]).update(state="VOIDED", void_reason="x")
    assert "pagos huérfanos" in areas()


def test_orphan_payments_on_drafts_are_reported(
    seller: Any, customer: Any, product: Any, admin: Any
) -> None:
    from sales.application import sales

    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": "rec-draft-00001",
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [{"product_id": product.pk, "quantity": "1"}],
        },
    ).body
    payment = CommercialPayment.objects.create(
        operation_id=uuid.uuid4(),
        sale_id=draft["id"],
        amount=D("1.00"),
        effective_at=timezone.now(),
        effective_date=timezone.localdate(),
        created_by=seller,
    )
    PaymentPart.objects.create(payment=payment, method="EFECTIVO", amount=D("1.00"))
    assert "pagos huérfanos" in areas()


def test_open_linked_lines_match_active_reservations_one_to_one(
    seller: Any, maintenance_order: Any, product: Any, stock: Any
) -> None:
    stock(product, 5, "10.00")
    line = add_linked_line(
        actor=seller,
        order_ref=maintenance_order,
        product_id=product.pk,
        quantity="2",
    )
    assert reconciliation.reconcile() == []

    InventoryReservation.objects.filter(source_id=line.pk).update(quantity=D(1))

    differences = reconciliation.reconcile()
    assert [difference.area for difference in differences] == ["reservas"]
    assert "línea" in differences[0].detail


def test_the_command_exits_nonzero_on_differences_and_never_repairs(
    healthy: dict[str, Any],
) -> None:
    with bypass_history():
        SaleCostAllocation.objects.filter(sale_line__sale=healthy["id"]).update(
            applied_value=D("1.000000")
        )
    before = list(SaleCostAllocation.objects.values_list("applied_value", flat=True))
    err = StringIO()
    with pytest.raises(CommandError), redirect_stderr(err):
        call_command("reconcile_sales")
    assert "asignaciones" in err.getvalue()
    assert list(SaleCostAllocation.objects.values_list("applied_value", flat=True)) == before
    with pytest.raises(CommandError):
        call_command("reconcile_sales", "--fix")
    assert InventoryPosition.objects.count() == 1
    assert SaleLine.objects.count() == 1
