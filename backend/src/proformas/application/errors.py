"""Errores de aplicación de proformas con código estable para la frontera HTTP."""

from typing import Any, Literal

ErrorCode = Literal[
    "validation_error",
    "unknown_field",
    "inactive_reference",
    "stale_record",
    "review_required",
    "idempotency_conflict",
    "configuration_missing",
    "configuration_ambiguous",
    "logo_unreadable",
    "not_found",
    "proforma_not_issued",
    "proforma_issued",
    "proforma_expired",
    "proforma_converted",
    "proforma_voided",
]


class ProformaApplicationError(Exception):
    """``conflict`` identifica el recurso existente, por ejemplo la venta ya generada."""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        errors: dict[str, list[str]] | None = None,
        conflict: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code: ErrorCode = code
        self.message = message
        self.errors: dict[str, list[str]] = errors or {}
        self.conflict = conflict


def field_error(code: ErrorCode, field: str, message: str) -> ProformaApplicationError:
    return ProformaApplicationError(code, message, {field: [message]})


def not_found() -> ProformaApplicationError:
    return ProformaApplicationError("not_found", "Proforma no encontrada.")


def stale_record() -> ProformaApplicationError:
    return ProformaApplicationError(
        "stale_record",
        "La proforma cambió desde que la consultó. Recargue y revise antes de continuar.",
        {"expected_version": ["La versión esperada no coincide con la vigente."]},
    )
