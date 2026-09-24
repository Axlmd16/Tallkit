"""Errores de aplicación del taller con código estable para la frontera HTTP."""

from typing import Any


class WorkshopError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        errors: dict[str, list[str]] | None = None,
        *,
        conflict: dict[str, Any] | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.errors: dict[str, list[str]] = errors or {}
        self.conflict = conflict
        self.details = details


def field_error(code: str, field: str, message: str) -> WorkshopError:
    return WorkshopError(code, message, {field: [message]})


def not_found() -> WorkshopError:
    return WorkshopError("not_found", "Orden de mantenimiento no encontrada.")


def stale_record() -> WorkshopError:
    return WorkshopError(
        "stale_record",
        "La orden cambió desde que la consultó. Recargue y revise antes de continuar.",
        {"expected_version": ["La versión esperada no coincide con la vigente."]},
    )


def not_editable(state: str) -> WorkshopError:
    if state == "FINALIZED":
        message = "La orden está finalizada. Reábrala antes de modificarla."
    else:
        message = "La orden está reabierta: solo puede modificar la intervención correctiva."
    return WorkshopError("not_editable", message)
