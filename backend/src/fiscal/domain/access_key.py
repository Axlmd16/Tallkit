"""Clave de acceso SRI de 49 dígitos y fecha fiscal de referencia (dominio puro).

Una clave bien formada no implica autorización: solo comprueba coherencia de
componentes y dígito verificador módulo 11. La fecha fiscal se determina en
``America/Guayaquil`` con independencia de la zona del servidor, y sus componentes
(código numérico, fecha) se conservan sin regenerarse en un reintento.
"""

import re
from datetime import date, datetime
from zoneinfo import ZoneInfo

FACTURA = "01"
NOTA_CREDITO = "04"
SUPPORTED_DOCUMENT_TYPES = frozenset({FACTURA, NOTA_CREDITO})
ENVIRONMENT_TEST = "1"
ENVIRONMENT_PRODUCTION = "2"
SUPPORTED_ENVIRONMENTS = frozenset({ENVIRONMENT_TEST, ENVIRONMENT_PRODUCTION})
EMISSION_NORMAL = "1"

SEQUENTIAL_MIN = 1
SEQUENTIAL_MAX = 999_999_999
GUAYAQUIL = ZoneInfo("America/Guayaquil")

_RUC_RE = re.compile(r"^[0-9]{13}$")
_CODE3_RE = re.compile(r"^[0-9]{3}$")
_SEQ_RE = re.compile(r"^[0-9]{9}$")
_NUMERIC_CODE_RE = re.compile(r"^[0-9]{8}$")
_VERIFICATION_WEIGHTS = (2, 3, 4, 5, 6, 7)


class AccessKeyError(Exception):
    pass


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise AccessKeyError(message)


def local_reference_date(instant: datetime) -> date:
    """Fecha en America/Guayaquil del instante dado, sin usar la fecha UTC directamente."""
    if instant.tzinfo is None:
        raise AccessKeyError("El instante debe incluir zona horaria.")
    return instant.astimezone(GUAYAQUIL).date()


def emission_date_component(day: date) -> str:
    """Componente ddmmaaaa de la clave de acceso."""
    return day.strftime("%d%m%Y")


def format_sequential(value: int) -> str:
    if isinstance(value, bool) or not isinstance(value, int):
        raise AccessKeyError("El secuencial debe ser un entero.")
    if not SEQUENTIAL_MIN <= value <= SEQUENTIAL_MAX:
        raise AccessKeyError("El secuencial debe estar entre 1 y 999999999.")
    return f"{value:09d}"


def verification_digit(base: str) -> str:
    """Dígito verificador módulo 11 según las reglas del SRI."""
    if not base.isdigit():
        raise AccessKeyError("La base de la clave debe ser numérica.")
    total = 0
    for index, char in enumerate(reversed(base)):
        total += int(char) * _VERIFICATION_WEIGHTS[index % len(_VERIFICATION_WEIGHTS)]
    remainder = total % 11
    digit = 11 - remainder
    if digit == 11:
        return "0"
    if digit == 10:
        return "1"
    return str(digit)


def build_access_key(
    *,
    emission_date: date,
    doc_type: str,
    ruc: str,
    environment: str,
    establishment: str,
    emission_point: str,
    sequential: str,
    numeric_code: str,
    emission_type: str = EMISSION_NORMAL,
) -> str:
    _require(isinstance(emission_date, date), "La fecha de emisión es obligatoria.")
    _require(doc_type in SUPPORTED_DOCUMENT_TYPES, "Tipo de comprobante no soportado.")
    _require(bool(_RUC_RE.fullmatch(ruc)), "El RUC debe tener 13 dígitos.")
    _require(environment in SUPPORTED_ENVIRONMENTS, "Ambiente inválido.")
    _require(bool(_CODE3_RE.fullmatch(establishment)), "El establecimiento debe tener 3 dígitos.")
    _require(bool(_CODE3_RE.fullmatch(emission_point)), "El punto debe tener 3 dígitos.")
    _require(bool(_SEQ_RE.fullmatch(sequential)), "El secuencial debe tener 9 dígitos.")
    _require(
        SEQUENTIAL_MIN <= int(sequential) <= SEQUENTIAL_MAX,
        "El secuencial debe estar entre 1 y 999999999.",
    )
    _require(
        bool(_NUMERIC_CODE_RE.fullmatch(numeric_code)), "El código numérico debe tener 8 dígitos."
    )
    _require(emission_type == EMISSION_NORMAL, "Tipo de emisión no soportado.")

    base = (
        emission_date_component(emission_date)
        + doc_type
        + ruc
        + environment
        + establishment
        + emission_point
        + sequential
        + numeric_code
        + emission_type
    )
    if len(base) != 48:
        raise AccessKeyError("La base de la clave debe tener 48 dígitos.")
    return base + verification_digit(base)


def validate_access_key(key: str) -> bool:
    if not isinstance(key, str) or len(key) != 49 or not key.isdigit():
        return False
    return verification_digit(key[:48]) == key[48]
