"""Revisión previa de solo lectura y token firmado de 15 minutos.

El token liga actor, acción, venta, versión y huella del contenido y de los efectos relevantes;
no contiene costos ni datos del cliente. En escritura el servicio recalcula la huella bajo
bloqueo y la compara: si cambió, ``review_required``. Las revisiones nunca crean recibos,
números, usos fiscales ni reservas.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from django.core import signing

import inventory.application.queries as inventory_queries
from catalog.application.sales_references import (
    SaleProductReference,
    get_sale_product_references,
)
from customer_registry.application.sales_references import (
    CustomerReference,
    get_customer_reference,
)
from identity.application.authorization import has_permission, require_permission
from identity.models import User
from sales.application import queries
from sales.application.calculation import (
    LineComputation,
    LineSource,
    compute_lines,
    document_totals,
)
from sales.application.errors import SalesApplicationError, field_error, not_found
from sales.domain.amounts import AmountValidationError, parse_quantity
from sales.domain.draft_input import DRAFT_FIELDS, LINE_FIELDS, MAX_LINES
from sales.models import Sale, SaleLine
from shared.command_values import canonical_fingerprint
from workshop_configuration.application.operation_context import (
    OperationContext,
    OperationContextError,
    get_operation_context,
    review_tax_options,
)

REVIEW_SALT = "sales.review"
REVIEW_MAX_AGE_SECONDS = 15 * 60
CONFIRM_ACTION = "sale.confirm"
_TZ = ZoneInfo("America/Guayaquil")
INTERNAL_NOTICE = "Documento interno; no es una factura electrónica autorizada por el SRI."


def today() -> date:
    return datetime.now(tz=_TZ).date()


def issue_token(*, actor: User, action: str, sale_id: int, version: int, digest: str) -> str:
    """Token firmado con identificadores y huella; sin costos ni datos del cliente."""
    return signing.dumps(
        {"a": actor.pk, "act": action, "s": sale_id, "v": version, "d": digest}, salt=REVIEW_SALT
    )


def read_token(
    token: Any,
    *,
    actor: User,
    action: str,
    sale_id: int,
    version: int | None,
    max_age: int | None = REVIEW_MAX_AGE_SECONDS,
) -> str:
    """Valida firma, vencimiento y ligadura a actor, acción, venta y versión; devuelve la huella."""
    if not isinstance(token, str) or not token:
        raise field_error("validation_error", "review_token", "La revisión es obligatoria.")
    try:
        data = signing.loads(token, salt=REVIEW_SALT, max_age=max_age)
    except signing.SignatureExpired:
        raise field_error(
            "review_required", "review_token", "La revisión venció. Revise nuevamente."
        ) from None
    except signing.BadSignature:
        raise field_error("validation_error", "review_token", "La revisión no es válida.") from None
    if (
        not isinstance(data, dict)
        or data.get("a") != actor.pk
        or data.get("act") != action
        or data.get("s") != sale_id
        or (version is not None and data.get("v") != version)
    ):
        raise field_error("validation_error", "review_token", "La revisión no corresponde.")
    return str(data["d"])


@dataclass(frozen=True)
class Issue:
    code: str
    field: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "field": self.field, "message": self.message}


@dataclass(frozen=True)
class ReviewSnapshot:
    sale: Sale
    lines: list[SaleLine]
    customer: CustomerReference | None
    products: dict[int, SaleProductReference]
    rates: dict[int, Decimal | None]
    computations: list[LineComputation]
    context: OperationContext | None
    operational_date: date
    availability: dict[int, Decimal]


def _normalized(rate: Decimal | None) -> str | None:
    return None if rate is None else format(rate.normalize(), "f")


def confirmation_digest(snapshot: ReviewSnapshot) -> str:
    """Huella de contenido y efectos relevantes de la confirmación."""
    sale = snapshot.sale
    context = snapshot.context
    return canonical_fingerprint(
        {
            "sale_id": sale.pk,
            "customer_id": sale.customer_id,
            "customer_active": None if snapshot.customer is None else snapshot.customer.is_active,
            "condition": sale.condition,
            "operational_date": snapshot.operational_date.isoformat(),
            "lines": [
                [
                    comp.position,
                    comp.product_id,
                    f"{comp.quantity:.0f}",
                    None if comp.unit_price is None else str(comp.unit_price),
                    comp.tax_definition_id,
                    _normalized(comp.tax_rate),
                    None
                    if comp.amounts is None
                    else [str(comp.amounts.total), str(comp.amounts.base), str(comp.amounts.tax)],
                ]
                for comp in snapshot.computations
            ],
            "availability": {str(k): f"{v:.0f}" for k, v in sorted(snapshot.availability.items())},
            "entity_id": None if context is None else context.entity_id,
            "warehouse_id": None if context is None else context.warehouse_id,
        }
    )


def collect_issues(snapshot: ReviewSnapshot) -> list[Issue]:
    issues: list[Issue] = []
    if snapshot.customer is None:
        issues.append(Issue("inactive_reference", "customer_id", "El cliente no existe."))
    elif not snapshot.customer.is_active:
        issues.append(Issue("inactive_reference", "customer_id", "El cliente está inactivo."))
    if not snapshot.lines:
        issues.append(Issue("validation_error", "lines", "Agregue al menos una línea."))
    needed: dict[int, Decimal] = defaultdict(Decimal)
    for index, comp in enumerate(snapshot.computations):
        ref = snapshot.products.get(comp.product_id)
        if ref is None or not ref.is_active:
            issues.append(
                Issue(
                    "inactive_reference",
                    f"lines.{index}.product_id",
                    "El producto no existe." if ref is None else "El producto está inactivo.",
                )
            )
            continue
        if comp.amounts is None:
            issues.append(
                Issue(
                    "configuration_missing",
                    f"lines.{index}.product_id",
                    "El impuesto del producto no tiene una tarifa vigente única para hoy.",
                )
            )
        needed[comp.product_id] += comp.quantity
    for index, comp in enumerate(snapshot.computations):
        available = snapshot.availability.get(comp.product_id, Decimal(0))
        if needed.get(comp.product_id, Decimal(0)) > available:
            issues.append(
                Issue(
                    "insufficient_stock",
                    f"lines.{index}.quantity",
                    f"Existencia insuficiente: hay {available:.0f} disponibles.",
                )
            )
    if snapshot.context is None:
        issues.append(
            Issue("configuration_missing", "configuration", "Falta la configuración comercial.")
        )
    return issues


def build_snapshot(sale: Sale) -> ReviewSnapshot:
    """Estado actual, sin bloqueos, del que depende la confirmación."""
    lines = list(sale.lines.order_by("position"))
    products = get_sale_product_references(line.product_id for line in lines)
    on = today()
    reviews = review_tax_options({p.tax_definition_id for p in products.values()}, on=on)
    rates = {pk: review.rate for pk, review in reviews.items()}
    computations = compute_lines(
        [LineSource(line.position, line.product_id, line.quantity) for line in lines],
        products,
        rates,
    )
    try:
        context: OperationContext | None = get_operation_context()
    except OperationContextError:
        context = None
    availability: dict[int, Decimal] = {}
    if context is not None:
        for product_id in {line.product_id for line in lines}:
            position = inventory_queries.get_position(product_id, warehouse_id=context.warehouse_id)
            availability[product_id] = position.quantity if position else Decimal(0)
    return ReviewSnapshot(
        sale=sale,
        lines=lines,
        customer=get_customer_reference(sale.customer_id),
        products=products,
        rates=rates,
        computations=computations,
        context=context,
        operational_date=on,
        availability=availability,
    )


def _projection(snapshot: ReviewSnapshot, *, include_costs: bool) -> dict[str, Any]:
    totals = document_totals(snapshot.computations)
    effects = []
    needed: dict[int, Decimal] = defaultdict(Decimal)
    for comp in snapshot.computations:
        needed[comp.product_id] += comp.quantity
    for product_id, quantity in needed.items():
        available = snapshot.availability.get(product_id, Decimal(0))
        ref = snapshot.products.get(product_id)
        effect: dict[str, Any] = {
            "product_id": product_id,
            "code": ref.code if ref else None,
            "name": ref.name if ref else None,
            "quantity_to_sell": f"{quantity:.0f}",
            "current_quantity": f"{available:.0f}",
            "resulting_quantity": f"{available - quantity:.0f}",
        }
        if include_costs and snapshot.context is not None:
            position = inventory_queries.get_position(
                product_id, warehouse_id=snapshot.context.warehouse_id
            )
            effect["current_average_cost"] = f"{position.average:.6f}" if position else None
        effects.append(effect)
    return {
        "lines": [
            {
                "position": comp.position,
                "product_id": comp.product_id,
                "product_code": (snapshot.products[comp.product_id].code)
                if comp.product_id in snapshot.products
                else None,
                "product_name": (snapshot.products[comp.product_id].name)
                if comp.product_id in snapshot.products
                else None,
                "quantity": f"{comp.quantity:.0f}",
                "unit_price": queries.money(comp.unit_price),
                "tax_rate": _normalized(comp.tax_rate),
                "base_amount": queries.money(comp.amounts.base if comp.amounts else None),
                "tax_amount": queries.money(comp.amounts.tax if comp.amounts else None),
                "total_amount": queries.money(comp.amounts.total if comp.amounts else None),
            }
            for comp in snapshot.computations
        ],
        "totals": None
        if totals is None
        else {
            "base": queries.money(totals.base),
            "tax": queries.money(totals.tax),
            "total": queries.money(totals.total),
        },
        "effects": effects,
        "operational_date": snapshot.operational_date.isoformat(),
    }


def preview_confirmation(
    *, actor: User, sale_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    """Revisión de solo lectura: importes, efectos y token; sin uso fiscal ni numeración."""
    require_permission(
        actor=actor,
        permission="ventas.confirmar",
        request_id=request_id,
        denial_action="sales.sale_reviewed",
        target_type="sale",
        target_id=str(sale_id),
    )
    sale = Sale.objects.filter(pk=sale_id).first()
    if sale is None:
        raise not_found()
    result: dict[str, Any] = {
        "sale_id": sale.pk,
        "state": sale.state,
        "version": sale.version,
        "can_confirm": False,
        "issues": [],
        "review_token": None,
        "expires_in_seconds": REVIEW_MAX_AGE_SECONDS,
        "totals": None,
        "effects": [],
        "lines": [],
    }
    if sale.state != "DRAFT":
        return result
    snapshot = build_snapshot(sale)
    issues = collect_issues(snapshot)
    include_costs = has_permission(actor, "inventario.ver_valorizacion")
    result.update(_projection(snapshot, include_costs=include_costs))
    result["issues"] = [issue.as_dict() for issue in issues]
    if not issues:
        result["can_confirm"] = True
        result["review_token"] = issue_token(
            actor=actor,
            action=CONFIRM_ACTION,
            sale_id=sale.pk,
            version=sale.version,
            digest=confirmation_digest(snapshot),
        )
    return result


def _lenient_lines(payload: dict[str, Any]) -> tuple[list[LineSource], list[Issue]]:
    issues: list[Issue] = []
    sources: list[LineSource] = []
    raw = payload.get("lines", [])
    if not isinstance(raw, list) or len(raw) > MAX_LINES:
        return [], [Issue("validation_error", "lines", "Las líneas no son válidas.")]
    for index, item in enumerate(raw):
        prefix = f"lines.{index}"
        if not isinstance(item, dict):
            issues.append(Issue("validation_error", prefix, "La línea debe ser un objeto."))
            continue
        extra = sorted(set(item) - LINE_FIELDS)
        if extra:
            raise SalesApplicationError(
                "unknown_field",
                "La solicitud contiene campos no admitidos.",
                {f"{prefix}.{name}": ["Campo no admitido."] for name in extra},
            )
        product_id = item.get("product_id")
        if isinstance(product_id, bool) or not isinstance(product_id, int) or product_id < 1:
            issues.append(
                Issue("validation_error", f"{prefix}.product_id", "Seleccione un producto.")
            )
            continue
        try:
            quantity = parse_quantity(item.get("quantity"))
        except AmountValidationError as error:
            issues.append(
                Issue("validation_error", f"{prefix}.quantity", error.errors["quantity"][0])
            )
            continue
        sources.append(LineSource(index + 1, product_id, quantity))
    return sources, issues


def preview_draft_capture(
    *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> dict[str, Any]:
    """Proyección documental de una captura sin persistir nada.

    No guarda borrador ni recibo, no reserva inventario, no numera ni registra usos fiscales.
    Tolera entradas incompletas devolviendo incidencias por campo. No habilita confirmar.
    """
    require_permission(
        actor=actor,
        permission="ventas.crear",
        request_id=request_id,
        denial_action="sales.draft_previewed",
        target_type="sale",
        target_id="draft-preview",
    )
    unknown = sorted(set(payload) - DRAFT_FIELDS - {"idempotency_key"})
    if unknown:
        raise SalesApplicationError(
            "unknown_field",
            "La solicitud contiene campos no admitidos.",
            {name: ["Campo no admitido."] for name in unknown},
        )
    if payload.get("entity_type", "COMERCIAL") != "COMERCIAL":
        raise field_error(
            "validation_error",
            "entity_type",
            "Una venta de repuestos pertenece solo al RUC comercial.",
        )
    sources, issues = _lenient_lines(payload)
    customer: CustomerReference | None = None
    customer_id = payload.get("customer_id")
    if isinstance(customer_id, int) and not isinstance(customer_id, bool):
        customer = get_customer_reference(customer_id)
        if customer is None or not customer.is_active:
            issues.append(
                Issue("inactive_reference", "customer_id", "Seleccione un cliente registrado.")
            )
    else:
        issues.append(Issue("validation_error", "customer_id", "Seleccione un cliente registrado."))
    condition = payload.get("condition")
    if condition not in ("CONTADO", "CREDITO"):
        issues.append(Issue("validation_error", "condition", "Indique CONTADO o CREDITO."))
    products = get_sale_product_references(s.product_id for s in sources)
    on = today()
    reviews = review_tax_options({p.tax_definition_id for p in products.values()}, on=on)
    rates = {pk: review.rate for pk, review in reviews.items()}
    computations = compute_lines(sources, products, rates)
    for comp in computations:
        ref = products.get(comp.product_id)
        if ref is None or not ref.is_active:
            issues.append(
                Issue(
                    "inactive_reference",
                    f"lines.{comp.position - 1}.product_id",
                    "El producto no existe o está inactivo.",
                )
            )
        elif comp.amounts is None:
            issues.append(
                Issue(
                    "configuration_missing",
                    f"lines.{comp.position - 1}.product_id",
                    "El impuesto del producto no tiene tarifa vigente.",
                )
            )
    try:
        context: OperationContext | None = get_operation_context()
    except OperationContextError:
        context = None
        issues.append(
            Issue("configuration_missing", "configuration", "Falta la configuración comercial.")
        )
    snapshot_like = _capture_projection(computations, products, on)
    return {
        "status": "DRAFT_PREVIEW",
        "internal_number": None,
        "number_pending": True,
        "notice": INTERNAL_NOTICE,
        "condition": condition if condition in ("CONTADO", "CREDITO") else None,
        "notes": payload.get("notes") if isinstance(payload.get("notes"), str) else "",
        "customer": None
        if customer is None
        else {
            "id": customer.id,
            "name": customer.name,
            "identification_type": customer.identification_type,
            "identification": customer.identification,
            "phone": customer.phone,
        },
        "fiscal_entity": None
        if context is None
        else {"type": context.entity_type, "ruc": context.ruc, "legal_name": context.legal_name},
        "issues": [issue.as_dict() for issue in issues],
        "can_confirm": False,
        **snapshot_like,
    }


def _capture_projection(
    computations: list[LineComputation], products: dict[int, SaleProductReference], on: date
) -> dict[str, Any]:
    totals = document_totals(computations) if computations else None
    return {
        "lines": [
            {
                "position": comp.position,
                "product_id": comp.product_id,
                "product_code": products[comp.product_id].code
                if comp.product_id in products
                else None,
                "product_name": products[comp.product_id].name
                if comp.product_id in products
                else None,
                "quantity": f"{comp.quantity:.0f}",
                "unit_price": queries.money(comp.unit_price),
                "tax_rate": _normalized(comp.tax_rate),
                "base_amount": queries.money(comp.amounts.base if comp.amounts else None),
                "tax_amount": queries.money(comp.amounts.tax if comp.amounts else None),
                "total_amount": queries.money(comp.amounts.total if comp.amounts else None),
            }
            for comp in computations
        ],
        "totals": None
        if totals is None
        else {
            "base": queries.money(totals.base),
            "tax": queries.money(totals.tax),
            "total": queries.money(totals.total),
        },
        "operational_date": on.isoformat(),
    }
