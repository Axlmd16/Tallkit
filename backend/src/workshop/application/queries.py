"""Consultas del taller: listado, historial por cliente o vehículo y opciones de selección.

Todas exigen ``mantenimientos.ver``. Los totales se agregan en SQL y el resumen de servicios
se carga en una sola consulta por página, sin N+1.
"""

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db.models import (
    Case,
    DecimalField,
    ExpressionWrapper,
    F,
    OuterRef,
    Q,
    Subquery,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce

from catalog.application.workshop_references import list_service_options
from customer_registry.application.workshop_references import (
    get_active_states,
    list_customer_options,
    list_vehicle_options,
)
from identity.application.authorization import require_permission
from identity.models import User
from workshop.application import projection
from workshop.application.commands import TARGET_TYPE
from workshop.application.errors import WorkshopError
from workshop.application.support import business_today
from workshop.domain.states import OrderState
from workshop.models import ArtisanPayment, MaintenanceOrder, ServiceLine, ServiceOperation

MAX_PAGE_SIZE = 100
SUMMARY_NAMES = 3


def _authorize(actor: User, request_id: UUID | None, target_id: str = "list") -> None:
    require_permission(
        actor=actor,
        permission="mantenimientos.ver",
        request_id=request_id,
        denial_action="maintenance.view",
        target_type=TARGET_TYPE,
        target_id=target_id,
    )


def _bad(name: str, message: str) -> WorkshopError:
    return WorkshopError("validation_error", f"Parámetro inválido: {name}.", {name: [message]})


def _page(page: int, page_size: int) -> tuple[int, int]:
    if page < 1:
        raise _bad("page", "Debe ser mayor o igual a 1.")
    if not 1 <= page_size <= MAX_PAGE_SIZE:
        raise _bad("page_size", f"Use un valor entre 1 y {MAX_PAGE_SIZE}.")
    return page, page_size


def list_orders(
    *,
    actor: User,
    search: str = "",
    state: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    customer_id: int | None = None,
    vehicle_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> dict[str, Any]:
    _authorize(actor, request_id)
    page, page_size = _page(page, page_size)
    queryset = MaintenanceOrder.objects.all()
    term = (search or "").strip()
    if term:
        queryset = queryset.filter(
            Q(number__icontains=term)
            | Q(customer_snapshot__name__icontains=term)
            | Q(customer_snapshot__identification__icontains=term)
            | Q(vehicle_snapshot__plate__icontains=term)
        )
    if state:
        if state not in OrderState.__members__:
            raise _bad("state", "Use REGISTERED, FINALIZED o REOPENED.")
        queryset = queryset.filter(state=state)
    if date_from and date_to and date_from > date_to:
        raise _bad("date_from", "La fecha inicial no puede ser posterior a la final.")
    if date_from:
        queryset = queryset.filter(opened_on__gte=date_from)
    if date_to:
        queryset = queryset.filter(opened_on__lte=date_to)
    if customer_id:
        queryset = queryset.filter(customer_id=customer_id)
    if vehicle_id:
        queryset = queryset.filter(vehicle_id=vehicle_id)
    total = queryset.count()
    subtotal = ExpressionWrapper(
        F("interventions__service_lines__quantity")
        * F("interventions__service_lines__applied_price"),
        output_field=DecimalField(max_digits=24, decimal_places=2),
    )
    offset = (page - 1) * page_size
    rows = list(
        queryset.annotate(
            services_total=Coalesce(
                Sum(subtotal), Value(Decimal("0.00")), output_field=DecimalField()
            )
        ).order_by("-opened_on", "-sequence")[offset : offset + page_size]
    )
    ids = [row.pk for row in rows]
    summaries: dict[int, dict[str, Any]] = {pk: {"names": [], "line_count": 0} for pk in ids}
    for order_id, name in (
        ServiceLine.objects.filter(intervention__order_id__in=ids)
        .order_by("intervention__order_id", "intervention__ordinal", "position", "id")
        .values_list("intervention__order_id", "service_name")
    ):
        summary = summaries[order_id]
        summary["line_count"] += 1
        if len(summary["names"]) < SUMMARY_NAMES and name not in summary["names"]:
            summary["names"].append(name)
    customers, vehicles = get_active_states(
        {row.customer_id for row in rows}, {row.vehicle_id for row in rows}
    )
    items = [
        {
            "id": row.pk,
            "number": row.number,
            "state": row.state,
            "opened_on": row.opened_on.isoformat(),
            "odometer_km": row.odometer_km,
            "customer": {
                "id": row.customer_id,
                "name": row.customer_snapshot.get("name", ""),
                "identification": row.customer_snapshot.get("identification", ""),
                "is_active": customers.get(row.customer_id, False),
            },
            "vehicle": {
                "id": row.vehicle_id,
                "plate": row.vehicle_snapshot.get("plate", ""),
                "brand": row.vehicle_snapshot.get("brand", ""),
                "model": row.vehicle_snapshot.get("model", ""),
                "is_active": vehicles.get(row.vehicle_id, False),
            },
            "services_total": projection.money(row.services_total),
            "service_summary": summaries[row.pk],
        }
        for row in rows
    ]
    return {"items": items, "total_count": total, "page": page, "page_size": page_size}


def get_order(*, actor: User, order_id: int, request_id: UUID | None = None) -> dict[str, Any]:
    _authorize(actor, request_id, str(order_id))
    return projection.order_detail(order_id, actor)


def customer_options(
    *,
    actor: User,
    search: str = "",
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> dict[str, Any]:
    _authorize(actor, request_id, "options")
    page, page_size = _page(page, page_size)
    result = list_customer_options(search=search, page=page, page_size=page_size)
    return {
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "identification_type": c.identification_type,
                "identification": c.identification,
                "phone": c.phone,
            }
            for c in result.items
        ],
        "total_count": result.total_count,
        "page": page,
        "page_size": page_size,
    }


def vehicle_options(
    *, actor: User, customer_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    _authorize(actor, request_id, "options")
    vehicles = list_vehicle_options(customer_id)
    open_orders = {
        vehicle_id: {"id": pk, "number": number}
        for vehicle_id, pk, number in MaintenanceOrder.objects.filter(
            vehicle_id__in=[v.id for v in vehicles],
            state__in=[OrderState.REGISTERED.value, OrderState.REOPENED.value],
        ).values_list("vehicle_id", "pk", "number")
    }
    items = [
        {
            "id": v.id,
            "plate": v.plate,
            "brand": v.brand_name,
            "model": v.model,
            "year": v.year,
            "color": v.color,
            "open_order": open_orders.get(v.id),
        }
        for v in vehicles
    ]
    return {"items": items, "total_count": len(items), "page": 1, "page_size": max(len(items), 1)}


def service_options(
    *,
    actor: User,
    search: str = "",
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> dict[str, Any]:
    _authorize(actor, request_id, "options")
    page, page_size = _page(page, page_size)
    result = list_service_options(search=search, page=page, page_size=page_size)
    return {
        "items": [
            {
                "id": s.id,
                "name": s.name,
                "description": s.description,
                "reference_price": projection.money(s.reference_price),
            }
            for s in result.items
        ],
        "total_count": result.total_count,
        "page": page,
        "page_size": page_size,
    }


# --- Cuentas por cobrar artesanales ---------------------------------------------------------

PAYMENT_STATES = ("PENDING", "PARTIAL", "PAID")
_MONEY: "DecimalField[Decimal, Decimal]" = DecimalField(max_digits=24, decimal_places=2)


def _receivable_rows() -> Any:
    paid = (
        ArtisanPayment.objects.filter(service_operation=OuterRef("pk"), correction__isnull=True)
        .values("service_operation")
        .annotate(total=Sum("amount"))
        .values("total")
    )
    return (
        ServiceOperation.objects.filter(state="CONFIRMED")
        .annotate(paid_amount=Coalesce(Subquery(paid, output_field=_MONEY), Value(Decimal(0))))
        .annotate(
            balance_amount=ExpressionWrapper(F("grand_total") - F("paid_amount"), _MONEY),
            payment_state=Case(
                When(balance_amount__lte=0, then=Value("PAID")),
                When(paid_amount__gt=0, then=Value("PARTIAL")),
                default=Value("PENDING"),
            ),
        )
    )


def artisan_receivables(
    *,
    actor: User,
    customer_id: int | None = None,
    order_id: int | None = None,
    payment_state: str | None = None,
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> dict[str, Any]:
    """Deuda del RUC artesanal por operación; nunca incluye ventas comerciales ni compensa RUC.

    Sin filtro de estado de pago muestra solo lo pendiente o parcial. Las sumas corresponden a
    todas las coincidencias, no a la página. La antigüedad cuenta días desde la confirmación y
    no expresa mora ni vencimiento.
    """
    require_permission(
        actor=actor,
        permission="pagos_artesanales.ver",
        request_id=request_id,
        denial_action="maintenance.artisan_receivables",
        target_type="service_operation",
        target_id="list",
    )
    page, page_size = _page(page, page_size)
    if payment_state is not None and payment_state not in PAYMENT_STATES:
        raise _bad("payment_state", "Use PENDING, PARTIAL o PAID.")
    rows = _receivable_rows()
    if customer_id is not None:
        rows = rows.filter(customer_id=customer_id)
    if order_id is not None:
        rows = rows.filter(order_id=order_id)
    if payment_state is None:
        rows = rows.filter(balance_amount__gt=0)
    else:
        rows = rows.filter(payment_state=payment_state)
    sums = rows.aggregate(
        grand_total=Coalesce(Sum("grand_total"), Value(Decimal(0)), output_field=_MONEY),
        paid=Coalesce(Sum("paid_amount"), Value(Decimal(0)), output_field=_MONEY),
        balance=Coalesce(Sum("balance_amount"), Value(Decimal(0)), output_field=_MONEY),
    )
    count = rows.count()
    today = business_today()
    start = (page - 1) * page_size
    page_rows = rows.select_related("order").order_by("operational_date", "id")[
        start : start + page_size
    ]
    return {
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": (count + page_size - 1) // page_size if count else 0,
        "totals": {key: f"{value:.2f}" for key, value in sums.items()},
        "results": [
            {
                "id": row.pk,
                "internal_number": row.internal_number,
                "fiscal_entity": "ARTESANAL",
                "document_type": "SERVICIO",
                "order_id": row.order_id,
                "order_number": row.order.number,
                "customer_id": row.customer_id,
                "customer_name": row.customer_snapshot.get("name", ""),
                "condition": row.condition,
                "operational_date": row.operational_date.isoformat(),
                "age_days": (today - row.operational_date).days,
                "grand_total": f"{row.grand_total:.2f}",
                "paid": f"{row.paid_amount:.2f}",
                "balance": f"{row.balance_amount:.2f}",
                "payment_state": row.payment_state,
            }
            for row in page_rows
        ],
    }
