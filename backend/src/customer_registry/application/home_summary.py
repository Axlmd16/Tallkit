"""Lecturas de clientes y vehículos para inicio y búsqueda global.

Como las demás lecturas del inicio, deciden con ``has_permission`` —que no audita denegaciones—
y devuelven ``None`` cuando el actor no tiene permiso.
"""

from dataclasses import dataclass

from customer_registry.application.queries import CustomerCard
from customer_registry.application.queries import customer_cards as _cards
from customer_registry.models import Customer, OwnershipPeriod, Vehicle
from identity.application.authorization import has_permission
from identity.models import User
from shared.text import fold_compact, fold_text


@dataclass(frozen=True)
class VehicleSearchRow:
    id: int
    plate: str
    label: str
    owner_id: int | None
    owner_name: str


@dataclass(frozen=True)
class CustomerSearchRow:
    id: int
    full_name: str
    identification_type: str
    identification: str


def customer_cards(actor: User, customer_ids: set[int]) -> list[CustomerCard] | None:
    if not has_permission(actor, "clientes.ver"):
        return None
    return _cards(customer_ids)


def customer_exists(actor: User, customer_id: int) -> bool | None:
    if not has_permission(actor, "clientes.ver"):
        return None
    return Customer.objects.filter(pk=customer_id).exists()


def search_vehicles(
    actor: User, query: str, *, limit: int = 5
) -> tuple[list[VehicleSearchRow], int] | None:
    """Busca vehículos por placa (con o sin guion), marca, modelo o dueño vigente."""
    if not has_permission(actor, "vehiculos.ver"):
        return None
    term = fold_text(query)
    compact = fold_compact(query)
    if len(term) < 2:
        return [], 0

    owners = dict(
        OwnershipPeriod.objects.filter(ended_at__isnull=True)
        .select_related("customer")
        .values_list("vehicle_id", "customer_id")
    )
    owner_names = dict(
        OwnershipPeriod.objects.filter(ended_at__isnull=True)
        .select_related("customer")
        .values_list("vehicle_id", "customer__name")
    )

    matches: list[VehicleSearchRow] = []
    total = 0
    rows = (
        Vehicle.objects.filter(is_active=True)
        .select_related("brand")
        .order_by("plate", "id")
        .values_list("id", "plate", "brand__name", "model", "year")
    )
    for vid, plate, brand_name, model, year in rows:
        owner_name = owner_names.get(vid, "")
        label = f"{brand_name} {model}".strip()
        if year is not None:
            label = f"{label} {year}"
        haystack_plate = fold_compact(plate)
        haystack_text = fold_text(f"{label} {owner_name}")
        if (compact and compact in haystack_plate) or (term in haystack_text):
            total += 1
            if len(matches) < limit:
                matches.append(
                    VehicleSearchRow(
                        id=vid,
                        plate=plate,
                        label=label,
                        owner_id=owners.get(vid),
                        owner_name=owner_name,
                    )
                )
    return matches, total


def search_customers(
    actor: User, query: str, *, limit: int = 5
) -> tuple[list[CustomerSearchRow], int] | None:
    """Busca clientes activos por nombre/razón social o identificación."""
    if not has_permission(actor, "clientes.ver"):
        return None
    term = fold_text(query)
    compact = fold_compact(query)
    if len(term) < 2:
        return [], 0

    matches: list[CustomerSearchRow] = []
    total = 0
    rows = (
        Customer.objects.filter(is_active=True)
        .order_by("name", "id")
        .values_list("id", "name", "identification_type", "identification")
    )
    for cid, name, id_type, identification in rows:
        if term in fold_text(name) or (compact and compact in fold_compact(identification)):
            total += 1
            if len(matches) < limit:
                matches.append(
                    CustomerSearchRow(
                        id=cid,
                        full_name=name,
                        identification_type=id_type,
                        identification=identification,
                    )
                )
    return matches, total
