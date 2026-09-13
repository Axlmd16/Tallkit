from dataclasses import dataclass
from datetime import datetime
from math import ceil

from django.db.models import Q

from customer_registry.application.customers import CustomerNotFoundError
from customer_registry.models import Customer
from identity.application.authorization import require_permission
from identity.models import User


@dataclass(frozen=True)
class CustomerSummary:
    id: int
    person_type: str
    name: str
    identification_type: str
    identification: str
    phone: str
    email: str
    address: str
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class CustomerPage:
    items: tuple[CustomerSummary, ...]
    page: int
    page_size: int
    total: int
    total_pages: int


def get_customer(*, actor: User, customer_id: int) -> Customer:
    require_permission(actor=actor, permission="clientes.ver")
    try:
        return Customer.objects.get(id=customer_id)
    except Customer.DoesNotExist as exc:
        raise CustomerNotFoundError(f"No existe el cliente con ID {customer_id}.") from exc


def search_customers(
    *,
    actor: User,
    query: str = "",
    is_active: bool | None = None,
    page: int = 1,
    page_size: int = 20,
) -> CustomerPage:
    require_permission(actor=actor, permission="clientes.ver")
    if page < 1 or page_size < 1:
        raise ValueError("La página y su tamaño deben ser positivos.")

    qs = Customer.objects.all().order_by("name", "id")

    search_term = query.strip()
    if search_term:
        qs = qs.filter(
            Q(name__icontains=search_term)
            | Q(identification__icontains=search_term)
            | Q(phone__icontains=search_term)
        )

    if is_active is not None:
        qs = qs.filter(is_active=is_active)

    total = qs.count()
    start = (page - 1) * page_size
    page_items = qs[start : start + page_size]

    items = tuple(
        CustomerSummary(
            id=customer.id,
            person_type=customer.person_type,
            name=customer.name,
            identification_type=customer.identification_type,
            identification=customer.identification,
            phone=customer.phone,
            email=customer.email,
            address=customer.address,
            is_active=customer.is_active,
            version=customer.version,
            created_at=customer.created_at,
            updated_at=customer.updated_at,
        )
        for customer in page_items
    )

    total_pages = ceil(total / page_size) if total > 0 else 0

    return CustomerPage(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


def find_matching_customers(
    *,
    actor: User,
    name: str = "",
    phone: str = "",
    exclude_customer_id: int | None = None,
) -> list[Customer]:
    require_permission(actor=actor, permission="clientes.ver")

    q_filter = Q()
    name_stripped = name.strip()
    phone_stripped = phone.strip()

    if name_stripped:
        q_filter |= Q(name__icontains=name_stripped)
    if phone_stripped:
        q_filter |= Q(phone__icontains=phone_stripped)

    if not q_filter:
        return []

    qs = Customer.objects.filter(q_filter)
    if exclude_customer_id is not None:
        qs = qs.exclude(id=exclude_customer_id)

    return list(qs.order_by("name", "id")[:10])
