"""Ejecución idempotente de comandos del catálogo con recibo persistente propio.

El recibo se reclama por inserción única dentro de un savepoint y se completa antes
del commit; cualquier excepción revierte operación y recibo. Nunca se confirma un
recibo provisional.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID

from django.db import IntegrityError, transaction

from catalog.application.errors import CatalogApplicationError, ErrorCode, field_error
from catalog.domain.errors import CatalogValidationError
from catalog.models import CatalogCommand
from identity.application.audit import record_audit_event
from identity.application.authorization import (
    BusinessPermissionDeniedError,
    record_permission_denial,
    require_permission,
)
from identity.models import AuditResult, User
from shared.command_values import (
    InvalidIdempotencyKeyError,
    canonical_fingerprint,
    validate_idempotency_key,
)


class IdempotencyConflictError(Exception):
    """La clave ya se usó con una entrada distinta."""


@dataclass(frozen=True)
class CommandOutcome:
    status: int
    body: dict[str, Any]
    replayed: bool = False


def run_idempotent_command(
    *,
    actor: User,
    action: str,
    idempotency_key: str,
    payload: dict[str, Any],
    execute: Callable[[], tuple[int, dict[str, Any]]],
    set_fields: frozenset[str] = frozenset(),
) -> CommandOutcome:
    """Ejecuta ``execute`` una sola vez por actor/acción/clave.

    El llamador autoriza antes de invocar esta función, incluso para reproducir.
    ``execute`` devuelve ``(estado HTTP, cuerpo JSON)`` y puede lanzar; en ese caso
    se revierte todo, incluido el recibo, y la clave puede reclamarse de nuevo.
    """
    key = validate_idempotency_key(idempotency_key)
    fingerprint = canonical_fingerprint(payload, set_fields=set_fields)
    with transaction.atomic():
        try:
            with transaction.atomic():
                receipt = CatalogCommand.objects.create(
                    actor=actor,
                    action=action,
                    idempotency_key=key,
                    input_fingerprint=fingerprint,
                )
        except IntegrityError:
            existing = CatalogCommand.objects.filter(
                actor=actor, action=action, idempotency_key=key
            ).first()
            if existing is None:
                raise
            if existing.input_fingerprint != fingerprint:
                raise IdempotencyConflictError(key) from None
            if existing.response_status is None or existing.result is None:
                raise
            return CommandOutcome(existing.response_status, existing.result, replayed=True)
        status, body = execute()
        receipt.response_status = status
        receipt.result = body
        receipt.save(update_fields=["response_status", "result"])
        return CommandOutcome(status, body)


# ---------------------------------------------------------------------------
# Envoltorio común de escritura: autorización, validación previa, recibo y auditoría
# ---------------------------------------------------------------------------


class PermissionDeniedInWorkError(Exception):
    """Permiso adicional denegado durante la operación (p. ej. cambiar precio)."""

    def __init__(self, permission: str) -> None:
        super().__init__(permission)
        self.permission = permission


def reject_unknown_fields(payload: dict[str, Any], allowed: frozenset[str]) -> None:
    unknown = sorted(set(payload) - allowed)
    if unknown:
        raise CatalogApplicationError(
            "unknown_field",
            "La solicitud contiene campos no admitidos.",
            {name: ["Campo no admitido."] for name in unknown},
        )


def validated_key(payload: dict[str, Any]) -> str:
    try:
        return validate_idempotency_key(payload.get("idempotency_key"))
    except InvalidIdempotencyKeyError as exc:
        raise field_error("validation_error", "idempotency_key", str(exc)) from None


def validated_version(payload: dict[str, Any]) -> int:
    value = payload.get("expected_version")
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise field_error(
            "validation_error", "expected_version", "La versión esperada es obligatoria."
        )
    return value


def translate_validation(exc: CatalogValidationError) -> CatalogApplicationError:
    return CatalogApplicationError("validation_error", str(exc), exc.errors)


def constraint_name(exc: IntegrityError) -> str:
    diag = getattr(exc.__cause__, "diag", None)
    return str(getattr(diag, "constraint_name", "") or "")


def save_or_translate(save: Callable[[], Any], mapping: dict[str, tuple[str, str, str]]) -> Any:
    """Ejecuta ``save`` en un savepoint y traduce restricciones conocidas.

    ``mapping``: restricción -> (código, campo, mensaje). Las desconocidas se relanzan.
    """
    try:
        with transaction.atomic():
            return save()
    except IntegrityError as exc:
        found = mapping.get(constraint_name(exc))
        if found is None:
            raise
        code, field, message = found
        raise field_error(cast(ErrorCode, code), field, message) from None


def execute_write(
    *,
    actor: User,
    permission: str,
    action: str,
    target_type: str,
    target_id: str,
    request_id: UUID | None,
    payload: dict[str, Any],
    work: Callable[[], tuple[int, dict[str, Any], list[str]]],
    set_fields: frozenset[str] = frozenset(),
) -> CommandOutcome:
    """Autoriza, reclama el recibo, ejecuta ``work`` y audita.

    ``work`` devuelve ``(estado HTTP, cuerpo, campos cambiados)``; una lista vacía
    indica una operación inocua sin evento. Los rechazos se auditan después del
    rollback con un motivo estable.
    """
    require_permission(
        actor=actor,
        permission=permission,
        request_id=request_id,
        denial_action=action,
        target_type=target_type,
        target_id=target_id,
    )
    key = validated_key(payload)

    def execute() -> tuple[int, dict[str, Any]]:
        status, body, changed = work()
        if changed:
            record_audit_event(
                actor=actor,
                action=action,
                target_type=target_type,
                target_id=str(body.get("id", target_id)),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": changed},
            )
        return status, body

    try:
        return run_idempotent_command(
            actor=actor,
            action=action,
            idempotency_key=key,
            payload=payload,
            execute=execute,
            set_fields=set_fields,
        )
    except PermissionDeniedInWorkError as exc:
        record_permission_denial(
            actor=actor,
            permission=exc.permission,
            request_id=request_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
        )
        raise BusinessPermissionDeniedError("No tiene permiso para realizar esta acción.") from None
    except (CatalogApplicationError, IdempotencyConflictError) as exc:
        reason = exc.code if isinstance(exc, CatalogApplicationError) else "idempotency_conflict"
        record_audit_event(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=target_id,
            result=AuditResult.FAILURE,
            reason=reason,
            request_id=request_id,
        )
        raise
