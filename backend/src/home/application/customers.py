"""Cuentas de los clientes: deuda y actividad por negocio, compuestas desde cada módulo dueño.

Como el resto del inicio, no consulta tablas ajenas: usa las lecturas que cada módulo publica en
su ``home_summary`` y estas devuelven ``None`` cuando el actor no puede ver el dato. Los importes
de los dos negocios van siempre separados y nunca se suman.
"""

from datetime import date
from decimal import Decimal
from typing import Any

from django.utils import timezone

import customer_registry.application.home_summary as customer_summary_reads
import sales.application.home_summary as sales_summary
import workshop.application.home_summary as workshop_summary
from home.application.snapshot import read_snapshot
from identity.models import User


class CustomersHiddenError(Exception):
    """El actor no puede ver clientes."""


class CustomerMissingError(Exception):
    """El cliente pedido no existe."""


def _money(value: Decimal | None) -> str | None:
    return None if value is None else f"{value:.2f}"


def _iso(value: date | None) -> str | None:
    return None if value is None else value.isoformat()


def debtors(actor: User) -> dict[str, Any]:
    """Clientes con deuda en algún negocio que el actor puede ver, con el saldo de cada uno."""
    with read_snapshot():
        commercial = sales_summary.debts_by_customer(actor)
        artisan = workshop_summary.debts_by_customer(actor)
        cards = customer_summary_reads.customer_cards(
            actor, set(commercial or {}) | set(artisan or {})
        )
    if cards is None:
        raise CustomersHiddenError
    items = [
        {
            "customer_id": card.id,
            "name": card.name,
            "identification": card.identification,
            "person_type": card.person_type,
            "commercial": _money((commercial or {}).get(card.id)),
            "artisan": _money((artisan or {}).get(card.id)),
        }
        for card in cards
    ]
    return {
        "items": items,
        "visible": {"commercial": commercial is not None, "artisan": artisan is not None},
    }


def _block(activity: Any, debts: dict[int, Decimal] | None, customer_id: int) -> Any:
    if activity is None and debts is None:
        return None
    return {
        "spent_year": None if activity is None else _money(activity.spent),
        "documents_year": None if activity is None else activity.documents,
        "last_on": None if activity is None else _iso(activity.last_on),
        "balance": None if debts is None else _money(debts.get(customer_id, Decimal("0.00"))),
    }


def customer_summary(actor: User, customer_id: int) -> dict[str, Any]:
    """Visitas, gasto del año y deuda del cliente, cada negocio en su propio bloque.

    Un bloque es ``None`` si el actor no puede ver nada de ese negocio; dentro de él, el gasto o
    el saldo son ``None`` si falta el permiso que los muestra.
    """
    exists = customer_summary_reads.customer_exists(actor, customer_id)
    if exists is None:
        raise CustomersHiddenError
    if not exists:
        raise CustomerMissingError
    today = timezone.localdate()
    since = today.replace(month=1, day=1)
    with read_snapshot():
        visits = workshop_summary.customer_visits(actor, customer_id, since=since)
        commercial = _block(
            sales_summary.customer_activity(actor, customer_id, since=since),
            sales_summary.debts_by_customer(actor),
            customer_id,
        )
        artisan = _block(
            workshop_summary.customer_activity(actor, customer_id, since=since),
            workshop_summary.debts_by_customer(actor),
            customer_id,
        )
    return {
        "customer_id": customer_id,
        "year": today.year,
        "visits": None
        if visits is None
        else {"count_year": visits.count, "last_on": _iso(visits.last_on)},
        "commercial": commercial,
        "artisan": artisan,
    }
