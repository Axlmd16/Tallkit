"""Ejecución idempotente de comandos comerciales con recibo persistente propio.

El recibo se reclama por inserción única en un savepoint y se completa antes del commit;
cualquier excepción revierte documento, efectos y recibo provisional. El recibo conserva solo
la identidad del resultado (tipo e ID): al repetir se proyecta con los permisos actuales, de
modo que un replay nunca devuelve costos que el actor ya no puede ver.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from sales.application.errors import SalesApplicationError, field_error
from sales.models import SalesCommand
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


@dataclass(frozen=True)
class CommandResult:
    """Identidad del hecho producido y campos cambiados para la auditoría."""

    status: int
    kind: str
    id: int
    changed: tuple[str, ...] = ()


Projector = Callable[[str, int], dict[str, Any]]


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


def reject_unknown_fields(payload: dict[str, Any], allowed: frozenset[str]) -> None:
    unknown = sorted(set(payload) - allowed)
    if unknown:
        raise SalesApplicationError(
            "unknown_field",
            "La solicitud contiene campos no admitidos.",
            {name: ["Campo no admitido."] for name in unknown},
        )


def parse_operation_id(payload: dict[str, Any]) -> UUID:
    value = payload.get("operation_id")
    try:
        if not isinstance(value, str):
            raise ValueError
        return UUID(value)
    except ValueError:
        raise field_error(
            "validation_error", "operation_id", "Indique el identificador único de la operación."
        ) from None


def run_idempotent_command(
    *,
    actor: User,
    action: str,
    idempotency_key: str,
    payload: dict[str, Any],
    execute: Callable[[], CommandResult],
    project: Projector,
    request_id: UUID | None = None,
) -> CommandOutcome:
    """Ejecuta ``execute`` una sola vez por actor/acción/clave (el llamador ya autorizó)."""
    key = validate_idempotency_key(idempotency_key)
    fingerprint = canonical_fingerprint(payload)
    with transaction.atomic():
        try:
            with transaction.atomic():
                receipt = SalesCommand.objects.create(
                    actor=actor, action=action, idempotency_key=key, input_fingerprint=fingerprint
                )
        except IntegrityError:
            existing = SalesCommand.objects.filter(
                actor=actor, action=action, idempotency_key=key
            ).first()
            if existing is None:
                raise
            if existing.input_fingerprint != fingerprint:
                raise IdempotencyConflictError(key) from None
            if existing.response_status is None or existing.result_id is None:
                raise
            body = project(existing.result_kind, existing.result_id)
            return CommandOutcome(existing.response_status, body, replayed=True)
        result = execute()
        receipt.response_status = result.status
        receipt.result_kind = result.kind
        receipt.result_id = result.id
        receipt.save(update_fields=["response_status", "result_kind", "result_id"])
        record_success(actor, action, result, request_id)
        return CommandOutcome(result.status, project(result.kind, result.id))


def record_success(
    actor: User, action: str, result: CommandResult, request_id: UUID | None
) -> None:
    if not result.changed:
        return
    record_audit_event(
        actor=actor,
        action=action,
        target_type=result.kind,
        target_id=str(result.id),
        result=AuditResult.SUCCESS,
        request_id=request_id,
        metadata={"changed_fields": list(result.changed)},
    )


def execute_write(
    *,
    actor: User,
    permission: str,
    action: str,
    target_type: str,
    target_id: str,
    request_id: UUID | None,
    payload: dict[str, Any],
    work: Callable[[], CommandResult],
    project: Projector,
) -> CommandOutcome:
    """Autoriza (siempre antes del replay), reclama el recibo, ejecuta ``work`` y audita.

    Los rechazos se auditan después del rollback con un motivo estable.
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
    try:
        return run_idempotent_command(
            actor=actor,
            action=action,
            idempotency_key=key,
            payload=payload,
            execute=work,
            project=project,
            request_id=request_id,
        )
    except (SalesApplicationError, IdempotencyConflictError) as exc:
        reason = exc.code if isinstance(exc, SalesApplicationError) else "idempotency_conflict"
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
