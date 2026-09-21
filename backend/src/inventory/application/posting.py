"""Núcleo de publicación de inventario: preparar, bloquear, publicar y revertir.

Todas las funciones exigen la transacción exterior del coordinador y no confirman por
separado. El coordinador ya bloqueó, en el orden total del diseño, recibo, operaciones,
proveedor y productos; este módulo solo toma el grupo de posiciones y después inserta.
Tras ``post_operation`` no se adquiere ningún recurso de grupos anteriores. Inventario
nunca importa compras: devuelve resultados al coordinador.
"""

from collections import defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Protocol

from django.db import transaction
from django.utils import timezone

from identity.models import User
from inventory.domain.validation import (
    InventoryValidationError,
    parse_entry_value,
    parse_movement_quantity,
)
from inventory.domain.valuation import (
    Position,
    apply_entry,
    apply_exit,
    reverse_exactly,
)
from inventory.models import (
    InventoryMovement,
    InventoryOperation,
    InventoryOperationLine,
    InventoryPosition,
    OperationKind,
    OperationState,
)


class ProductReference(Protocol):
    """Lo que la publicación necesita para congelar la identidad del producto.

    Cualquier DTO de catálogo con estos atributos (inventario, compras o ventas) lo cumple.
    """

    @property
    def id(self) -> int: ...
    @property
    def code(self) -> str: ...
    @property
    def name(self) -> str: ...
    @property
    def content_quantity(self) -> Decimal: ...
    @property
    def unit_id(self) -> int: ...
    @property
    def unit_name(self) -> str: ...
    @property
    def unit_symbol(self) -> str: ...


SNAPSHOT_SCHEMA_VERSION = 1
ENTRY_KINDS = {
    OperationKind.PURCHASE_RECEIPT,
    OperationKind.INITIAL_LOAD,
    OperationKind.ADJUSTMENT_IN,
    OperationKind.CUSTOMER_RETURN_IN,
}
_TOKEN = object()


class ContextNotLockedError(RuntimeError):
    """Se intentó publicar sin las posiciones y productos bloqueados por el coordinador."""


class ReversalBlockedError(Exception):
    """La reversión no procede; ``code`` distingue el motivo estable.

    ``later_movements``: existe un efecto posterior del producto (referencia en
    ``blocking_operation_id``). ``inconsistent``: los saldos actuales no coinciden con los
    posteriores originales, lo que indica una discrepancia que no se repara aquí.
    """

    def __init__(
        self,
        code: str,
        detail: str,
        product_id: int | None = None,
        blocking_operation_id: int | None = None,
    ) -> None:
        super().__init__(detail)
        self.code = code
        self.product_id = product_id
        self.blocking_operation_id = blocking_operation_id


@dataclass(frozen=True)
class EntryLine:
    product_id: int
    quantity: Decimal
    value: Decimal
    source_line_ids: tuple[int, ...] = ()


@dataclass(frozen=True)
class ExitLine:
    product_id: int
    quantity: Decimal


@dataclass(frozen=True)
class LockedPositions:
    """Posiciones bloqueadas; solo ``lock_positions`` puede construirlas."""

    positions: dict[int, InventoryPosition]
    warehouse_id: int
    _token: object = field(repr=False, default=None)

    def __post_init__(self) -> None:
        if self._token is not _TOKEN:
            raise ContextNotLockedError("Las posiciones solo se obtienen con lock_positions().")


@dataclass(frozen=True)
class PostingResult:
    operation: InventoryOperation
    movements: tuple[InventoryMovement, ...]


def _now() -> datetime:
    return timezone.now()


def _require_transaction() -> None:
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("La operación de inventario requiere una transacción exterior activa.")


def group_entry_lines(lines: Iterable[EntryLine]) -> list[EntryLine]:
    """Un solo movimiento por producto: suma cantidades y valores ya calculados."""
    quantity: dict[int, Decimal] = defaultdict(Decimal)
    value: dict[int, Decimal] = defaultdict(Decimal)
    sources: dict[int, list[int]] = defaultdict(list)
    for line in lines:
        quantity[line.product_id] += line.quantity
        value[line.product_id] += line.value
        sources[line.product_id].extend(line.source_line_ids)
    return [EntryLine(pid, quantity[pid], value[pid], tuple(sources[pid])) for pid in quantity]


def _group_exit_lines(lines: Iterable[ExitLine]) -> list[ExitLine]:
    quantity: dict[int, Decimal] = defaultdict(Decimal)
    for line in lines:
        quantity[line.product_id] += line.quantity
    return [ExitLine(pid, qty) for pid, qty in quantity.items()]


def prepare_operation(
    *,
    kind: str,
    actor: User,
    source_type: str,
    source_id: int | None,
    entry_lines: Iterable[EntryLine] = (),
    exit_lines: Iterable[ExitLine] = (),
    reason: str = "",
    observation: str = "",
    fingerprint: str = "",
    external_reference: str = "",
    corrects_operation_id: int | None = None,
) -> InventoryOperation:
    """Crea la operación PREPARED con sus líneas agrupadas; no toca existencias."""
    _require_transaction()
    entries = group_entry_lines(entry_lines)
    exits = _group_exit_lines(exit_lines)
    if bool(entries) == bool(exits):
        raise InventoryValidationError("lines", "Una operación es de entrada o de salida.")
    if bool(entries) != (kind in ENTRY_KINDS):
        raise InventoryValidationError("lines", "Las líneas no corresponden al tipo de operación.")
    for entry in entries:
        parse_movement_quantity(entry.quantity)
        parse_entry_value(entry.value)
    for leave in exits:
        parse_movement_quantity(leave.quantity)
    operation = InventoryOperation.objects.create(
        kind=kind,
        actor=actor,
        source_type=source_type,
        source_id=source_id,
        reason=reason,
        observation=observation,
        fingerprint=fingerprint,
        external_reference=external_reference,
        corrects_operation_id=corrects_operation_id,
    )
    rows: list[InventoryOperationLine] = []
    for position, entry in enumerate(entries, start=1):
        rows.append(
            InventoryOperationLine(
                operation=operation,
                position=position,
                product_id=entry.product_id,
                quantity=entry.quantity,
                entry_value=entry.value,
                source_line_id=entry.source_line_ids[0]
                if len(entry.source_line_ids) == 1
                else None,
            )
        )
    for position, leave in enumerate(exits, start=1):
        rows.append(
            InventoryOperationLine(
                operation=operation,
                position=position,
                product_id=leave.product_id,
                quantity=leave.quantity,
            )
        )
    InventoryOperationLine.objects.bulk_create(rows)
    return operation


def lock_operation(operation_id: int) -> InventoryOperation:
    """Bloquea una operación existente (grupo 2 del orden total; antes de las posiciones)."""
    _require_transaction()
    return InventoryOperation.objects.select_for_update().get(pk=operation_id)


def lock_positions(
    product_refs: Mapping[int, ProductReference], *, warehouse_id: int
) -> LockedPositions:
    """Bloquea las posiciones por ID de producto; crea las ausentes bajo el bloqueo del producto."""
    _require_transaction()
    product_ids = sorted(product_refs)
    for product_id in product_ids:
        InventoryPosition.objects.get_or_create(product_id=product_id, warehouse_id=warehouse_id)
    locked = {
        p.product_id: p
        for p in InventoryPosition.objects.select_for_update()
        .filter(product_id__in=product_ids, warehouse_id=warehouse_id)
        .order_by("product_id")
    }
    return LockedPositions(locked, warehouse_id, _TOKEN)


def _snapshot(ref: ProductReference) -> dict[str, Any]:
    return {
        "schema_version": SNAPSHOT_SCHEMA_VERSION,
        "product_id": ref.id,
        "code": ref.code,
        "name": ref.name,
        "content_quantity": str(ref.content_quantity),
        "unit_id": ref.unit_id,
        "unit_name": ref.unit_name,
        "unit_symbol": ref.unit_symbol,
    }


def _state(position: InventoryPosition) -> Position:
    return Position(position.quantity, position.value, position.average)


def _check_context(
    operation_product_ids: Iterable[int],
    locked: LockedPositions,
    product_refs: Mapping[int, ProductReference],
) -> None:
    if not isinstance(locked, LockedPositions):
        raise ContextNotLockedError("Las posiciones deben provenir de lock_positions().")
    for product_id in operation_product_ids:
        if product_id not in locked.positions or product_id not in product_refs:
            raise ContextNotLockedError(f"El producto {product_id} no está bloqueado.")


def _insert_movement(
    *,
    operation: InventoryOperation,
    position: InventoryPosition,
    ref: ProductReference,
    movement_type: str,
    effective_at: datetime,
    before: Position,
    after: Position,
    quantity_in: Decimal,
    quantity_out: Decimal,
    value_delta: Decimal,
    applied_unit_cost: Decimal,
    rounding_adjustment: Decimal = Decimal(0),
    reverses_movement: InventoryMovement | None = None,
) -> InventoryMovement:
    ordinal = position.last_ordinal + 1
    movement = InventoryMovement.objects.create(
        operation=operation,
        position=position,
        product_id=position.product_id,
        warehouse_id=position.warehouse_id,
        ordinal=ordinal,
        movement_type=movement_type,
        effective_at=effective_at,
        quantity_in=quantity_in,
        quantity_out=quantity_out,
        value_delta=value_delta,
        applied_unit_cost=applied_unit_cost,
        rounding_adjustment=rounding_adjustment,
        quantity_before=before.quantity,
        value_before=before.value,
        average_before=before.average,
        quantity_after=after.quantity,
        value_after=after.value,
        average_after=after.average,
        product_snapshot=_snapshot(ref),
        actor=operation.actor,
        reverses_movement=reverses_movement,
    )
    position.quantity, position.value, position.average = after.quantity, after.value, after.average
    position.last_ordinal = ordinal
    position.last_effective_at = effective_at
    position.version += 1
    position.save(
        update_fields=[
            "quantity",
            "value",
            "average",
            "last_ordinal",
            "last_effective_at",
            "version",
            "updated_at",
        ]
    )
    return movement


def _effective_at(position: InventoryPosition, now: datetime) -> datetime:
    last = position.last_effective_at
    return now if last is None or now >= last else last


def _finish(operation: InventoryOperation, posted_at: datetime) -> None:
    InventoryOperation.objects.filter(pk=operation.pk).update(
        state=OperationState.POSTED, posted_at=posted_at, version=operation.version + 1
    )
    operation.refresh_from_db()


def post_operation(
    operation: InventoryOperation,
    locked: LockedPositions,
    product_refs: Mapping[int, ProductReference],
) -> PostingResult:
    """Publica la operación PREPARED: valora todo primero y después inserta los efectos."""
    _require_transaction()
    lines = list(operation.lines.order_by("product_id"))
    _check_context((line.product_id for line in lines), locked, product_refs)
    if operation.state != OperationState.PREPARED:
        raise InventoryValidationError("operation", "La operación ya fue publicada.")
    is_entry = operation.kind in ENTRY_KINDS

    planned: list[tuple[InventoryOperationLine, Position, Position, Decimal, Decimal]] = []
    for line in lines:  # valoración pura: el saldo insuficiente falla antes de escribir
        before = _state(locked.positions[line.product_id])
        if is_entry:
            value = line.entry_value if line.entry_value is not None else Decimal(0)
            after = apply_entry(before, line.quantity, value)
            planned.append((line, before, after, after.value - before.value, Decimal(0)))
        else:
            result = apply_exit(before, line.quantity)
            planned.append(
                (line, before, result.position, -result.applied_value, result.rounding_adjustment)
            )

    now = _now()  # posterior a los bloqueos
    movements = []
    for line, before, after, delta, adjustment in planned:
        position = locked.positions[line.product_id]
        if is_entry:
            unit_cost = (delta / line.quantity).quantize(Decimal("0.000001"))
        else:
            unit_cost = before.average
        movements.append(
            _insert_movement(
                operation=operation,
                position=position,
                ref=product_refs[line.product_id],
                movement_type=operation.kind,
                effective_at=_effective_at(position, now),
                before=before,
                after=after,
                quantity_in=line.quantity if is_entry else Decimal(0),
                quantity_out=Decimal(0) if is_entry else line.quantity,
                value_delta=delta,
                applied_unit_cost=unit_cost,
                rounding_adjustment=adjustment,
            )
        )
    _finish(operation, now)
    return PostingResult(operation, tuple(movements))


def reverse_operation(
    original: InventoryOperation,
    *,
    actor: User,
    source_type: str,
    source_id: int | None,
    reason: str,
    locked: LockedPositions,
    product_refs: Mapping[int, ProductReference],
    observation: str = "",
) -> tuple[InventoryOperation, PostingResult]:
    """Compensa por completo una operación restituyendo cantidad, valor y promedio previos.

    Exige que los movimientos originales sean el último efecto de cada posición; cualquier
    movimiento posterior, aunque ya compensado, bloquea toda la reversión. El coordinador
    ya bloqueó la operación original (grupo 2) antes de las posiciones.
    """
    _require_transaction()
    original.refresh_from_db()
    if original.kind == OperationKind.REVERSAL:
        raise ReversalBlockedError("not_reversible", "Una compensación no puede revertirse.")
    if original.state != OperationState.POSTED:
        raise ReversalBlockedError("not_posted", "La operación no está vigente para revertirse.")
    movements = list(original.movements.select_related("position").order_by("product_id"))
    _check_context((m.product_id for m in movements), locked, product_refs)

    restored: list[tuple[InventoryMovement, Position, Position]] = []
    for movement in movements:
        position = locked.positions[movement.product_id]
        before = Position(movement.quantity_before, movement.value_before, movement.average_before)
        after = Position(movement.quantity_after, movement.value_after, movement.average_after)
        if position.last_ordinal != movement.ordinal:
            later = (
                InventoryMovement.objects.filter(position=position, ordinal__gt=movement.ordinal)
                .order_by("ordinal")
                .first()
            )
            raise ReversalBlockedError(
                "later_movements",
                "Existen movimientos posteriores del producto.",
                movement.product_id,
                later.operation_id if later else None,
            )
        try:
            reverse_exactly(_state(position), before=before, after=after)
        except InventoryValidationError as error:
            raise ReversalBlockedError("inconsistent", str(error), movement.product_id) from error
        restored.append((movement, after, before))

    reversal = InventoryOperation.objects.create(
        kind=OperationKind.REVERSAL,
        actor=actor,
        source_type=source_type,
        source_id=source_id,
        reason=reason,
        observation=observation,
        reverses=original,
    )
    InventoryOperationLine.objects.bulk_create(
        InventoryOperationLine(
            operation=reversal,
            position=index,
            product_id=line.product_id,
            quantity=line.quantity,
        )
        for index, line in enumerate(original.lines.order_by("position"), start=1)
    )
    now = _now()
    created = []
    for movement, current, target in restored:
        position = locked.positions[movement.product_id]
        was_entry = movement.quantity_in > 0
        created.append(
            _insert_movement(
                operation=reversal,
                position=position,
                ref=product_refs[movement.product_id],
                movement_type=OperationKind.REVERSAL,
                effective_at=_effective_at(position, now),
                before=current,
                after=target,
                quantity_in=Decimal(0) if was_entry else movement.quantity_out,
                quantity_out=movement.quantity_in if was_entry else Decimal(0),
                value_delta=target.value - current.value,
                applied_unit_cost=movement.applied_unit_cost,
                reverses_movement=movement,
            )
        )
    _finish(reversal, now)
    InventoryOperation.objects.filter(pk=original.pk).update(
        state=OperationState.REVERSED, version=original.version + 1
    )
    original.refresh_from_db()
    return reversal, PostingResult(reversal, tuple(created))
