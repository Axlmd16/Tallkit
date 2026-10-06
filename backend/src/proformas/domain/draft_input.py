"""Entrada de un borrador de proforma: cliente opcional, vigencia y líneas producto/cantidad.

No recibe precio, descuento, impuesto, total, condición de venta ni servicios: el servidor
obtiene los valores del catálogo y de la configuración. No depende de Django ni de DRF.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from shared.money import QUANTITY_MAX, AmountValidationError, _as_decimal

DRAFT_FIELDS = frozenset({"customer_id", "valid_until", "lines", "entity_type"})
LINE_FIELDS = frozenset({"product_id", "quantity"})
MAX_LINES = 200


class DraftValidationError(ValueError):
    def __init__(self, code: str, errors: dict[str, list[str]]) -> None:
        super().__init__("La solicitud contiene datos inválidos.")
        self.code = code
        self.errors = errors


@dataclass(frozen=True)
class LineInput:
    product_id: int
    quantity: Decimal


@dataclass(frozen=True)
class DraftInput:
    # ``None``: cotización sin cliente registrado.
    customer_id: int | None
    valid_until: date | None
    lines: tuple[LineInput, ...]


def parse_quantity(value: Any) -> Decimal:
    """Cantidad entera positiva de presentaciones completas; rechaza sin truncar."""
    number = _as_decimal(value, "quantity", "La cantidad")
    if number != number.to_integral_value():
        raise AmountValidationError("quantity", "La cantidad debe ser un número entero.")
    if number <= 0:
        raise AmountValidationError("quantity", "La cantidad debe ser mayor que cero.")
    if number > QUANTITY_MAX:
        raise AmountValidationError("quantity", "La cantidad excede el máximo permitido.")
    return Decimal(int(number))


def is_id(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 1


def parse_valid_until(value: Any) -> date | None:
    """Fecha de calendario ISO, o ``None`` para la vigencia predeterminada."""
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    raise DraftValidationError(
        "validation_error", {"valid_until": ["Indique una fecha válida (AAAA-MM-DD)."]}
    )


def parse_draft(payload: dict[str, Any]) -> DraftInput:
    unknown = sorted(set(payload) - DRAFT_FIELDS - {"idempotency_key", "expected_version"})
    if unknown:
        raise DraftValidationError(
            "unknown_field", {name: ["Campo no admitido."] for name in unknown}
        )
    if payload.get("entity_type", "COMERCIAL") != "COMERCIAL":
        raise DraftValidationError(
            "validation_error",
            {"entity_type": ["Una proforma pertenece solo al RUC comercial."]},
        )
    errors: dict[str, list[str]] = {}
    code = "validation_error"
    customer_id = payload.get("customer_id")
    if customer_id is not None and not is_id(customer_id):
        errors["customer_id"] = ["Seleccione un cliente registrado o deje la proforma sin cliente."]
    valid_until: date | None = None
    try:
        valid_until = parse_valid_until(payload.get("valid_until"))
    except DraftValidationError as error:
        errors.update(error.errors)

    raw_lines = payload.get("lines", [])
    if not isinstance(raw_lines, list):
        errors["lines"] = ["Las líneas deben enviarse como lista."]
        raw_lines = []
    if len(raw_lines) > MAX_LINES:
        errors["lines"] = [f"Una proforma admite hasta {MAX_LINES} líneas."]
        raw_lines = []
    lines: list[LineInput] = []
    for index, raw in enumerate(raw_lines):
        prefix = f"lines.{index}"
        if not isinstance(raw, dict):
            errors[prefix] = ["La línea debe ser un objeto."]
            continue
        extra = sorted(set(raw) - LINE_FIELDS)
        if extra:
            code = "unknown_field"
            for name in extra:
                errors[f"{prefix}.{name}"] = ["Campo no admitido."]
            continue
        product_id = raw.get("product_id")
        if not isinstance(product_id, int) or not is_id(product_id):
            errors[f"{prefix}.product_id"] = ["Seleccione un producto."]
            continue
        try:
            quantity = parse_quantity(raw.get("quantity"))
        except AmountValidationError as error:
            errors[f"{prefix}.quantity"] = error.errors["quantity"]
            continue
        lines.append(LineInput(product_id, quantity))
    if errors:
        raise DraftValidationError(code, errors)
    assert customer_id is None or isinstance(customer_id, int)
    return DraftInput(customer_id, valid_until, tuple(lines))
