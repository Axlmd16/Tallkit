"""Cálculo de importes de compra a partir de la revisión o el bloqueo de vigencias.

Una definición sin vigencia, ambigua o de otro ámbito produce importes no calculables:
nunca se muestra cero como tarifa ni total inventado.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from purchasing.domain.amounts import (
    DocumentTotals,
    InventoryTaxTreatment,
    LineAmounts,
    calculate_document_totals,
    calculate_line,
)
from purchasing.domain.draft_input import LineInput


class TaxLike(Protocol):
    @property
    def status(self) -> str: ...
    @property
    def rate(self) -> Decimal | None: ...


@dataclass(frozen=True)
class TaxBasis:
    """Tarifa efectiva de una definición para la fecha documental."""

    definition_id: int
    status: str  # applicable | missing | ambiguous | invalid_scope | absent
    rate: Decimal | None


@dataclass(frozen=True)
class LineComputation:
    tax_status: str
    rate: Decimal | None
    amounts: LineAmounts | None


def compute_line(
    quantity: Decimal,
    unit_cost: Decimal,
    treatment: InventoryTaxTreatment,
    basis: TaxBasis | None,
) -> LineComputation:
    if basis is None or basis.status != "applicable" or basis.rate is None:
        return LineComputation(basis.status if basis else "absent", None, None)
    return LineComputation(
        "applicable", basis.rate, calculate_line(quantity, unit_cost, basis.rate, treatment)
    )


def compute_lines(
    lines: Sequence[LineInput], bases: Mapping[int, TaxBasis]
) -> list[LineComputation]:
    return [
        compute_line(
            line.quantity, line.unit_cost, line.treatment, bases.get(line.tax_definition_id)
        )
        for line in lines
    ]


def document_totals(computations: Sequence[LineComputation]) -> DocumentTotals | None:
    """``None`` cuando alguna línea no es calculable: no se inventan totales parciales."""
    amounts = [c.amounts for c in computations]
    if any(a is None for a in amounts):
        return None
    return calculate_document_totals(a for a in amounts if a is not None)
