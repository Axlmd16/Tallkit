"""Reglas puras de las retenciones recibidas, compartidas por los dos RUC.

No depende de Django, DRF ni persistencia. El sistema registra el valor que el
cliente retuvo: no calcula ni valida porcentajes legales de retención.
"""

import re
from decimal import Decimal
from typing import Any

from shared.money import AmountValidationError, parse_amount

_VOUCHER_RE = re.compile(r"^[0-9]{3}-[0-9]{3}-[0-9]{9}$")
_HUNDRED = Decimal("100")


class WithholdingValidationError(ValueError):
    """Dato de retención inválido; ``errors`` asocia campo → mensajes."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = {field: [message]}


def parse_voucher_number(value: Any) -> str:
    """Número del comprobante de retención con forma ``NNN-NNN-NNNNNNNNN``."""
    if not isinstance(value, str) or _VOUCHER_RE.fullmatch(value.strip()) is None:
        raise WithholdingValidationError(
            "voucher_number",
            "El número del comprobante debe tener el formato 001-001-000000001.",
        )
    return value.strip()


def _part(value: Any, field: str, label: str) -> Decimal:
    try:
        return parse_amount(value, field, label)
    except AmountValidationError as error:
        raise WithholdingValidationError(field, str(error)) from None


def validate_breakdown(
    amount: Decimal, income_tax: Any, vat: Any
) -> tuple[Decimal, Decimal] | None:
    """Desglose opcional renta/IVA: ambos o ninguno, y su suma es el importe retenido."""
    if income_tax is None and vat is None:
        return None
    if income_tax is None or vat is None:
        raise WithholdingValidationError(
            "breakdown", "Indique tanto el valor de renta como el de IVA, o ninguno."
        )
    income = _part(income_tax, "income_tax_amount", "La retención de renta")
    vat_amount = _part(vat, "vat_amount", "La retención de IVA")
    if income + vat_amount != amount:
        raise WithholdingValidationError(
            "breakdown",
            f"Renta e IVA suman {income + vat_amount:.2f} y la retención es de {amount:.2f}.",
        )
    return income, vat_amount


def warning_threshold(exigible: Decimal, percentage: Decimal) -> Decimal:
    """Importe a partir del cual la retención acumulada resulta inusual; sin redondear."""
    return exigible * percentage / _HUNDRED


def exceeds_warning(
    exigible: Decimal, already_withheld: Decimal, amount: Decimal, percentage: Decimal | None
) -> bool:
    if percentage is None:
        return False
    return already_withheld + amount > warning_threshold(exigible, percentage)
