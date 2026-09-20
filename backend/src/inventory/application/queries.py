"""Consultas de solo lectura de inventario: nunca crean ni bloquean posiciones."""

from inventory.models import InventoryPosition


def get_position(product_id: int, *, warehouse_id: int) -> InventoryPosition | None:
    return InventoryPosition.objects.filter(
        product_id=product_id, warehouse_id=warehouse_id
    ).first()
