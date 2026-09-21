"""Errores de aplicación comercial con código estable para la frontera HTTP."""

from typing import Literal

ErrorCode = Literal[
    "validation_error",
    "unknown_field",
    "inactive_reference",
    "stale_record",
    "review_required",
    "idempotency_conflict",
    "configuration_missing",
    "configuration_ambiguous",
    "insufficient_stock",
    "not_editable",
    "not_found",
    "invalid_state",
    "dependency_conflict",
    "unsafe_reversal",
    "inventory_inconsistent",
]


class SalesApplicationError(Exception):
    def __init__(
        self, code: ErrorCode, message: str, errors: dict[str, list[str]] | None = None
    ) -> None:
        super().__init__(message)
        self.code: ErrorCode = code
        self.message = message
        self.errors: dict[str, list[str]] = errors or {}


def field_error(code: ErrorCode, field: str, message: str) -> SalesApplicationError:
    return SalesApplicationError(code, message, {field: [message]})


def not_found(what: str = "Venta") -> SalesApplicationError:
    return SalesApplicationError("not_found", f"{what} no encontrada.")


def stale_record() -> SalesApplicationError:
    return SalesApplicationError(
        "stale_record",
        "La venta cambió desde que la consultó. Recargue y revise antes de continuar.",
        {"expected_version": ["La versión esperada no coincide con la vigente."]},
    )
