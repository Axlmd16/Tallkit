"""Entrada de un borrador de venta: cliente, condición, notas y líneas producto/cantidad.

No recibe precio, descuento, impuesto, total, costo, saldo ni fecha fiscal: el servidor los
obtiene del catálogo y de la configuración. No depende de Django ni de DRF.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from sales.domain.amounts import QUANTITY_MAX, AmountValidationError, parse_quantity
from sales.domain.balances import PaymentCondition

DRAFT_FIELDS = frozenset({"customer_id", "condition", "notes", "lines", "entity_type"})
LINE_FIELDS = frozenset({"product_id", "quantity"})
MAX_LINES = 200
NOTES_MAX = 2000


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
    customer_id: int
    condition: PaymentCondition
    notes: str
    lines: tuple[LineInput, ...]


def _is_id(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 1


def parse_draft(payload: dict[str, Any]) -> DraftInput:
    errors: dict[str, list[str]] = {}
    code = "validation_error"
    unknown = sorted(set(payload) - DRAFT_FIELDS - {"idempotency_key", "expected_version"})
    if unknown:
        raise DraftValidationError(
            "unknown_field", {name: ["Campo no admitido."] for name in unknown}
        )
    entity_type = payload.get("entity_type", "COMERCIAL")
    if entity_type != "COMERCIAL":
        raise DraftValidationError(
            "validation_error",
            {"entity_type": ["Una venta de repuestos pertenece solo al RUC comercial."]},
        )

    customer_id = payload.get("customer_id")
    if not _is_id(customer_id):
        errors["customer_id"] = ["Seleccione un cliente registrado."]
    condition_raw = payload.get("condition")
    condition: PaymentCondition | None = None
    if isinstance(condition_raw, str) and condition_raw in PaymentCondition._value2member_map_:
        condition = PaymentCondition(condition_raw)
    else:
        errors["condition"] = ["La condición debe ser CONTADO o CREDITO."]
    notes = payload.get("notes", "")
    if not isinstance(notes, str) or len(notes.strip()) > NOTES_MAX:
        errors["notes"] = [f"Las notas admiten hasta {NOTES_MAX} caracteres."]
        notes = ""

    raw_lines = payload.get("lines", [])
    lines: list[LineInput] = []
    if not isinstance(raw_lines, list):
        errors["lines"] = ["Las líneas deben enviarse como lista."]
        raw_lines = []
    if len(raw_lines) > MAX_LINES:
        errors["lines"] = [f"Una venta admite hasta {MAX_LINES} líneas."]
        raw_lines = []
    totals: dict[int, Decimal] = {}
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
        if not isinstance(product_id, int) or not _is_id(product_id):
            errors[f"{prefix}.product_id"] = ["Seleccione un producto."]
            continue
        try:
            quantity = parse_quantity(raw.get("quantity"))
        except AmountValidationError as error:
            errors[f"{prefix}.quantity"] = error.errors["quantity"]
            continue
        totals[product_id] = totals.get(product_id, Decimal(0)) + quantity
        if totals[product_id] > QUANTITY_MAX:
            errors[f"{prefix}.quantity"] = ["La cantidad acumulada excede el máximo permitido."]
            continue
        lines.append(LineInput(product_id, quantity))
    if errors:
        raise DraftValidationError(code, errors)
    assert isinstance(customer_id, int)
    assert condition is not None
    return DraftInput(customer_id, condition, notes.strip(), tuple(lines))
