"""Resumen económico de una orden por RUC y vista comercial restringida para el Vendedor.

Es una consulta: no crea obligaciones ni permite cobrar el conjunto. Los documentos de cada
RUC se presentan en bloques separados; lo pendiente de documentar se distingue de lo
confirmado y cada línea se cuenta una sola vez. El total combinado es solo informativo.
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

from identity.application.authorization import has_permission, require_permission
from identity.models import User
from sales.application.workshop_links import linked_sales_summary
from workshop.application.errors import WorkshopError, not_found
from workshop.application.service_operations import order_operations
from workshop.domain.amounts import line_subtotal
from workshop.models import MaintenanceOrder, ServiceLine

ZERO = Decimal("0.00")


def _money(value: Decimal) -> str:
    return f"{value:.2f}"


def _dec(value: str | None) -> Decimal:
    return Decimal(value) if value is not None else ZERO


def _commercial_documents(order_id: int, actor: User) -> tuple[list[dict[str, Any]], Any]:
    can_pay = has_permission(actor, "pagos_comerciales.registrar")
    full = has_permission(actor, "ventas.ver")
    documents: list[dict[str, Any]] = []
    pending: dict[str, Any] | None = None
    for sale in linked_sales_summary(order_id):
        if sale["state"] == "DRAFT":
            if sale["lines"]:
                estimate = sale.get("estimate") or {}
                totals = estimate.get("totals") or {}
                pending = {
                    "sale_id": sale["id"],
                    "label": "Reservado, pendiente de confirmar: no descuenta inventario ni "
                    "genera deuda.",
                    "line_count": len(sale["lines"]),
                    "lines": estimate.get("lines", []),
                    "estimated_total": totals.get("total"),
                }
            continue
        money = sale["money"]
        balance = _dec(money["balance"])
        actions = ["pay"] if can_pay and sale["state"] == "CONFIRMED" and balance > 0 else []
        document = {
            "id": sale["id"],
            "fiscal_entity": "COMERCIAL",
            "document_type": "VENTA",
            "internal_number": sale["internal_number"],
            "state": sale["state"],
            "condition": sale["condition"],
            "grand_total": sale["grand_total"],
            "paid": money["applied"],
            "balance": money["balance"],
            "payment_state": money["payment_state"],
            "lines": sale["lines"],
            "allowed_actions": actions,
            "can_open_sale": full,
        }
        documents.append(document)
    return documents, pending


def _artisan_block(order: MaintenanceOrder, actor: User) -> dict[str, Any]:
    documents = [
        {**summary, "fiscal_entity": "ARTESANAL", "document_type": "SERVICIO"}
        for summary in order_operations(order.pk, actor)
    ]
    pending_lines = list(
        ServiceLine.objects.filter(intervention__order=order, intervention__kind="INITIAL")
        .exclude(documentations__is_current=True)
        .order_by("position", "id")
    )
    estimated = sum(
        (line_subtotal(line.quantity, line.applied_price) for line in pending_lines), ZERO
    )
    pending = None
    if pending_lines and estimated > 0:
        pending = {
            "label": "Pendiente de documentar: todavía no genera deuda.",
            "line_count": len(pending_lines),
            "estimated_total": _money(estimated),
        }
    confirmed = [d for d in documents if d["state"] == "CONFIRMED"]
    return {
        "visible": True,
        "fiscal_entity": "ARTESANAL",
        "documents": documents,
        "pending": pending,
        "confirmed_total": _money(sum((_dec(d["grand_total"]) for d in confirmed), ZERO)),
        "balance_total": _money(sum((_dec(d["balance"]) for d in confirmed), ZERO)),
    }


def order_economic_summary(
    *, actor: User, order_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    require_permission(
        actor=actor,
        permission="mantenimientos.ver",
        request_id=request_id,
        denial_action="maintenance.economic_summary",
        target_type="maintenance_order",
        target_id=str(order_id),
    )
    order = MaintenanceOrder.objects.filter(pk=order_id).first()
    if order is None:
        raise not_found()
    documents, pending = _commercial_documents(order.pk, actor)
    confirmed = [d for d in documents if d["state"] == "CONFIRMED"]
    commercial = {
        "visible": True,
        "fiscal_entity": "COMERCIAL",
        "documents": documents,
        "pending": pending,
        "confirmed_total": _money(sum((_dec(d["grand_total"]) for d in confirmed), ZERO)),
        "balance_total": _money(sum((_dec(d["balance"]) for d in confirmed), ZERO)),
    }
    artisan = (
        _artisan_block(order, actor)
        if has_permission(actor, "servicios_economicos.ver")
        else {"visible": False, "documents": [], "pending": None}
    )
    combined = None
    if artisan["visible"] and has_permission(actor, "ventas.ver"):
        pending_total = _dec((pending or {}).get("estimated_total")) + _dec(
            (artisan["pending"] or {}).get("estimated_total")
        )
        combined = {
            "informative": True,
            "confirmed_total": _money(
                _dec(commercial["confirmed_total"]) + _dec(artisan["confirmed_total"])
            ),
            "pending_total": _money(pending_total),
        }
    return {
        "order_id": order.pk,
        "order_number": order.number,
        "commercial": commercial,
        "artisan": artisan,
        "combined": combined,
        "notice": "Los importes de cada RUC se cobran por separado; el total combinado es "
        "informativo y no constituye una deuda única ni una factura.",
    }


def commercial_view(
    *, actor: User, order_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    """Vista restringida de la orden de origen para quien consulta ventas vinculadas."""
    require_permission(
        actor=actor,
        permission="ventas.ver",
        request_id=request_id,
        denial_action="maintenance.commercial_view",
        target_type="maintenance_order",
        target_id=str(order_id),
    )
    order = MaintenanceOrder.objects.filter(pk=order_id).first()
    parts = linked_sales_summary(order_id) if order is not None else []
    if order is None or not parts:
        raise WorkshopError("not_found", "Orden de mantenimiento no encontrada.")
    customer = order.customer_snapshot
    vehicle = order.vehicle_snapshot
    return {
        "id": order.pk,
        "number": order.number,
        "state": order.state,
        "opened_on": order.opened_on.isoformat(),
        "customer": {
            "name": customer.get("name"),
            "identification": customer.get("identification"),
        },
        "vehicle": {
            "plate": vehicle.get("plate"),
            "brand": vehicle.get("brand"),
            "model": vehicle.get("model"),
        },
        "parts": parts,
    }
