"""Errores de aplicación de proveedores con código estable para la frontera HTTP."""

from typing import Literal

SupplierErrorCode = Literal[
    "validation_error",
    "unknown_field",
    "duplicate_identification",
    "stale_record",
    "idempotency_conflict",
    "not_found",
]


class SupplierApplicationError(Exception):
    def __init__(
        self, code: SupplierErrorCode, message: str, errors: dict[str, list[str]] | None = None
    ) -> None:
        super().__init__(message)
        self.code: SupplierErrorCode = code
        self.message = message
        self.errors: dict[str, list[str]] = errors or {}


def field_error(code: SupplierErrorCode, field: str, message: str) -> SupplierApplicationError:
    return SupplierApplicationError(code, message, {field: [message]})


def not_found(label: str) -> SupplierApplicationError:
    return SupplierApplicationError("not_found", f"{label} no encontrado.")


def stale_record() -> SupplierApplicationError:
    return SupplierApplicationError(
        "stale_record",
        "El registro cambió desde que lo consultó. Recargue y revise antes de guardar.",
        {"expected_version": ["La versión esperada no coincide con la vigente."]},
    )
