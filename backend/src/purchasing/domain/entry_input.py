"""Validación pura de la solicitud de una entrada de stock.

No depende de Django, DRF ni persistencia. Los importes derivados, las fechas y los
impuestos nunca se aceptan: cualquier campo desconocido se rechaza.
"""

import hashlib
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from purchasing.domain.amounts import AmountValidationError, parse_quantity, parse_unit_cost

MAX_LINES = 200
REFERENCE_MAX = 128
OBSERVATION_MAX = 2000
ENTRY_FIELDS = frozenset(
    {
        "supplier_id",
        "reference",
        "observation",
        "lines",
        "acknowledged_entry_ids",
    }
)
CONTROL_FIELDS = frozenset({"idempotency_key"})
LINE_FIELDS = frozenset({"product_id", "quantity", "unit_cost"})


class EntryValidationError(ValueError):
    def __init__(self, errors: dict[str, list[str]], code: str = "validation_error") -> None:
        super().__init__("; ".join(m for msgs in errors.values() for m in msgs))
        self.errors = errors
        self.code = code


@dataclass(frozen=True)
class EntryLineInput:
    product_id: int
    quantity: Decimal
    unit_cost: Decimal | None


@dataclass(frozen=True)
class EntryInput:
    lines: tuple[EntryLineInput, ...]
    supplier_id: int | None
    reference: str
    observation: str
    acknowledged_entry_ids: tuple[int, ...]


def _identifier(value: Any, field: str, errors: dict[str, list[str]]) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        errors.setdefault(field, []).append("Debe ser un identificador válido.")
        return 0
    return int(value)


def _text(value: Any, field: str, errors: dict[str, list[str]], limit: int) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        errors.setdefault(field, []).append("Debe ser texto.")
        return ""
    stripped = value.strip()
    if len(stripped) > limit:
        errors.setdefault(field, []).append(f"No puede exceder {limit} caracteres.")
    return stripped


def _parse_line(raw: Any, index: int, errors: dict[str, list[str]]) -> EntryLineInput | None:
    prefix = f"lines.{index}"
    if not isinstance(raw, dict):
        errors.setdefault(prefix, []).append("La línea debe ser un objeto.")
        return None
    problems_before = len(errors)
    for name in sorted(set(raw) - LINE_FIELDS):
        errors.setdefault(f"{prefix}.{name}", []).append("Campo no admitido.")
    product_id = _identifier(raw.get("product_id"), f"{prefix}.product_id", errors)
    quantity = Decimal(0)
    try:
        quantity = parse_quantity(raw.get("quantity"))
    except AmountValidationError as error:
        errors.setdefault(f"{prefix}.quantity", []).append(next(iter(error.errors.values()))[0])
    cost: Decimal | None = None
    if raw.get("unit_cost") is not None:
        try:
            cost = parse_unit_cost(raw["unit_cost"])
        except AmountValidationError as error:
            errors.setdefault(f"{prefix}.unit_cost", []).append(
                next(iter(error.errors.values()))[0]
            )
    if len(errors) != problems_before:
        return None
    return EntryLineInput(product_id, quantity, cost)


def parse_entry(payload: dict[str, Any]) -> EntryInput:
    """Solicitud completa de una entrada; la revisión y el registro comparten este parser."""
    unknown = sorted(set(payload) - ENTRY_FIELDS - CONTROL_FIELDS)
    if unknown:
        raise EntryValidationError(
            {name: ["Campo no admitido."] for name in unknown}, code="unknown_field"
        )
    errors: dict[str, list[str]] = {}
    supplier_id: int | None = None
    if payload.get("supplier_id") is not None:
        supplier_id = _identifier(payload["supplier_id"], "supplier_id", errors)
    reference = _text(payload.get("reference"), "reference", errors, REFERENCE_MAX)
    observation = _text(payload.get("observation"), "observation", errors, OBSERVATION_MAX)

    acknowledged: list[int] = []
    raw_ack = payload.get("acknowledged_entry_ids", [])
    if not isinstance(raw_ack, list):
        errors.setdefault("acknowledged_entry_ids", []).append("Debe ser una lista de IDs.")
    else:
        acknowledged = [_identifier(item, "acknowledged_entry_ids", errors) for item in raw_ack]

    raw_lines = payload.get("lines")
    lines: list[EntryLineInput] = []
    if not isinstance(raw_lines, list) or not raw_lines:
        errors.setdefault("lines", []).append("Agregue al menos un producto.")
    elif len(raw_lines) > MAX_LINES:
        errors.setdefault("lines", []).append(f"Una entrada admite hasta {MAX_LINES} productos.")
    else:
        parsed = [_parse_line(item, index, errors) for index, item in enumerate(raw_lines)]
        seen: set[int] = set()
        for index, line in enumerate(parsed):
            if line is None:
                continue
            if line.product_id in seen:
                errors.setdefault(f"lines.{index}.product_id", []).append(
                    "El producto está repetido; ajuste su cantidad en una sola línea."
                )
            seen.add(line.product_id)
            lines.append(line)
    if errors:
        raise EntryValidationError(errors)
    return EntryInput(tuple(lines), supplier_id, reference, observation, tuple(acknowledged))


def content_signature(lines: tuple[EntryLineInput, ...]) -> str:
    """Huella de los pares producto y cantidad, independiente del orden y de los costos."""
    pairs = sorted((line.product_id, int(line.quantity)) for line in lines)
    canonical = ";".join(f"{product}:{quantity}" for product, quantity in pairs)
    return hashlib.sha256(canonical.encode("ascii")).hexdigest()
