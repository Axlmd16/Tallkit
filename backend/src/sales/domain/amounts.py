"""Reglas puras de importes de venta.

No depende de Django, DRF ni persistencia. Todo cálculo usa ``Decimal`` con un contexto
local de precisión 60, sin apoyarse en el contexto global del proceso. El precio de
catálogo es un valor final con impuesto incluido (DP-017).
"""

import re
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, localcontext
from typing import Any

QUANTITY_MAX = Decimal("999999999999")
MONEY_MAX = Decimal("9999999999999999999999.99")  # Decimal(24, 2)
CENTS = Decimal("0.01")
PRECISION = 60

_SIGNED_DECIMAL = re.compile(r"^-?\d+(\.\d+)?$")


class AmountValidationError(ValueError):
    """Entrada de importes inválida; ``errors`` asocia campo → mensajes."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = {field: [message]}


@dataclass(frozen=True)
class SaleLineAmounts:
    total: Decimal
    base: Decimal
    tax: Decimal


@dataclass(frozen=True)
class SaleTotals:
    base: Decimal
    tax: Decimal
    total: Decimal


def _as_decimal(value: Any, field: str, label: str) -> Decimal:
    if isinstance(value, bool | float):
        raise AmountValidationError(field, f"{label} debe enviarse como texto decimal.")
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise AmountValidationError(field, f"{label} debe ser un número finito.")
        return value
    if not isinstance(value, str) or not _SIGNED_DECIMAL.match(value.strip() or "x"):
        raise AmountValidationError(field, f"{label} no es un decimal válido.")
    return Decimal(value.strip())


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


def parse_amount(value: Any, field: str, label: str) -> Decimal:
    """Importe en USD: no negativo, hasta dos decimales, sin redondear ni truncar."""
    number = _as_decimal(value, field, label)
    if number < 0:
        raise AmountValidationError(field, f"{label} no puede ser negativo.")
    exponent = number.normalize().as_tuple().exponent
    if isinstance(exponent, int) and exponent < -2:
        raise AmountValidationError(field, f"{label} admite hasta 2 decimales.")
    if number > MONEY_MAX:
        raise AmountValidationError(field, f"{label} excede el máximo permitido.")
    return number.quantize(CENTS)


def parse_price(value: Any) -> Decimal:
    """Precio final unitario: no negativo, hasta dos decimales, sin redondear."""
    return parse_amount(value, "unit_price", "El precio")


def _cents(value: Decimal) -> Decimal:
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def calculate_line(
    quantity: Decimal, unit_price: Decimal, tax_rate: Decimal | None
) -> SaleLineAmounts:
    """Total, base e impuesto de una línea, redondeados por línea.

    ``tax_rate`` ausente significa "sin vigencia": nunca se interpreta como exención.
    Una tarifa cero explícita es válida y produce impuesto 0.00.
    """
    if tax_rate is None or tax_rate < 0:
        raise AmountValidationError(
            "tax_rate", "La definición tributaria no tiene una tarifa vigente para la fecha."
        )
    with localcontext() as context:
        context.prec = PRECISION
        total = _cents(quantity * unit_price)
        if total > MONEY_MAX:
            raise AmountValidationError("total", "El total de la línea excede el máximo permitido.")
        base = _cents(total / (1 + tax_rate / 100))
        tax = total - base
    return SaleLineAmounts(total=total, base=base, tax=tax)


def calculate_document_totals(lines: Iterable[SaleLineAmounts]) -> SaleTotals:
    """Suma de líneas ya redondeadas; no vuelve a redondear el documento."""
    base = tax = total = Decimal("0.00")
    with localcontext() as context:
        context.prec = PRECISION
        for line in lines:
            base += line.base
            tax += line.tax
            total += line.total
    if total > MONEY_MAX:
        raise AmountValidationError("total", "El total del documento excede el máximo permitido.")
    return SaleTotals(base=base, tax=tax, total=total)
