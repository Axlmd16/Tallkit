"""Validación pura de cantidades y valores de inventario.

No depende de Django, DRF ni persistencia. Rechaza sin truncar ni redondear.
"""

import re
from decimal import Decimal
from typing import Any

QUANTITY_MAX = Decimal("999999999999")
VALUE_SCALE = 6
VALUE_MAX = Decimal("99999999999999999999999999999999.999999")  # numeric(38,6)
AVERAGE_MAX = Decimal("999999999999999999.999999")  # numeric(24,6)

_DECIMAL_TEXT = re.compile(r"^-?\d+(\.\d+)?$")


class InventoryValidationError(ValueError):
    """Regla de inventario incumplida; ``errors`` asocia campo → mensajes."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = {field: [message]}


class InsufficientStockError(InventoryValidationError):
    """La cantidad solicitada supera la existencia; nunca se admite saldo negativo."""

    def __init__(self, available: Decimal, requested: Decimal) -> None:
        super().__init__("quantity", "La existencia es insuficiente para la salida.")
        self.available = available
        self.requested = requested


def _decimal(value: Any, field: str, label: str) -> Decimal:
    if isinstance(value, bool | float):
        raise InventoryValidationError(field, f"{label} debe enviarse como texto decimal.")
    if isinstance(value, int | Decimal):
        number = Decimal(value)
        if not number.is_finite():
            raise InventoryValidationError(field, f"{label} debe ser un número finito.")
        return number
    if not isinstance(value, str) or not _DECIMAL_TEXT.match(value.strip() or "x"):
        raise InventoryValidationError(field, f"{label} no es un decimal válido.")
    return Decimal(value.strip())


def parse_movement_quantity(value: Any) -> Decimal:
    """Cantidad entera positiva de presentaciones."""
    number = _decimal(value, "quantity", "La cantidad")
    if number != number.to_integral_value():
        raise InventoryValidationError("quantity", "La cantidad debe ser un número entero.")
    if number <= 0:
        raise InventoryValidationError("quantity", "La cantidad debe ser mayor que cero.")
    if number > QUANTITY_MAX:
        raise InventoryValidationError("quantity", "La cantidad excede el máximo permitido.")
    return Decimal(int(number))


def parse_entry_value(value: Any) -> Decimal:
    """Valor inventariable no negativo con hasta seis decimales, sin redondear."""
    number = _decimal(value, "value", "El valor")
    if number < 0:
        raise InventoryValidationError("value", "El valor no puede ser negativo.")
    if number > VALUE_MAX:
        raise InventoryValidationError("value", "El valor excede el máximo permitido.")
    exponent = number.normalize().as_tuple().exponent
    if isinstance(exponent, int) and exponent < -VALUE_SCALE:
        raise InventoryValidationError("value", "El valor admite hasta 6 decimales.")
    return number
