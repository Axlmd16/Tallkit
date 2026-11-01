"""Receptor fiscal declarado: valida formato por tipo, sin verificar existencia.

No aplica un dígito verificador universal ni afirma comprobación oficial del
identificador. El cliente operativo de origen se conserva por separado; estos
validadores puros nunca leen ni modifican la ficha maestra ni el snapshot comercial.
"""

import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, NoReturn

# Tipos de identificación del receptor admitidos en esta entrega (códigos SRI).
RUC_TYPE = "04"
CEDULA_TYPE = "05"
PASSPORT_TYPE = "06"
CONSUMER_FINAL_TYPE = "07"
FOREIGN_TYPE = "08"
IDENTIFICATION_TYPES = frozenset(
    {RUC_TYPE, CEDULA_TYPE, PASSPORT_TYPE, CONSUMER_FINAL_TYPE, FOREIGN_TYPE}
)

# Identificación e importe máximo oficiales del consumidor final.
CONSUMER_FINAL_IDENTIFICATION = "9999999999999"
CONSUMER_FINAL_MAX_TOTAL = Decimal("50")

_ALLOWED_FIELDS = frozenset(
    {"identification_type", "identification", "legal_name", "address", "email"}
)
_RUC_RE = re.compile(r"^[0-9]{13}$")
_CEDULA_RE = re.compile(r"^[0-9]{10}$")
_ALPHANUMERIC_RE = re.compile(r"^[A-Za-z0-9-]{1,20}$")
# Correo conservador: sin espacios, con una arroba y un dominio con punto.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class FiscalReceiverError(Exception):
    """Error de validación del receptor con mensajes por campo."""

    def __init__(self, message: str, *, errors: dict[str, list[str]] | None = None) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = errors or {}


def _reject(field: str, message: str) -> NoReturn:
    raise FiscalReceiverError(message, errors={field: [message]})


def _text(payload: dict[str, Any], field: str, *, required: bool) -> str | None:
    value = payload.get(field)
    if value is None:
        if required:
            _reject(field, "Este dato es obligatorio.")
        return None
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= 300:
        _reject(field, "Ingrese texto de entre 1 y 300 caracteres.")
    return value.strip()


@dataclass(frozen=True)
class FiscalReceiver:
    identification_type: str
    identification: str
    legal_name: str
    address: str | None = None
    email: str | None = None

    @property
    def is_consumer_final(self) -> bool:
        return self.identification_type == CONSUMER_FINAL_TYPE

    @property
    def requires_email(self) -> bool:
        """El comprobante se envía al correo del comprador; consumidor final no lo informa.

        Solo se exige al completar la preparación (DP-035, regla 1): guardar un borrador sin
        correo sigue siendo válido.
        """
        return not self.is_consumer_final


def _validate_identification(identification_type: str, identification: str) -> None:
    if identification_type == CONSUMER_FINAL_TYPE:
        if identification != CONSUMER_FINAL_IDENTIFICATION:
            _reject(
                "identification",
                "Consumidor final debe usar la identificación oficial 9999999999999.",
            )
        return
    if identification_type == RUC_TYPE:
        if _RUC_RE.fullmatch(identification) is None:
            _reject("identification", "El RUC debe tener 13 dígitos ASCII.")
        return
    if identification_type == CEDULA_TYPE:
        if _CEDULA_RE.fullmatch(identification) is None:
            _reject("identification", "La cédula debe tener 10 dígitos ASCII.")
        return
    # Pasaporte e identificación del exterior conservan su forma alfanumérica.
    if _ALPHANUMERIC_RE.fullmatch(identification) is None:
        _reject("identification", "El documento debe ser alfanumérico de hasta 20 caracteres.")


def parse_receiver(payload: Any) -> FiscalReceiver:
    if not isinstance(payload, dict):
        _reject("receiver", "Se requiere un objeto con los datos del receptor.")
    if payload.keys() - _ALLOWED_FIELDS:
        _reject("receiver", "Contiene campos no admitidos para el receptor fiscal.")

    identification_type = payload.get("identification_type")
    if identification_type not in IDENTIFICATION_TYPES:
        _reject("identification_type", "Tipo de identificación no soportado en esta entrega.")

    identification = payload.get("identification")
    if not isinstance(identification, str) or not identification:
        _reject("identification", "Ingrese la identificación del receptor.")
    _validate_identification(identification_type, identification)

    legal_name = _text(payload, "legal_name", required=True)
    assert legal_name is not None  # _text ya rechazó si faltaba
    address = _text(payload, "address", required=False)

    email = payload.get("email")
    if email is not None:
        if not isinstance(email, str) or _EMAIL_RE.fullmatch(email.strip()) is None:
            _reject("email", "Ingrese un correo electrónico válido.")
        email = email.strip()

    return FiscalReceiver(
        identification_type=identification_type,
        identification=identification,
        legal_name=legal_name,
        address=address,
        email=email,
    )


def check_consumer_final_total(total: Decimal) -> None:
    """Rechaza consumidor final cuando el total supera el límite oficial."""
    if total > CONSUMER_FINAL_MAX_TOTAL:
        _reject(
            "identification_type",
            "Consumidor final no admite un total superior a USD 50; identifique al receptor.",
        )
