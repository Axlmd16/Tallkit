"""Interfaz pública de servicios del catálogo para el taller.

Entrega copias inmutables de los datos que una orden conserva al agregar un servicio. No
ofrece escritura; el bloqueo exige la transacción exterior del consumidor.
"""

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.db.models import Q

from catalog.models import Service


@dataclass(frozen=True)
class WorkshopServiceReference:
    id: int
    code: str
    name: str
    description: str
    reference_price: Decimal
    tax_definition_id: int
    tax_name: str
    is_active: bool


@dataclass(frozen=True)
class WorkshopServicePage:
    items: tuple[WorkshopServiceReference, ...]
    total_count: int
    page: int
    page_size: int


class ServiceReferenceError(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(f"Servicio inválido: {reason}.")
        self.reason = reason


def _reference(service: Service) -> WorkshopServiceReference:
    return WorkshopServiceReference(
        id=service.pk,
        code=service.code,
        name=service.name,
        description=service.description,
        reference_price=service.reference_price,
        tax_definition_id=service.tax_definition_id,
        tax_name=service.tax_definition.name,
        is_active=service.is_active,
    )


def lock_service_reference(service_id: int) -> WorkshopServiceReference:
    """Bloquea un servicio activo dentro de la transacción vigente."""
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("El bloqueo de servicios requiere una transacción atómica.")
    service = (
        Service.objects.select_for_update(of=("self",))
        .select_related("tax_definition")
        .filter(pk=service_id)
        .first()
    )
    if service is None:
        raise ServiceReferenceError("missing")
    if not service.is_active:
        raise ServiceReferenceError("inactive")
    return _reference(service)


def list_service_options(
    *, search: str = "", page: int = 1, page_size: int = 20
) -> WorkshopServicePage:
    """Servicios activos seleccionables, por nombre o código parcial y paginados en servidor."""
    queryset = Service.objects.filter(is_active=True).select_related("tax_definition")
    term = search.strip()
    if term:
        queryset = queryset.filter(Q(name__icontains=term) | Q(code__icontains=term))
    queryset = queryset.order_by("name", "id")
    total = queryset.count()
    offset = (page - 1) * page_size
    items = tuple(_reference(s) for s in queryset[offset : offset + page_size])
    return WorkshopServicePage(items=items, total_count=total, page=page, page_size=page_size)


def get_service_active_states(service_ids: set[int]) -> dict[int, bool]:
    """Estado activo actual de servicios usados, para indicar inactividad en consultas."""
    return dict(Service.objects.filter(pk__in=service_ids).values_list("pk", "is_active"))
