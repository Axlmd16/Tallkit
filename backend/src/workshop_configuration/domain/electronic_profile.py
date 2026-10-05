"""Condiciones declaradas: no verifica registros ni material de firma."""

import re
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
    issuing_body: str | None = None

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


# --- Formato 2: valores cerrados representables en el esquema de factura 2.1.0 del SRI ---

TAX_REGIME = "tax_regime"
ACCOUNTING_OBLIGATION = "accounting_obligation"
WITHHOLDING_AGENT = "withholding_agent"
SPECIAL_TAXPAYER = "special_taxpayer"
ARTISAN_QUALIFICATION = "artisan_qualification"
CONDITION_KEYS = (
    TAX_REGIME,
    ACCOUNTING_OBLIGATION,
    WITHHOLDING_AGENT,
    SPECIAL_TAXPAYER,
    ARTISAN_QUALIFICATION,
)
# Siempre tienen un valor: «no aplica» no es una respuesta posible.
_ALWAYS_APPLY = frozenset({TAX_REGIME, ACCOUNTING_OBLIGATION})

REGIME_GENERAL = "GENERAL"
REGIME_RIMPE_EMPRENDEDOR = "RIMPE_EMPRENDEDOR"
REGIME_RIMPE_NEGOCIO_POPULAR = "RIMPE_NEGOCIO_POPULAR"
REGIME_LABELS = {
    REGIME_GENERAL: "General",
    REGIME_RIMPE_EMPRENDEDOR: "RIMPE Emprendedor",
    REGIME_RIMPE_NEGOCIO_POPULAR: "RIMPE Negocio Popular",
}
# Elemento `contribuyenteRimpe` del XSD de factura 2.1.0: su único valor admitido.
RIMPE_LEGEND = "CONTRIBUYENTE RÉGIMEN RIMPE"
ACCOUNTING_VALUES = ("SI", "NO")
ACCOUNTING_LABELS = {"SI": "Sí", "NO": "No"}

# `agenteRetencion`: hasta 8 dígitos; `contribuyenteEspecial`: alfanumérico de hasta 13.
_WITHHOLDING_RE = re.compile(r"[0-9]{1,8}")
_SPECIAL_TAXPAYER_RE = re.compile(r"[A-Za-z0-9]{1,13}")
QUALIFICATION_NUMBER_MAX = 50
ISSUING_BODY_MAX = 200

# La advertencia previa al vencimiento de la calificación es fija (decisión D4).
QUALIFICATION_WARNING_DAYS = 60

_FORMAT2_FIELDS = frozenset({"status", "value", "source", "starts_on", "ends_on", "issuing_body"})


def regime_legend(regime: str | None) -> str | None:
    """Leyenda oficial derivada del régimen; nunca se escribe ni se declara aparte."""
    return RIMPE_LEGEND if regime == REGIME_RIMPE_EMPRENDEDOR else None


def closed_options() -> dict[str, list[dict[str, str]]]:
    """Opciones de las condiciones de valor cerrado, para que la interfaz no las duplique."""
    return {
        TAX_REGIME: [{"value": v, "label": label} for v, label in REGIME_LABELS.items()],
        ACCOUNTING_OBLIGATION: [
            {"value": v, "label": label} for v, label in ACCOUNTING_LABELS.items()
        ],
    }


def qualification_days_left(condition: DeclaredCondition, on: date) -> int | None:
    """Días hasta el vencimiento si cae en la ventana de advertencia; si no, ninguno."""
    if condition.status != "APPLICABLE" or condition.ends_on is None:
        return None
    days = (condition.ends_on - on).days
    return days if 0 <= days <= QUALIFICATION_WARNING_DAYS else None


def _bounded_text(data: dict[str, Any], field: str, maximum: int, label: str) -> str:
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        _reject(field, f"{label} es obligatorio.")
    text = value.strip()
    if len(text) > maximum or "\n" in text or "\r" in text:
        _reject(field, f"{label} admite hasta {maximum} caracteres en una sola línea.")
    return text


def _closed_value(key: str, raw: Any) -> str:
    if key == TAX_REGIME:
        if raw not in REGIME_LABELS:
            _reject("value", "Seleccione General, RIMPE Emprendedor o RIMPE Negocio Popular.")
        return str(raw)
    if key == ACCOUNTING_OBLIGATION:
        if raw not in ACCOUNTING_VALUES:
            _reject("value", "Seleccione Sí o No.")
        return str(raw)
    if key == WITHHOLDING_AGENT:
        if not isinstance(raw, str) or _WITHHOLDING_RE.fullmatch(raw) is None:
            _reject("value", "El número de resolución admite de 1 a 8 dígitos.")
        return raw
    if key == SPECIAL_TAXPAYER:
        if not isinstance(raw, str) or _SPECIAL_TAXPAYER_RE.fullmatch(raw) is None:
            _reject("value", "El número de resolución admite de 1 a 13 letras o dígitos.")
        return raw
    return _bounded_text({"value": raw}, "value", QUALIFICATION_NUMBER_MAX, "El número")


def parse_closed_condition(key: str, payload: Any) -> DeclaredCondition:
    """Una condición del formato 2; los mensajes de error usan el nombre del campo interno."""
    data = _fields(payload, _FORMAT2_FIELDS)
    status = data.get("status")
    if status not in ("UNKNOWN", "APPLICABLE", "NOT_APPLICABLE"):
        _reject("status", "Seleccione sin declarar, aplica o no aplica.")
    if status == "UNKNOWN":
        if any(v is not None for k, v in data.items() if k != "status"):
            _reject("status", "Una condición sin declarar no puede declarar valores ni vigencia.")
        return DeclaredCondition("UNKNOWN")
    if status == "NOT_APPLICABLE" and key in _ALWAYS_APPLY:
        _reject("status", "Esta condición siempre aplica; declare su valor.")
    if data.get("issuing_body") is not None and not (
        key == ARTISAN_QUALIFICATION and status == "APPLICABLE"
    ):
        _reject("issuing_body", "Solo la calificación artesanal vigente declara un organismo.")
    if status == "NOT_APPLICABLE" and data.get("value") is not None:
        _reject("value", "Una condición no aplicable no admite un valor.")

    source = _text(data, "source")
    start = _date(data, "starts_on")
    end_raw = data.get("ends_on")
    end = _date(data, "ends_on") if end_raw is not None else None
    if key == ARTISAN_QUALIFICATION and status == "APPLICABLE":
        if end is None:
            _reject("ends_on", "El vencimiento de la calificación es obligatorio.")
        if end <= start:
            _reject("ends_on", "El vencimiento debe ser posterior al inicio.")
    elif end is not None and end < start:
        _reject("ends_on", "El fin de vigencia no puede preceder al inicio.")

    if status == "NOT_APPLICABLE":
        return DeclaredCondition(status, None, source, start, end)
    value = _closed_value(key, data.get("value"))
    body = None
    if key == ARTISAN_QUALIFICATION:
        body = _bounded_text(data, "issuing_body", ISSUING_BODY_MAX, "El organismo")
    return DeclaredCondition(status, value, source, start, end, body)


def parse_profile_conditions(payload: Any) -> dict[str, DeclaredCondition]:
    """Perfil completo del formato 2; acumula los errores de todas las condiciones."""
    if not isinstance(payload, dict):
        _reject("conditions", "Se requiere un objeto de condiciones.")
    if payload.keys() - set(CONDITION_KEYS):
        _reject(
            "conditions",
            "Contiene condiciones no admitidas; RIMPE se declara en el régimen tributario.",
        )
    errors: dict[str, list[str]] = {}
    parsed: dict[str, DeclaredCondition] = {}
    for key in CONDITION_KEYS:
        try:
            parsed[key] = parse_closed_condition(key, payload.get(key, {"status": "UNKNOWN"}))
        except ConfigurationValidationError as error:
            for field, messages in error.errors.items():
                errors[f"{key}.{field}"] = messages
    if errors:
        raise ConfigurationValidationError("Hay condiciones tributarias inválidas.", errors=errors)
    return parsed


def condition_payload(condition: DeclaredCondition) -> dict[str, str]:
    """Representación JSON del formato 2: omite los campos que la condición no declara."""
    result = {"status": condition.status}
    for field in ("value", "source", "issuing_body"):
        value = getattr(condition, field)
        if value is not None:
            result[field] = value
    for field in ("starts_on", "ends_on"):
        value = getattr(condition, field)
        if value is not None:
            result[field] = value.isoformat()
    return result
