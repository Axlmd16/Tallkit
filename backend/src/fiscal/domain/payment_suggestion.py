"""Sugerencia de formas de pago para el comprobante a partir de los cobros internos.

La sugerencia es editable y no registra ni modifica cobros. Los cobros vigentes se
traducen por medio a la forma habilitada asociada; lo no cubierto se asigna a la forma
predeterminada. Si lo cobrado excede el total (por ejemplo, con un reembolso pendiente)
se sugiere la forma predeterminada por el total, sin intentar repartir el exceso.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

CENTS = Decimal("0.01")


@dataclass(frozen=True)
class SuggestedForm:
    payment_code: str
    amount: str


@dataclass(frozen=True)
class PaymentSuggestion:
    forms: tuple[SuggestedForm, ...]
    origin: str


def _cents(value: Decimal) -> Decimal:
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def suggest_payment_forms(
    *,
    total: str,
    collected: Mapping[str, Decimal],
    enabled_forms: Mapping[str, str],
    default_code: str | None,
) -> PaymentSuggestion:
    target = _cents(Decimal(total))
    amounts: dict[str, Decimal] = {}
    covered = Decimal("0.00")
    for method in sorted(collected):
        code = enabled_forms.get(method)
        value = _cents(collected[method])
        if code is None or value <= 0:
            continue
        amounts[code] = amounts.get(code, Decimal("0.00")) + value
        covered += value

    if covered > target or not amounts:
        if default_code is None or target <= 0:
            return PaymentSuggestion((), "NONE")
        return PaymentSuggestion((SuggestedForm(default_code, str(target)),), "DEFAULT")

    remainder = target - covered
    origin = "COLLECTED"
    if remainder > 0:
        if default_code is None:
            return PaymentSuggestion((), "NONE")
        amounts[default_code] = amounts.get(default_code, Decimal("0.00")) + remainder
        origin = "MIXED"
    forms = tuple(SuggestedForm(code, str(amounts[code])) for code in sorted(amounts))
    return PaymentSuggestion(forms, origin)
