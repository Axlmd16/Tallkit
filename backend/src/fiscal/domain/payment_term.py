"""Plazo del comprobante: dato de la factura a crédito, sin efecto en la cobranza.

La ficha técnica 2.34 pide ``plazo`` y ``unidadTiempo`` «cuando corresponda» y no define
cuándo (``NOR-019``, validación ``V-6``). Por decisión del titular (DP-035, regla 2) se pide
solo al preparar una operación a crédito con saldo pendiente. No crea vencimiento, cuotas,
mora ni alertas: nada de este módulo se comunica con ventas, taller o cobros.
"""

from collections.abc import Mapping, Sequence
from decimal import Decimal
from typing import Any, NoReturn

from fiscal.domain.payment_declaration import CREDITO, DeclaredPaymentForm

TERM_MIN = 1
TERM_MAX = 9999
# La unidad la fija el sistema: los ejemplos de la ficha solo usan días.
TERM_UNIT = "dias"
_ZERO = Decimal("0")


class PaymentTermError(Exception):
    """Plazo inválido; ``errors`` asocia campo → mensajes."""

    def __init__(self, message: str, *, errors: dict[str, list[str]] | None = None) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = errors or {}


def _reject(message: str) -> NoReturn:
    raise PaymentTermError(message, errors={"term_days": [message]})


def term_required(condition: str, pending_balance: str | Decimal) -> bool:
    """Solo una operación a crédito con saldo pendiente mayor que cero declara plazo."""
    return condition == CREDITO and Decimal(str(pending_balance)) > _ZERO


def parse_term_days(value: Any) -> int:
    """Número entero de días; no convierte textos, decimales ni booleanos."""
    if isinstance(value, bool) or not isinstance(value, int):
        _reject("El plazo debe ser un número entero de días.")
    days: int = value
    if not TERM_MIN <= days <= TERM_MAX:
        _reject(f"El plazo debe estar entre {TERM_MIN} y {TERM_MAX} días.")
    return days


def forms_with_term(
    forms: Sequence[DeclaredPaymentForm], collected_by_code: Mapping[str, str | Decimal]
) -> tuple[int, ...]:
    """Posiciones de las formas cuyo importe supera lo ya cobrado con esa forma.

    Con saldo pendiente las formas suman el total y lo cobrado es menor, así que al menos una
    forma siempre supera su cobro. Las formas cubiertas por completo no llevan plazo.
    """
    return tuple(
        index
        for index, form in enumerate(forms)
        if Decimal(form.amount) > Decimal(str(collected_by_code.get(form.payment_code, _ZERO)))
    )
