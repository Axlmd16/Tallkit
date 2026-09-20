"""Interfaz pública de marcas de vehículo para el catálogo de productos.

El catálogo consulta y bloquea marcas mediante estas funciones; nunca escribe la
persistencia de clientes/vehículos ni cambia su comportamiento.
"""

from collections.abc import Iterable
from dataclasses import dataclass

from django.db import transaction
from django.db.models import Q

from customer_registry.models import VehicleBrand


@dataclass(frozen=True)
class VehicleBrandRef:
    id: int
    name: str
    is_active: bool


@dataclass(frozen=True)
class VehicleBrandOptionsPage:
    items: tuple[VehicleBrandRef, ...]
    total_count: int
    page: int
    page_size: int


class VehicleBrandReferenceError(Exception):
    def __init__(self, missing: tuple[int, ...] = (), inactive: tuple[int, ...] = ()) -> None:
        super().__init__("Referencia de marca de vehículo inválida.")
        self.missing = missing
        self.inactive = inactive


def _ref(brand: VehicleBrand) -> VehicleBrandRef:
    return VehicleBrandRef(id=brand.pk, name=brand.name, is_active=brand.is_active)


def get_vehicle_brand_refs(ids: Iterable[int]) -> tuple[VehicleBrandRef, ...]:
    """Referencias mínimas, activas o no, ordenadas por nombre e ID."""
    brands = VehicleBrand.objects.filter(pk__in=set(ids)).order_by("name", "id")
    return tuple(_ref(b) for b in brands)


def list_vehicle_brand_options(
    *, search: str = "", page: int = 1, page_size: int = 20
) -> VehicleBrandOptionsPage:
    """Marcas activas seleccionables, paginadas en servidor."""
    queryset = VehicleBrand.objects.filter(is_active=True)
    if search.strip():
        queryset = queryset.filter(Q(name__icontains=search.strip()))
    queryset = queryset.order_by("name", "id")
    total = queryset.count()
    offset = (page - 1) * page_size
    items = tuple(_ref(b) for b in queryset[offset : offset + page_size])
    return VehicleBrandOptionsPage(items=items, total_count=total, page=page, page_size=page_size)


def lock_vehicle_brands_for_association(
    ids: Iterable[int], *, new_ids: Iterable[int] | None = None
) -> dict[int, VehicleBrandRef]:
    """Bloquea las marcas por ID ascendente dentro de la transacción vigente.

    ``new_ids`` son las asociaciones nuevas (deben existir y estar activas). Las
    demás pueden seguir inactivas al conservarse. Sin ``new_ids`` todas se
    consideran nuevas.
    """
    requested = sorted(set(ids))
    must_be_active = set(requested if new_ids is None else new_ids)
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("El bloqueo de marcas requiere una transacción atómica.")
    locked = {
        b.pk: b
        for b in VehicleBrand.objects.select_for_update().filter(pk__in=requested).order_by("pk")
    }
    missing = tuple(i for i in requested if i not in locked)
    inactive = tuple(
        i for i in requested if i in locked and i in must_be_active and not locked[i].is_active
    )
    if missing or inactive:
        raise VehicleBrandReferenceError(missing=missing, inactive=inactive)
    return {pk: _ref(b) for pk, b in locked.items()}
