"""Prevalidación y proyección de solo lectura para «Cobrar y facturar»."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from django.utils import timezone

from checkout.application.errors import CheckoutError
from customer_registry.application.workshop_references import read_customer_contact
from fiscal.application.preparations import find_active_preparation
from identity.application.authorization import has_permission
from identity.models import User
from sales.application import reviews as sale_reviews
from sales.application import sales as sales_app
from sales.application.errors import SalesApplicationError
from workshop.application import economic_summary, service_operations
from workshop.application import queries as workshop_queries
from workshop.application.errors import WorkshopError
from workshop_configuration.application.brand import BrandUnavailableError, read_entity_brand
from workshop_configuration.application.electronic_status import evaluate_electronic_status
from workshop_configuration.application.withholding_settings import withholding_settings

ZERO = Decimal("0.00")
FINAL_CONSUMER_MAX = Decimal("50.00")
GUAYAQUIL = ZoneInfo("America/Guayaquil")


def _today() -> date:
    return timezone.now().astimezone(GUAYAQUIL).date()


def _money(value: Decimal) -> str:
    return f"{value:.2f}"


def _dec(value: Any) -> Decimal:
    if value in (None, ""):
        return ZERO
    return Decimal(str(value))


def _business_info(entity_type: str) -> tuple[int | None, str]:
    fallback = "Repuestos" if entity_type == "COMERCIAL" else "Servicios"
    try:
        brand = read_entity_brand(entity_type)
        name = (
            (brand.identity.trade_name or "").strip()
            or (brand.identity.legal_name or "").strip()
            or fallback
        )
        return brand.identity.entity_id, name
    except BrandUnavailableError:
        return None, fallback


def _fiscal_status_block(
    *,
    actor: User,
    entity_type: str,
    entity_id: int | None,
    source_kind: str,
    source_id: int | None,
    total: Decimal,
) -> dict[str, Any]:
    perm = (
        "fiscal.comercial.preparar" if entity_type == "COMERCIAL" else "fiscal.artesanal.preparar"
    )
    can_prepare_perm = has_permission(actor, perm)
    existing_state: str | None = None
    existing_id: str | None = None
    if source_id is not None and can_prepare_perm:
        active = find_active_preparation(actor=actor, source_kind=source_kind, source_id=source_id)
        if active is not None:
            existing_state = str(active.state)
            existing_id = str(active.preparation_id)

    impediments: list[str] = []
    if entity_id is not None:
        es = evaluate_electronic_status(entity_id=entity_id, on=_today())
        if es.causes:
            impediments.extend(cause.message for cause in es.causes)
    else:
        impediments.append("La entidad fiscal no está configurada.")

    can_prepare = can_prepare_perm and existing_state != "PREPARED" and len(impediments) == 0
    return {
        "can_prepare_permission": can_prepare_perm,
        "state": existing_state or "NONE",
        "preparation_id": existing_id,
        "can_prepare": can_prepare,
        "impediments": impediments,
        "can_use_final_consumer": total > ZERO and total <= FINAL_CONSUMER_MAX,
    }


def _withholding_info(entity_type: str) -> dict[str, Any]:
    cfg = withholding_settings(entity_type)
    return {
        "enabled": cfg.registration_enabled,
        "alert_percentage": (
            str(cfg.warning_percentage) if cfg.warning_percentage is not None else None
        ),
    }


def _customer_block(customer_id: int, snapshot: dict[str, Any], actor: User) -> dict[str, Any]:
    contact = read_customer_contact(customer_id)
    return {
        "id": customer_id,
        "name": snapshot.get("name") or "",
        "identification_type": snapshot.get("identification_type") or "",
        "identification": snapshot.get("identification") or "",
        "email": contact.email or "",
        "address": contact.address or "",
        "is_withholding_agent": bool(snapshot.get("is_withholding_agent", False)),
        "can_save_email": has_permission(actor, "clientes.gestionar"),
    }


def preview_maintenance_checkout(
    *, actor: User, order_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    """Proyecta el estado de «Cobrar y facturar» para una orden de mantenimiento."""
    can_view_order = has_permission(actor, "mantenimientos.ver")
    can_view_sales = has_permission(actor, "ventas.ver")
    if not can_view_order and not can_view_sales:
        raise CheckoutError(
            "permission_denied",
            "No tiene permiso para consultar este mantenimiento.",
            status=403,
        )

    try:
        order = workshop_queries.get_order(actor=actor, order_id=order_id, request_id=request_id)
        summary = economic_summary.order_economic_summary(
            actor=actor, order_id=order_id, request_id=request_id
        )
    except WorkshopError as exc:
        code_status = 404 if exc.code == "not_found" else 400
        raise CheckoutError(exc.code, exc.message, status=code_status) from None

    artisan_entity_id, artisan_name = _business_info("ARTESANAL")
    commercial_entity_id, commercial_name = _business_info("COMERCIAL")

    # Bloque artesanal (servicios)
    artisan_visible = bool(summary["artisan"]["visible"])
    can_confirm_art = has_permission(actor, "servicios_economicos.confirmar")
    can_collect_art = has_permission(actor, "pagos_artesanales.registrar")
    can_fiscal_art = has_permission(actor, "fiscal.artesanal.preparar")

    artisan_pending = summary["artisan"].get("pending")
    artisan_docs = [d for d in summary["artisan"].get("documents", []) if d["state"] == "CONFIRMED"]
    # Operación artesanal activa para cobrar/facturar: la confirmada con saldo o sin factura,
    # o las líneas pendientes de documentar.
    target_art_doc = next(
        (d for d in reversed(artisan_docs) if _dec(d.get("balance")) > ZERO),
        artisan_docs[-1] if artisan_docs else None,
    )
    artisan_lines: list[dict[str, Any]] = []
    artisan_issues: list[str] = []
    artisan_total = ZERO
    artisan_balance = ZERO
    artisan_target_id: int | None = None
    artisan_action_needed = False

    if artisan_visible:
        if artisan_pending and can_confirm_art:
            try:
                prev = service_operations.preview_operation(
                    actor=actor,
                    order_id=order_id,
                    payload={"condition": "CONTADO"},
                    request_id=request_id,
                )
                artisan_lines = [
                    {
                        "description": line.get("service_name")
                        or line.get("description")
                        or "Servicio",
                        "quantity": str(line.get("quantity", "1")),
                        "total": str(line.get("total_amount") or line.get("total") or "0.00"),
                    }
                    for line in prev.get("lines", [])
                ]
                prev_totals = prev.get("totals") or {}
                artisan_total = _dec(prev_totals.get("grand_total") or prev_totals.get("total"))
                artisan_balance = artisan_total
                artisan_issues.extend(i["message"] for i in prev.get("issues", []))
                artisan_action_needed = True
            except WorkshopError as exc:
                artisan_issues.append(exc.message)
        elif target_art_doc is not None:
            artisan_target_id = int(target_art_doc["id"])
            artisan_total = _dec(target_art_doc.get("grand_total"))
            artisan_balance = _dec(target_art_doc.get("balance"))
            artisan_lines = [
                {
                    "description": line.get("description")
                    or line.get("service_name")
                    or "Servicio",
                    "quantity": line.get("quantity", "1"),
                    "total": line.get("total_amount") or line.get("subtotal") or "0.00",
                }
                for line in target_art_doc.get("lines", [])
            ]
            artisan_action_needed = artisan_balance > ZERO

    artisan_fiscal = _fiscal_status_block(
        actor=actor,
        entity_type="ARTESANAL",
        entity_id=artisan_entity_id,
        source_kind="ARTISAN",
        source_id=artisan_target_id,
        total=artisan_total,
    )
    if artisan_visible and artisan_target_id is not None and artisan_fiscal["state"] != "PREPARED":
        artisan_action_needed = artisan_action_needed or can_fiscal_art

    # Bloque comercial (repuestos)
    commercial_visible = bool(summary["commercial"]["visible"])
    can_confirm_com = has_permission(actor, "ventas.confirmar")
    can_collect_com = has_permission(actor, "pagos_comerciales.registrar")
    can_fiscal_com = has_permission(actor, "fiscal.comercial.preparar")

    pending_sale = summary["commercial"].get("pending")
    confirmed_sales = [
        d for d in summary["commercial"].get("documents", []) if d["state"] == "CONFIRMED"
    ]
    target_com_doc = next(
        (d for d in reversed(confirmed_sales) if _dec(d.get("balance")) > ZERO),
        confirmed_sales[-1] if confirmed_sales else None,
    )

    commercial_lines: list[dict[str, Any]] = []
    commercial_issues: list[str] = []
    commercial_total = ZERO
    commercial_balance = ZERO
    commercial_target_id: int | None = None
    commercial_pending_sale_id: int | None = None
    commercial_action_needed = False

    if commercial_visible:
        if pending_sale is not None:
            commercial_pending_sale_id = int(pending_sale["sale_id"])
            commercial_total = _dec(pending_sale.get("estimated_total"))
            commercial_balance = commercial_total
            commercial_lines = [
                {
                    "description": line.get("product_name") or line.get("name") or "Producto",
                    "quantity": line.get("quantity", "1"),
                    "total": line.get("total") or line.get("total_amount") or "0.00",
                }
                for line in pending_sale.get("lines", [])
            ]
            if can_confirm_com:
                try:
                    prev_sale = sale_reviews.preview_confirmation(
                        actor=actor, sale_id=commercial_pending_sale_id, request_id=request_id
                    )
                    commercial_issues.extend(i["message"] for i in prev_sale.get("issues", []))
                    if prev_sale.get("totals", {}).get("total") is not None:
                        commercial_total = _dec(prev_sale["totals"]["total"])
                        commercial_balance = commercial_total
                except SalesApplicationError as exc:
                    commercial_issues.append(exc.message)
                commercial_action_needed = True
        elif target_com_doc is not None:
            commercial_target_id = int(target_com_doc["id"])
            commercial_total = _dec(target_com_doc.get("grand_total"))
            commercial_balance = _dec(target_com_doc.get("balance"))
            commercial_lines = [
                {
                    "description": line.get("product_name")
                    or (line.get("product_snapshot") or {}).get("name")
                    or "Producto",
                    "quantity": line.get("quantity", "1"),
                    "total": line.get("total_amount") or line.get("total") or "0.00",
                }
                for line in target_com_doc.get("lines", [])
            ]
            commercial_action_needed = commercial_balance > ZERO

    commercial_fiscal = _fiscal_status_block(
        actor=actor,
        entity_type="COMERCIAL",
        entity_id=commercial_entity_id,
        source_kind="COMMERCIAL",
        source_id=commercial_target_id,
        total=commercial_total,
    )
    if (
        commercial_visible
        and commercial_target_id is not None
        and commercial_fiscal["state"] != "PREPARED"
    ):
        commercial_action_needed = commercial_action_needed or can_fiscal_com

    # Requisitos de cierre de la orden (DP-021, DP-037)
    can_finalize_perm = has_permission(actor, "mantenimientos.finalizar")
    order_open = order["state"] == "REGISTERED"
    missing_closure: list[str] = []
    if not order_open:
        missing_closure.append("La orden ya está cerrada o reabierta.")
    else:
        if not str(order.get("diagnosis") or "").strip():
            missing_closure.append("Falta registrar el diagnóstico.")
        has_any_service = bool(artisan_lines) or bool(artisan_docs)
        if not has_any_service:
            missing_closure.append("Falta al menos un servicio.")
        if commercial_pending_sale_id is not None and not can_confirm_com:
            missing_closure.append(
                "Hay repuestos reservados pendientes de confirmar por un Vendedor o Administrador."
            )
    can_close = can_finalize_perm and order_open and len(missing_closure) == 0

    customer_data = _customer_block(int(order["customer"]["id"]), order["customer"], actor)

    vehicle = order.get("vehicle") or {}
    raw_brand = vehicle.get("brand_name") or vehicle.get("brand")
    brand_name = (
        raw_brand
        if isinstance(raw_brand, str)
        else (raw_brand.get("name", "") if isinstance(raw_brand, dict) else "")
    )

    return {
        "origin": {
            "kind": "MAINTENANCE",
            "id": order["id"],
            "number": order.get("number") or order.get("internal_number") or f"#{order['id']}",
            "state": order["state"],
            "version": order["version"],
            "vehicle_plate": vehicle.get("plate"),
            "vehicle_label": f"{brand_name} {vehicle.get('model') or ''}".strip(),
        },
        "customer": customer_data,
        "artisan": {
            "visible": artisan_visible and (can_confirm_art or can_collect_art or can_fiscal_art),
            "business_name": artisan_name,
            "has_pending_lines": bool(artisan_pending),
            "operation_id": artisan_target_id,
            "document_number": target_art_doc["internal_number"] if target_art_doc else None,
            "lines": artisan_lines,
            "total": _money(artisan_total),
            "balance": _money(artisan_balance),
            "can_confirm": can_confirm_art,
            "can_collect": can_collect_art,
            "action_needed": artisan_action_needed,
            "issues": artisan_issues,
            "fiscal": artisan_fiscal,
            "withholding": _withholding_info("ARTESANAL"),
        },
        "commercial": {
            "visible": commercial_visible
            and (can_confirm_com or can_collect_com or can_fiscal_com),
            "business_name": commercial_name,
            "pending_sale_id": commercial_pending_sale_id,
            "sale_id": commercial_target_id or commercial_pending_sale_id,
            "document_number": target_com_doc["internal_number"] if target_com_doc else None,
            "lines": commercial_lines,
            "total": _money(commercial_total),
            "balance": _money(commercial_balance),
            "can_confirm": can_confirm_com,
            "can_collect": can_collect_com,
            "action_needed": commercial_action_needed,
            "issues": commercial_issues,
            "fiscal": commercial_fiscal,
            "withholding": _withholding_info("COMERCIAL"),
        },
        "closure": {
            "can_close": can_close,
            "default_checked": can_close,
            "missing_requirements": missing_closure,
        },
    }


def preview_sale_checkout(
    *, actor: User, sale_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    """Proyecta el estado de «Cobrar y facturar» para una venta comercial."""
    if not has_permission(actor, "ventas.ver"):
        raise CheckoutError(
            "permission_denied",
            "No tiene permiso para consultar esta venta.",
            status=403,
        )
    try:
        sale = sales_app.get_sale(actor=actor, sale_id=sale_id, request_id=request_id)
    except SalesApplicationError as exc:
        code_status = 404 if exc.code == "not_found" else 400
        raise CheckoutError(exc.code, exc.message, status=code_status) from None

    if sale["state"] == "VOIDED":
        raise CheckoutError("invalid_state", "La venta está anulada.", status=409)

    commercial_entity_id, commercial_name = _business_info("COMERCIAL")
    can_confirm = has_permission(actor, "ventas.confirmar")
    can_collect = has_permission(actor, "pagos_comerciales.registrar")
    can_fiscal = has_permission(actor, "fiscal.comercial.preparar")

    issues: list[str] = []
    lines: list[dict[str, Any]] = []
    total = ZERO
    balance = ZERO
    pending_sale_id: int | None = None
    confirmed_id: int | None = None

    if sale["state"] == "DRAFT":
        pending_sale_id = int(sale["id"])
        if can_confirm:
            try:
                prev = sale_reviews.preview_confirmation(
                    actor=actor, sale_id=pending_sale_id, request_id=request_id
                )
                issues.extend(i["message"] for i in prev.get("issues", []))
                total = _dec(prev.get("totals", {}).get("total"))
                balance = total
                lines = [
                    {
                        "description": line.get("product_name") or "Producto",
                        "quantity": line.get("quantity", "1"),
                        "total": line.get("total") or "0.00",
                    }
                    for line in prev.get("lines", [])
                ]
            except SalesApplicationError as exc:
                issues.append(exc.message)
    else:
        confirmed_id = int(sale["id"])
        total = _dec(sale.get("grand_total"))
        balance = _dec((sale.get("money") or {}).get("balance"))
        lines = [
            {
                "description": line.get("product_name")
                or (line.get("product_snapshot") or {}).get("name")
                or "Producto",
                "quantity": line.get("quantity", "1"),
                "total": line.get("total_amount") or "0.00",
            }
            for line in sale.get("lines", [])
        ]

    fiscal_block = _fiscal_status_block(
        actor=actor,
        entity_type="COMERCIAL",
        entity_id=commercial_entity_id,
        source_kind="COMMERCIAL",
        source_id=confirmed_id,
        total=total,
    )
    customer_id = int(sale["customer"]["id"])
    customer_data = _customer_block(customer_id, sale["customer"], actor)

    return {
        "origin": {
            "kind": "SALE",
            "id": sale["id"],
            "number": sale.get("internal_number") or f"Borrador #{sale['id']}",
            "state": sale["state"],
            "version": sale["version"],
            "vehicle_plate": None,
            "vehicle_label": None,
        },
        "customer": customer_data,
        "artisan": {
            "visible": False,
            "business_name": "",
            "has_pending_lines": False,
            "operation_id": None,
            "document_number": None,
            "lines": [],
            "total": "0.00",
            "balance": "0.00",
            "can_confirm": False,
            "can_collect": False,
            "action_needed": False,
            "issues": [],
            "fiscal": {
                "can_prepare_permission": False,
                "state": "NONE",
                "preparation_id": None,
                "can_prepare": False,
                "impediments": [],
                "can_use_final_consumer": False,
            },
            "withholding": {"enabled": False, "alert_percentage": None},
        },
        "commercial": {
            "visible": True,
            "business_name": commercial_name,
            "pending_sale_id": pending_sale_id,
            "sale_id": sale["id"],
            "document_number": sale.get("internal_number"),
            "lines": lines,
            "total": _money(total),
            "balance": _money(balance),
            "can_confirm": can_confirm,
            "can_collect": can_collect,
            "action_needed": pending_sale_id is not None
            or balance > ZERO
            or (can_fiscal and fiscal_block["state"] != "PREPARED"),
            "issues": issues,
            "fiscal": fiscal_block,
            "withholding": _withholding_info("COMERCIAL"),
        },
        "closure": {
            "can_close": False,
            "default_checked": False,
            "missing_requirements": [],
        },
    }
