"""Reglas monetarias puras compartidas por operaciones comerciales y artesanales.

No depende de Django, DRF ni persistencia. Todo cálculo usa ``Decimal`` con un
contexto local de precisión 60, sin apoyarse en el contexto global del proceso.
Los precios son valores finales con impuesto incluido (DP-017).
"""

import re
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, localcontext
from enum import StrEnum
from typing import Any

QUANTITY_MAX = Decimal("999999999999")
MONEY_MAX = Decimal("9999999999999999999999.99")  # Decimal(24, 2)
CENTS = Decimal("0.01")
PRECISION = 60
ZERO = Decimal("0.00")

_SIGNED_DECIMAL = re.compile(r"^-?\d+(\.\d+)?$")


class AmountValidationError(ValueError):
    """Entrada de importes inválida; ``errors`` asocia campo → mensajes."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = {field: [message]}


@dataclass(frozen=True)
class SaleLineAmounts:
    total: Decimal
    base: Decimal
    tax: Decimal


@dataclass(frozen=True)
class SaleTotals:
    base: Decimal
    tax: Decimal
    total: Decimal


def _as_decimal(value: Any, field: str, label: str) -> Decimal:
    if isinstance(value, bool | float):
        raise AmountValidationError(field, f"{label} debe enviarse como texto decimal.")
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise AmountValidationError(field, f"{label} debe ser un número finito.")
        return value
    if not isinstance(value, str) or not _SIGNED_DECIMAL.match(value.strip() or "x"):
        raise AmountValidationError(field, f"{label} no es un decimal válido.")
    return Decimal(value.strip())


def parse_amount(value: Any, field: str, label: str) -> Decimal:
    """Importe en USD: no negativo, hasta dos decimales, sin redondear ni truncar."""
    number = _as_decimal(value, field, label)
    if number < 0:
        raise AmountValidationError(field, f"{label} no puede ser negativo.")
    exponent = number.normalize().as_tuple().exponent
    if isinstance(exponent, int) and exponent < -2:
        raise AmountValidationError(field, f"{label} admite hasta 2 decimales.")
    if number > MONEY_MAX:
        raise AmountValidationError(field, f"{label} excede el máximo permitido.")
    return number.quantize(CENTS)


def _cents(value: Decimal) -> Decimal:
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def calculate_line(
    quantity: Decimal, unit_price: Decimal, tax_rate: Decimal | None
) -> SaleLineAmounts:
    """Total, base e impuesto de una línea, redondeados por línea."""
    if tax_rate is None or tax_rate < 0:
        raise AmountValidationError(
            "tax_rate", "La definición tributaria no tiene una tarifa vigente para la fecha."
        )
    with localcontext() as context:
        context.prec = PRECISION
        total = _cents(quantity * unit_price)
        if total > MONEY_MAX:
            raise AmountValidationError("total", "El total de la línea excede el máximo permitido.")
        base = _cents(total / (1 + tax_rate / 100))
        tax = total - base
    return SaleLineAmounts(total=total, base=base, tax=tax)


def calculate_document_totals(lines: Iterable[SaleLineAmounts]) -> SaleTotals:
    """Suma de líneas ya redondeadas; no vuelve a redondear el documento."""
    base = tax = total = Decimal("0.00")
    with localcontext() as context:
        context.prec = PRECISION
        for line in lines:
            base += line.base
            tax += line.tax
            total += line.total
    if total > MONEY_MAX:
        raise AmountValidationError("total", "El total del documento excede el máximo permitido.")
    return SaleTotals(base=base, tax=tax, total=total)


class ChargeRejectedError(ValueError):
    """Cobro incompatible con el saldo, la condición o los medios permitidos."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = {field: [message]}


class PaymentCondition(StrEnum):
    """Condición de la operación; CRÉDITO no tiene vencimiento, cuotas ni intereses."""

    CONTADO = "CONTADO"
    CREDITO = "CREDITO"


class PaymentMethod(StrEnum):
    """Medios reales de pago; CRÉDITO es una condición, nunca un medio (DP-003)."""

    EFECTIVO = "EFECTIVO"
    TRANSFERENCIA = "TRANSFERENCIA"

    @classmethod
    def parse(cls, value: Any) -> "PaymentMethod":
        if isinstance(value, str) and value in cls._value2member_map_:
            return cls(value)
        raise ChargeRejectedError("method", "El medio de pago debe ser EFECTIVO o TRANSFERENCIA.")


class PaymentState(StrEnum):
    PENDING = "PENDING"
    PARTIAL = "PARTIAL"
    PAID = "PAID"


@dataclass(frozen=True)
class BalanceResult:
    exigible: Decimal
    applied: Decimal
    balance: Decimal
    excess: Decimal
    state: PaymentState
    # Retenciones recibidas vigentes: reducen el saldo, pero nunca son dinero cobrado.
    withheld: Decimal = ZERO
    withheld_excess: Decimal = ZERO

    @property
    def is_settled_without_payment(self) -> bool:
        return self.exigible == 0 and self.applied == 0


def compute_balance(
    exigible: Decimal, paid: Decimal, refunded: Decimal, withheld: Decimal = ZERO
) -> BalanceResult:
    """Saldo con dinero neto y retenciones; solo el dinero cobrado es reembolsable."""
    money = paid - refunded
    applied = money + withheld
    balance = max(exigible - applied, ZERO)
    total_excess = max(applied - exigible, ZERO)
    excess = min(total_excess, max(money, ZERO))
    if balance == 0:
        state = PaymentState.PAID
    elif applied > 0:
        state = PaymentState.PARTIAL
    else:
        state = PaymentState.PENDING
    return BalanceResult(exigible, applied, balance, excess, state, withheld, total_excess - excess)


def validate_settlement(
    condition: PaymentCondition, balance: Decimal, money: Decimal, withheld: Decimal
) -> None:
    """Dinero y retención de una misma acción contra el saldo y la condición."""
    if money < 0:
        raise ChargeRejectedError("amount", "El importe del cobro no puede ser negativo.")
    if withheld < 0:
        raise ChargeRejectedError("withholding", "La retención no puede ser negativa.")
    total = money + withheld
    if total <= 0:
        raise ChargeRejectedError("amount", "El importe del cobro debe ser mayor que cero.")
    if balance <= 0:
        raise ChargeRejectedError("amount", "La venta no tiene saldo pendiente por cobrar.")
    if withheld > balance:
        raise ChargeRejectedError("withholding", "La retención excede el saldo pendiente.")
    if total > balance:
        raise ChargeRejectedError("amount", "El importe excede el saldo pendiente de la venta.")
    if condition is PaymentCondition.CONTADO and total != balance:
        raise ChargeRejectedError("amount", "Una venta de contado exige cobrar el saldo completo.")


def validate_charge(condition: PaymentCondition, balance: Decimal, amount: Decimal) -> None:
    """Un cobro es positivo, no supera el saldo y, en contado, lo liquida completo."""
    if amount <= 0:
        raise ChargeRejectedError("amount", "El importe del cobro debe ser mayor que cero.")
    validate_settlement(condition, balance, amount, ZERO)
