"""Valores vigentes de una oferta: referencias, precios de catálogo, tarifas y disponibilidad.

Reúne los contratos públicos de clientes, catálogo, inventario y configuración. La misma
composición sirve a la revisión sin bloqueos y a la emisión bajo bloqueo, de modo que ambas
producen la misma huella cuando nada relevante cambió. La disponibilidad es informativa: sus
cambios actualizan el aviso, nunca la huella ni una condición de stock mínimo.
"""

from collections import defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

from catalog.application.sales_references import SaleProductReference
from customer_registry.application.sales_references import CustomerReference
from proformas.domain.amounts import Offer, OfferLine, compose_offer
from proformas.domain.validity import ValidityError, resolve_valid_until
from shared.command_values import canonical_fingerprint
from workshop_configuration.application.brand import BrandIdentity
from workshop_configuration.application.operation_context import OperationContext


@dataclass(frozen=True)
class LineSource:
    position: int
    product_id: int
    quantity: Decimal


@dataclass(frozen=True)
class Issue:
    code: str
    field: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "field": self.field, "message": self.message}


@dataclass(frozen=True)
class OfferView:
    """Estado del que depende emitir o convertir, ya calculado."""

    customer: CustomerReference | None
    sources: tuple[LineSource, ...]
    products: Mapping[int, SaleProductReference]
    rates: Mapping[int, Decimal | None]
    offer: Offer
    context: OperationContext | None
    on: date
    explicit_valid_until: date | None
    availability: Mapping[int, Decimal]
    brand: BrandIdentity | None = None
    extra_issues: tuple[Issue, ...] = field(default=())

    @property
    def valid_until(self) -> date | None:
        try:
            return resolve_valid_until(self.explicit_valid_until, self.on)
        except ValidityError:
            return None


def build_view(
    *,
    customer: CustomerReference | None,
    sources: Sequence[LineSource],
    products: Mapping[int, SaleProductReference],
    rates: Mapping[int, Decimal | None],
    context: OperationContext | None,
    on: date,
    explicit_valid_until: date | None,
    availability: Mapping[int, Decimal],
    brand: BrandIdentity | None = None,
    extra_issues: Sequence[Issue] = (),
) -> OfferView:
    lines = [
        OfferLine(
            source.position,
            source.product_id,
            source.quantity,
            products[source.product_id].sale_price,
            rates.get(products[source.product_id].tax_definition_id),
        )
        for source in sources
        if source.product_id in products
    ]
    return OfferView(
        customer=customer,
        sources=tuple(sources),
        products=products,
        rates=rates,
        offer=compose_offer(lines),
        context=context,
        on=on,
        explicit_valid_until=explicit_valid_until,
        availability=availability,
        brand=brand,
        extra_issues=tuple(extra_issues),
    )


def needed_by_product(view: OfferView) -> dict[int, Decimal]:
    needed: dict[int, Decimal] = defaultdict(Decimal)
    for source in view.sources:
        needed[source.product_id] += source.quantity
    return dict(needed)


def collect_issues(view: OfferView) -> list[Issue]:
    """Impedimentos para emitir; la disponibilidad insuficiente nunca figura aquí."""
    issues: list[Issue] = list(view.extra_issues)
    if view.customer is None:
        issues.append(Issue("inactive_reference", "customer_id", "El cliente no existe."))
    elif not view.customer.is_active:
        issues.append(Issue("inactive_reference", "customer_id", "El cliente está inactivo."))
    if not view.sources:
        issues.append(Issue("validation_error", "lines", "Agregue al menos una línea."))
    computed = {item.line.position: item for item in view.offer.lines}
    for index, source in enumerate(view.sources):
        ref = view.products.get(source.product_id)
        if ref is None or not ref.is_active:
            message = "El producto no existe." if ref is None else "El producto está inactivo."
            issues.append(Issue("inactive_reference", f"lines.{index}.product_id", message))
            continue
        item = computed.get(source.position)
        if item is None or item.amounts is None:
            issues.append(
                Issue(
                    "configuration_missing",
                    f"lines.{index}.product_id",
                    "El impuesto del producto no tiene una tarifa vigente única para hoy.",
                )
            )
    if view.context is None:
        issues.append(
            Issue("configuration_missing", "configuration", "Falta la configuración comercial.")
        )
    if view.valid_until is None:
        issues.append(
            Issue(
                "validation_error",
                "valid_until",
                "La vigencia no puede ser anterior a la fecha de emisión. Corrija la fecha.",
            )
        )
    return issues


def availability_warnings(view: OfferView) -> list[dict[str, Any]]:
    """Avisos informativos de insuficiencia; no bloquean cotizar ni convertir."""
    warnings: list[dict[str, Any]] = []
    for product_id, needed in needed_by_product(view).items():
        available = view.availability.get(product_id, Decimal(0))
        if needed > available:
            ref = view.products.get(product_id)
            warnings.append(
                {
                    "code": "insufficient_availability",
                    "product_id": product_id,
                    "product_code": ref.code if ref else None,
                    "requested": f"{needed:.0f}",
                    "available": f"{available:.0f}",
                    "message": (
                        f"Disponibilidad insuficiente: hay {available:.0f} y se cotizan "
                        f"{needed:.0f}. La proforma no reserva unidades."
                    ),
                }
            )
    return warnings


def normalized_rate(rate: Decimal | None) -> str | None:
    return None if rate is None else format(rate.normalize(), "f")


def issue_digest(proforma_id: int, view: OfferView) -> str:
    """Huella de contenido y datos históricos relevantes de la emisión."""
    customer = view.customer
    context = view.context
    brand = view.brand
    amounts = {item.line.position: item for item in view.offer.lines}
    lines = []
    for source in view.sources:
        ref = view.products.get(source.product_id)
        item = amounts.get(source.position)
        lines.append(
            [
                source.position,
                source.product_id,
                f"{source.quantity:.0f}",
                None
                if ref is None
                else [ref.code, ref.name, ref.is_active, str(ref.sale_price), ref.is_kit],
                None if ref is None else ref.tax_definition_id,
                None if ref is None else normalized_rate(view.rates.get(ref.tax_definition_id)),
                None
                if item is None or item.amounts is None
                else [str(item.amounts.total), str(item.amounts.base), str(item.amounts.tax)],
            ]
        )
    return canonical_fingerprint(
        {
            "proforma_id": proforma_id,
            "customer": None
            if customer is None
            else [
                customer.id,
                customer.is_active,
                customer.name,
                customer.identification_type,
                customer.identification,
                customer.phone,
                customer.email,
                customer.address,
            ],
            "issue_date": view.on.isoformat(),
            "valid_until": view.valid_until.isoformat() if view.valid_until else None,
            "lines": lines,
            "entity": None
            if context is None
            else [context.entity_id, context.ruc, context.legal_name],
            "brand": None
            if brand is None
            else [
                brand.trade_name,
                brand.address,
                brand.phone,
                brand.email,
                brand.logo_revision,
                brand.logo_sha256,
            ],
        }
    )


def money(value: Decimal | None) -> str | None:
    return None if value is None else f"{value:.2f}"


def project_lines(view: OfferView) -> list[dict[str, Any]]:
    amounts = {item.line.position: item for item in view.offer.lines}
    needed = needed_by_product(view)
    result = []
    for source in view.sources:
        ref = view.products.get(source.product_id)
        item = amounts.get(source.position)
        line_amounts = item.amounts if item else None
        available = view.availability.get(source.product_id, Decimal(0))
        result.append(
            {
                "position": source.position,
                "product_id": source.product_id,
                "product_code": ref.code if ref else None,
                "product_name": ref.name if ref else None,
                "product_active": bool(ref and ref.is_active),
                "is_kit": bool(ref and ref.is_kit),
                "quantity": f"{source.quantity:.0f}",
                "unit_price": money(ref.sale_price) if ref else None,
                "tax_rate": normalized_rate(view.rates.get(ref.tax_definition_id)) if ref else None,
                "base_amount": money(line_amounts.base if line_amounts else None),
                "tax_amount": money(line_amounts.tax if line_amounts else None),
                "total_amount": money(line_amounts.total if line_amounts else None),
                "availability": f"{available:.0f}",
                "availability_sufficient": needed[source.product_id] <= available,
            }
        )
    return result


def project_totals(view: OfferView) -> dict[str, str | None] | None:
    totals = view.offer.totals
    if totals is None:
        return None
    return {"base": money(totals.base), "tax": money(totals.tax), "total": money(totals.total)}
