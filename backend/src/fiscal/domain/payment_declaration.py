"""Formas de pago declaradas para el comprobante fiscal.

La declaración es independiente de los cobros efectivos internos: describe cómo se
pagará el comprobante y SHALL cubrir exactamente su total con una o varias formas
habilitadas para la entidad. Contado y crédito son condiciones internas; ninguna se
traduce a un código de la Tabla 24. En esta fase no se captura plazo ni unidad de
tiempo: se rechazan si llegan y la condición de crédito no bloquea la preparación.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, localcontext
from typing import Any, NoReturn

CONTADO = "CONTADO"
CREDITO = "CREDITO"
CONDITIONS = frozenset({CONTADO, CREDITO})

CENTS = Decimal("0.01")
PRECISION = 60
_ALLOWED_FORM_FIELDS = frozenset({"payment_code", "amount"})
_TERM_FIELDS = frozenset({"term_days", "time_unit"})


class PaymentDeclarationError(Exception):
    """Declaración de pagos inválida; ``errors`` asocia campo → mensajes."""

    def __init__(self, message: str, *, errors: dict[str, list[str]] | None = None) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = errors or {}


def _reject(field: str, message: str) -> NoReturn:
    raise PaymentDeclarationError(message, errors={field: [message]})


@dataclass(frozen=True)
class DeclaredPaymentForm:
    payment_code: str
    amount: str


@dataclass(frozen=True)
class PaymentDeclaration:
    forms: tuple[DeclaredPaymentForm, ...]


def _amount(value: Any, field: str) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, str):
        _reject(field, "El importe debe enviarse como texto decimal.")
    try:
        number = Decimal(value)
    except (ArithmeticError, ValueError):
        _reject(field, "El importe no es un decimal válido.")
    if not number.is_finite() or number <= 0:
        _reject(field, "El importe declarado debe ser mayor que cero.")
    return number.quantize(CENTS, rounding=ROUND_HALF_UP)


def validate_payment_declaration(
    *, condition: str, forms: list[dict[str, Any]], total: str, enabled_codes: Iterable[str]
) -> PaymentDeclaration:
    if condition not in CONDITIONS:
        _reject("condition", "La condición debe ser CONTADO o CREDITO.")
    if not isinstance(forms, list) or not forms:
        _reject("forms", "Declare al menos una forma de pago para el comprobante.")
    enabled = frozenset(enabled_codes)
    target = Decimal(total).quantize(CENTS, rounding=ROUND_HALF_UP)
    normalized: list[DeclaredPaymentForm] = []
    declared = Decimal("0.00")
    with localcontext() as context:
        context.prec = PRECISION
        for index, form in enumerate(forms, start=1):
            if not isinstance(form, dict):
                _reject(f"forms[{index}]", "Forma de pago con formato no admitido.")
            if form.keys() & _TERM_FIELDS:
                _reject(
                    f"forms[{index}].term_days",
                    "El plazo se indica una sola vez para toda la factura, no por forma de pago.",
                )
            if form.keys() - _ALLOWED_FORM_FIELDS:
                _reject(f"forms[{index}]", "Forma de pago con campos no admitidos.")
            code = form.get("payment_code")
            if code not in enabled:
                _reject(
                    f"forms[{index}].payment_code",
                    "Forma de pago no habilitada para esta entidad; crédito es una condición, "
                    "no una forma de pago.",
                )
            amount = _amount(form.get("amount"), f"forms[{index}].amount")
            declared += amount
            normalized.append(DeclaredPaymentForm(payment_code=code, amount=str(amount)))
        if declared.quantize(CENTS) != target:
            difference = (target - declared).quantize(CENTS)
            _reject(
                "amount",
                f"Las formas de pago suman USD {declared} y el comprobante USD {target}; "
                f"diferencia USD {difference}.",
            )
    return PaymentDeclaration(forms=tuple(normalized))
