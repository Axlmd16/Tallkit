"""Interfaz pública de clientes para ventas comerciales.

Entrega un DTO inmutable de identidad, contacto y estado. No expone vehículos ni ofrece
capacidad de escritura sobre clientes. El bloqueo permanece dentro del proceso y exige una
transacción exterior.
"""

from dataclasses import dataclass

from django.db import transaction
from django.db.models import Q

from customer_registry.models import Customer


@dataclass(frozen=True)
class CustomerReference:
    id: int
    name: str
    person_type: str
    identification_type: str
    identification: str
    phone: str
    email: str
    address: str
    is_active: bool
    is_withholding_agent: bool = False


@dataclass(frozen=True)
class CustomerOptionsPage:
    items: tuple[CustomerReference, ...]
    total_count: int
    page: int
    page_size: int


class CustomerReferenceError(Exception):
    def __init__(self, *, missing: bool = False, inactive: bool = False) -> None:
        super().__init__("Referencia de cliente inválida.")
        self.missing = missing
        self.inactive = inactive


def _reference(customer: Customer) -> CustomerReference:
    return CustomerReference(
        id=customer.pk,
        name=customer.name,
        person_type=customer.person_type,
        identification_type=customer.identification_type,
        identification=customer.identification,
        phone=customer.phone,
        email=customer.email,
        address=customer.address,
        is_active=customer.is_active,
        is_withholding_agent=customer.is_withholding_agent,
    )


def get_customer_reference(customer_id: int) -> CustomerReference | None:
    """Consulta el cliente, activo o no, para leer o corregir su historia."""
    customer = Customer.objects.filter(pk=customer_id).first()
    return _reference(customer) if customer else None


def list_customer_options(
    *, search: str = "", page: int = 1, page_size: int = 20
) -> CustomerOptionsPage:
    """Clientes activos seleccionables para nuevas ventas, paginados en servidor."""
    queryset = Customer.objects.filter(is_active=True)
    term = search.strip()
    if term:
        queryset = queryset.filter(Q(name__icontains=term) | Q(identification__icontains=term))
    queryset = queryset.order_by("name", "id")
    total = queryset.count()
    offset = (page - 1) * page_size
    items = tuple(_reference(c) for c in queryset[offset : offset + page_size])
    return CustomerOptionsPage(items=items, total_count=total, page=page, page_size=page_size)


def lock_customer_reference(customer_id: int, *, require_active: bool = True) -> CustomerReference:
    """Bloquea el cliente dentro de la transacción vigente."""
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("El bloqueo de clientes requiere una transacción atómica.")
    customer = Customer.objects.select_for_update().filter(pk=customer_id).first()
    if customer is None:
        raise CustomerReferenceError(missing=True)
    if require_active and not customer.is_active:
        raise CustomerReferenceError(inactive=True)
    return _reference(customer)
