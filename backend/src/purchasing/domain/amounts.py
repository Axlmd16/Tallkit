"""Reglas puras de importes de compra.

No depende de Django, DRF ni persistencia. Todo cálculo usa ``Decimal`` con un contexto
local de precisión 60, sin apoyarse en el contexto global del proceso.
"""

import re
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, localcontext
from enum import StrEnum
from typing import Any

QUANTITY_MAX = Decimal("999999999999")
UNIT_COST_MAX = Decimal("999999999999.999999")
UNIT_COST_SCALE = 6
CENTS = Decimal("0.01")
PRECISION = 60

_PLAIN_DECIMAL = re.compile(r"^\d+(\.\d+)?$")
_SIGNED_DECIMAL = re.compile(r"^-?\d+(\.\d+)?$")


class AmountValidationError(ValueError):
    """Entrada de importes inválida; ``errors`` asocia campo → mensajes."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = {field: [message]}


class InventoryTaxTreatment(StrEnum):
    """Recuperabilidad del impuesto de una línea; no admite recuperación parcial."""

    RECOVERABLE = "RECOVERABLE"
    NON_RECOVERABLE = "NON_RECOVERABLE"

    @classmethod
    def parse(cls, value: Any) -> "InventoryTaxTreatment":
        if isinstance(value, str) and value in cls._value2member_map_:
            return cls(value)
        raise AmountValidationError(
            "tax_treatment", "Indique si el impuesto es RECOVERABLE o NON_RECOVERABLE."
        )


@dataclass(frozen=True)
class LineAmounts:
    base: Decimal
    tax: Decimal
    total: Decimal
    inventory_value: Decimal


@dataclass(frozen=True)
class DocumentTotals:
    base: Decimal
    tax: Decimal
    total: Decimal
    inventory_value: Decimal


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


def _cents(value: Decimal) -> Decimal:
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def calculate_line(
    quantity: Decimal,
    unit_cost: Decimal,
    tax_rate: Decimal | None,
    treatment: InventoryTaxTreatment,
) -> LineAmounts:
    """Base, impuesto, total y valor inventariable de una línea, redondeados por línea.

    ``tax_rate`` ausente significa "sin vigencia": nunca se interpreta como exención.
    Una tarifa cero explícita es válida y produce impuesto 0.00.
    """
    if tax_rate is None:
        raise AmountValidationError(
            "tax_rate", "La definición tributaria no tiene una tarifa vigente para la fecha."
        )
    with localcontext() as context:
        context.prec = PRECISION
        base = _cents(quantity * unit_cost)
        tax = _cents(base * tax_rate / 100)
        total = base + tax
        inventory_value = base + tax if treatment is InventoryTaxTreatment.NON_RECOVERABLE else base
    return LineAmounts(base=base, tax=tax, total=total, inventory_value=inventory_value)


def calculate_document_totals(lines: Iterable[LineAmounts]) -> DocumentTotals:
    """Suma de líneas ya redondeadas; no vuelve a redondear el documento."""
    base = tax = total = inventory_value = Decimal("0.00")
    with localcontext() as context:
        context.prec = PRECISION
        for line in lines:
            base += line.base
            tax += line.tax
            total += line.total
            inventory_value += line.inventory_value
    return DocumentTotals(base=base, tax=tax, total=total, inventory_value=inventory_value)
