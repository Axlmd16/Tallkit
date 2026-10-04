"""Reglas puras de cantidades y costos de una entrada de stock.

No depende de Django, DRF ni persistencia. Rechaza sin truncar ni redondear.
"""

import re
from decimal import Decimal
from typing import Any

QUANTITY_MAX = Decimal("999999999999")
UNIT_COST_MAX = Decimal("999999999999.999999")
UNIT_COST_SCALE = 6

_SIGNED_DECIMAL = re.compile(r"^-?\d+(\.\d+)?$")


class AmountValidationError(ValueError):
    """Entrada inválida; ``errors`` asocia campo → mensajes."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = {field: [message]}


def _as_decimal(value: Any, field: str, pattern: re.Pattern[str], label: str) -> Decimal:
    if isinstance(value, bool | float):
        raise AmountValidationError(field, f"{label} debe enviarse como texto decimal.")
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise AmountValidationError(field, f"{label} debe ser un número finito.")
        return value
    if not isinstance(value, str) or not pattern.match(value.strip() or "x"):
        raise AmountValidationError(field, f"{label} no es un decimal válido.")
    return Decimal(value.strip())


def parse_quantity(value: Any) -> Decimal:
    """Cantidad entera positiva de presentaciones; rechaza sin truncar."""
    number = _as_decimal(value, "quantity", _SIGNED_DECIMAL, "La cantidad")
    if number != number.to_integral_value():
        raise AmountValidationError("quantity", "La cantidad debe ser un número entero.")
    if number <= 0:
        raise AmountValidationError("quantity", "La cantidad debe ser mayor que cero.")
    if number > QUANTITY_MAX:
        raise AmountValidationError("quantity", "La cantidad excede el máximo permitido.")
    return Decimal(int(number))


def parse_unit_cost(value: Any) -> Decimal:
    """Costo unitario sin impuesto: no negativo, hasta seis decimales, sin redondear."""
    number = _as_decimal(value, "unit_cost", _SIGNED_DECIMAL, "El costo unitario")
    if number < 0:
        raise AmountValidationError("unit_cost", "El costo unitario no puede ser negativo.")
    if number > UNIT_COST_MAX:
        raise AmountValidationError("unit_cost", "El costo unitario excede el máximo permitido.")
    exponent = number.normalize().as_tuple().exponent
    if isinstance(exponent, int) and exponent < -UNIT_COST_SCALE:
        raise AmountValidationError("unit_cost", "El costo unitario admite hasta 6 decimales.")
    return number
