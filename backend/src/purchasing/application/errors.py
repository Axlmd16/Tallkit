"""Errores de aplicación de compras con código estable para la frontera HTTP."""

from typing import Literal

ErrorCode = Literal[
    "validation_error",
    "unknown_field",
    "inactive_reference",
    "stale_record",
    "review_required",
    "possible_duplicate",
    "idempotency_conflict",
    "configuration_missing",
    "configuration_ambiguous",
    "insufficient_stock",
    "unsafe_reversal",
    "inventory_inconsistent",
    "not_editable",
    "not_found",
]


class PurchaseApplicationError(Exception):
    def __init__(
        self, code: ErrorCode, message: str, errors: dict[str, list[str]] | None = None
    ) -> None:
        super().__init__(message)
        self.code: ErrorCode = code
        self.message = message
        self.errors: dict[str, list[str]] = errors or {}


def field_error(code: ErrorCode, field: str, message: str) -> PurchaseApplicationError:
    return PurchaseApplicationError(code, message, {field: [message]})


def not_found() -> PurchaseApplicationError:
    return PurchaseApplicationError("not_found", "Ingreso de mercadería no encontrado.")


def stale_record() -> PurchaseApplicationError:
    return PurchaseApplicationError(
        "stale_record",
        "El ingreso cambió desde que lo consultó. Recargue y revise antes de guardar.",
        {"expected_version": ["La versión esperada no coincide con la vigente."]},
    )
