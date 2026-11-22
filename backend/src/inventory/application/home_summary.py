"""Existencias de solo lectura para la búsqueda global; nunca entrega costos ni valoración."""

from identity.application.authorization import has_permission
from identity.models import User
from inventory.application.queries import list_stock_quantities


def stock_quantities(actor: User, product_ids: list[int]) -> dict[int, str] | None:
    """Devuelve la existencia por producto si el actor tiene ``inventario.ver``."""
    if not has_permission(actor, "inventario.ver"):
        return None
    if not product_ids:
        return {}
    payload = list_stock_quantities(product_ids)
    return {row["product_id"]: row["quantity"] for row in payload["results"]}
