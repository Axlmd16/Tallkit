"""Reparto del valor de salida realmente aplicado entre líneas comerciales.

Inventario publica un movimiento agrupado por producto; cuando la venta repite el producto en
varias líneas, su valor se distribuye por cantidad y posición estable usando diferencias del
valor proporcional acumulado a seis decimales. La última línea absorbe el residuo.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, localcontext

from sales.domain.amounts import PRECISION, AmountValidationError

VALUE_SCALE = Decimal("0.000001")


@dataclass(frozen=True)
class AllocationLine:
    position: int
    quantity: Decimal


def proportional_value(value: Decimal, part: Decimal, whole: Decimal) -> Decimal:
    """Proporción ``value * part / whole`` a seis decimales HALF_UP."""
    with localcontext() as context:
        context.prec = PRECISION
        return (value * part / whole).quantize(VALUE_SCALE, rounding=ROUND_HALF_UP)


def allocate_output_value(lines: Iterable[AllocationLine], value: Decimal) -> dict[int, Decimal]:
    """Valor por posición; su suma iguala exactamente ``value``."""
    ordered = sorted(lines, key=lambda line: line.position)
    if not ordered:
        raise AmountValidationError("lines", "No hay líneas a las cuales asignar el costo.")
    if any(line.quantity <= 0 for line in ordered):
        raise AmountValidationError("quantity", "La cantidad de cada línea debe ser positiva.")
    total_quantity = sum((line.quantity for line in ordered), Decimal(0))
    result: dict[int, Decimal] = {}
    accumulated_quantity = Decimal(0)
    accumulated_value = Decimal("0.000000")
    for index, line in enumerate(ordered):
        accumulated_quantity += line.quantity
        if index == len(ordered) - 1:
            cumulative = value.quantize(VALUE_SCALE)
        else:
            cumulative = proportional_value(value, accumulated_quantity, total_quantity)
        result[line.position] = cumulative - accumulated_value
        accumulated_value = cumulative
    return result
