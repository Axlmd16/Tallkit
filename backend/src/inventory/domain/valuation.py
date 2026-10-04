"""Promedio ponderado con residuos de redondeo conservados.

Q = cantidad, V = valor conservado (exacto a seis decimales) y A = promedio publicado.
El promedio nunca sustituye a V: el residuo entre V y Q*A permanece en V hasta que la
salida que agota la existencia lo absorbe. No depende de Django, DRF ni persistencia.

Una posición puede estar **sin costo registrado** (``valued = False``): tiene existencia pero
ninguna entrada trajo costo ni hubo un promedio previo. Su valor y su promedio son cero sin
significado económico, distinto de un costo cero informado explícitamente. La primera
entrada con costo regulariza las unidades previas a ese costo. Una posición vacía siempre
está valorada.
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
    valued: bool = True


@dataclass(frozen=True)
class ExitResult:
    position: Position
    nominal_value: Decimal
    applied_value: Decimal
    rounding_adjustment: Decimal


@dataclass(frozen=True)
class EntryResult:
    position: Position
    value_delta: Decimal
    cost_known: bool
    regularization_value: Decimal


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


def receive_entry(
    current: Position,
    quantity: Decimal,
    value: Decimal | None,
    *,
    last_average: Decimal = ZERO,
) -> EntryResult:
    """Entrada con o sin costo; ``value`` es el valor inventariable total de la línea.

    Con costo se ponderan cantidad y valor y, si la posición no tenía costo, sus unidades
    previas se valoran al costo unitario de la entrada (``regularization_value``). Sin
    costo la existencia se valora al promedio vigente (o al último conocido si la posición
    está vacía) sin modificarlo; si no hay promedio alguno queda sin costo registrado.
    """
    if value is not None:
        regularization = ZERO
        base = current
        if not current.valued and current.quantity > 0:
            with localcontext() as context:
                context.prec = PRECISION
                regularization = _q6(current.quantity * value / quantity)
            base = Position(current.quantity, regularization, ZERO)
        after = apply_entry(Position(base.quantity, base.value, base.average), quantity, value)
        return EntryResult(after, after.value - current.value, True, regularization)
    new_quantity = current.quantity + quantity
    if new_quantity > QUANTITY_MAX:
        raise InventoryValidationError("quantity", "La existencia resultante excede el máximo.")
    average = current.average if current.quantity > 0 else last_average
    if not current.valued or (average <= 0 and current.quantity == 0):
        return EntryResult(Position(new_quantity, ZERO, ZERO, valued=False), ZERO, False, ZERO)
    with localcontext() as context:
        context.prec = PRECISION
        added = _q6(quantity * average)
    new_value = current.value + added
    if new_value > VALUE_MAX:
        raise InventoryValidationError("value", "El valor resultante excede el máximo permitido.")
    return EntryResult(Position(new_quantity, new_value, average), added, True, ZERO)


def apply_exit(current: Position, quantity: Decimal) -> ExitResult:
    """Salida al promedio vigente, acotada por el valor conservado.

    La salida total aplica exactamente V y deja la posición en cero; la diferencia con el
    valor nominal se registra como ajuste técnico de redondeo.
    """
    if quantity > current.quantity:
        raise InsufficientStockError(current.quantity, quantity)
    if not current.valued:
        remaining = current.quantity - quantity
        position = (
            EMPTY_POSITION if remaining == 0 else Position(remaining, ZERO, ZERO, valued=False)
        )
        return ExitResult(position, ZERO, ZERO, ZERO)
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
