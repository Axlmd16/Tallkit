"""Proyecciones de lectura de proformas: sin costos, sin escrituras y con un único reloj.

El estado efectivo (vigente o vencida) se calcula aquí con el día local; nunca se persiste ni
se escribe al consultar. Una oferta emitida se proyecta desde sus instantáneas; un borrador,
desde las referencias vigentes.
"""

from datetime import date, timedelta
from typing import Any
from uuid import UUID

from django.db.models import Q, QuerySet

import sales.application.proforma_links as proforma_links
from catalog.application.sales_references import get_sale_product_references
from identity.application.authorization import has_permission, require_permission
from identity.models import User
from proformas.application import clock, references
from proformas.application.errors import ProformaApplicationError, field_error, not_found
from proformas.application.offer import (
    LineSource,
    availability_warnings,
    money,
    normalized_rate,
    project_lines,
    project_totals,
)
from proformas.domain.validity import (
    EffectiveState,
    ProformaState,
    allowed_actions,
    effective_state,
    suggested_valid_until,
)
from proformas.models import Proforma, ProformaLine

PAGE_SIZE_MAX = 100
QUOTE_NOTICE = (
    "Cotización interna e informativa. No reserva unidades ni garantiza disponibilidad o "
    "precio al comprar: la venta revalida los valores vigentes. No es una factura "
    "electrónica autorizada por el SRI."
)
_ACTION_PERMISSIONS = {
    "edit": "proformas.gestionar",
    "issue": "proformas.gestionar",
    "copy": "proformas.gestionar",
    "void": "proformas.anular",
    "convert": "proformas.convertir",
}


def sources_of(proforma: Proforma) -> tuple[LineSource, ...]:
    return tuple(
        LineSource(line.position, line.product_id, line.quantity)
        for line in proforma.lines.order_by("position")
    )


def _customer(proforma: Proforma) -> dict[str, Any] | None:
    """Cliente histórico o vigente; ``None`` si la oferta se hizo sin cliente."""
    snapshot = proforma.header_snapshot
    if snapshot is not None:
        return dict(snapshot["customer"]) if snapshot["customer"] else None
    customer = proforma.customer
    if customer is None:
        return None
    return {
        "id": customer.pk,
        "name": customer.name,
        "identification_type": customer.identification_type,
        "identification": customer.identification,
        "phone": customer.phone,
        "email": customer.email,
        "address": customer.address,
        "is_active": customer.is_active,
    }


def _reference(proforma: Proforma, today: date) -> dict[str, Any]:
    return {
        "id": proforma.pk,
        "number": proforma.internal_number,
        "state": effective_state(proforma.state, proforma.valid_until, today).value,
    }


def _sale(link: proforma_links.ProformaSaleLink | None, actor: User) -> dict[str, Any] | None:
    if link is None:
        return None
    return {
        "id": link.sale_id,
        "internal_number": link.internal_number,
        "state": link.state,
        "can_open": has_permission(actor, "ventas.ver"),
    }


def _actions(proforma: Proforma, actor: User, today: date) -> list[str]:
    actions = [
        action
        for action in allowed_actions(proforma.state, proforma.valid_until, today)
        if has_permission(actor, _ACTION_PERMISSIONS[action])
    ]
    if action_convert_needs_sales(actions, actor):
        actions.remove("convert")
    if proforma.internal_number:
        actions.append("print")
    return actions


def action_convert_needs_sales(actions: list[str], actor: User) -> bool:
    return "convert" in actions and not has_permission(actor, "ventas.crear")


def base(
    proforma: Proforma,
    *,
    actor: User,
    today: date,
    link: proforma_links.ProformaSaleLink | None,
) -> dict[str, Any]:
    """Datos comunes de lista y detalle, sin líneas."""
    state = effective_state(proforma.state, proforma.valid_until, today)
    return {
        "id": proforma.pk,
        "state": state.value,
        "version": proforma.version,
        "internal_number": proforma.internal_number,
        "customer": _customer(proforma),
        "issue_date": proforma.issue_date.isoformat() if proforma.issue_date else None,
        "valid_until": proforma.valid_until.isoformat() if proforma.valid_until else None,
        "base_total": money(proforma.base_total),
        "tax_total": money(proforma.tax_total),
        "grand_total": money(proforma.grand_total),
        "origin": _reference(proforma.origin, today) if proforma.origin else None,
        "sale": _sale(link, actor),
        "allowed_actions": _actions(proforma, actor, today),
        "created_at": proforma.created_at.isoformat(),
        "issued_at": proforma.issued_at.isoformat() if proforma.issued_at else None,
        "converted_at": proforma.converted_at.isoformat() if proforma.converted_at else None,
        "voided_at": proforma.voided_at.isoformat() if proforma.voided_at else None,
        "fiscal_scope": "COMERCIAL",
    }


def issued_lines(proforma: Proforma) -> list[dict[str, Any]]:
    """Líneas históricas de una oferta emitida; nunca se recalculan."""
    lines: list[ProformaLine] = list(proforma.lines.order_by("position"))
    # Ofertas emitidas antes de conservar código de fabricante o marca: se leen del catálogo.
    frozen = ("manufacturer_code", "brand_name")
    missing = [
        line.product_id
        for line in lines
        if line.product_snapshot is not None
        and any(key not in line.product_snapshot for key in frozen)
    ]
    current = get_sale_product_references(missing) if missing else {}

    def catalog_value(line: ProformaLine, key: str) -> str:
        snapshot = line.product_snapshot or {}
        if key in snapshot:
            return str(snapshot[key])
        ref = current.get(line.product_id)
        return str(getattr(ref, key)) if ref else ""

    return [
        {
            "position": line.position,
            "product_id": line.product_id,
            "product_code": line.product_snapshot["code"],
            "manufacturer_code": catalog_value(line, "manufacturer_code"),
            "brand_name": catalog_value(line, "brand_name"),
            "product_name": line.product_snapshot["name"],
            "is_kit": line.product_snapshot["is_kit"],
            "quantity": f"{line.quantity:.0f}",
            "unit_price": money(line.unit_price),
            "tax_rate": normalized_rate(line.tax_rate),
            "base_amount": money(line.base_amount),
            "tax_amount": money(line.tax_amount),
            "total_amount": money(line.total_amount),
            "availability_at_issue": f"{line.availability_at_issue:.0f}",
            "availability_sufficient": bool(line.product_snapshot["availability_sufficient"]),
        }
        for line in lines
        if line.product_snapshot is not None and line.availability_at_issue is not None
    ]


def detail(proforma: Proforma, *, actor: User, today: date | None = None) -> dict[str, Any]:
    on = today or clock.today()
    link = (
        proforma_links.get_sale_link(proforma.pk)
        if proforma.state == ProformaState.CONVERTED
        else None
    )
    result = base(proforma, actor=actor, today=on, link=link)
    result["derived"] = [_reference(item, on) for item in proforma.derived.order_by("created_at")]
    if proforma.internal_number:
        result["lines"] = issued_lines(proforma)
        result["totals"] = {
            "base": money(proforma.base_total),
            "tax": money(proforma.tax_total),
            "total": money(proforma.grand_total),
        }
        return result
    view = references.read_view(
        customer_id=proforma.customer_id,
        sources=sources_of(proforma),
        on=on,
        explicit_valid_until=proforma.valid_until,
    )
    result["lines"] = project_lines(view)
    result["totals"] = project_totals(view)
    result["suggested_valid_until"] = suggested_valid_until(on).isoformat()
    result["warnings"] = availability_warnings(view)
    return result


def project(actor: User) -> Any:
    """Proyector de resultados de comando con los permisos vigentes del actor."""

    def projector(proforma_id: int) -> dict[str, Any]:
        proforma = Proforma.objects.select_related("customer", "origin").get(pk=proforma_id)
        return detail(proforma, actor=actor)

    return projector


def _authorize(actor: User, action: str, target: str, request_id: UUID | None) -> None:
    require_permission(
        actor=actor,
        permission="proformas.ver",
        request_id=request_id,
        denial_action=action,
        target_type="proforma",
        target_id=target,
    )


def get_proforma(
    *, actor: User, proforma_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    _authorize(actor, "proformas.proforma_viewed", str(proforma_id), request_id)
    proforma = Proforma.objects.select_related("customer", "origin").filter(pk=proforma_id).first()
    if proforma is None:
        raise not_found()
    return detail(proforma, actor=actor)


def filter_by_effective_state(
    queryset: QuerySet[Proforma], state: str, today: date
) -> QuerySet[Proforma]:
    """El filtro usa la misma fecha local que la proyección del estado."""
    if state == EffectiveState.VALID:
        return queryset.filter(state=ProformaState.ISSUED, valid_until__gte=today)
    if state == EffectiveState.EXPIRED:
        return queryset.filter(state=ProformaState.ISSUED, valid_until__lt=today)
    if state in {EffectiveState.DRAFT, EffectiveState.CONVERTED, EffectiveState.VOIDED}:
        return queryset.filter(state=state)
    raise field_error("validation_error", "state", "Estado de proforma no válido.")


def expiring(queryset: QuerySet[Proforma], today: date, within_days: int) -> QuerySet[Proforma]:
    """Ofertas vigentes cuya vigencia termina dentro de los días indicados, contando hoy."""
    if within_days < 0:
        raise field_error("validation_error", "expires_within_days", "Use cero o más días.")
    return filter_by_effective_state(queryset, EffectiveState.VALID, today).filter(
        valid_until__lte=today + timedelta(days=within_days)
    )


def list_proformas(
    *,
    actor: User,
    search: str = "",
    state: str | None = None,
    customer_id: int | None = None,
    expires_within_days: int | None = None,
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> dict[str, Any]:
    _authorize(actor, "proformas.proforma_listed", "list", request_id)
    if page < 1:
        raise field_error("validation_error", "page", "La página debe ser al menos 1.")
    if not 1 <= page_size <= PAGE_SIZE_MAX:
        raise field_error(
            "validation_error", "page_size", f"El tamaño debe estar entre 1 y {PAGE_SIZE_MAX}."
        )
    today = clock.today()
    queryset = Proforma.objects.select_related("customer", "origin")
    if state:
        queryset = filter_by_effective_state(queryset, state, today)
    if expires_within_days is not None:
        queryset = expiring(queryset, today, expires_within_days)
    if customer_id:
        queryset = queryset.filter(customer_id=customer_id)
    term = search.strip()
    if term:
        queryset = queryset.filter(
            Q(internal_number__icontains=term)
            | Q(customer__name__icontains=term)
            | Q(customer__identification__icontains=term)
        )
    queryset = queryset.order_by("-created_at", "-id")
    total = queryset.count()
    offset = (page - 1) * page_size
    rows = list(queryset[offset : offset + page_size])
    links = proforma_links.sale_links(
        row.pk for row in rows if row.state == ProformaState.CONVERTED
    )
    return {
        "items": [base(row, actor=actor, today=today, link=links.get(row.pk)) for row in rows],
        "total_count": total,
        "page": page,
        "page_size": page_size,
    }


def _issued(proforma_id: int) -> Proforma:
    proforma = (
        Proforma.objects.select_related("customer", "origin", "brand_asset")
        .filter(pk=proforma_id)
        .first()
    )
    if proforma is None:
        raise not_found()
    if not proforma.internal_number:
        raise ProformaApplicationError(
            "proforma_not_issued", "Un borrador no tiene documento emitido ni número."
        )
    return proforma


def document(*, actor: User, proforma_id: int, request_id: UUID | None = None) -> dict[str, Any]:
    """Cotización imprimible con datos históricos; la disponibilidad actual va aparte."""
    _authorize(actor, "proformas.document_viewed", str(proforma_id), request_id)
    proforma = _issued(proforma_id)
    today = clock.today()
    snapshot = proforma.header_snapshot or {}
    lines = issued_lines(proforma)
    current = references.current_availability(
        sorted({line["product_id"] for line in lines}), references.current_context()
    )
    return {
        "notice": QUOTE_NOTICE,
        "number": proforma.internal_number,
        "state": effective_state(proforma.state, proforma.valid_until, today).value,
        "issue_date": proforma.issue_date.isoformat() if proforma.issue_date else None,
        "valid_until": proforma.valid_until.isoformat() if proforma.valid_until else None,
        "issuer": snapshot.get("issuer"),
        "has_logo": proforma.brand_asset_id is not None,
        "customer": _customer(proforma),
        "lines": [{k: v for k, v in line.items() if k != "product_id"} for line in lines],
        "base_total": money(proforma.base_total),
        "tax_total": money(proforma.tax_total),
        "grand_total": money(proforma.grand_total),
        "availability_observed_at": snapshot.get("availability_observed_at"),
        "current_availability": [
            {
                "position": line["position"],
                "product_code": line["product_code"],
                "available": f"{current[line['product_id']]:.0f}"
                if line["product_id"] in current
                else None,
            }
            for line in lines
        ],
        "origin": _reference(proforma.origin, today) if proforma.origin else None,
    }


def document_logo(
    *, actor: User, proforma_id: int, request_id: UUID | None = None
) -> tuple[bytes, str] | None:
    """Bytes históricos del logo emitido; ``None`` si la oferta se emitió sin logo."""
    _authorize(actor, "proformas.document_logo_viewed", str(proforma_id), request_id)
    proforma = _issued(proforma_id)
    asset = proforma.brand_asset
    if asset is None:
        return None
    return bytes(asset.content), asset.mime_type
