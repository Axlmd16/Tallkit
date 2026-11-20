"""Lecturas de clientes para el resumen de inicio.

Como las demás lecturas del inicio, deciden con ``has_permission`` —que no audita denegaciones—
y devuelven ``None`` cuando el actor no puede ver clientes.
"""

from customer_registry.application.queries import CustomerCard
from customer_registry.application.queries import customer_cards as _cards
from customer_registry.models import Customer
from identity.application.authorization import has_permission
from identity.models import User


def customer_cards(actor: User, customer_ids: set[int]) -> list[CustomerCard] | None:
    if not has_permission(actor, "clientes.ver"):
        return None
    return _cards(customer_ids)


def customer_exists(actor: User, customer_id: int) -> bool | None:
    if not has_permission(actor, "clientes.ver"):
        return None
    return Customer.objects.filter(pk=customer_id).exists()
