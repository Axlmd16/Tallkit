"""Validación pura de la entrada de un borrador de compra.

No depende de Django, DRF ni persistencia. Los importes derivados enviados por el cliente
nunca se aceptan: cualquier campo desconocido se rechaza.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from purchasing.domain.amounts import (
    AmountValidationError,
    InventoryTaxTreatment,
    parse_quantity,
    parse_unit_cost,
)
from purchasing.domain.identity import normalize_reference

MAX_LINES = 200
REFERENCE_MAX = 128
TEXT_MAX = 2000
DOCUMENT_TYPES = ("FACTURA", "NOTA_DE_VENTA", "OTRO", "SIN_DOCUMENTO")
DRAFT_FIELDS = frozenset(
    {
        "supplier_id",
        "document_type",
        "supplier_reference",
        "document_date",
        "notes",
        "no_document_reason",
        "lines",
    }
)
LINE_FIELDS = frozenset(
    {"product_id", "quantity", "unit_cost", "tax_definition_id", "tax_recoverability"}
)


class DraftValidationError(ValueError):
    def __init__(self, errors: dict[str, list[str]], code: str = "validation_error") -> None:
        super().__init__("; ".join(m for msgs in errors.values() for m in msgs))
        self.errors = errors
        self.code = code


@dataclass(frozen=True)
class LineInput:
    product_id: int
    quantity: Decimal
    unit_cost: Decimal
    tax_definition_id: int
    treatment: InventoryTaxTreatment


@dataclass(frozen=True)
class DraftInput:
    supplier_id: int
    document_type: str
    reference: str
    normalized_reference: str
    document_date: date
    notes: str
    no_document_reason: str
    lines: tuple[LineInput, ...]


def _integer(value: Any, field: str, errors: dict[str, list[str]]) -> int:
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


def parse_document_date(value: Any, today: date, errors: dict[str, list[str]]) -> date:
    if not isinstance(value, str):
        errors.setdefault("document_date", []).append("La fecha del documento es obligatoria.")
        return today
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        errors.setdefault("document_date", []).append("Use una fecha ISO válida (AAAA-MM-DD).")
        return today
    if parsed > today:
        errors.setdefault("document_date", []).append(
            "La fecha del documento no puede ser posterior a hoy."
        )
    return parsed


def parse_line(raw: Any, index: int, errors: dict[str, list[str]]) -> LineInput | None:
    prefix = f"lines.{index}"
    if not isinstance(raw, dict):
        errors.setdefault(prefix, []).append("La línea debe ser un objeto.")
        return None
    unknown = sorted(set(raw) - LINE_FIELDS)
    for name in unknown:
        errors.setdefault(f"{prefix}.{name}", []).append("Campo no admitido.")
    before = len(errors)
    product_id = _integer(raw.get("product_id"), f"{prefix}.product_id", errors)
    tax_id = _integer(raw.get("tax_definition_id"), f"{prefix}.tax_definition_id", errors)
    parsed: dict[str, Any] = {}
    for field, parser in (
        ("quantity", parse_quantity),
        ("unit_cost", parse_unit_cost),
        ("tax_recoverability", InventoryTaxTreatment.parse),
    ):
        try:
            parsed[field] = parser(raw.get(field))
        except AmountValidationError as error:
            message = next(iter(error.errors.values()))[0]
            errors.setdefault(f"{prefix}.{field}", []).append(message)
    if unknown or len(errors) != before:
        return None
    return LineInput(
        product_id, parsed["quantity"], parsed["unit_cost"], tax_id, parsed["tax_recoverability"]
    )


def parse_lines(raw: Any, errors: dict[str, list[str]]) -> tuple[LineInput, ...]:
    if raw is None:
        return ()
    if not isinstance(raw, list):
        errors.setdefault("lines", []).append("Las líneas deben ser una lista.")
        return ()
    if len(raw) > MAX_LINES:
        errors.setdefault("lines", []).append(f"Una compra admite hasta {MAX_LINES} líneas.")
        return ()
    parsed = [parse_line(item, index, errors) for index, item in enumerate(raw)]
    return tuple(line for line in parsed if line is not None)


def parse_draft(payload: dict[str, Any], *, today: date) -> DraftInput:
    """Entrada completa de creación; PATCH fusiona con el borrador antes de llamar aquí."""
    errors: dict[str, list[str]] = {}
    for name in sorted(set(payload) - DRAFT_FIELDS - {"idempotency_key", "expected_version"}):
        errors.setdefault(name, []).append("Campo no admitido.")
    if errors:
        raise DraftValidationError(errors, code="unknown_field")
    supplier_id = _integer(payload.get("supplier_id"), "supplier_id", errors)
    document_type = payload.get("document_type")
    if document_type not in DOCUMENT_TYPES:
        errors.setdefault("document_type", []).append(
            "Use FACTURA, NOTA_DE_VENTA, OTRO o SIN_DOCUMENTO."
        )
        document_type = "OTRO"
    reference = _text(
        payload.get("supplier_reference"), "supplier_reference", errors, REFERENCE_MAX
    )
    reason = _text(payload.get("no_document_reason"), "no_document_reason", errors, TEXT_MAX)
    notes = _text(payload.get("notes"), "notes", errors, TEXT_MAX)
    if document_type == "SIN_DOCUMENTO":
        if reference:
            errors.setdefault("supplier_reference", []).append(
                "Una compra sin documento no lleva referencia."
            )
        if not reason:
            errors.setdefault("no_document_reason", []).append(
                "Explique por qué la compra no tiene documento."
            )
    else:
        if not reference:
            errors.setdefault("supplier_reference", []).append(
                "La referencia del documento es obligatoria."
            )
        if reason:
            errors.setdefault("no_document_reason", []).append(
                "Solo una compra sin documento lleva explicación."
            )
    document_date = parse_document_date(payload.get("document_date"), today, errors)
    lines = parse_lines(payload.get("lines"), errors)
    if errors:
        raise DraftValidationError(errors)
    return DraftInput(
        supplier_id=supplier_id,
        document_type=document_type,
        reference=reference,
        normalized_reference=normalize_reference(reference),
        document_date=document_date,
        notes=notes,
        no_document_reason=reason,
        lines=lines,
    )
