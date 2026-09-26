"""Formas de pago declaradas para el comprobante fiscal.

La declaración es independiente de los cobros efectivos internos: describe cómo se
pagará el comprobante y SHALL cubrir su total. Efectivo corresponde al código SRI
``01`` y transferencia a ``20``; crédito es una condición, nunca un medio. Cuando el
caso exige plazo y unidad de tiempo y faltan, se señalan como pendientes sin
inventar vencimientos ni planes de deuda.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, localcontext
from typing import Any, NoReturn

EFECTIVO_CODE = "01"
TRANSFERENCIA_CODE = "20"
SUPPORTED_PAYMENT_CODES = frozenset({EFECTIVO_CODE, TRANSFERENCIA_CODE})

CONTADO = "CONTADO"
CREDITO = "CREDITO"
CONDITIONS = frozenset({CONTADO, CREDITO})

_TIME_UNITS = frozenset({"dias", "meses"})
CENTS = Decimal("0.01")
PRECISION = 60
_ALLOWED_FORM_FIELDS = frozenset({"payment_code", "amount", "term_days", "time_unit"})


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
    term_days: int | None = None
    time_unit: str | None = None


@dataclass(frozen=True)
class PaymentDeclaration:
    forms: tuple[DeclaredPaymentForm, ...]
    pending: tuple[str, ...]


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
    *, condition: str, forms: list[dict[str, Any]], total: str
) -> PaymentDeclaration:
    if condition not in CONDITIONS:
        _reject("condition", "La condición debe ser CONTADO o CREDITO.")
    if not isinstance(forms, list) or not forms:
        _reject("forms", "Declare al menos una forma de pago para el comprobante.")

    target = Decimal(total).quantize(CENTS, rounding=ROUND_HALF_UP)
    normalized: list[DeclaredPaymentForm] = []
    pending: list[str] = []
    declared = Decimal("0.00")

    with localcontext() as context:
        context.prec = PRECISION
        for index, form in enumerate(forms, start=1):
            if not isinstance(form, dict) or form.keys() - _ALLOWED_FORM_FIELDS:
                _reject(f"forms[{index}]", "Forma de pago con campos no admitidos.")
            code = form.get("payment_code")
            if code not in SUPPORTED_PAYMENT_CODES:
                _reject(
                    f"forms[{index}].payment_code",
                    "Medio de pago no soportado; crédito es una condición, no un medio.",
                )
            amount = _amount(form.get("amount"), f"forms[{index}].amount")
            declared += amount

            term_days = form.get("term_days")
            time_unit = form.get("time_unit")
            if condition == CONTADO:
                if term_days is not None or time_unit is not None:
                    _reject(
                        f"forms[{index}].term_days",
                        "Una operación de contado no admite plazo ni unidad de tiempo.",
                    )
            else:  # CREDITO
                if term_days is None or time_unit is None:
                    pending.append(f"forms[{index}].plazo_unidad")
                else:
                    if (
                        isinstance(term_days, bool)
                        or not isinstance(term_days, int)
                        or term_days <= 0
                    ):
                        _reject(
                            f"forms[{index}].term_days", "El plazo debe ser un entero positivo."
                        )
                    if (
                        not isinstance(time_unit, str)
                        or time_unit.strip().lower() not in _TIME_UNITS
                    ):
                        _reject(
                            f"forms[{index}].time_unit",
                            "La unidad de tiempo debe ser días o meses.",
                        )
                    time_unit = time_unit.strip().lower()

            normalized.append(
                DeclaredPaymentForm(
                    payment_code=code,
                    amount=str(amount),
                    term_days=term_days if condition == CREDITO else None,
                    time_unit=time_unit if condition == CREDITO else None,
                )
            )

        if declared.quantize(CENTS) != target:
            _reject(
                "amount",
                "El total declarado de formas de pago debe cubrir el total del comprobante.",
            )

    return PaymentDeclaration(forms=tuple(normalized), pending=tuple(pending))
