"""Reservas de disponibilidad mantenidas sobre posiciones bloqueadas."""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.db import transaction

from inventory.application.posting import ContextNotLockedError, LockedPositions
from inventory.domain.validation import InventoryValidationError, parse_movement_quantity
from inventory.models import InventoryPosition, InventoryReservation, ReservationState


class InsufficientAvailabilityError(InventoryValidationError):
    """La disponibilidad actual no alcanza para crear o ampliar la reserva."""

    def __init__(self, *, available: Decimal, requested: Decimal) -> None:
        super().__init__(
            "quantity",
            f"Disponibilidad insuficiente: disponible {available}, solicitada {requested}.",
        )
        self.available = available
        self.requested = requested


class ReservationConflictError(InventoryValidationError):
    """La fuente ya posee otra reserva activa incompatible."""

    def __init__(self) -> None:
        super().__init__("reservation", "La fuente ya tiene una reserva activa incompatible.")


class ReservationNotFoundError(InventoryValidationError):
    """No existe una reserva activa para la fuente indicada."""

    def __init__(self) -> None:
        super().__init__("reservation", "No existe una reserva activa para la fuente indicada.")


@dataclass(frozen=True)
class Availability:
    product_id: int
    warehouse_id: int
    quantity: Decimal
    reserved: Decimal
    available: Decimal


@dataclass(frozen=True)
class ActiveReservation:
    source_type: str
    source_id: int
    product_id: int
    quantity: Decimal


def _require_transaction() -> None:
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("La reserva de inventario requiere una transacción exterior activa.")


def _position(locked: LockedPositions, product_id: int) -> InventoryPosition:
    if not isinstance(locked, LockedPositions):
        raise ContextNotLockedError("Las posiciones deben provenir de lock_positions().")
    try:
        return locked.positions[product_id]
    except KeyError as error:
        raise ContextNotLockedError(f"El producto {product_id} no está bloqueado.") from error


def _active_reservation(source_type: str, source_id: int) -> InventoryReservation:
    try:
        return InventoryReservation.objects.select_for_update().get(
            source_type=source_type,
            source_id=source_id,
            state=ReservationState.ACTIVE,
        )
    except InventoryReservation.DoesNotExist as error:
        raise ReservationNotFoundError from error


def _save_reserved(position: InventoryPosition, reserved: Decimal) -> None:
    position.reserved = reserved
    position.version += 1
    position.save(update_fields=["reserved", "version", "updated_at"])


def reserve(
    locked: LockedPositions,
    *,
    product_id: int,
    source_type: str,
    source_id: int,
    source_reference: dict[str, Any],
    quantity: Decimal,
) -> InventoryReservation:
    """Crea una reserva activa, o devuelve el mismo hecho compatible."""
    _require_transaction()
    position = _position(locked, product_id)
    quantity = parse_movement_quantity(quantity)
    existing = (
        InventoryReservation.objects.select_for_update()
        .filter(
            source_type=source_type,
            source_id=source_id,
            state=ReservationState.ACTIVE,
        )
        .first()
    )
    if existing is not None:
        if (
            existing.position_id == position.pk
            and existing.quantity == quantity
            and existing.source_reference == source_reference
        ):
            return existing
        raise ReservationConflictError

    available = position.quantity - position.reserved
    if quantity > available:
        raise InsufficientAvailabilityError(available=available, requested=quantity)
    reservation = InventoryReservation.objects.create(
        position=position,
        product_id=product_id,
        warehouse_id=locked.warehouse_id,
        source_type=source_type,
        source_id=source_id,
        source_reference=source_reference,
        quantity=quantity,
    )
    _save_reserved(position, position.reserved + quantity)
    return reservation


def resize(
    locked: LockedPositions,
    *,
    source_type: str,
    source_id: int,
    quantity: Decimal,
) -> InventoryReservation:
    """Cambia la cantidad activa y aplica solo su diferencia al agregado."""
    _require_transaction()
    quantity = parse_movement_quantity(quantity)
    reservation = _active_reservation(source_type, source_id)
    position = _position(locked, reservation.product_id)
    if reservation.position_id != position.pk or reservation.warehouse_id != locked.warehouse_id:
        raise ContextNotLockedError("La posición de la reserva no está bloqueada.")
    delta = quantity - reservation.quantity
    available = position.quantity - position.reserved
    if delta > available:
        raise InsufficientAvailabilityError(available=available, requested=delta)
    reservation.quantity = quantity
    reservation.save(update_fields=["quantity", "updated_at"])
    _save_reserved(position, position.reserved + delta)
    return reservation


def release(
    locked: LockedPositions,
    *,
    source_type: str,
    source_id: int,
) -> InventoryReservation:
    """Libera una reserva activa conservando el registro histórico."""
    _require_transaction()
    reservation = _active_reservation(source_type, source_id)
    position = _position(locked, reservation.product_id)
    if reservation.position_id != position.pk or reservation.warehouse_id != locked.warehouse_id:
        raise ContextNotLockedError("La posición de la reserva no está bloqueada.")
    reservation.state = ReservationState.RELEASED
    reservation.save(update_fields=["state", "updated_at"])
    _save_reserved(position, position.reserved - reservation.quantity)
    return reservation


def read_availability(product_ids: Iterable[int], *, warehouse_id: int) -> dict[int, Availability]:
    """Lee existencia, reserva y disponibilidad sin crear posiciones."""
    ids = tuple(dict.fromkeys(product_ids))
    positions = {
        position.product_id: position
        for position in InventoryPosition.objects.filter(
            product_id__in=ids,
            warehouse_id=warehouse_id,
        )
    }
    result: dict[int, Availability] = {}
    for product_id in ids:
        position = positions.get(product_id)
        quantity = position.quantity if position is not None else Decimal(0)
        reserved = position.reserved if position is not None else Decimal(0)
        result[product_id] = Availability(
            product_id=product_id,
            warehouse_id=warehouse_id,
            quantity=quantity,
            reserved=reserved,
            available=quantity - reserved,
        )
    return result


def read_reserved_by_sources(
    sources: Iterable[tuple[str, int]],
) -> dict[int, Decimal]:
    """Suma reservas activas propias por producto sin exponer modelos de inventario."""
    keys = tuple(dict.fromkeys(sources))
    if not keys:
        return {}
    from django.db.models import Q

    requested = Q()
    for source_type, source_id in keys:
        requested |= Q(source_type=source_type, source_id=source_id)
    totals: dict[int, Decimal] = {}
    for reservation in InventoryReservation.objects.filter(
        requested,
        state=ReservationState.ACTIVE,
    ).only("product_id", "quantity"):
        totals[reservation.product_id] = (
            totals.get(reservation.product_id, Decimal(0)) + reservation.quantity
        )
    return totals


def read_active_reservations(*, source_type: str) -> tuple[ActiveReservation, ...]:
    """Proyección conciliable de reservas activas para el módulo propietario de la fuente."""
    return tuple(
        ActiveReservation(
            source_type=row.source_type,
            source_id=row.source_id,
            product_id=row.product_id,
            quantity=row.quantity,
        )
        for row in InventoryReservation.objects.filter(
            source_type=source_type,
            state=ReservationState.ACTIVE,
        ).order_by("source_id")
    )
