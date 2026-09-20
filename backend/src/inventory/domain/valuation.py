"""Promedio ponderado con residuos de redondeo conservados.

Q = cantidad, V = valor conservado (exacto a seis decimales) y A = promedio publicado.
El promedio nunca sustituye a V: el residuo entre V y Q*A permanece en V hasta que la
salida que agota la existencia lo absorbe. No depende de Django, DRF ni persistencia.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, localcontext

from inventory.domain.validation import (
    AVERAGE_MAX,
    QUANTITY_MAX,
    VALUE_MAX,
    InsufficientStockError,
    InventoryValidationError,
)

PRECISION = 60
SIX_DECIMALS = Decimal("0.000001")
ZERO = Decimal("0.000000")


@dataclass(frozen=True)
class Position:
    quantity: Decimal
    value: Decimal
    average: Decimal


@dataclass(frozen=True)
class ExitResult:
    position: Position
    nominal_value: Decimal
    applied_value: Decimal
    rounding_adjustment: Decimal


EMPTY_POSITION = Position(Decimal(0), ZERO, ZERO)


def _q6(value: Decimal) -> Decimal:
    return value.quantize(SIX_DECIMALS, rounding=ROUND_HALF_UP)


def apply_entry(current: Position, quantity: Decimal, value: Decimal) -> Position:
    """Suma cantidad y valor exactos y publica el nuevo promedio Q6(V'/Q')."""
    with localcontext() as context:
        context.prec = PRECISION
        new_quantity = current.quantity + quantity
        new_value = _q6(current.value + value)
        average = _q6(new_value / new_quantity)
    if new_quantity > QUANTITY_MAX:
        raise InventoryValidationError("quantity", "La existencia resultante excede el máximo.")
    if new_value > VALUE_MAX or average > AVERAGE_MAX:
        raise InventoryValidationError("value", "El valor resultante excede el máximo permitido.")
    return Position(new_quantity, new_value, average)


def apply_exit(current: Position, quantity: Decimal) -> ExitResult:
    """Salida al promedio vigente, acotada por el valor conservado.

    La salida total aplica exactamente V y deja la posición en cero; la diferencia con el
    valor nominal se registra como ajuste técnico de redondeo.
    """
    if quantity > current.quantity:
        raise InsufficientStockError(current.quantity, quantity)
    with localcontext() as context:
        context.prec = PRECISION
        nominal = _q6(quantity * current.average)
        if quantity == current.quantity:
            applied = current.value
            position = EMPTY_POSITION
        else:
            applied = min(current.value, nominal)
            position = Position(
                current.quantity - quantity, current.value - applied, current.average
            )
        adjustment = applied - nominal
    return ExitResult(position, nominal, applied, adjustment)


def reverse_exactly(current: Position, *, before: Position, after: Position) -> Position:
    """Restituye el estado anterior conservado por el movimiento original.

    Solo procede si la posición actual sigue siendo el estado posterior al movimiento:
    cualquier movimiento intermedio impide una restitución exacta.
    """
    if current != after:
        raise InventoryValidationError(
            "reversal", "La posición cambió después del movimiento; no se puede revertir."
        )
    return before
