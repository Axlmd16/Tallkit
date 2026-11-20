"""Resumen artesanal del inicio: cada indicador coincide con su lista y respeta los permisos."""

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    add_part,
    confirm_linked_sale,
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


def test_status_counts_ignore_the_state_filter_and_follow_the_other_filters(  # type: ignore[no-untyped-def]
    manager, make_order, make_service, make_customer
) -> None:
    ana = make_customer(name="Ana Pérez")
    mine_open = make_order(ana)
    mine_closed = make_order(ana)
    close(manager, mine_closed, make_service)
    reopened = make_order(ana)
    close(manager, reopened, make_service)
    reopen(manager, reopened["id"], reason="Fuga después del cambio")
    for _ in range(2):
        make_order()
    for _ in range(3):
        close(manager, make_order(), make_service)

    everything = queries.list_orders(actor=manager)
    assert everything["status_counts"] == {
        "all": 8,
        "open": 4,
        "reopened": 1,
        "finalized": 4,
    }
    assert everything["status_counts"]["all"] == everything["total_count"]

    # El contador de cada segmento es el total de la lista al elegirlo.
    for segment, state in (("open", "OPEN"), ("reopened", "REOPENED"), ("finalized", "FINALIZED")):
        chosen = queries.list_orders(actor=manager, state=state)
        assert chosen["total_count"] == chosen["status_counts"][segment]
        assert chosen["status_counts"] == everything["status_counts"]

    # Con otro filtro, solo se cuentan las órdenes que lo cumplen.
    only_ana = queries.list_orders(actor=manager, customer_id=ana.pk, state="OPEN")
    assert only_ana["status_counts"] == {"all": 3, "open": 2, "reopened": 1, "finalized": 1}
    assert mine_open["id"] in {row["id"] for row in only_ana["items"]}

    searched = queries.list_orders(actor=manager, search="Ana Pérez")
    assert searched["status_counts"] == {"all": 3, "open": 2, "reopened": 1, "finalized": 1}


def test_status_counts_respect_the_search_by_plate(  # type: ignore[no-untyped-def]
    manager, artisan_billing, make_customer, make_vehicle, make_service
) -> None:
    customer = make_customer()
    target = make_vehicle(customer, plate="ZZZ-9999")
    other = make_vehicle(customer, plate="AAA-1111")
    closed_one = create(manager, customer_id=customer.pk, vehicle_id=target.pk, odometer_km=5)
    close(manager, closed_one, make_service)
    open_one = create(manager, customer_id=customer.pk, vehicle_id=target.pk, odometer_km=6)
    create(manager, customer_id=customer.pk, vehicle_id=other.pk, odometer_km=7)

    result = queries.list_orders(actor=manager, search="zzz")
    assert result["status_counts"] == {"all": 2, "open": 1, "reopened": 0, "finalized": 1}
    assert open_one["id"] in {row["id"] for row in result["items"]}


def test_list_shows_the_billing_of_each_business_apart(  # type: ignore[no-untyped-def]
    manager, seller, commercial, make_order, make_service, stocked
) -> None:
    mixed = make_order()
    add_part(manager, mixed["id"], stocked(5, price="40.00").pk, 1)
    confirm_linked_sale(seller, mixed["id"], "CREDITO")
    add_line(manager, mixed["id"], service_id=make_service().pk, applied_price="60.00")
    operation = confirm_services(manager, mixed["id"], "CONTADO")
    settle(manager, operation["id"], ("EFECTIVO", "60.00"))
    services_only = make_order()
    add_line(manager, services_only["id"], service_id=make_service().pk, applied_price="25.00")
    empty = make_order()

    rows = {row["id"]: row["billing"] for row in queries.list_orders(actor=manager)["items"]}

    # Cada negocio con su propio saldo: el pago de los servicios no cubre los repuestos.
    assert rows[mixed["id"]] == {
        "commercial": {"state": "PENDING", "balance": "40.00"},
        "artisan": {"state": "PAID", "balance": "0.00"},
    }
    assert rows[services_only["id"]] == {
        "commercial": None,
        "artisan": {"state": "UNDOCUMENTED", "balance": "0.00"},
    }
    assert rows[empty["id"]] == {"commercial": None, "artisan": None}


def test_list_hides_the_artisan_billing_without_permission(  # type: ignore[no-untyped-def]
    manager, make_order, make_service, monkeypatch
) -> None:
    order = make_order()
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="25.00")
    monkeypatch.setattr(
        queries,
        "has_permission",
        lambda actor, permission: permission != "servicios_economicos.ver",
    )
    [row] = queries.list_orders(actor=manager)["items"]
    assert row["billing"]["artisan"] is None


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


# --- Cuentas de un cliente (lectura del inicio) ----------------------------------------------


@pytest.fixture
def indebted(manager, seller, commercial, make_customer, make_order, make_service, stocked):  # type: ignore[no-untyped-def]
    """Cliente con repuestos a crédito sin pagar (40) y servicios de contado pagados (60)."""
    customer = make_customer(name="Carlos Mendoza")
    order = make_order(customer)
    add_part(manager, order["id"], stocked(5, price="40.00").pk, 1)
    confirm_linked_sale(seller, order["id"], "CREDITO")
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="60.00")
    operation = confirm_services(manager, order["id"], "CONTADO")
    settle(manager, operation["id"], ("EFECTIVO", "60.00"))
    return customer


def test_customer_summary_keeps_each_business_apart(admin, indebted) -> None:  # type: ignore[no-untyped-def]
    from home.application import customers

    body = customers.customer_summary(admin, indebted.pk)

    assert body["visits"] == {"count_year": 1, "last_on": support.business_today().isoformat()}
    assert body["commercial"]["spent_year"] == "40.00"
    assert body["commercial"]["balance"] == "40.00"
    assert body["artisan"]["spent_year"] == "60.00"
    assert body["artisan"]["balance"] == "0.00"
    assert "total" not in body


def test_customer_summary_shows_only_the_business_the_actor_can_see(manager, indebted) -> None:  # type: ignore[no-untyped-def]
    from home.application import customers

    body = customers.customer_summary(manager, indebted.pk)

    # El encargado del taller no ve ventas ni cobros de repuestos.
    assert body["commercial"] is None
    assert body["artisan"] == {
        "spent_year": "60.00",
        "documents_year": 1,
        "last_on": support.business_today().isoformat(),
        "balance": "0.00",
    }


def test_debtors_list_each_balance_by_business(admin, manager, indebted, make_customer) -> None:  # type: ignore[no-untyped-def]
    from home.application import customers

    make_customer(name="Sin deuda")
    body = customers.debtors(admin)
    assert body["items"] == [
        {
            "customer_id": indebted.pk,
            "name": "Carlos Mendoza",
            "identification": indebted.identification,
            "person_type": "NATURAL",
            "commercial": "40.00",
            "artisan": None,
        }
    ]
    # Quien solo ve el taller no recibe la deuda de repuestos ni, por tanto, a este cliente.
    only_workshop = customers.debtors(manager)
    assert only_workshop == {"items": [], "visible": {"commercial": False, "artisan": True}}


def test_customer_accounts_require_permission_to_see_customers(  # type: ignore[no-untyped-def]
    indebted, monkeypatch
) -> None:
    from django.contrib.auth import get_user_model

    from home.application import customers

    nobody = get_user_model().objects.create_user(username="wk-nobody", password="x" * 14)
    with pytest.raises(customers.CustomersHiddenError):
        customers.customer_summary(nobody, indebted.pk)
    with pytest.raises(customers.CustomersHiddenError):
        customers.debtors(nobody)
