"""Conciliación de solo lectura del inventario contra su historia inmutable.

Reconstruye cantidad y valor desde los movimientos originales e inversos, verifica la cadena
anterior/posterior, los ordinales, el promedio y la posición, y comprueba que las operaciones
de compra contabilizadas tengan sus efectos y las anuladas su compensación. Nunca modifica ni
repara: una discrepancia exige diagnóstico y un procedimiento explícito fuera del ajuste
ordinario.
"""

from collections import defaultdict
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from inventory.application.queries import read_snapshot
from inventory.models import (
    InventoryMovement,
    InventoryOperation,
    InventoryPosition,
    OperationKind,
    OperationState,
)

SIX = Decimal("0.000001")
ZERO = Decimal(0)


@dataclass(frozen=True)
class Difference:
    scope: str
    message: str
    product_id: int | None = None
    operation_id: int | None = None

    def render(self) -> str:
        where = []
        if self.product_id is not None:
            where.append(f"producto {self.product_id}")
        if self.operation_id is not None:
            where.append(f"operación INV-{self.operation_id}")
        suffix = f" ({', '.join(where)})" if where else ""
        return f"[{self.scope}] {self.message}{suffix}"


def _q6(value: Decimal) -> Decimal:
    return value.quantize(SIX, rounding=ROUND_HALF_UP)


def _check_chain(product_id: int, movements: list[InventoryMovement]) -> list[Difference]:
    found: list[Difference] = []
    by_id = {m.pk: m for m in movements}
    previous_after: tuple[Decimal, Decimal, Decimal] = (ZERO, ZERO, ZERO)
    for expected_ordinal, movement in enumerate(movements, start=1):

        def diff(message: str, movement: InventoryMovement = movement) -> None:
            found.append(Difference("movimiento", message, product_id, movement.operation_id))

        if movement.ordinal != expected_ordinal:
            diff(f"ordinal {movement.ordinal} no consecutivo (se esperaba {expected_ordinal})")
        before = (movement.quantity_before, movement.value_before, movement.average_before)
        if before != previous_after:
            diff(f"la cadena anterior/posterior se rompe en el ordinal {movement.ordinal}")
        if (
            movement.quantity_after
            != movement.quantity_before + movement.quantity_in - movement.quantity_out
        ):
            diff(f"la cantidad posterior no cuadra en el ordinal {movement.ordinal}")
        if movement.value_after != movement.value_before + movement.value_delta:
            diff(f"el valor posterior no cuadra en el ordinal {movement.ordinal}")
        if movement.quantity_after < 0 or movement.value_after < 0:
            diff(f"saldo negativo en el ordinal {movement.ordinal}")
        if movement.movement_type == OperationKind.REVERSAL:
            original = by_id.get(movement.reverses_movement_id or 0)
            if original is None:
                diff(f"la compensación del ordinal {movement.ordinal} no enlaza su original")
            elif (
                movement.quantity_after,
                movement.value_after,
                movement.average_after,
            ) != (original.quantity_before, original.value_before, original.average_before):
                diff(
                    f"la compensación del ordinal {movement.ordinal} no restituye el estado previo"
                )
        elif movement.quantity_in > 0:
            expected = (
                _q6(movement.value_after / movement.quantity_after)
                if movement.quantity_after > 0
                else ZERO
            )
            if movement.average_after != expected:
                diff(f"promedio inconsistente en la entrada del ordinal {movement.ordinal}")
        elif movement.quantity_after == 0:
            if movement.value_after != 0 or movement.average_after != 0:
                diff(f"la salida que agota stock deja residuo en el ordinal {movement.ordinal}")
        elif movement.average_after != movement.average_before:
            diff(f"la salida altera el promedio en el ordinal {movement.ordinal}")
        previous_after = (movement.quantity_after, movement.value_after, movement.average_after)
    return found


def _check_positions(
    positions: list[InventoryPosition], grouped: dict[int, list[InventoryMovement]]
) -> list[Difference]:
    found: list[Difference] = []
    for position in positions:
        movements = grouped.get(position.product_id, [])
        if movements:
            last = movements[-1]
            expected = (last.quantity_after, last.value_after, last.average_after, len(movements))
        else:
            expected = (ZERO, ZERO, ZERO, 0)
        actual = (position.quantity, position.value, position.average, position.last_ordinal)
        if actual != expected:
            found.append(
                Difference(
                    "posición",
                    f"la posición ({actual[0]:.0f} uds, valor {actual[1]:.6f}, ordinal {actual[3]})"
                    f" difiere de la reconstruida ({expected[0]:.0f} uds, valor {expected[1]:.6f},"
                    f" ordinal {expected[3]})",
                    position.product_id,
                )
            )
    tracked = {p.product_id for p in positions}
    for product_id in grouped.keys() - tracked:
        found.append(Difference("posición", "existen movimientos sin posición", product_id))
    return found


def _check_operations() -> list[Difference]:
    found: list[Difference] = []
    counts_lines: dict[int, int] = defaultdict(int)
    for operation_id, _ in InventoryOperation.objects.filter(
        state__in=[OperationState.POSTED, OperationState.REVERSED]
    ).values_list("id", "kind"):
        counts_lines[operation_id] = 0
    for movement_operation in InventoryMovement.objects.values_list("operation_id", flat=True):
        counts_lines[movement_operation] += 1
    for operation in InventoryOperation.objects.select_related("reversal").prefetch_related(
        "lines"
    ):
        movements = counts_lines.get(operation.pk, 0)
        lines = len(operation.lines.all())
        if operation.state == OperationState.PREPARED and movements:
            found.append(
                Difference(
                    "operación", "una operación preparada tiene movimientos", None, operation.pk
                )
            )
        if (
            operation.state in (OperationState.POSTED, OperationState.REVERSED)
            and movements != lines
        ):
            found.append(
                Difference(
                    "operación",
                    f"{movements} movimientos frente a {lines} líneas",
                    None,
                    operation.pk,
                )
            )
        if operation.state == OperationState.REVERSED:
            reversal = getattr(operation, "reversal", None)
            if reversal is None or reversal.state != OperationState.POSTED:
                found.append(
                    Difference(
                        "operación",
                        "la operación revertida no tiene su compensación contabilizada",
                        None,
                        operation.pk,
                    )
                )
            else:
                compensated = InventoryMovement.objects.filter(
                    operation=reversal, reverses_movement__operation=operation
                ).count()
                if compensated != movements:
                    found.append(
                        Difference(
                            "operación",
                            "la compensación no cubre todos los movimientos originales",
                            None,
                            operation.pk,
                        )
                    )
        if (
            operation.kind == OperationKind.PURCHASE_RECEIPT
            and operation.state == OperationState.POSTED
            and movements == 0
        ):
            found.append(
                Difference(
                    "operación", "un ingreso contabilizado no tiene efectos", None, operation.pk
                )
            )
    return found


def reconcile() -> list[Difference]:
    """Devuelve todas las diferencias encontradas; una lista vacía significa conciliado."""
    with read_snapshot():
        grouped: dict[int, list[InventoryMovement]] = defaultdict(list)
        for movement in InventoryMovement.objects.order_by("product_id", "ordinal").iterator():
            grouped[movement.product_id].append(movement)
        differences: list[Difference] = []
        for product_id, movements in grouped.items():
            differences += _check_chain(product_id, movements)
        differences += _check_positions(list(InventoryPosition.objects.all()), grouped)
        differences += _check_operations()
    return differences
