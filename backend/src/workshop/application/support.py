"""Utilidades internas del taller: bloqueo de la orden, fecha operativa y referencias."""

from datetime import date
from typing import Any

from django.utils import timezone

from catalog.application.workshop_references import (
    ServiceReferenceError,
    WorkshopServiceReference,
    lock_service_reference,
)
from customer_registry.application.workshop_references import (
    LockedCustomerVehicle,
    WorkshopReferenceError,
    lock_customer_and_vehicle,
)
from identity.application.authorization import has_permission
from identity.models import User
from workshop.application.errors import WorkshopError, not_editable, not_found, stale_record
from workshop.domain.states import OrderState
from workshop.models import SNAPSHOT_SCHEMA_VERSION, Intervention, MaintenanceOrder

WORKSHOP_PERMISSIONS = (
    "mantenimientos.ver",
    "mantenimientos.gestionar",
    "mantenimientos.cambiar_precio_servicio",
    "mantenimientos.gestionar_fotos",
    "mantenimientos.finalizar",
    "mantenimientos.reabrir",
)


def business_today() -> date:
    return timezone.localdate()


def actor_permissions(actor: User) -> frozenset[str]:
    return frozenset(p for p in WORKSHOP_PERMISSIONS if has_permission(actor, p))


def lock_order(order_id: int) -> MaintenanceOrder:
    order = MaintenanceOrder.objects.select_for_update(of=("self",)).filter(pk=order_id).first()
    if order is None:
        raise not_found()
    return order


def ensure_version(order: MaintenanceOrder, expected_version: int) -> None:
    if order.version != expected_version:
        raise stale_record()


def ensure_state(order: MaintenanceOrder, *states: OrderState) -> None:
    if order.state not in {s.value for s in states}:
        raise not_editable(order.state)


def open_intervention(order: MaintenanceOrder) -> Intervention:
    intervention = (
        Intervention.objects.select_for_update().filter(order=order, closed_at__isnull=True).first()
    )
    if intervention is None:
        raise not_editable(order.state)
    return intervention


_REFERENCE_MESSAGES = {
    ("customer_id", "missing"): ("validation_error", "El cliente no existe."),
    ("customer_id", "inactive"): ("inactive_reference", "El cliente está inactivo."),
    ("vehicle_id", "missing"): ("validation_error", "El vehículo no existe."),
    ("vehicle_id", "inactive"): ("inactive_reference", "El vehículo está inactivo."),
    ("vehicle_id", "not_owner"): (
        "validation_error",
        "El vehículo no pertenece actualmente al cliente seleccionado.",
    ),
}


def lock_pair(customer_id: int, vehicle_id: int) -> LockedCustomerVehicle:
    try:
        return lock_customer_and_vehicle(customer_id, vehicle_id)
    except WorkshopReferenceError as error:
        code, message = _REFERENCE_MESSAGES[(error.field, error.reason)]
        raise WorkshopError(code, message, {error.field: [message]}) from None


def lock_service(service_id: int) -> WorkshopServiceReference:
    try:
        return lock_service_reference(service_id)
    except ServiceReferenceError as error:
        if error.reason == "inactive":
            message = "El servicio está inactivo y no puede agregarse."
            raise WorkshopError("inactive_reference", message, {"service_id": [message]}) from None
        message = "Seleccione un servicio existente del catálogo."
        raise WorkshopError("validation_error", message, {"service_id": [message]}) from None


def snapshots(pair: LockedCustomerVehicle) -> tuple[dict[str, Any], dict[str, Any]]:
    customer = {
        "schema_version": SNAPSHOT_SCHEMA_VERSION,
        "name": pair.customer.name,
        "identification_type": pair.customer.identification_type,
        "identification": pair.customer.identification,
    }
    vehicle = {
        "schema_version": SNAPSHOT_SCHEMA_VERSION,
        "plate": pair.vehicle.plate,
        "brand": pair.vehicle.brand_name,
        "model": pair.vehicle.model,
    }
    return customer, vehicle


def open_order_conflict(vehicle_id: int, exclude_id: int | None = None) -> None:
    other = (
        MaintenanceOrder.objects.filter(
            vehicle_id=vehicle_id,
            state__in=[OrderState.REGISTERED.value, OrderState.REOPENED.value],
        )
        .exclude(pk=exclude_id or 0)
        .first()
    )
    if other is not None:
        raise open_order_error(other.pk, other.number)


def open_order_error(order_id: int, number: str) -> WorkshopError:
    message = f"El vehículo ya tiene la orden abierta {number}. Finalícela antes de abrir otra."
    return WorkshopError(
        "open_order_exists",
        message,
        {"vehicle_id": [message]},
        conflict={"type": "maintenance_order", "id": order_id},
    )


def user_label(user: User | None) -> dict[str, Any] | None:
    if user is None:
        return None
    return {"id": user.pk, "name": user.get_full_name() or user.username}
