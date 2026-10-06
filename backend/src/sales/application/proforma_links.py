"""Contrato público de ventas para el borrador originado en una proforma (ADR-0012).

El módulo de proformas es el único consumidor previsto. Estas funciones no reclaman recibos
ni abren transacciones: el coordinador de la conversión ya bloqueó la oferta y conserva la
transacción exterior. Ventas escribe exclusivamente su propia persistencia y guarda una copia
inmutable de lo cotizado, de modo que sus consultas y confirmaciones nunca consultan la
oferta. No confirma, numera, reserva ni cobra.

Orden de recursos (diseño D5): raíz de venta nueva o consulta del vínculo, cliente y productos
por ID ascendente.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from django.db import transaction

from catalog.application.sales_references import (
    SaleProductReferenceError,
    lock_product_references,
)
from customer_registry.application.sales_references import (
    CustomerReferenceError,
    lock_customer_reference,
)
from identity.application.authorization import require_permission
from identity.models import User
from sales.application.errors import SalesApplicationError, field_error
from sales.models import Sale, SaleLine, SaleOriginType
from workshop_configuration.application.operation_context import (
    OperationContextError,
    get_operation_context,
)

# Error público del contrato: proformas no importa ``sales.application.errors``.
LinkedSaleError = SalesApplicationError


@dataclass(frozen=True)
class QuotedLine:
    """Línea emitida de la oferta, con sus valores históricos."""

    position: int
    product_id: int
    product_code: str
    product_name: str
    quantity: Decimal
    unit_price: Decimal
    tax_rate: Decimal
    base_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal


@dataclass(frozen=True)
class ProformaOffer:
    """Oferta emitida ya validada por su módulo; nunca proviene del cliente HTTP."""

    proforma_id: int
    number: str
    customer_id: int
    issue_date: date
    valid_until: date
    lines: tuple[QuotedLine, ...]
    base_total: Decimal
    tax_total: Decimal
    grand_total: Decimal


@dataclass(frozen=True)
class ProformaSaleLink:
    proforma_id: int
    sale_id: int
    state: str
    internal_number: str | None


class ProformaAlreadyLinkedError(Exception):
    """La oferta ya originó una venta; ``link`` la identifica."""

    def __init__(self, link: ProformaSaleLink) -> None:
        super().__init__("La proforma ya originó una venta.")
        self.link = link


def _require_transaction() -> None:
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("La venta originada en una proforma requiere una transacción exterior.")


def _link(sale: Sale) -> ProformaSaleLink:
    assert sale.origin_proforma_id is not None
    return ProformaSaleLink(
        proforma_id=sale.origin_proforma_id,
        sale_id=sale.pk,
        state=sale.state,
        internal_number=sale.internal_number,
    )


def _rate(value: Decimal) -> str:
    return format(value.normalize(), "f")


def _snapshot(offer: ProformaOffer) -> dict[str, Any]:
    """Copia versionada de lo cotizado: sin costos ni bytes del logotipo."""
    return {
        "schema_version": 1,
        "proforma_id": offer.proforma_id,
        "number": offer.number,
        "issue_date": offer.issue_date.isoformat(),
        "valid_until": offer.valid_until.isoformat(),
        "lines": [
            {
                "position": line.position,
                "product_id": line.product_id,
                "product_code": line.product_code,
                "product_name": line.product_name,
                "quantity": f"{line.quantity:.0f}",
                "unit_price": f"{line.unit_price:.2f}",
                "tax_rate": _rate(line.tax_rate),
                "base_amount": f"{line.base_amount:.2f}",
                "tax_amount": f"{line.tax_amount:.2f}",
                "total_amount": f"{line.total_amount:.2f}",
            }
            for line in offer.lines
        ],
        "totals": {
            "base": f"{offer.base_total:.2f}",
            "tax": f"{offer.tax_total:.2f}",
            "total": f"{offer.grand_total:.2f}",
        },
    }


def get_sale_link(proforma_id: int) -> ProformaSaleLink | None:
    """Venta originada por la oferta, si existe. La referencia única de ventas es la fuente."""
    sale = Sale.objects.filter(origin_proforma_id=proforma_id).first()
    return _link(sale) if sale else None


def sale_links(proforma_ids: Iterable[int]) -> dict[int, ProformaSaleLink]:
    """Vínculos de varias ofertas en una sola consulta, para listados y conciliación."""
    sales = Sale.objects.filter(origin_proforma_id__in=set(proforma_ids)).order_by("pk")
    return {link.proforma_id: link for link in map(_link, sales)}


def create_draft_from_proforma(*, actor: User, offer: ProformaOffer) -> ProformaSaleLink:
    """Crea el único borrador de venta de la oferta, con condición editable CONTADO.

    Copia cliente y líneas y conserva origen, número y copia histórica. Los precios de la venta
    se recalculan con el catálogo vigente al revisarla; aquí no se congelan importes.
    """
    _require_transaction()
    require_permission(
        actor=actor,
        permission="ventas.crear",
        denial_action="sales.sale_created_from_proforma",
        target_type="proforma",
        target_id=str(offer.proforma_id),
    )
    if not offer.number.strip() or not offer.lines:
        raise SalesApplicationError(
            "validation_error", "La oferta debe estar emitida y tener al menos una línea."
        )
    existing = Sale.objects.select_for_update().filter(origin_proforma_id=offer.proforma_id).first()
    if existing is not None:
        raise ProformaAlreadyLinkedError(_link(existing))
    try:
        context = get_operation_context()
    except OperationContextError as error:
        raise SalesApplicationError("configuration_missing", error.detail or error.code) from None
    sale = Sale.objects.create(
        customer_id=offer.customer_id,
        fiscal_entity_id=context.entity_id,
        warehouse_id=context.warehouse_id,
        origin_type=SaleOriginType.PROFORMA,
        origin_proforma_id=offer.proforma_id,
        origin_reference=offer.number,
        proforma_snapshot=_snapshot(offer),
        condition="CONTADO",
        created_by=actor,
    )
    try:
        lock_customer_reference(offer.customer_id)
    except CustomerReferenceError as error:
        message = "El cliente no existe." if error.missing else "El cliente está inactivo."
        raise field_error("inactive_reference", "customer_id", message) from None
    try:
        lock_product_references({line.product_id for line in offer.lines})
    except SaleProductReferenceError as error:
        bad = set(error.missing) | set(error.inactive)
        raise SalesApplicationError(
            "inactive_reference",
            "Hay productos inexistentes o inactivos.",
            {
                f"lines.{index}.product_id": [
                    "El producto no existe."
                    if line.product_id in error.missing
                    else "El producto está inactivo."
                ]
                for index, line in enumerate(offer.lines)
                if line.product_id in bad
            },
        ) from None
    SaleLine.objects.bulk_create(
        SaleLine(sale=sale, position=index, product_id=line.product_id, quantity=line.quantity)
        for index, line in enumerate(offer.lines, start=1)
    )
    return _link(sale)
