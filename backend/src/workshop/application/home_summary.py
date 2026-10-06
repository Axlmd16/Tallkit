"""Indicadores del taller y del RUC artesanal para el resumen de inicio.

Cada función decide con ``has_permission`` —que no audita denegaciones— si el actor puede ver
el indicador y devuelve ``None`` cuando no puede. Los conteos reutilizan los mismos filtros que
las listas de destino, de modo que el número del inicio coincide con lo que la lista muestra.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from identity.application.authorization import has_permission
from identity.models import User
from workshop.application import artisan_withholdings, queries
from workshop.application.support import business_today
from workshop.models import ArtisanPayment

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
