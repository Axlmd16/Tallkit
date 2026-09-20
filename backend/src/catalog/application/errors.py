"""Errores de aplicación del catálogo con código estable para la frontera HTTP."""

from typing import Literal

ErrorCode = Literal[
    "validation_error",
    "unknown_field",
    "duplicate_code",
    "duplicate_name",
    "inactive_reference",
    "invalid_tax_scope",
    "category_has_active_products",
    "stale_record",
    "idempotency_conflict",
    "not_found",
]


class CatalogApplicationError(Exception):
    def __init__(
        self, code: ErrorCode, message: str, errors: dict[str, list[str]] | None = None
    ) -> None:
        super().__init__(message)
        self.code: ErrorCode = code
        self.message = message
        self.errors: dict[str, list[str]] = errors or {}


def field_error(code: ErrorCode, field: str, message: str) -> CatalogApplicationError:
    return CatalogApplicationError(code, message, {field: [message]})


def not_found(label: str) -> CatalogApplicationError:
    return CatalogApplicationError("not_found", f"{label} no encontrado.")


def stale_record() -> CatalogApplicationError:
    return CatalogApplicationError(
        "stale_record",
        "El registro cambió desde que lo consultó. Recargue y revise antes de guardar.",
        {"expected_version": ["La versión esperada no coincide con la vigente."]},
    )
