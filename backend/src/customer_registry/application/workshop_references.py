"""Interfaz pública de clientes y vehículos para el taller.

Entrega DTO inmutables de identidad para órdenes de mantenimiento y no ofrece escritura. El
bloqueo sigue el orden de la transferencia de propiedad (cliente → vehículo → período vigente)
y exige la transacción exterior del consumidor.
"""

from dataclasses import dataclass

from django.db import transaction
from django.db.models import Q

from customer_registry.models import Customer, OwnershipPeriod, Vehicle


@dataclass(frozen=True)
class WorkshopCustomer:
    id: int
    name: str
    identification_type: str
    identification: str
    phone: str
    is_active: bool


@dataclass(frozen=True)
class WorkshopVehicle:
    id: int
    plate: str
    brand_name: str
    model: str
    year: int | None
    color: str
    is_active: bool
    current_owner_id: int | None


@dataclass(frozen=True)
class LockedCustomerVehicle:
    customer: WorkshopCustomer
    vehicle: WorkshopVehicle


@dataclass(frozen=True)
class WorkshopCustomerPage:
    items: tuple[WorkshopCustomer, ...]
    total_count: int
    page: int
    page_size: int


class WorkshopReferenceError(Exception):
    """Referencia inválida: ``field`` es customer_id o vehicle_id; ``reason`` missing,
    inactive o not_owner."""

    def __init__(self, field: str, reason: str) -> None:
        super().__init__(f"Referencia inválida en {field}: {reason}.")
        self.field = field
        self.reason = reason


def _customer(customer: Customer) -> WorkshopCustomer:
    return WorkshopCustomer(
        id=customer.pk,
        name=customer.name,
        identification_type=customer.identification_type,
        identification=customer.identification,
        phone=customer.phone,
        is_active=customer.is_active,
    )


def _vehicle(vehicle: Vehicle, owner_id: int | None) -> WorkshopVehicle:
    return WorkshopVehicle(
        id=vehicle.pk,
        plate=vehicle.plate,
        brand_name=vehicle.brand.name,
        model=vehicle.model,
        year=vehicle.year,
        color=vehicle.color,
        is_active=vehicle.is_active,
        current_owner_id=owner_id,
    )


def lock_customer_and_vehicle(customer_id: int, vehicle_id: int) -> LockedCustomerVehicle:
    """Bloquea cliente, vehículo y período vigente; exige ambos activos y propiedad vigente."""
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("El bloqueo de clientes y vehículos requiere una transacción atómica.")
    customer = Customer.objects.select_for_update().filter(pk=customer_id).first()
    if customer is None:
        raise WorkshopReferenceError("customer_id", "missing")
    if not customer.is_active:
        raise WorkshopReferenceError("customer_id", "inactive")
    vehicle = (
        Vehicle.objects.select_for_update(of=("self",))
        .select_related("brand")
        .filter(pk=vehicle_id)
        .first()
    )
    if vehicle is None:
        raise WorkshopReferenceError("vehicle_id", "missing")
    if not vehicle.is_active:
        raise WorkshopReferenceError("vehicle_id", "inactive")
    period = (
        OwnershipPeriod.objects.select_for_update()
        .filter(vehicle_id=vehicle.pk, ended_at__isnull=True)
        .first()
    )
    owner_id = period.customer_id if period else None
    if owner_id != customer.pk:
        raise WorkshopReferenceError("vehicle_id", "not_owner")
    return LockedCustomerVehicle(customer=_customer(customer), vehicle=_vehicle(vehicle, owner_id))


def list_customer_options(
    *, search: str = "", page: int = 1, page_size: int = 20
) -> WorkshopCustomerPage:
    """Clientes activos seleccionables para nuevas órdenes, paginados en servidor."""
    queryset = Customer.objects.filter(is_active=True)
    term = search.strip()
    if term:
        queryset = queryset.filter(Q(name__icontains=term) | Q(identification__icontains=term))
    queryset = queryset.order_by("name", "id")
    total = queryset.count()
    offset = (page - 1) * page_size
    items = tuple(_customer(c) for c in queryset[offset : offset + page_size])
    return WorkshopCustomerPage(items=items, total_count=total, page=page, page_size=page_size)


def list_vehicle_options(customer_id: int) -> tuple[WorkshopVehicle, ...]:
    """Vehículos activos cuyo propietario vigente es el cliente, ordenados por placa."""
    vehicles = (
        Vehicle.objects.filter(
            is_active=True,
            ownership_periods__customer_id=customer_id,
            ownership_periods__ended_at__isnull=True,
        )
        .select_related("brand")
        .order_by("plate", "id")
    )
    return tuple(_vehicle(v, customer_id) for v in vehicles)


def get_vehicle_summary(vehicle_id: int) -> WorkshopVehicle | None:
    """Vehículo, activo o no, con su propietario vigente, para consultas históricas."""
    vehicle = Vehicle.objects.select_related("brand").filter(pk=vehicle_id).first()
    if vehicle is None:
        return None
    period = vehicle.ownership_periods.filter(ended_at__isnull=True).first()
    return _vehicle(vehicle, period.customer_id if period else None)


def get_active_states(
    customer_ids: set[int], vehicle_ids: set[int]
) -> tuple[dict[int, bool], dict[int, bool]]:
    """Estado activo actual de clientes y vehículos para indicar inactividad en consultas."""
    customers = dict(Customer.objects.filter(pk__in=customer_ids).values_list("pk", "is_active"))
    vehicles = dict(Vehicle.objects.filter(pk__in=vehicle_ids).values_list("pk", "is_active"))
    return customers, vehicles
