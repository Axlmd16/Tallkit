"""Errores de aplicación de inventario con código estable para la frontera HTTP."""

from typing import Literal

ErrorCode = Literal[
    "validation_error",
    "unknown_field",
    "inactive_reference",
    "invalid_tax_scope",
    "stale_record",
    "review_required",
    "duplicate_supplier_document",
    "idempotency_conflict",
    "configuration_missing",
    "configuration_ambiguous",
    "insufficient_stock",
    "unsafe_reversal",
    "inventory_inconsistent",
    "not_editable",
    "already_initialized",
    "not_found",
]


class InventoryApplicationError(Exception):
    def __init__(
        self, code: ErrorCode, message: str, errors: dict[str, list[str]] | None = None
    ) -> None:
        super().__init__(message)
        self.code: ErrorCode = code
        self.message = message
        self.errors: dict[str, list[str]] = errors or {}


def field_error(code: ErrorCode, field: str, message: str) -> InventoryApplicationError:
    return InventoryApplicationError(code, message, {field: [message]})


def not_found() -> InventoryApplicationError:
    return InventoryApplicationError("not_found", "Operación de inventario no encontrada.")


def stale_record() -> InventoryApplicationError:
    return InventoryApplicationError(
        "stale_record",
        "La operación cambió desde que lo consultó. Recargue y revise antes de guardar.",
        {"expected_version": ["La versión esperada no coincide con la vigente."]},
    )
