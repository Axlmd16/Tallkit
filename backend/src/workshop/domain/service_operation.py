"""Reglas puras de la operación artesanal: cálculo por línea y huella de revisión.

No depende de Django ni de persistencia. Los importes siguen la política inclusiva compartida
(`shared.money`): total = cantidad por precio aplicado, base HALF_UP a centavos e impuesto por
diferencia; el documento suma las líneas ya redondeadas.
"""

import hashlib
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from shared.money import (
    AmountValidationError,
    PaymentCondition,
    SaleLineAmounts,
    SaleTotals,
    calculate_document_totals,
    calculate_line,
)


class ConditionError(ValueError):
    pass


@dataclass(frozen=True)
class DocumentableLine:
    """Línea de servicio inicial pendiente de documentar, identificada por su propio id."""

    line_id: int
    service_id: int
    service_code: str
    service_name: str
    quantity: int
    reference_price: Decimal
    applied_price: Decimal
    tax_definition_id: int


@dataclass(frozen=True)
class RateInfo:
    rate: Decimal
    period_id: int


@dataclass(frozen=True)
class LineComputation:
    line: DocumentableLine
    rate: RateInfo | None
    amounts: SaleLineAmounts | None


def parse_condition(value: Any) -> PaymentCondition:
    if isinstance(value, str) and value in PaymentCondition._value2member_map_:
        return PaymentCondition(value)
    raise ConditionError("La condición debe ser CONTADO o CREDITO.")


def compute_lines(
    lines: Sequence[DocumentableLine], rates: Mapping[int, RateInfo | None]
) -> list[LineComputation]:
    """Importes por línea; una línea sin tarifa vigente queda sin importes (nunca exenta)."""
    result: list[LineComputation] = []
    for line in lines:
        rate = rates.get(line.tax_definition_id)
        amounts = None
        if rate is not None:
            try:
                amounts = calculate_line(Decimal(line.quantity), line.applied_price, rate.rate)
            except AmountValidationError:
                amounts = None
        result.append(LineComputation(line, rate, amounts))
    return result


def document_totals(computations: Sequence[LineComputation]) -> SaleTotals | None:
    if not computations or any(c.amounts is None for c in computations):
        return None
    return calculate_document_totals([c.amounts for c in computations if c.amounts])


def review_digest(
    *,
    order_id: int,
    customer_id: int,
    condition: PaymentCondition,
    on: date,
    computations: Sequence[LineComputation],
) -> str:
    """Huella de todo lo que el usuario revisó; cualquier cambio exige nueva revisión."""
    content = {
        "order": order_id,
        "customer": customer_id,
        "condition": condition.value,
        "date": on.isoformat(),
        "lines": [
            {
                "id": c.line.line_id,
                "service": c.line.service_id,
                "quantity": c.line.quantity,
                "reference_price": format(c.line.reference_price, "f"),
                "applied_price": format(c.line.applied_price, "f"),
                "tax_definition": c.line.tax_definition_id,
                "period": c.rate.period_id if c.rate else None,
                "rate": format(c.rate.rate, "f") if c.rate else None,
            }
            for c in computations
        ],
    }
    encoded = json.dumps(content, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()
