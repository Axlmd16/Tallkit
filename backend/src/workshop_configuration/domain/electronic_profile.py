"""Condiciones declaradas: no verifica registros ni material de firma."""

from dataclasses import dataclass
from datetime import date
from typing import Any, NoReturn

from workshop_configuration.domain.validation import ConfigurationValidationError


def _reject(field: str, message: str) -> NoReturn:
    raise ConfigurationValidationError(message, errors={field: [message]})


def _fields(payload: Any, allowed: frozenset[str]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        _reject("profile", "Se requiere un objeto de datos declarados.")
    if payload.keys() - allowed:
        _reject("profile", "Contiene campos no admitidos; no envíe material privado de firma.")
    return payload


def _text(payload: dict[str, Any], field: str) -> str:
    value = payload.get(field)
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= 500:
        _reject(field, "Ingrese texto de entre 1 y 500 caracteres.")
    return value.strip()


def _date(payload: dict[str, Any], field: str) -> date:
    value = payload.get(field)
    if not isinstance(value, str) or len(value) != 10:
        _reject(field, "Ingrese una fecha válida AAAA-MM-DD.")
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        _reject(field, "Ingrese una fecha válida AAAA-MM-DD.")
    if parsed.isoformat() != value:
        _reject(field, "Ingrese una fecha válida AAAA-MM-DD.")
    return parsed


@dataclass(frozen=True)
class DeclaredCondition:
    status: str
    value: str | None = None
    source: str | None = None
    starts_on: date | None = None
    ends_on: date | None = None

    @property
    def is_resolved(self) -> bool:
        return self.status != "UNKNOWN"


def parse_condition(payload: Any) -> DeclaredCondition:
    data = _fields(payload, frozenset({"status", "value", "source", "starts_on", "ends_on"}))
    status = data.get("status")
    if status not in ("UNKNOWN", "APPLICABLE", "NOT_APPLICABLE"):
        _reject("status", "Seleccione desconocido, aplicable o no aplicable.")
    if status == "UNKNOWN":
        if any(v is not None for k, v in data.items() if k != "status"):
            _reject("status", "Una condición desconocida no puede declarar valores ni vigencia.")
        return DeclaredCondition(status)
    source = _text(data, "source")
    start = _date(data, "starts_on")
    end = _date(data, "ends_on") if data.get("ends_on") is not None else None
    if end is not None and end < start:
        _reject("ends_on", "El fin de vigencia no puede preceder al inicio.")
    value = _text(data, "value") if status == "APPLICABLE" else None
    if status == "NOT_APPLICABLE" and data.get("value") is not None:
        _reject("value", "Una condición no aplicable no admite un valor.")
    return DeclaredCondition(status, value, source, start, end)


@dataclass(frozen=True)
class DeclaredCertificate:
    holder: str
    issuer: str
    reference: str
    source: str
    starts_on: date
    ends_on: date

    def status_on(self, day: date) -> str:
        if day < self.starts_on:
            return "FUTURE"
        if day > self.ends_on:
            return "EXPIRED"
        return "DECLARED_CURRENT"


def parse_certificate_metadata(payload: Any) -> DeclaredCertificate:
    data = _fields(
        payload,
        frozenset(
            {
                "holder",
                "issuer",
                "reference",
                "source",
                "starts_on",
                "ends_on",
            }
        ),
    )
    holder, issuer = _text(data, "holder"), _text(data, "issuer")
    reference, source = _text(data, "reference"), _text(data, "source")
    start, end = _date(data, "starts_on"), _date(data, "ends_on")
    if end <= start:
        _reject("ends_on", "El fin de vigencia debe ser posterior al inicio.")
    return DeclaredCertificate(holder, issuer, reference, source, start, end)
