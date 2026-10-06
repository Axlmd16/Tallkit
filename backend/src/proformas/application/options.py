"""Selectores autorizados del editor de proformas, sin costos ni permisos de otra capacidad."""

from typing import Any
from uuid import UUID

from catalog.application.sales_references import list_sale_product_options
from customer_registry.application.sales_references import list_customer_options
from identity.application.authorization import require_permission
from identity.models import User
from proformas.application import references
from proformas.application.errors import field_error
from proformas.application.queries import PAGE_SIZE_MAX


def _check(page: int, page_size: int) -> None:
    if page < 1:
        raise field_error("validation_error", "page", "La página debe ser al menos 1.")
    if not 1 <= page_size <= PAGE_SIZE_MAX:
        raise field_error(
            "validation_error", "page_size", f"El tamaño debe estar entre 1 y {PAGE_SIZE_MAX}."
        )


def _authorize(actor: User, target: str, request_id: UUID | None) -> None:
    require_permission(
        actor=actor,
        permission="proformas.gestionar",
        request_id=request_id,
        denial_action="proformas.options_viewed",
        target_type="proforma",
        target_id=target,
    )


def customer_options(
    *,
    actor: User,
    search: str = "",
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> dict[str, Any]:
    _authorize(actor, "customer-options", request_id)
    _check(page, page_size)
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
        "page": result.page,
        "page_size": result.page_size,
    }


def product_options(
    *,
    actor: User,
    search: str = "",
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> dict[str, Any]:
    """Productos activos con precio final y disponibilidad informativa; nunca costos."""
    _authorize(actor, "product-options", request_id)
    _check(page, page_size)
    result = list_sale_product_options(search=search, page=page, page_size=page_size)
    availability = references.current_availability(
        [p.id for p in result.items], references.current_context()
    )
    return {
        "items": [
            {
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "unit_name": p.unit_name,
                "unit_symbol": p.unit_symbol,
                "content_quantity": f"{p.content_quantity:f}",
                "unit_price": f"{p.sale_price:.2f}",
                "is_kit": p.is_kit,
                "available": f"{availability[p.id]:.0f}" if p.id in availability else None,
            }
            for p in result.items
        ],
        "total_count": result.total_count,
        "page": result.page,
        "page_size": result.page_size,
    }
