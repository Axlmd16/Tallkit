"""Cálculo de importes de una venta a partir de precios del catálogo y tarifas vigentes."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal

from catalog.application.sales_references import SaleProductReference
from sales.domain.amounts import (
    AmountValidationError,
    SaleLineAmounts,
    SaleTotals,
    calculate_document_totals,
    calculate_line,
)


@dataclass(frozen=True)
class LineSource:
    """Línea de entrada: identifica posición, producto y cantidad enteras."""

    position: int
    product_id: int
    quantity: Decimal


@dataclass(frozen=True)
class LineComputation:
    position: int
    product_id: int
    quantity: Decimal
    unit_price: Decimal | None
    tax_definition_id: int | None
    tax_rate: Decimal | None
    amounts: SaleLineAmounts | None
    error: str | None = None


def compute_lines(
    lines: Sequence[LineSource],
    products: Mapping[int, SaleProductReference],
    rates: Mapping[int, Decimal | None],
) -> list[LineComputation]:
    """Importes por línea; una línea sin producto o sin tarifa vigente queda sin importes."""
    result: list[LineComputation] = []
    for line in lines:
        product = products.get(line.product_id)
        if product is None:
            result.append(
                LineComputation(
                    line.position,
                    line.product_id,
                    line.quantity,
                    None,
                    None,
                    None,
                    None,
                    "El producto no existe.",
                )
            )
            continue
        rate = rates.get(product.tax_definition_id)
        try:
            amounts = calculate_line(line.quantity, product.sale_price, rate)
            error = None
        except AmountValidationError as exc:
            amounts = None
            error = next(iter(exc.errors.values()))[0]
        result.append(
            LineComputation(
                line.position,
                line.product_id,
                line.quantity,
                product.sale_price,
                product.tax_definition_id,
                rate,
                amounts,
                error,
            )
        )
    return result


def document_totals(computations: Sequence[LineComputation]) -> SaleTotals | None:
    """Totales del documento; ``None`` si alguna línea no pudo calcularse o no hay líneas."""
    if not computations or any(c.amounts is None for c in computations):
        return None
    try:
        return calculate_document_totals([c.amounts for c in computations if c.amounts])
    except AmountValidationError:
        return None
