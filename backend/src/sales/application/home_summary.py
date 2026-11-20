"""Indicadores comerciales del resumen de inicio.

Cada función decide con ``has_permission`` —que no audita denegaciones— si el actor puede ver
el indicador y devuelve ``None`` cuando no puede. Los conteos reutilizan los mismos filtros que
las listas de destino, de modo que el número del inicio coincide con lo que la lista muestra.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Max, Sum

from identity.application.authorization import has_permission
from identity.models import User
from sales.application import reads, reviews, withholdings
from sales.models import CommercialPayment

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


def cash_sales_unpaid(actor: User) -> int | None:
    if not has_permission(actor, "pagos_comerciales.ver"):
        return None
    with reads.read_snapshot():
        return reads.unpaid_cash_sales().count()


def sale_drafts(actor: User) -> int | None:
    if not has_permission(actor, "ventas.ver"):
        return None
    with reads.read_snapshot():
        return reads.draft_sales().count()


def pending_withholdings(actor: User) -> int | None:
    if not has_permission(actor, "pagos_comerciales.ver"):
        return None
    with reads.read_snapshot():
        return withholdings.pending_voucher_rows().count()


def receivable_balance(actor: User) -> Receivable | None:
    """Saldo comercial por cobrar y clientes con deuda; el exceso por reembolsar no cuenta."""
    if not has_permission(actor, "pagos_comerciales.ver"):
        return None
    with reads.read_snapshot():
        owed = reads.with_debt(reads.annotated_sales())
        balance = owed.aggregate(total=Sum("balance"))["total"] or _ZERO
        customers = owed.order_by().values("customer_id").distinct().count()
    return Receivable(balance=balance, customers=customers)


def collections_by_day(actor: User, *, today: date | None = None) -> list[DayCollection] | None:
    """Dinero cobrado por día en los últimos siete días; sin retenciones ni pagos corregidos."""
    if not has_permission(actor, "pagos_comerciales.ver"):
        return None
    today = today or reviews.today()
    start = today - timedelta(days=COLLECTION_DAYS - 1)
    with reads.read_snapshot():
        rows = (
            CommercialPayment.objects.filter(
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


def debts_by_customer(actor: User) -> dict[int, Decimal] | None:
    """Saldo comercial por cobrar de cada cliente con deuda; el exceso por reembolsar no cuenta."""
    if not has_permission(actor, "pagos_comerciales.ver"):
        return None
    with reads.read_snapshot():
        rows = (
            reads.with_debt(reads.annotated_sales())
            .order_by()
            .values("customer_id")
            .annotate(total=Sum("balance"))
        )
        return {row["customer_id"]: row["total"] for row in rows}


def customer_activity(actor: User, customer_id: int, *, since: date) -> CustomerActivity | None:
    """Ventas confirmadas del cliente desde ``since`` (neto de devoluciones) y la última venta."""
    if not has_permission(actor, "ventas.ver"):
        return None
    with reads.read_snapshot():
        confirmed = reads.annotated_sales().filter(customer_id=customer_id, state="CONFIRMED")
        period = confirmed.filter(sale_date__gte=since).aggregate(
            total=Sum("exigible"), documents=Count("pk")
        )
        last = confirmed.aggregate(last=Max("sale_date"))["last"]
    return CustomerActivity(
        spent=period["total"] or _ZERO, documents=period["documents"], last_on=last
    )
