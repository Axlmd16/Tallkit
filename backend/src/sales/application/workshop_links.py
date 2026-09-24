"""Ventas comerciales vinculadas cuya colección de líneas pertenece al taller.

Estas funciones no reclaman recibos ni abren transacciones: el coordinador de ``workshop``
ya bloqueó la orden y conserva la transacción exterior. Ventas mantiene su propia raíz,
líneas y reservas sin importar código del módulo de taller.
"""

from collections.abc import Mapping
from decimal import Decimal
from typing import Any, Protocol

from django.db import transaction
from django.db.models import Max, Q

import inventory.application.posting as posting
from catalog.application.sales_references import (
    SaleProductReference,
    SaleProductReferenceError,
    list_sale_product_options,
    lock_product_references,
)
from identity.models import User
from inventory.application.reservations import (
    InsufficientAvailabilityError,
    read_availability,
    release,
    reserve,
    resize,
)
from sales.application import queries
from sales.application.errors import SalesApplicationError, field_error, not_found, stale_record
from sales.domain.amounts import AmountValidationError, parse_quantity
from sales.models import Sale, SaleLine, SaleOriginType, SaleState
from workshop_configuration.application.operation_context import (
    OperationContextError,
    get_operation_context,
)

# Error público del contrato: el taller no importa ``sales.application.errors``.
LinkedSaleError = SalesApplicationError


class MaintenanceOrderReference(Protocol):
    pk: int
    number: str
    customer_id: int


def _require_transaction() -> None:
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("La venta vinculada requiere una transacción exterior activa.")


def _context() -> Any:
    try:
        return get_operation_context()
    except OperationContextError as error:
        raise SalesApplicationError("configuration_missing", error.detail or error.code) from None


def _quantity(value: Any) -> Decimal:
    try:
        return parse_quantity(value)
    except AmountValidationError as error:
        raise SalesApplicationError(
            "validation_error",
            "La cantidad no es válida.",
            {"quantity": error.errors["quantity"]},
        ) from None


def _reject_unknown(unknown: Mapping[str, Any]) -> None:
    if unknown:
        raise SalesApplicationError(
            "unknown_field",
            "La solicitud contiene campos no admitidos.",
            {name: ["Campo no admitido."] for name in sorted(unknown)},
        )


def _lock_product(product_id: int) -> SaleProductReference:
    if isinstance(product_id, bool) or not isinstance(product_id, int) or product_id < 1:
        raise field_error("validation_error", "product_id", "Seleccione un producto.")
    try:
        return lock_product_references([product_id])[product_id]
    except SaleProductReferenceError as error:
        message = "El producto no existe." if error.missing else "El producto está inactivo."
        raise field_error("inactive_reference", "product_id", message) from None


def lock_open_linked_sale(order_id: int) -> Sale | None:
    """Bloquea el borrador vinculado de la orden, si existe."""
    _require_transaction()
    return (
        Sale.objects.select_for_update()
        .filter(origin_order_id=order_id, state=SaleState.DRAFT)
        .first()
    )


def _open_sale(
    *, actor: User | None, order_ref: MaintenanceOrderReference, create: bool
) -> Sale | None:
    sale = lock_open_linked_sale(order_ref.pk)
    if sale is not None or not create:
        return sale
    context = _context()
    assert actor is not None
    return Sale.objects.create(
        customer_id=order_ref.customer_id,
        fiscal_entity_id=context.entity_id,
        warehouse_id=context.warehouse_id,
        origin_type=SaleOriginType.MAINTENANCE,
        origin_order_id=order_ref.pk,
        origin_reference=order_ref.number,
        condition="CONTADO",
        created_by=actor,
    )


def _position_for(sale: Sale, product: SaleProductReference) -> posting.LockedPositions:
    return posting.lock_positions({product.id: product}, warehouse_id=sale.warehouse_id)


def _bump(sale: Sale) -> None:
    sale.version += 1
    sale.save(update_fields=["version", "updated_at"])


def add_linked_line(
    *,
    actor: User,
    order_ref: MaintenanceOrderReference,
    product_id: int,
    quantity: Any,
    **unknown: Any,
) -> SaleLine:
    """Agrega una línea independiente y reserva su cantidad sin mover existencia."""
    _require_transaction()
    _reject_unknown(unknown)
    parsed = _quantity(quantity)
    sale = _open_sale(actor=actor, order_ref=order_ref, create=True)
    assert sale is not None
    product = _lock_product(product_id)
    locked = _position_for(sale, product)
    last = sale.lines.aggregate(value=Max("position"))["value"] or 0
    line = SaleLine.objects.create(
        sale=sale,
        position=last + 1,
        product_id=product.id,
        quantity=parsed,
    )
    try:
        reserve(
            locked,
            product_id=product.id,
            source_type="SALE_LINE",
            source_id=line.pk,
            source_reference={
                "sale_id": sale.pk,
                "order_id": order_ref.pk,
                "order_number": order_ref.number,
            },
            quantity=parsed,
        )
    except InsufficientAvailabilityError as error:
        raise SalesApplicationError(
            "insufficient_availability",
            "La disponibilidad es insuficiente para reservar el repuesto.",
            {"quantity": [f"Disponible {error.available:.0f}; solicitado {error.requested:.0f}."]},
        ) from None
    _bump(sale)
    return line


def _editable_line(
    *, order_ref: MaintenanceOrderReference, line_id: int, expected_sale_version: int
) -> tuple[Sale, SaleLine]:
    sale = _open_sale(actor=None, order_ref=order_ref, create=False)
    if sale is None:
        if SaleLine.objects.filter(pk=line_id, sale__origin_order_id=order_ref.pk).exists():
            raise SalesApplicationError(
                "linked_sale_locked", "Las líneas de una venta confirmada no pueden cambiarse."
            )
        raise not_found("Línea")
    if sale.version != expected_sale_version:
        raise stale_record()
    line = sale.lines.filter(pk=line_id).first()
    if line is None:
        raise not_found("Línea")
    return sale, line


def change_linked_line(
    *,
    actor: User,
    order_ref: MaintenanceOrderReference,
    line_id: int,
    quantity: Any,
    expected_sale_version: int,
    **unknown: Any,
) -> SaleLine:
    """Cambia cantidad con control optimista y redimensiona la reserva propia."""
    del actor
    _require_transaction()
    _reject_unknown(unknown)
    parsed = _quantity(quantity)
    sale, line = _editable_line(
        order_ref=order_ref,
        line_id=line_id,
        expected_sale_version=expected_sale_version,
    )
    product = _lock_product(line.product_id)
    locked = _position_for(sale, product)
    try:
        resize(
            locked,
            source_type="SALE_LINE",
            source_id=line.pk,
            quantity=parsed,
        )
    except InsufficientAvailabilityError as error:
        raise SalesApplicationError(
            "insufficient_availability",
            "La disponibilidad es insuficiente para aumentar la reserva.",
            {
                "quantity": [
                    f"Disponible {error.available:.0f}; aumento solicitado {error.requested:.0f}."
                ]
            },
        ) from None
    line.quantity = parsed
    line.save(update_fields=["quantity"])
    _bump(sale)
    return line


def remove_linked_line(
    *,
    actor: User,
    order_ref: MaintenanceOrderReference,
    line_id: int,
    expected_sale_version: int,
) -> None:
    """Libera la reserva y retira la línea del borrador vinculado."""
    del actor
    _require_transaction()
    sale, line = _editable_line(
        order_ref=order_ref,
        line_id=line_id,
        expected_sale_version=expected_sale_version,
    )
    product = _lock_product(line.product_id)
    locked = _position_for(sale, product)
    release(locked, source_type="SALE_LINE", source_id=line.pk)
    line.delete()
    _bump(sale)


def linked_sales_summary(order_id: int) -> list[dict[str, Any]]:
    """Proyecta ventas de la orden sin exponer valoraciones ni costos de inventario.

    El borrador abierto aún no tiene importes congelados: ``estimate`` expone los importes
    vigentes calculados como en la revisión, rotulados como estimación y sin efectos.
    """
    from sales.application import reviews

    result: list[dict[str, Any]] = []
    for sale in Sale.objects.filter(origin_order_id=order_id).order_by("created_at", "id"):
        body = queries.sale_detail(sale)
        if sale.state == SaleState.DRAFT:
            projection = reviews._projection(reviews.build_snapshot(sale), include_costs=False)
            body["estimate"] = {
                "lines": projection["lines"],
                "totals": projection["totals"],
                "availability": projection["effects"],
            }
        result.append(body)
    return result


def open_linked_line_count(order_id: int) -> int:
    return SaleLine.objects.filter(
        sale__origin_order_id=order_id,
        sale__state=SaleState.DRAFT,
    ).count()


def blocking_linked_documents(order_id: int) -> list[str]:
    sales = (
        Sale.objects.filter(origin_order_id=order_id)
        .filter(Q(state=SaleState.CONFIRMED) | Q(state=SaleState.DRAFT, lines__isnull=False))
        .distinct()
        .order_by("created_at", "id")
    )
    return [sale.internal_number or f"Borrador {sale.pk}" for sale in sales]


def linked_product_options(
    *, search: str = "", page: int = 1, page_size: int = 20
) -> dict[str, Any]:
    if page < 1 or not 1 <= page_size <= 100:
        raise field_error("validation_error", "page", "La paginación no es válida.")
    catalog = list_sale_product_options(search=search, page=page, page_size=page_size)
    warehouse_id = _context().warehouse_id
    availability = read_availability(
        [product.id for product in catalog.items], warehouse_id=warehouse_id
    )
    return {
        "count": catalog.total_count,
        "page": catalog.page,
        "page_size": catalog.page_size,
        "total_pages": -(-catalog.total_count // page_size) if catalog.total_count else 0,
        "results": [
            {
                "id": product.id,
                "code": product.code,
                "name": product.name,
                "content_quantity": str(product.content_quantity),
                "unit": {"name": product.unit_name, "symbol": product.unit_symbol},
                "sale_price": f"{product.sale_price:.2f}",
                "quantity": f"{availability[product.id].quantity:.0f}",
                "reserved": f"{availability[product.id].reserved:.0f}",
                "available": f"{availability[product.id].available:.0f}",
            }
            for product in catalog.items
        ],
    }
