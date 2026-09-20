"""Consultas y proyecciones JSON de compras (solo Administrador)."""

from datetime import date
from decimal import Decimal
from typing import Any

from django.db.models import Q

from catalog.application.inventory_references import get_product_references
from identity.application.authorization import require_permission
from identity.models import User
from purchasing.application.calculation import (
    LineComputation,
    TaxBasis,
    compute_lines,
    document_totals,
)
from purchasing.application.errors import not_found
from purchasing.domain.amounts import DocumentTotals, InventoryTaxTreatment
from purchasing.domain.draft_input import LineInput
from purchasing.models import Purchase, PurchaseLine
from supplier_registry.application.purchase_references import (
    get_supplier_reference,
    list_supplier_references,
)
from workshop_configuration.application.operation_context import (
    list_commercial_tax_options,
    review_tax_options,
)

MAX_PAGE_SIZE = 100


def money(value: Decimal | None, places: int = 2) -> str | None:
    return None if value is None else f"{value:.{places}f}"


def _iso(value: Any) -> str | None:
    return None if value is None else str(value.isoformat())


def totals_dict(totals: DocumentTotals | None) -> dict[str, str] | None:
    if totals is None:
        return None
    return {
        "base": f"{totals.base:.2f}",
        "tax": f"{totals.tax:.2f}",
        "total": f"{totals.total:.2f}",
        "inventory_value": f"{totals.inventory_value:.2f}",
    }


def line_inputs(lines: list[PurchaseLine]) -> list[LineInput]:
    return [
        LineInput(
            product_id=line.product_id,
            quantity=line.quantity,
            unit_cost=line.unit_cost,
            tax_definition_id=line.tax_definition_id,
            treatment=InventoryTaxTreatment(line.tax_treatment),
        )
        for line in lines
    ]


def tax_bases(tax_ids: set[int], on: date) -> dict[int, TaxBasis]:
    review = review_tax_options(tax_ids, on=on)
    return {pk: TaxBasis(pk, r.status, r.rate) for pk, r in review.items()}


def _line_dict(
    line: PurchaseLine, computation: LineComputation | None, product: Any, confirmed: bool
) -> dict[str, Any]:
    if confirmed and line.product_snapshot:
        snap = line.product_snapshot
        product_dict = {
            "id": snap["product_id"],
            "code": snap["code"],
            "name": snap["name"],
            "unit_name": snap["unit_name"],
            "unit_symbol": snap["unit_symbol"],
            "is_active": None,
        }
    else:
        product_dict = {
            "id": line.product_id,
            "code": getattr(product, "code", None),
            "name": getattr(product, "name", None),
            "unit_name": getattr(product, "unit_name", None),
            "unit_symbol": getattr(product, "unit_symbol", None),
            "is_active": getattr(product, "is_active", None),
        }
    if confirmed and line.base_amount is not None:
        amounts: dict[str, str | None] | None = {
            "base": money(line.base_amount),
            "tax": money(line.tax_amount),
            "total": money(line.total_amount),
            "inventory_value": money(line.inventory_value),
        }
        snap_tax = line.tax_snapshot or {}
        tax = {
            "definition_id": line.tax_definition_id,
            "code": snap_tax.get("code"),
            "rate": snap_tax.get("rate"),
            "status": "applicable",
        }
    else:
        c = computation
        amounts = None
        if c is not None and c.amounts is not None:
            amounts = {
                "base": money(c.amounts.base),
                "tax": money(c.amounts.tax),
                "total": money(c.amounts.total),
                "inventory_value": money(c.amounts.inventory_value),
            }
        tax = {
            "definition_id": line.tax_definition_id,
            "code": None,
            "rate": None if c is None or c.rate is None else str(c.rate.normalize()),
            "status": c.tax_status if c else "absent",
        }
    return {
        "id": line.pk,
        "position": line.position,
        "product": product_dict,
        "quantity": f"{line.quantity:.0f}",
        "unit_cost": money(line.unit_cost, 6),
        "tax_recoverability": line.tax_treatment,
        "tax": tax,
        "amounts": amounts,
    }


def purchase_detail(purchase: Purchase) -> dict[str, Any]:
    """Proyección completa del ingreso; confirmados y anulados salen de sus snapshots."""
    identity = purchase.document_identity
    lines = list(purchase.lines.order_by("position"))
    confirmed = purchase.state != "DRAFT"
    totals: dict[str, str | None] | None
    if confirmed:
        computations: list[LineComputation | None] = [None] * len(lines)
        totals = (
            None
            if purchase.grand_total is None
            else {
                "base": money(purchase.base_total),
                "tax": money(purchase.tax_total),
                "total": money(purchase.grand_total),
                "inventory_value": money(purchase.inventory_value_total),
            }
        )
        status = "calculated"
        supplier = purchase.supplier_snapshot or {}
        supplier_dict = {
            "id": supplier.get("id", identity.supplier_id),
            "name": supplier.get("name"),
            "identification_type": supplier.get("identification_type"),
            "identification": supplier.get("identification"),
        }
        product_refs: dict[int, Any] = {}
    else:
        bases = tax_bases({line.tax_definition_id for line in lines}, purchase.document_date)
        computations = list(compute_lines(line_inputs(lines), bases))
        calculated = document_totals([c for c in computations if c is not None])
        as_text = totals_dict(calculated)
        totals = None if as_text is None else {**as_text}
        status = "calculated" if totals is not None else "not_calculable"
        ref = get_supplier_reference(identity.supplier_id)
        supplier_dict = {
            "id": identity.supplier_id,
            "name": ref.name if ref else None,
            "identification_type": ref.identification_type if ref else None,
            "identification": ref.identification if ref else None,
            "is_active": ref.is_active if ref else None,
        }
        product_refs = get_product_references(line.product_id for line in lines)
    return {
        "id": purchase.pk,
        "state": purchase.state,
        "version": purchase.version,
        "internal_number": purchase.internal_number,
        "supplier": supplier_dict,
        "document": {
            "type": identity.document_type,
            "reference": identity.reference,
            "normalized_reference": identity.normalized_reference,
            "no_document_reason": purchase.no_document_explanation,
        },
        "document_date": purchase.document_date.isoformat(),
        "notes": purchase.observation,
        "replaces_id": purchase.replaces_id,
        "replacements": [
            {"id": r.pk, "state": r.state, "internal_number": r.internal_number}
            for r in purchase.replacements.order_by("id")
        ],
        "created_at": _iso(purchase.created_at),
        "updated_at": _iso(purchase.updated_at),
        "confirmed_at": _iso(purchase.confirmed_at),
        "voided_at": _iso(purchase.voided_at),
        "void_reason": purchase.void_reason,
        "inventory_operation_id": purchase.inventory_operation_id,
        "void_operation_id": purchase.void_operation_id,
        "totals": totals,
        "totals_status": status,
        "lines": [
            _line_dict(line, comp, product_refs.get(line.product_id), confirmed)
            for line, comp in zip(lines, computations, strict=True)
        ],
    }


def get_purchase(*, actor: User, purchase_id: int) -> dict[str, Any]:
    require_permission(
        actor=actor,
        permission="ingresos.ver",
        request_id=None,
        denial_action="purchasing.purchase_viewed",
        target_type="purchase",
        target_id=str(purchase_id),
    )
    purchase = Purchase.objects.select_related("document_identity").filter(pk=purchase_id).first()
    if purchase is None:
        raise not_found()
    return purchase_detail(purchase)


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
) -> dict[str, Any]:
    require_permission(
        actor=actor,
        permission="ingresos.ver",
        request_id=None,
        denial_action="purchasing.purchase_listed",
        target_type="purchase",
        target_id="list",
    )
    page_size = max(1, min(page_size, MAX_PAGE_SIZE))
    page = max(1, page)
    queryset = Purchase.objects.select_related("document_identity")
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
            | Q(document_identity__normalized_reference__icontains=term)
            | Q(document_identity__supplier_id__in=supplier_ids)
        )
    if supplier_id is not None:
        queryset = queryset.filter(document_identity__supplier_id=supplier_id)
    if state:
        queryset = queryset.filter(state=state)
    if date_from:
        queryset = queryset.filter(document_date__gte=date_from)
    if date_to:
        queryset = queryset.filter(document_date__lte=date_to)
    queryset = queryset.order_by("-document_date", "-id")
    count = queryset.count()
    offset = (page - 1) * page_size
    rows = list(queryset[offset : offset + page_size])
    suppliers = {
        r.id: r
        for r in (
            get_supplier_reference(pk) for pk in {p.document_identity.supplier_id for p in rows}
        )
        if r
    }
    results = [
        {
            "id": p.pk,
            "state": p.state,
            "version": p.version,
            "internal_number": p.internal_number,
            "supplier": {
                "id": p.document_identity.supplier_id,
                "name": suppliers[p.document_identity.supplier_id].name
                if p.document_identity.supplier_id in suppliers
                else None,
            },
            "document": {
                "type": p.document_identity.document_type,
                "reference": p.document_identity.reference,
            },
            "document_date": p.document_date.isoformat(),
            "total": money(p.grand_total),
        }
        for p in rows
    ]
    return {
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": -(-count // page_size) if count else 0,
        "results": results,
    }


def list_tax_options(
    *,
    actor: User,
    document_date: date,
    search: str = "",
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    """Opciones tributarias comerciales a la fecha del documento; solo lectura."""
    require_permission(
        actor=actor,
        permission="ingresos.crear",
        request_id=None,
        denial_action="purchasing.tax_options_listed",
        target_type="purchase",
        target_id="tax-options",
    )
    result = list_commercial_tax_options(
        on=document_date, search=search, page=page, page_size=page_size
    )
    count = result.total_count
    return {
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": -(-count // page_size) if count else 0,
        "results": [
            {
                "id": o.id,
                "code": o.code,
                "name": o.name,
                "entity_type": o.entity_type,
                "rate": None if o.rate is None else str(o.rate.normalize()),
                "tax_status": o.tax_status,
            }
            for o in result.items
        ],
    }
