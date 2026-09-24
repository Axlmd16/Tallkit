"""Creación y edición de órdenes de mantenimiento.

Orden de bloqueos: recibo → orden → cliente → vehículo → período vigente → contador. La creación
asigna el número ART-OT dentro de la misma transacción; un rechazo revierte el contador.
"""

from datetime import date
from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction
from django.utils import timezone

from identity.models import User
from workshop.application import projection
from workshop.application.commands import CommandOutcome, CommandResult, execute_write
from workshop.application.errors import WorkshopError
from workshop.application.support import (
    business_today,
    ensure_state,
    ensure_version,
    lock_order,
    lock_pair,
    open_order_conflict,
    open_order_error,
    snapshots,
)
from workshop.domain.input import InputError, parse_create, parse_update
from workshop.domain.odometer import needs_confirmation
from workshop.domain.states import InterventionKind, OrderState
from workshop.models import Intervention, MaintenanceCounter, MaintenanceOrder
from workshop_configuration.application.workshop_references import (
    ArtisanEntityMissingError,
    get_artisan_entity,
)


def parsed(call: Any) -> Any:
    try:
        return call()
    except InputError as error:
        raise WorkshopError(
            error.code, "La solicitud contiene datos inválidos.", error.errors
        ) from None


def last_known_odometer(
    vehicle_id: int, opened_on: date, exclude_id: int | None = None
) -> MaintenanceOrder | None:
    """Orden más reciente del vehículo con fecha de apertura anterior o igual."""
    return (
        MaintenanceOrder.objects.filter(vehicle_id=vehicle_id, opened_on__lte=opened_on)
        .exclude(pk=exclude_id or 0)
        .order_by("-opened_on", "-sequence")
        .first()
    )


def check_odometer(
    *,
    vehicle_id: int,
    opened_on: date,
    odometer_km: int,
    confirmed: bool,
    exclude_id: int | None = None,
) -> bool:
    """Devuelve si el valor quedó confirmado por ser menor al último conocido."""
    previous = last_known_odometer(vehicle_id, opened_on, exclude_id)
    if previous is None or not needs_confirmation(odometer_km, previous.odometer_km):
        return False
    if confirmed:
        return True
    message = (
        f"El kilometraje es menor al último conocido: {previous.odometer_km} km en la orden "
        f"{previous.number}. Confirme explícitamente si el valor es correcto."
    )
    raise WorkshopError(
        "odometer_confirmation_required",
        message,
        {"odometer_km": [message]},
        details={
            "last_known_km": previous.odometer_km,
            "order_id": previous.pk,
            "order_number": previous.number,
        },
    )


def _next_number() -> tuple[int, str]:
    # La migración siembra la fila; get_or_create cubre bases vaciadas y serializa la carrera
    # de inserción por la clave primaria antes de bloquear la fila.
    counter, _ = MaintenanceCounter.objects.select_for_update().get_or_create(pk=1)
    counter.last_number += 1
    counter.save(update_fields=["last_number"])
    return counter.last_number, f"ART-OT-{counter.last_number:06d}"


def create_order(
    *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    def work() -> CommandResult:
        data = parsed(lambda: parse_create(payload, today=business_today()))
        try:
            entity = get_artisan_entity()
        except ArtisanEntityMissingError:
            raise WorkshopError(
                "configuration_missing", "Configure el RUC artesanal antes de registrar órdenes."
            ) from None
        pair = lock_pair(data.customer_id, data.vehicle_id)
        open_order_conflict(data.vehicle_id)
        confirmed = check_odometer(
            vehicle_id=data.vehicle_id,
            opened_on=data.opened_on,
            odometer_km=data.odometer_km,
            confirmed=data.odometer_confirmed,
        )
        sequence, number = _next_number()
        customer_snapshot, vehicle_snapshot = snapshots(pair)
        try:
            with transaction.atomic():
                order = MaintenanceOrder.objects.create(
                    sequence=sequence,
                    number=number,
                    fiscal_entity_id=entity.id,
                    customer_id=data.customer_id,
                    vehicle_id=data.vehicle_id,
                    customer_snapshot=customer_snapshot,
                    vehicle_snapshot=vehicle_snapshot,
                    opened_on=data.opened_on,
                    odometer_km=data.odometer_km,
                    odometer_confirmed_by=actor if confirmed else None,
                    odometer_confirmed_at=timezone.now() if confirmed else None,
                    diagnosis=data.diagnosis,
                    notes=data.notes,
                    created_by=actor,
                    updated_by=actor,
                )
        except IntegrityError:
            other = MaintenanceOrder.objects.filter(
                vehicle_id=data.vehicle_id,
                state__in=[OrderState.REGISTERED.value, OrderState.REOPENED.value],
            ).first()
            if other is None:
                raise
            raise open_order_error(other.pk, other.number) from None
        Intervention.objects.create(
            order=order, kind=InterventionKind.INITIAL.value, ordinal=1, opened_by=actor
        )
        return CommandResult(201, order.pk, ("created",))

    return execute_write(
        actor=actor,
        permissions=("mantenimientos.gestionar",),
        action="maintenance.create",
        target_id="new",
        payload=payload,
        work=work,
        project=lambda order_id: projection.order_detail(order_id, actor),
        request_id=request_id,
    )


def update_order(
    *, actor: User, order_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    def work() -> CommandResult:
        data = parsed(lambda: parse_update(payload, today=business_today()))
        order = lock_order(order_id)
        ensure_state(order, OrderState.REGISTERED)
        ensure_version(order, data.expected_version)
        fields = {k: v for k, v in data.fields.items() if getattr(order, k) != v}
        customer_id = fields.get("customer_id", order.customer_id)
        vehicle_id = fields.get("vehicle_id", order.vehicle_id)
        if "customer_id" in fields or "vehicle_id" in fields:
            pair = lock_pair(customer_id, vehicle_id)
            open_order_conflict(vehicle_id, exclude_id=order.pk)
            order.customer_snapshot, order.vehicle_snapshot = snapshots(pair)
        if {"vehicle_id", "opened_on", "odometer_km"} & set(fields):
            confirmed = check_odometer(
                vehicle_id=vehicle_id,
                opened_on=fields.get("opened_on", order.opened_on),
                odometer_km=fields.get("odometer_km", order.odometer_km),
                confirmed=data.odometer_confirmed,
                exclude_id=order.pk,
            )
            order.odometer_confirmed_by = actor if confirmed else None
            order.odometer_confirmed_at = timezone.now() if confirmed else None
        for name, value in fields.items():
            setattr(order, name, value)
        if fields:
            order.version += 1
            order.updated_by = actor
            try:
                with transaction.atomic():
                    order.save()
            except IntegrityError:
                raise open_order_conflict_after_race(vehicle_id, order.pk) from None
        return CommandResult(200, order.pk, tuple(sorted(fields)))

    return execute_write(
        actor=actor,
        permissions=("mantenimientos.gestionar",),
        action="maintenance.update",
        target_id=str(order_id),
        payload=payload,
        work=work,
        project=lambda pk: projection.order_detail(pk, actor),
        request_id=request_id,
    )


def open_order_conflict_after_race(vehicle_id: int, exclude_id: int) -> WorkshopError:
    other = (
        MaintenanceOrder.objects.filter(
            vehicle_id=vehicle_id,
            state__in=[OrderState.REGISTERED.value, OrderState.REOPENED.value],
        )
        .exclude(pk=exclude_id or 0)
        .first()
    )
    if other is None:
        return WorkshopError("concurrent_operation", "Otra operación modificó la orden.")
    return open_order_error(other.pk, other.number)
