"""Importes y costos históricos de devoluciones parciales.

Todo se calcula sobre los valores confirmados de la venta original, nunca con el catálogo, las
tarifas ni el promedio actuales.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, localcontext

from sales.domain.allocation import VALUE_SCALE, proportional_value
from sales.domain.amounts import CENTS, PRECISION, AmountValidationError


class ReturnValidationError(ValueError):
    """Devolución que excede lo vendido o los importes originales."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = {field: [message]}


@dataclass(frozen=True)
class ReturnAmounts:
    total: Decimal
    base: Decimal
    tax: Decimal


@dataclass(frozen=True)
class ReturnCostAllocation:
    """Valor histórico asignado a los tramos devueltos; el apto se publica, el no apto no."""

    fit_value: Decimal
    unfit_value: Decimal


def _cumulative_base(original_base: Decimal, sold: Decimal, returned: Decimal) -> Decimal:
    with localcontext() as context:
        context.prec = PRECISION
        return (original_base * returned / sold).quantize(CENTS, rounding=ROUND_HALF_UP)


def calculate_return_amounts(
    unit_price: Decimal,
    original_base: Decimal,
    sold_quantity: Decimal,
    previously_returned: Decimal,
    quantity: Decimal,
) -> ReturnAmounts:
    """Total por precio histórico; base por diferencia de la base acumulada; impuesto por resta."""
    if sold_quantity <= 0 or quantity <= 0 or previously_returned < 0:
        raise AmountValidationError("quantity", "Las cantidades de la devolución no son válidas.")
    total = (unit_price * quantity).quantize(CENTS, rounding=ROUND_HALF_UP)
    base = _cumulative_base(
        original_base, sold_quantity, previously_returned + quantity
    ) - _cumulative_base(original_base, sold_quantity, previously_returned)
    return ReturnAmounts(total=total, base=base, tax=total - base)


def allocate_return_cost(
    original_value: Decimal,
    sold_quantity: Decimal,
    previously_returned: Decimal,
    fit_quantity: Decimal,
    unfit_quantity: Decimal,
) -> ReturnCostAllocation:
    """Asigna a cada tramo su proporción acumulada del valor histórico, apto antes que no apto."""
    if sold_quantity <= 0 or previously_returned < 0 or fit_quantity < 0 or unfit_quantity < 0:
        raise AmountValidationError("quantity", "Las cantidades de la devolución no son válidas.")

    def cumulative(quantity: Decimal) -> Decimal:
        if quantity == sold_quantity:
            return original_value.quantize(VALUE_SCALE)
        return proportional_value(original_value, quantity, sold_quantity)

    before = cumulative(previously_returned)
    after_fit = cumulative(previously_returned + fit_quantity)
    after_all = cumulative(previously_returned + fit_quantity + unfit_quantity)
    return ReturnCostAllocation(fit_value=after_fit - before, unfit_value=after_all - after_fit)


def ensure_return_quantity(sold: Decimal, previously_returned: Decimal, requested: Decimal) -> None:
    if requested <= 0:
        raise ReturnValidationError("quantity", "La cantidad devuelta debe ser mayor que cero.")
    if previously_returned + requested > sold:
        raise ReturnValidationError(
            "quantity", "La cantidad acumulada devuelta excede la cantidad vendida."
        )


def ensure_cumulative_amounts(
    original_total: Decimal,
    original_base: Decimal,
    returned_total: Decimal,
    returned_base: Decimal,
) -> None:
    if returned_total > original_total or returned_base > original_base:
        raise ReturnValidationError(
            "amount", "Los importes acumulados devueltos exceden los originales de la venta."
        )


def receivable_after_returns(original_total: Decimal, returned_total: Decimal) -> Decimal:
    receivable = original_total - returned_total
    if receivable < 0:
        raise ReturnValidationError("amount", "El exigible resultante no puede ser negativo.")
    return receivable
