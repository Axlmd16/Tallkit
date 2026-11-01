"""Parseo estricto de solicitudes del taller: campos conocidos, errores por campo, sin efectos."""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

from workshop.domain.amounts import AmountError, parse_price, parse_quantity
from workshop.domain.odometer import OdometerError, parse_odometer

TEXT_MAX = 5000
REASON_MAX = 1000
DESCRIPTION_MAX = 200
DETAIL_MAX = 300
CONTROL = frozenset({"idempotency_key", "expected_version"})


class InputError(ValueError):
    def __init__(self, code: str, errors: dict[str, list[str]]) -> None:
        super().__init__("La solicitud contiene datos inválidos.")
        self.code = code
        self.errors = errors


def _reject_unknown(payload: dict[str, Any], allowed: frozenset[str]) -> None:
    unknown = sorted(set(payload) - allowed - CONTROL)
    if unknown:
        raise InputError("unknown_field", {name: ["Campo no admitido."] for name in unknown})


def _positive_id(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        return None
    return value


def _text(value: object, limit: int, errors: dict[str, list[str]], name: str) -> str | None:
    if value is None:
        return ""
    if not isinstance(value, str):
        errors[name] = ["Ingrese un texto."]
        return None
    text = value.strip()
    if len(text) > limit:
        errors[name] = [f"Use como máximo {limit} caracteres."]
        return None
    return text


def _version(payload: dict[str, Any], errors: dict[str, list[str]]) -> int:
    value = payload.get("expected_version")
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        errors["expected_version"] = ["La versión esperada es obligatoria."]
        return 0
    return value


def _opened_on(value: object, today: date, errors: dict[str, list[str]]) -> date | None:
    if not isinstance(value, str):
        errors["opened_on"] = ["Use AAAA-MM-DD."]
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        errors["opened_on"] = ["Use AAAA-MM-DD."]
        return None
    if parsed > today:
        errors["opened_on"] = ["La fecha de apertura no puede ser futura."]
        return None
    return parsed


def _odometer(value: object, errors: dict[str, list[str]]) -> int | None:
    try:
        return parse_odometer(value)
    except OdometerError as error:
        errors["odometer_km"] = [str(error)]
        return None


def _confirmed(value: object, errors: dict[str, list[str]]) -> bool:
    if value is None:
        return False
    if not isinstance(value, bool):
        errors["odometer_confirmed"] = ["Use verdadero o falso."]
        return False
    return value


@dataclass(frozen=True)
class CreateInput:
    customer_id: int
    vehicle_id: int
    opened_on: date
    odometer_km: int
    odometer_confirmed: bool
    diagnosis: str
    notes: str


GENERAL_FIELDS = frozenset(
    {"customer_id", "vehicle_id", "opened_on", "odometer_km", "diagnosis", "notes"}
)


def parse_create(payload: dict[str, Any], *, today: date) -> CreateInput:
    _reject_unknown(payload, GENERAL_FIELDS | {"odometer_confirmed"})
    errors: dict[str, list[str]] = {}
    customer_id = _positive_id(payload.get("customer_id"))
    if customer_id is None:
        errors["customer_id"] = ["Seleccione un cliente."]
    vehicle_id = _positive_id(payload.get("vehicle_id"))
    if vehicle_id is None:
        errors["vehicle_id"] = ["Seleccione un vehículo."]
    raw_date = payload.get("opened_on")
    opened_on = today if raw_date is None else _opened_on(raw_date, today, errors)
    if "odometer_km" not in payload:
        errors["odometer_km"] = ["Ingrese el kilometraje."]
        odometer = None
    else:
        odometer = _odometer(payload["odometer_km"], errors)
    confirmed = _confirmed(payload.get("odometer_confirmed"), errors)
    diagnosis = _text(payload.get("diagnosis"), TEXT_MAX, errors, "diagnosis")
    notes = _text(payload.get("notes"), TEXT_MAX, errors, "notes")
    if errors:
        raise InputError("validation_error", errors)
    if customer_id is None or vehicle_id is None or opened_on is None or odometer is None:
        raise InputError("validation_error", {"__all__": ["Solicitud incompleta."]})
    return CreateInput(
        customer_id, vehicle_id, opened_on, odometer, confirmed, diagnosis or "", notes or ""
    )


@dataclass(frozen=True)
class UpdateInput:
    expected_version: int
    fields: dict[str, Any] = field(default_factory=dict)
    odometer_confirmed: bool = False


def parse_update(payload: dict[str, Any], *, today: date) -> UpdateInput:
    _reject_unknown(payload, GENERAL_FIELDS | {"odometer_confirmed"})
    errors: dict[str, list[str]] = {}
    version = _version(payload, errors)
    fields: dict[str, Any] = {}
    for name in ("customer_id", "vehicle_id"):
        if name in payload:
            value = _positive_id(payload[name])
            if value is None:
                errors[name] = ["Seleccione un valor válido."]
            fields[name] = value
    if "opened_on" in payload:
        fields["opened_on"] = _opened_on(payload["opened_on"], today, errors)
    if "odometer_km" in payload:
        fields["odometer_km"] = _odometer(payload["odometer_km"], errors)
    for name in ("diagnosis", "notes"):
        if name in payload:
            fields[name] = _text(payload[name], TEXT_MAX, errors, name)
    confirmed = _confirmed(payload.get("odometer_confirmed"), errors)
    if errors:
        raise InputError("validation_error", errors)
    return UpdateInput(version, fields, confirmed)


@dataclass(frozen=True)
class InterventionInput:
    expected_version: int
    fields: dict[str, str]


def parse_intervention_update(payload: dict[str, Any]) -> InterventionInput:
    _reject_unknown(payload, frozenset({"work_performed", "notes"}))
    errors: dict[str, list[str]] = {}
    version = _version(payload, errors)
    fields: dict[str, str] = {}
    for name in ("work_performed", "notes"):
        if name in payload:
            value = _text(payload[name], TEXT_MAX, errors, name)
            if value is not None:
                fields[name] = value
    if errors:
        raise InputError("validation_error", errors)
    return InterventionInput(version, fields)


def _price(payload: dict[str, Any], errors: dict[str, list[str]]) -> Decimal | None:
    if payload.get("applied_price") is None:
        return None
    try:
        return parse_price(payload["applied_price"])
    except AmountError as error:
        errors["applied_price"] = [str(error)]
        return None


def _quantity(payload: dict[str, Any], errors: dict[str, list[str]]) -> int | None:
    if "quantity" not in payload:
        return None
    try:
        return parse_quantity(payload["quantity"])
    except AmountError as error:
        errors["quantity"] = [str(error)]
        return None


def _detail(payload: dict[str, Any], errors: dict[str, list[str]]) -> str | None:
    """Detalle de servicio: ausente no cambia, vacío lo quita; una línea, sin recortar."""
    if "detail" not in payload or payload["detail"] is None:
        return None
    value = payload["detail"]
    if not isinstance(value, str):
        errors["detail"] = ["Ingrese un texto."]
        return None
    text = value.strip()
    if "\n" in text or "\r" in text:
        errors["detail"] = ["El detalle admite una sola línea."]
        return None
    if len(text) > DETAIL_MAX:
        errors["detail"] = [f"El detalle admite hasta {DETAIL_MAX} caracteres; tiene {len(text)}."]
        return None
    return text


@dataclass(frozen=True)
class LineCreateInput:
    expected_version: int
    service_id: int
    quantity: int
    applied_price: Decimal | None
    detail: str | None = None


def parse_line_create(payload: dict[str, Any]) -> LineCreateInput:
    _reject_unknown(payload, frozenset({"service_id", "quantity", "applied_price", "detail"}))
    errors: dict[str, list[str]] = {}
    version = _version(payload, errors)
    service_id = _positive_id(payload.get("service_id"))
    if service_id is None:
        errors["service_id"] = ["Seleccione un servicio del catálogo."]
    quantity = _quantity(payload, errors)
    price = _price(payload, errors)
    detail = _detail(payload, errors)
    if errors:
        raise InputError("validation_error", errors)
    assert service_id is not None
    return LineCreateInput(version, service_id, quantity or 1, price, detail)


@dataclass(frozen=True)
class LineUpdateInput:
    expected_version: int
    quantity: int | None
    applied_price: Decimal | None
    detail: str | None = None


def parse_line_update(payload: dict[str, Any]) -> LineUpdateInput:
    _reject_unknown(payload, frozenset({"quantity", "applied_price", "detail"}))
    errors: dict[str, list[str]] = {}
    version = _version(payload, errors)
    quantity = _quantity(payload, errors)
    price = _price(payload, errors)
    detail = _detail(payload, errors)
    if errors:
        raise InputError("validation_error", errors)
    return LineUpdateInput(version, quantity, price, detail)


def parse_version_only(payload: dict[str, Any]) -> int:
    _reject_unknown(payload, frozenset())
    errors: dict[str, list[str]] = {}
    version = _version(payload, errors)
    if errors:
        raise InputError("validation_error", errors)
    return version


@dataclass(frozen=True)
class ReopenInput:
    expected_version: int
    reason: str


def parse_reopen(payload: dict[str, Any]) -> ReopenInput:
    _reject_unknown(payload, frozenset({"reason"}))
    errors: dict[str, list[str]] = {}
    version = _version(payload, errors)
    reason = _text(payload.get("reason"), REASON_MAX, errors, "reason")
    if reason == "" and "reason" not in errors:
        errors["reason"] = ["Indique la causa atribuible al trabajo anterior."]
    if errors:
        raise InputError("validation_error", errors)
    assert reason is not None
    return ReopenInput(version, reason)


def parse_photo_description(value: object) -> str:
    errors: dict[str, list[str]] = {}
    text = _text(value, DESCRIPTION_MAX, errors, "description")
    if errors or text is None:
        raise InputError("validation_error", errors or {"description": ["Texto inválido."]})
    return text
