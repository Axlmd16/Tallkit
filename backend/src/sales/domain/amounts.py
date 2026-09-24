"""Compatibilidad de importes de venta sobre el núcleo monetario compartido."""

from decimal import Decimal
from typing import Any

from shared.money import (
    CENTS,
    MONEY_MAX,
    PRECISION,
    QUANTITY_MAX,
    AmountValidationError,
    SaleLineAmounts,
    SaleTotals,
    _as_decimal,
    calculate_document_totals,
    calculate_line,
    parse_amount,
)

__all__ = [
    "CENTS",
    "MONEY_MAX",
    "PRECISION",
    "QUANTITY_MAX",
    "AmountValidationError",
    "SaleLineAmounts",
    "SaleTotals",
    "calculate_document_totals",
    "calculate_line",
    "parse_amount",
    "parse_price",
    "parse_quantity",
]


def parse_quantity(value: Any) -> Decimal:
    """Cantidad entera positiva de presentaciones completas; rechaza sin truncar."""
    number = _as_decimal(value, "quantity", "La cantidad")
    if number != number.to_integral_value():
        raise AmountValidationError("quantity", "La cantidad debe ser un número entero.")
    if number <= 0:
        raise AmountValidationError("quantity", "La cantidad debe ser mayor que cero.")
    if number > QUANTITY_MAX:
        raise AmountValidationError("quantity", "La cantidad excede el máximo permitido.")
    return Decimal(int(number))


def parse_price(value: Any) -> Decimal:
    """Precio final unitario: no negativo, hasta dos decimales, sin redondear."""
    return parse_amount(value, "unit_price", "El precio")
