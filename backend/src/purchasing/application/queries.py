"""Consultas y proyecciones JSON de entradas de stock y compras anteriores.

La proyección económica (costos, impuestos, totales e identificación del proveedor) depende de
``productos.ver_costos``: se omite en el servidor, nunca se envía nulo para ocultarla en el
cliente. Quien solo posee ``ingresos.ver`` recibe productos, cantidades, usuario y estado.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from django.db.models import Count, Q, QuerySet, Sum
from django.db.models.functions import Coalesce

from catalog.application.inventory_references import get_product_references
from identity.application.authorization import has_permission, require_permission
from identity.models import User
from purchasing.application.errors import not_found
from purchasing.models import Purchase, PurchaseLine
from supplier_registry.application.purchase_references import (
    get_supplier_reference,
    list_supplier_references,
)

MAX_PAGE_SIZE = 100
COSTS_PERMISSION = "productos.ver_costos"
_TZ = ZoneInfo("America/Guayaquil")


def money(value: Decimal | None, places: int = 2) -> str | None:
    return None if value is None else f"{value:.{places}f}"


def _iso(value: Any) -> str | None:
    return None if value is None else str(value.isoformat())


def can_see_costs(actor: User) -> bool:
    return has_permission(actor, COSTS_PERMISSION)


def user_name(user: User | None) -> str | None:
    if user is None:
        return None
    return user.get_full_name().strip() or user.get_username()


def _person(user: User | None) -> dict[str, Any] | None:
    return None if user is None else {"id": user.pk, "name": user_name(user)}


def _line_dict(
    line: PurchaseLine, product: Any, *, confirmed: bool, include_costs: bool, flow: str
) -> dict[str, Any]:
    snapshot = line.product_snapshot if confirmed and line.product_snapshot else None
    if snapshot is not None:
        product_dict = {
            "id": snapshot["product_id"],
            "code": snapshot["code"],
            "name": snapshot["name"],
            "unit_name": snapshot["unit_name"],
            "unit_symbol": snapshot["unit_symbol"],
        }
    else:
        product_dict = {
            "id": line.product_id,
            "code": getattr(product, "code", None),
            "name": getattr(product, "name", None),
            "unit_name": getattr(product, "unit_name", None),
            "unit_symbol": getattr(product, "unit_symbol", None),
        }
    result: dict[str, Any] = {
        "id": line.pk,
        "position": line.position,
        "product": product_dict,
        "quantity": f"{line.quantity:.0f}",
    }
    if include_costs:
        result["cost_registered"] = line.unit_cost is not None
        result["unit_cost"] = money(line.unit_cost, 6)
        if flow == "LEGACY":
            snap_tax = line.tax_snapshot or {}
            result["tax_recoverability"] = line.tax_treatment
            result["tax"] = {
                "definition_id": line.tax_definition_id,
                "code": snap_tax.get("code"),
                "rate": snap_tax.get("rate"),
            }
            result["amounts"] = (
                None
                if line.base_amount is None
                else {
                    "base": money(line.base_amount),
                    "tax": money(line.tax_amount),
                    "total": money(line.total_amount),
                    "inventory_value": money(line.inventory_value),
                }
            )
    return result


def _supplier_dict(purchase: Purchase, *, include_costs: bool) -> dict[str, Any] | None:
    snapshot = purchase.supplier_snapshot or {}
    supplier_id = purchase.supplier_id
    identity = purchase.document_identity
    if supplier_id is None and identity is not None:
        supplier_id = identity.supplier_id
    if supplier_id is None:
        return None
    name = snapshot.get("name")
    if name is None:
        reference = get_supplier_reference(supplier_id)
        name = reference.name if reference else None
    result: dict[str, Any] = {"id": supplier_id, "name": name}
    if include_costs:
        result["identification_type"] = snapshot.get("identification_type")
        result["identification"] = snapshot.get("identification")
    return result


def purchase_detail(purchase: Purchase, *, include_costs: bool) -> dict[str, Any]:
    """Detalle de una entrada o de una compra anterior, según la autorización del lector."""
    lines = list(purchase.lines.order_by("position"))
    confirmed = purchase.state != "DRAFT"
    product_refs = {} if confirmed else get_product_references(line.product_id for line in lines)
    result: dict[str, Any] = {
        "id": purchase.pk,
        "flow": purchase.flow,
        "state": purchase.state,
        "version": purchase.version,
        "internal_number": purchase.internal_number,
        "supplier": _supplier_dict(purchase, include_costs=include_costs),
        "reference": purchase.external_reference
        if purchase.flow == "SIMPLE"
        else (purchase.document_identity.reference if purchase.document_identity else ""),
        "observation": purchase.observation,
        "registered_by": _person(purchase.confirmed_by or purchase.created_by),
        "created_at": _iso(purchase.created_at),
        "confirmed_at": _iso(purchase.confirmed_at),
        "voided_at": _iso(purchase.voided_at),
        "void_reason": purchase.void_reason,
        "voided_by": _person(purchase.voided_by),
        "inventory_operation_id": purchase.inventory_operation_id,
        "void_operation_id": purchase.void_operation_id,
        "lines": [
            _line_dict(
                line,
                product_refs.get(line.product_id),
                confirmed=confirmed,
                include_costs=include_costs,
                flow=purchase.flow,
            )
            for line in lines
        ],
    }
    if purchase.flow == "LEGACY" and include_costs and purchase.document_identity is not None:
        identity = purchase.document_identity
        result["legacy"] = {
            "document": {
                "type": identity.document_type,
                "reference": identity.reference,
                "no_document_reason": purchase.no_document_explanation,
            },
            "document_date": _iso(purchase.document_date),
            "replaces_id": purchase.replaces_id,
            "replacements": [
                {"id": r.pk, "state": r.state, "internal_number": r.internal_number}
                for r in purchase.replacements.order_by("id")
            ],
            "totals": None
            if purchase.grand_total is None
            else {
                "base": money(purchase.base_total),
                "tax": money(purchase.tax_total),
                "total": money(purchase.grand_total),
                "inventory_value": money(purchase.inventory_value_total),
            },
            "is_pending_draft": purchase.state == "DRAFT",
        }
    return result


def get_purchase(*, actor: User, purchase_id: int) -> dict[str, Any]:
    require_permission(
        actor=actor,
        permission="ingresos.ver",
        request_id=None,
        denial_action="purchasing.purchase_viewed",
        target_type="purchase",
        target_id=str(purchase_id),
    )
    include_costs = can_see_costs(actor)
    purchase = (
        Purchase.objects.select_related(
            "document_identity", "confirmed_by", "created_by", "voided_by"
        )
        .filter(pk=purchase_id)
        .first()
    )
    # Un borrador anterior solo es visible para el Administrador.
    if purchase is None or (purchase.state == "DRAFT" and not include_costs):
        raise not_found()
    return purchase_detail(purchase, include_costs=include_costs)


def _day_start(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=_TZ)


def registered_by_options() -> list[dict[str, Any]]:
    users = User.objects.filter(
        pk__in=Purchase.objects.exclude(confirmed_by=None).values("confirmed_by_id")
    ).order_by("first_name", "last_name", "username")
    return [{"id": u.pk, "name": user_name(u)} for u in users]


def _filtered(
    queryset: QuerySet[Purchase],
    *,
    search: str,
    supplier_id: int | None,
    state: str | None,
    date_from: date | None,
    date_to: date | None,
    registered_by: int | None,
) -> QuerySet[Purchase]:
    if search.strip():
        term = search.strip()
        supplier_ids = [
            r.id
            for r in list_supplier_references(
                search=term, include_inactive=True, page_size=100
            ).items
        ]
        queryset = queryset.filter(
            Q(internal_number__icontains=term)
            | Q(external_reference__icontains=term)
            | Q(document_identity__normalized_reference__icontains=term)
            | Q(supplier_id__in=supplier_ids)
            | Q(document_identity__supplier_id__in=supplier_ids)
        )
    if supplier_id is not None:
        queryset = queryset.filter(
            Q(supplier_id=supplier_id) | Q(document_identity__supplier_id=supplier_id)
        )
    if state:
        queryset = queryset.filter(state=state)
    if date_from:
        queryset = queryset.filter(confirmed_at__gte=_day_start(date_from))
    if date_to:
        queryset = queryset.filter(confirmed_at__lt=_day_start(date_to + timedelta(days=1)))
    if registered_by is not None:
        queryset = queryset.filter(confirmed_by_id=registered_by)
    return queryset


def list_purchases(
    *,
    actor: User,
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    supplier_id: int | None = None,
    state: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    registered_by: int | None = None,
) -> dict[str, Any]:
    require_permission(
        actor=actor,
        permission="ingresos.ver",
        request_id=None,
        denial_action="purchasing.purchase_listed",
        target_type="purchase",
        target_id="list",
    )
    include_costs = can_see_costs(actor)
    page_size = max(1, min(page_size, MAX_PAGE_SIZE))
    page = max(1, page)
    base = Purchase.objects.all()
    if not include_costs:
        base = base.exclude(state="DRAFT")
    queryset = (
        _filtered(
            base,
            search=search,
            supplier_id=supplier_id,
            state=state,
            date_from=date_from,
            date_to=date_to,
            registered_by=registered_by,
        )
        .select_related("document_identity", "confirmed_by", "created_by")
        .annotate(
            product_count=Count("lines", distinct=True),
            unit_count=Coalesce(Sum("lines__quantity"), Decimal(0)),
            moment=Coalesce("confirmed_at", "created_at"),
        )
        .order_by("-moment", "-id")
    )
    count = queryset.count()
    offset = (page - 1) * page_size
    rows = list(queryset[offset : offset + page_size])
    results = []
    for purchase in rows:
        item: dict[str, Any] = {
            "id": purchase.pk,
            "flow": purchase.flow,
            "state": purchase.state,
            "internal_number": purchase.internal_number,
            "moment": _iso(purchase.moment),
            "registered_by": _person(purchase.confirmed_by or purchase.created_by),
            "product_count": purchase.product_count,
            "unit_count": f"{purchase.unit_count:.0f}",
            "supplier": _supplier_dict(purchase, include_costs=False),
        }
        if include_costs and purchase.grand_total is not None:
            item["total"] = money(purchase.grand_total)
        results.append(item)
    return {
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": -(-count // page_size) if count else 0,
        "results": results,
        "registered_by_options": registered_by_options(),
    }
