"""Saldo, exceso y estado de pago derivados; nada de esto se almacena ni se edita.

E es el importe exigible vigente tras correcciones, P los pagos válidos netos de correcciones
y R los reembolsos efectivamente registrados. Aplicado neto = P - R.
"""

from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum
from typing import Any

ZERO = Decimal("0.00")


class ChargeRejectedError(ValueError):
    """Cobro incompatible con el saldo, la condición o los medios permitidos."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = {field: [message]}


class PaymentCondition(StrEnum):
    """Condición de la venta; CRÉDITO no tiene vencimiento, cuotas ni intereses."""

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

    @property
    def is_settled_without_payment(self) -> bool:
        return self.exigible == 0 and self.applied == 0


def compute_balance(exigible: Decimal, paid: Decimal, refunded: Decimal) -> BalanceResult:
    applied = paid - refunded
    balance = max(exigible - applied, ZERO)
    excess = max(applied - exigible, ZERO)
    if balance == 0:
        state = PaymentState.PAID
    elif applied > 0:
        state = PaymentState.PARTIAL
    else:
        state = PaymentState.PENDING
    return BalanceResult(exigible, applied, balance, excess, state)


def validate_charge(condition: PaymentCondition, balance: Decimal, amount: Decimal) -> None:
    """Un cobro es positivo, no supera el saldo y, en contado, lo liquida completo."""
    if amount <= 0:
        raise ChargeRejectedError("amount", "El importe del cobro debe ser mayor que cero.")
    if balance <= 0:
        raise ChargeRejectedError("amount", "La venta no tiene saldo pendiente por cobrar.")
    if amount > balance:
        raise ChargeRejectedError("amount", "El importe excede el saldo pendiente de la venta.")
    if condition is PaymentCondition.CONTADO and amount != balance:
        raise ChargeRejectedError("amount", "Una venta de contado exige cobrar el saldo completo.")
