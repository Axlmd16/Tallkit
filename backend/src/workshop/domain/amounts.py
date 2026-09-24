"""Importes del taller en USD: precios aplicados de hasta dos decimales y cantidades enteras.

Los valores se construyen como ``Decimal`` desde texto, nunca se redondean para aceptarlos y
el subtotal es exacto porque la cantidad es entera y el precio tiene dos decimales.
"""

from collections.abc import Iterable
from decimal import Decimal, InvalidOperation

CENT = Decimal("0.01")
MAX_PRICE = Decimal("999999999999.99")
MAX_QUANTITY = 9999


class AmountError(ValueError):
    pass


def parse_price(value: object) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, str | int | float):
        raise AmountError("Ingrese un importe en USD.")
    text = str(value).strip()
    if not text or any(ch in text.lower() for ch in ("e", "n", "i")):
        raise AmountError("Ingrese un importe en USD.")
    try:
        amount = Decimal(text)
    except InvalidOperation:
        raise AmountError("Ingrese un importe en USD.") from None
    if not amount.is_finite():
        raise AmountError("Ingrese un importe en USD.")
    if amount < 0:
        raise AmountError("El precio aplicado no puede ser negativo.")
    exponent = amount.as_tuple().exponent
    if isinstance(exponent, int) and exponent < -2:
        raise AmountError("Use como máximo dos decimales.")
    if amount > MAX_PRICE:
        raise AmountError("El importe supera el máximo permitido.")
    return amount.quantize(CENT)


def parse_quantity(value: object) -> int:
    if isinstance(value, bool):
        raise AmountError("La cantidad debe ser un entero positivo.")
    if isinstance(value, str) and value.strip().isdigit():
        value = int(value.strip())
    if not isinstance(value, int):
        raise AmountError("La cantidad debe ser un entero positivo.")
    if not 1 <= value <= MAX_QUANTITY:
        raise AmountError(f"La cantidad debe estar entre 1 y {MAX_QUANTITY}.")
    return value


def line_subtotal(quantity: int, applied_price: Decimal) -> Decimal:
    return (applied_price * quantity).quantize(CENT)


def services_total(lines: Iterable[tuple[int, Decimal]]) -> Decimal:
    total = Decimal("0.00")
    for quantity, price in lines:
        total += line_subtotal(quantity, price)
    return total.quantize(CENT)
