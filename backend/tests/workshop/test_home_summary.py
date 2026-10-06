"""Resumen artesanal del inicio: cada indicador coincide con su lista y respeta los permisos."""

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    confirm_services,
    create,
    error_of,
    finalize,
    key,
    reopen,
    version,
)

from identity.models import AuditEvent
from workshop.application import (
    artisan_payments,
    artisan_withholdings,
    home_summary,
    orders,
    queries,
    support,
)

pytestmark = pytest.mark.django_db
D = Decimal


@pytest.fixture
def make_order(manager, artisan_billing, make_customer, make_vehicle):  # type: ignore[no-untyped-def]
    def build(customer: Any = None) -> dict[str, Any]:
        customer = customer or make_customer()
        vehicle = make_vehicle(customer)
        return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=5)

    return build


@pytest.fixture
def make_operation(manager, make_order, make_service):  # type: ignore[no-untyped-def]
    def build(
        condition: str = "CREDITO", price: str = "100.00", customer: Any = None
    ) -> dict[str, Any]:
        order = make_order(customer)
        add_line(manager, order["id"], service_id=make_service().pk, applied_price=price)
        return confirm_services(manager, order["id"], condition)

    return build


def settle(actor: Any, target: int, *parts: tuple[str, str], withheld: str | None = None) -> Any:
    payload: dict[str, Any] = {"operation_id": str(uuid.uuid4()), "idempotency_key": key()}
    if parts:
        payload["parts"] = [{"method": method, "amount": amount} for method, amount in parts]
    if withheld is not None:
        payload["withholding"] = {"amount": withheld}
    return artisan_payments.register_payment(actor=actor, operation_id=target, payload=payload)


# --- Filtros nuevos --------------------------------------------------------------------------


def close(manager: Any, order: dict[str, Any], make_service: Any) -> None:
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="10.00")
    orders.update_order(
        actor=manager,
        order_id=order["id"],
        payload={
            "diagnosis": "Pastillas gastadas",
            "expected_version": version(order["id"]),
            "idempotency_key": key(),
        },
    )
    finalize(manager, order["id"])


def test_open_state_gathers_registered_and_reopened(manager, make_order, make_service) -> None:  # type: ignore[no-untyped-def]
    registered = [make_order() for _ in range(3)]
    reopened = make_order()
    close(manager, reopened, make_service)
    reopen(manager, reopened["id"], reason="Fuga después del cambio")
    for _ in range(2):
        close(manager, make_order(), make_service)
    listing = queries.list_orders(actor=manager, state="OPEN")
    assert listing["total_count"] == 4
    assert {row["id"] for row in listing["items"]} == {
        *(order["id"] for order in registered),
        reopened["id"],
    }
    assert queries.list_orders(actor=manager, state="REGISTERED")["total_count"] == 3
    assert home_summary.open_orders(manager) == 4


def test_unknown_order_state_names_open(manager) -> None:  # type: ignore[no-untyped-def]
    error = error_of(lambda: queries.list_orders(actor=manager, state="ABIERTA"))
    assert "OPEN" in error.errors["state"][0]


def test_artisan_receivables_filter_by_condition(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    cash = make_operation("CONTADO", "40.00")
    make_operation("CREDITO", "60.00")
    listing = queries.artisan_receivables(actor=manager, condition="CONTADO")
    assert [row["id"] for row in listing["results"]] == [cash["id"]]
    assert listing["totals"]["balance"] == "40.00"
    assert queries.artisan_receivables(actor=manager)["count"] == 2
    error = error_of(lambda: queries.artisan_receivables(actor=manager, condition="FIADO"))
    assert "condition" in error.errors


# --- Pendientes ------------------------------------------------------------------------------


def test_cash_services_unpaid_match_the_list(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    make_operation("CONTADO", "40.00")
    make_operation("CREDITO", "60.00")
    covered = make_operation("CONTADO", "100.00")
    settle(manager, covered["id"], ("EFECTIVO", "98.00"), withheld="2.00")
    assert home_summary.cash_services_unpaid(manager) == 1
    assert queries.artisan_receivables(actor=manager, condition="CONTADO")["count"] == 1


def test_pending_withholdings_match_the_list(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation("CONTADO", "100.00")
    settle(manager, operation["id"], ("EFECTIVO", "98.00"), withheld="2.00")
    assert home_summary.pending_withholdings(manager) == 1
    assert artisan_withholdings.pending_vouchers(actor=manager)["total_count"] == 1


# --- Por cobrar ------------------------------------------------------------------------------


def test_balance_and_customers_match_the_receivables(  # type: ignore[no-untyped-def]
    manager, make_operation, make_customer
) -> None:
    customer = make_customer()
    make_operation("CREDITO", "70.00", customer)
    partial = make_operation("CREDITO", "50.00", customer)
    settle(manager, partial["id"], ("EFECTIVO", "18.00"), withheld="2.00")
    make_operation("CREDITO", "20.00")
    result = home_summary.receivable_balance(manager)
    assert result == home_summary.Receivable(balance=D("120.00"), customers=2)
    assert queries.artisan_receivables(actor=manager)["totals"]["balance"] == "120.00"


def test_no_debt_is_zero(manager, artisan_billing) -> None:  # type: ignore[no-untyped-def]
    assert home_summary.receivable_balance(manager) == home_summary.Receivable(
        balance=D("0.00"), customers=0
    )


# --- Cobros de los últimos siete días --------------------------------------------------------


def test_combined_payment_adds_both_parts_today(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation("CREDITO", "50.00")
    settle(manager, operation["id"], ("EFECTIVO", "30.00"), ("TRANSFERENCIA", "20.00"))
    days = home_summary.collections_by_day(manager, today=support.business_today())
    assert days is not None
    assert len(days) == 7
    assert days[-1].amount == D("50.00")
    assert sum(entry.amount for entry in days) == D("50.00")


def test_window_and_business_date(manager, make_operation, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    today = date(2026, 10, 6)
    for day in (date(2026, 9, 29), date(2026, 9, 30), date(2026, 10, 5)):
        monkeypatch.setattr(artisan_payments, "business_today", lambda day=day: day)
        operation = make_operation("CREDITO", "10.00")
        settle(manager, operation["id"], ("EFECTIVO", "10.00"))
    days = home_summary.collections_by_day(manager, today=today)
    assert days is not None
    assert [entry.day for entry in days] == [
        date(2026, 9, 30) + timedelta(days=offset) for offset in range(7)
    ]
    assert [entry.amount for entry in days] == [
        D("10.00"),
        D("0.00"),
        D("0.00"),
        D("0.00"),
        D("0.00"),
        D("10.00"),
        D("0.00"),
    ]


def test_withholding_and_voided_payment_are_not_collected_money(  # type: ignore[no-untyped-def]
    admin, manager, make_operation
) -> None:
    held = make_operation("CONTADO", "100.00")
    settle(manager, held["id"], ("EFECTIVO", "98.00"), withheld="2.00")
    voided = make_operation("CREDITO", "40.00")
    payment = settle(manager, voided["id"], ("EFECTIVO", "40.00")).body["payments"][0]
    artisan_payments.correct_payment(
        actor=admin,
        operation_id=voided["id"],
        payment_id=payment["id"],
        payload={
            "operation_id": str(uuid.uuid4()),
            "idempotency_key": key(),
            "reason": "Cobro registrado por error",
        },
    )
    days = home_summary.collections_by_day(manager, today=support.business_today())
    assert days is not None
    assert days[-1].amount == D("98.00")


# --- Permisos --------------------------------------------------------------------------------


def test_without_permission_nothing_is_computed_nor_audited(seller, make_operation) -> None:  # type: ignore[no-untyped-def]
    make_operation("CONTADO", "40.00")
    before = AuditEvent.objects.count()
    assert home_summary.open_orders(seller) is None
    assert home_summary.cash_services_unpaid(seller) is None
    assert home_summary.pending_withholdings(seller) is None
    assert home_summary.receivable_balance(seller) is None
    assert home_summary.collections_by_day(seller, today=support.business_today()) is None
    assert AuditEvent.objects.count() == before


# --- Recorrido por la API del inicio con datos reales ----------------------------------------


def test_home_routes_show_the_same_numbers_as_the_lists(  # type: ignore[no-untyped-def]
    manager, make_operation, make_order
) -> None:
    from rest_framework.test import APIClient

    api = APIClient()
    api.force_authenticate(user=manager)
    make_operation("CONTADO", "40.00")
    partial = make_operation("CREDITO", "60.00")
    settle(manager, partial["id"], ("EFECTIVO", "25.00"))
    make_order()

    pending = {
        (item["key"], item["scope"]): item["count"]
        for item in api.get("/api/v1/home/pending/").json()["items"]
    }
    assert pending[("open_orders", None)] == 3
    assert api.get("/api/v1/maintenance-orders/?state=OPEN").json()["count"] == 3
    assert pending[("cash_services_unpaid", "artisan")] == 1
    assert api.get("/api/v1/service-operations/?condition=CONTADO").json()["count"] == 1

    assert api.get("/api/v1/home/receivables/").json()["items"] == [
        {"scope": "artisan", "balance": "75.00", "customers": 2}
    ]
    assert api.get("/api/v1/service-operations/").json()["totals"]["balance"] == "75.00"

    [collected] = api.get("/api/v1/home/collections/").json()["items"]
    assert (collected["scope"], collected["total"]) == ("artisan", "25.00")
