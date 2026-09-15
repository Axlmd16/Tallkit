import re
from datetime import date
from decimal import Decimal
from enum import StrEnum
from typing import Any

MAX_SEQUENCE_VALUE = 9_223_372_036_854_775_807


class ConfigurationValidationError(ValueError):
    def __init__(self, message: str, errors: dict[str, list[str]] | None = None) -> None:
        super().__init__(message)
        self.errors = errors or {}


class FiscalEntityType(StrEnum):
    COMERCIAL = "COMERCIAL"
    ARTESANAL = "ARTESANAL"


class DocumentType(StrEnum):
    INGRESO = "INGRESO"
    PROFORMA = "PROFORMA"
    VENTA = "VENTA"
    SERVICIO = "SERVICIO"


def parse_fiscal_entity_type(value: Any) -> FiscalEntityType:
    if isinstance(value, FiscalEntityType):
        return value
    if isinstance(value, str):
        try:
            return FiscalEntityType(value.strip().upper())
        except ValueError:
            pass
    raise ConfigurationValidationError(
        "El tipo de entidad fiscal no es válido.",
        errors={"entity_type": ["Use COMERCIAL o ARTESANAL."]},
    )


def parse_document_type(value: Any) -> DocumentType:
    if isinstance(value, DocumentType):
        return value
    if isinstance(value, str):
        try:
            return DocumentType(value.strip().upper())
        except ValueError:
            pass
    raise ConfigurationValidationError(
        "El tipo de documento interno no es válido.",
        errors={
            "document_type": ["Use INGRESO, PROFORMA, VENTA o SERVICIO."],
        },
    )


def validate_ruc(value: Any) -> str:
    if isinstance(value, str):
        normalized = value.strip()
        if re.fullmatch(r"[0-9]{13}", normalized, flags=re.ASCII):
            return normalized
    raise ConfigurationValidationError(
        "El RUC debe contener exactamente 13 dígitos.",
        errors={"ruc": ["Ingrese exactamente 13 dígitos ASCII."]},
    )


def validate_legal_name(value: Any) -> str:
    if isinstance(value, str):
        normalized = value.strip()
        if 1 <= len(normalized) <= 200:
            return normalized
    raise ConfigurationValidationError(
        "La razón social debe contener entre 1 y 200 caracteres.",
        errors={"legal_name": ["Ingrese entre 1 y 200 caracteres."]},
    )


def validate_tax_rate(value: Any) -> Decimal:
    if not isinstance(value, str):
        raise ConfigurationValidationError(
            "La tarifa debe enviarse como texto decimal.",
            errors={"rate": ["Envíe una cadena decimal con hasta cuatro decimales."]},
        )
    normalized = value.strip()
    if re.fullmatch(r"(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{1,4})?", normalized) is None:
        raise ConfigurationValidationError(
            "La tarifa decimal no tiene una representación válida.",
            errors={"rate": ["Use punto decimal y hasta cuatro decimales."]},
        )
    rate = Decimal(normalized)
    if rate > Decimal(100):
        raise ConfigurationValidationError(
            "La tarifa debe estar entre 0 y 100.",
            errors={"rate": ["Ingrese una tarifa entre 0 y 100."]},
        )
    return rate


def validate_tax_interval(start: Any, end: Any) -> tuple[date, date | None]:
    if type(start) is not date or (end is not None and type(end) is not date):
        raise ConfigurationValidationError(
            "El período tributario requiere fechas válidas.",
            errors={"period": ["Use fechas de negocio válidas."]},
        )
    if end is not None and end < start:
        raise ConfigurationValidationError(
            "La fecha final no puede preceder a la inicial.",
            errors={"period": ["La fecha final debe ser igual o posterior a la inicial."]},
        )
    return start, end


def validate_tax_code(value: Any) -> str:
    if isinstance(value, str):
        normalized = value.strip().upper()
        if re.fullmatch(r"[A-Z][A-Z0-9_-]{0,19}", normalized, flags=re.ASCII):
            return normalized
    raise ConfigurationValidationError(
        "El código de impuesto no es válido.",
        errors={"code": ["Use de 1 a 20 letras, dígitos, guiones o guiones bajos."]},
    )


def validate_series_code(value: Any) -> str:
    if isinstance(value, str):
        normalized = value.strip().upper()
        if re.fullmatch(r"[A-Z][A-Z0-9-]{2,19}", normalized, flags=re.ASCII):
            return normalized
    raise ConfigurationValidationError(
        "El código de serie no es válido.",
        errors={"series_code": ["Use de 3 a 20 letras, dígitos o guiones."]},
    )


def format_internal_number(series_code: Any, sequence: Any) -> str:
    normalized_series = validate_series_code(series_code)
    if (
        not isinstance(sequence, int)
        or isinstance(sequence, bool)
        or not 1 <= sequence <= MAX_SEQUENCE_VALUE
    ):
        raise ConfigurationValidationError(
            "El secuencial debe ser un entero positivo representable.",
            errors={"sequence": [f"Use un entero entre 1 y {MAX_SEQUENCE_VALUE}."]},
        )
    return f"{normalized_series}-{sequence:06d}"
