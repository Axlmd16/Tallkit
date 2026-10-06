"""Resumen de trabajo del inicio.

Este módulo no tiene datos propios ni consulta tablas ajenas: compone las lecturas públicas que
cada módulo dueño publica en su ``home_summary``. Cada una devuelve ``None`` cuando el actor no
puede ver el indicador, y entonces el indicador no forma parte de la respuesta. Los valores de
los dos RUC nunca se suman.
"""

from collections.abc import Sequence
from datetime import date
from decimal import Decimal
from typing import Any, Protocol

from django.conf import settings
from django.utils import timezone

import proformas.application.home_summary as proformas_summary
import sales.application.home_summary as sales_summary
import workshop.application.home_summary as workshop_summary
import workshop_configuration.application.home_summary as configuration_summary
from home.application.snapshot import read_snapshot
from identity.models import User

COMMERCIAL = "commercial"
ARTISAN = "artisan"
_ENTITY_TYPES = {COMMERCIAL: "COMERCIAL", ARTISAN: "ARTESANAL"}


class _Receivable(Protocol):
    @property
    def balance(self) -> Decimal: ...
    @property
    def customers(self) -> int: ...


class _DayCollection(Protocol):
    @property
    def day(self) -> date: ...
    @property
    def amount(self) -> Decimal: ...


def _money(value: Decimal) -> str:
    return f"{value:.2f}"


def _pending_item(key: str, scope: str | None, count: int | None) -> list[dict[str, Any]]:
    return [] if count is None else [{"key": key, "scope": scope, "count": count}]


def _withholdings_item(scope: str, count: int | None) -> list[dict[str, Any]]:
    """Una entidad que no registra retenciones y no tiene pendientes no muestra el indicador."""
    if count is None:
        return []
    if count == 0 and not configuration_summary.registers_withholdings(_ENTITY_TYPES[scope]):
        return []
    return _pending_item("withholdings_pending", scope, count)


def pending(actor: User) -> dict[str, Any]:
    with read_snapshot():
        items = [
            *_pending_item("open_orders", None, workshop_summary.open_orders(actor)),
            *_pending_item("cash_sales_unpaid", COMMERCIAL, sales_summary.cash_sales_unpaid(actor)),
            *_pending_item(
                "cash_services_unpaid", ARTISAN, workshop_summary.cash_services_unpaid(actor)
            ),
            *_pending_item(
                "proformas_expiring", COMMERCIAL, proformas_summary.proformas_expiring(actor)
            ),
            *_withholdings_item(COMMERCIAL, sales_summary.pending_withholdings(actor)),
            *_withholdings_item(ARTISAN, workshop_summary.pending_withholdings(actor)),
            *_pending_item("sale_drafts", COMMERCIAL, sales_summary.sale_drafts(actor)),
            *_pending_item("proforma_drafts", COMMERCIAL, proformas_summary.proforma_drafts(actor)),
        ]
        notice = configuration_summary.artisan_qualification_notice(actor, on=timezone.localdate())
    qualification = (
        None
        if notice is None
        else {
            "expires_on": notice.ends_on.isoformat(),
            "days_left": notice.days_left,
            "expired": notice.expired,
        }
    )
    return {"items": items, "qualification": qualification}


def _receivable_item(scope: str, value: _Receivable | None) -> list[dict[str, Any]]:
    if value is None:
        return []
    return [{"scope": scope, "balance": _money(value.balance), "customers": value.customers}]


def receivables(actor: User) -> dict[str, Any]:
    with read_snapshot():
        items = [
            *_receivable_item(COMMERCIAL, sales_summary.receivable_balance(actor)),
            *_receivable_item(ARTISAN, workshop_summary.receivable_balance(actor)),
        ]
    return {"items": items}


def _collection_item(scope: str, days: Sequence[_DayCollection] | None) -> list[dict[str, Any]]:
    if days is None:
        return []
    return [
        {
            "scope": scope,
            "total": _money(sum((entry.amount for entry in days), Decimal("0.00"))),
            "days": [
                {"date": entry.day.isoformat(), "amount": _money(entry.amount)} for entry in days
            ],
        }
    ]


def collections(actor: User) -> dict[str, Any]:
    with read_snapshot():
        items = [
            *_collection_item(COMMERCIAL, sales_summary.collections_by_day(actor)),
            *_collection_item(ARTISAN, workshop_summary.collections_by_day(actor)),
        ]
    return {"timezone": settings.TIME_ZONE, "items": items}
