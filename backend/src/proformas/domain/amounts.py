"""Composición de importes de una oferta sobre el núcleo monetario compartido.

No define fórmulas propias: total, base e impuesto por línea y la suma del documento provienen
de ``shared.money``. Una línea sin tarifa vigente queda sin importes; nunca se asume exención.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

from shared.money import (
    AmountValidationError,
    SaleLineAmounts,
    SaleTotals,
    calculate_document_totals,
    calculate_line,
)


@dataclass(frozen=True)
class OfferLine:
    position: int
    product_id: int
    quantity: Decimal
    unit_price: Decimal
    tax_rate: Decimal | None


@dataclass(frozen=True)
class OfferLineAmounts:
    line: OfferLine
    amounts: SaleLineAmounts | None
    error: str | None = None


@dataclass(frozen=True)
class Offer:
    lines: tuple[OfferLineAmounts, ...]
    totals: SaleTotals | None


def compose_offer(lines: Sequence[OfferLine]) -> Offer:
    """Importes por línea y totales; sin totales si falta alguna tarifa o no hay líneas."""
    computed: list[OfferLineAmounts] = []
    for line in lines:
        try:
            amounts = calculate_line(line.quantity, line.unit_price, line.tax_rate)
        except AmountValidationError as error:
            computed.append(OfferLineAmounts(line, None, next(iter(error.errors.values()))[0]))
            continue
        computed.append(OfferLineAmounts(line, amounts))
    totals: SaleTotals | None = None
    if computed and all(item.amounts is not None for item in computed):
        try:
            totals = calculate_document_totals([i.amounts for i in computed if i.amounts])
        except AmountValidationError:
            totals = None
    return Offer(tuple(computed), totals)
