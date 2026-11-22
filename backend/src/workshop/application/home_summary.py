"""Indicadores del taller y del RUC artesanal para el resumen de inicio.

Cada función decide con ``has_permission`` —que no audita denegaciones— si el actor puede ver
el indicador y devuelve ``None`` cuando no puede. Los conteos reutilizan los mismos filtros que
las listas de destino, de modo que el número del inicio coincide con lo que la lista muestra.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Max, Sum

from identity.application.authorization import has_permission
from identity.models import User
from workshop.application import artisan_withholdings, queries
from workshop.application.support import business_today
from workshop.models import ArtisanPayment, MaintenanceOrder, ServiceOperation

COLLECTION_DAYS = 7
_ZERO = Decimal("0.00")


@dataclass(frozen=True)
class Receivable:
    balance: Decimal
    customers: int


@dataclass(frozen=True)
class DayCollection:
    day: date
    amount: Decimal


def open_orders(actor: User) -> int | None:
    if not has_permission(actor, "mantenimientos.ver"):
        return None
    count: int = queries.open_orders().count()
    return count


def cash_services_unpaid(actor: User) -> int | None:
    if not has_permission(actor, "pagos_artesanales.ver"):
        return None
    count: int = queries.unpaid_cash_operations().count()
    return count


def pending_withholdings(actor: User) -> int | None:
    if not has_permission(actor, "pagos_artesanales.ver"):
        return None
    count: int = artisan_withholdings.pending_voucher_rows().count()
    return count


def receivable_balance(actor: User) -> Receivable | None:
    """Saldo artesanal por cobrar y clientes con deuda, leídos en una misma instantánea."""
    if not has_permission(actor, "pagos_artesanales.ver"):
        return None
    with transaction.atomic():
        owed = queries.owed_operations()
        balance = owed.aggregate(total=Sum("balance_amount"))["total"] or _ZERO
        customers = owed.order_by().values("customer_id").distinct().count()
    return Receivable(balance=balance, customers=customers)


def collections_by_day(actor: User, *, today: date | None = None) -> list[DayCollection] | None:
    """Dinero cobrado por día en los últimos siete días; sin retenciones ni pagos corregidos."""
    if not has_permission(actor, "pagos_artesanales.ver"):
        return None
    today = today or business_today()
    start = today - timedelta(days=COLLECTION_DAYS - 1)
    rows = (
        ArtisanPayment.objects.filter(
            correction__isnull=True, effective_date__gte=start, effective_date__lte=today
        )
        .order_by()
        .values("effective_date")
        .annotate(total=Sum("amount"))
    )
    totals = {row["effective_date"]: row["total"] for row in rows}
    return [
        DayCollection(day=day, amount=totals.get(day, _ZERO))
        for day in (start + timedelta(days=offset) for offset in range(COLLECTION_DAYS))
    ]


@dataclass(frozen=True)
class CustomerActivity:
    spent: Decimal
    documents: int
    last_on: date | None


@dataclass(frozen=True)
class CustomerVisits:
    count: int
    last_on: date | None


def debts_by_customer(actor: User) -> dict[int, Decimal] | None:
    """Saldo artesanal por cobrar de cada cliente con deuda."""
    if not has_permission(actor, "pagos_artesanales.ver"):
        return None
    rows = (
        queries.owed_operations()
        .order_by()
        .values("customer_id")
        .annotate(total=Sum("balance_amount"))
    )
    return {row["customer_id"]: row["total"] for row in rows}


def customer_activity(actor: User, customer_id: int, *, since: date) -> CustomerActivity | None:
    """Servicios confirmados del cliente desde ``since`` y la fecha del último."""
    if not has_permission(actor, "servicios_economicos.ver"):
        return None
    confirmed = ServiceOperation.objects.filter(customer_id=customer_id, state="CONFIRMED")
    period = confirmed.filter(operational_date__gte=since).aggregate(
        total=Sum("grand_total"), documents=Count("pk")
    )
    last = confirmed.aggregate(last=Max("operational_date"))["last"]
    return CustomerActivity(
        spent=period["total"] or _ZERO, documents=period["documents"], last_on=last
    )


def customer_visits(actor: User, customer_id: int, *, since: date) -> CustomerVisits | None:
    """Mantenimientos abiertos para el cliente desde ``since`` y la fecha del último."""
    if not has_permission(actor, "mantenimientos.ver"):
        return None
    orders = MaintenanceOrder.objects.filter(customer_id=customer_id)
    return CustomerVisits(
        count=orders.filter(opened_on__gte=since).count(),
        last_on=orders.aggregate(last=Max("opened_on"))["last"],
    )


@dataclass(frozen=True)
class OpenOrderRef:
    id: int
    number: str
    status: str


def open_orders_by_vehicles(actor: User, vehicle_ids: list[int]) -> dict[int, OpenOrderRef] | None:
    """Mantenimiento abierto más reciente por vehículo; ``None`` si el actor no ve taller."""
    if not has_permission(actor, "mantenimientos.ver"):
        return None
    if not vehicle_ids:
        return {}
    found: dict[int, OpenOrderRef] = {}
    rows = (
        queries.open_orders()
        .filter(vehicle_id__in=vehicle_ids)
        .order_by("-opened_on", "-id")
        .values_list("vehicle_id", "id", "number", "state")
    )
    for vehicle_id, order_id, number, state in rows:
        if vehicle_id not in found:
            found[vehicle_id] = OpenOrderRef(id=order_id, number=number, status=state)
    return found
