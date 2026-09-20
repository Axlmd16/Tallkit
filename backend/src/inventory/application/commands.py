"""Ejecución idempotente de comandos manuales de inventario con recibo persistente propio.

El recibo se reclama por inserción única en un savepoint y se completa antes del commit;
cualquier excepción revierte operación, efectos y recibo provisional.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from inventory.application.errors import InventoryApplicationError, field_error
from inventory.models import InventoryCommand
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
        raise InventoryApplicationError(
            "unknown_field",
            "La solicitud contiene campos no admitidos.",
            {name: ["Campo no admitido."] for name in unknown},
        )


def run_idempotent_command(
    *,
    actor: User,
    action: str,
    idempotency_key: str,
    payload: dict[str, Any],
    execute: Callable[[], tuple[int, dict[str, Any]]],
) -> CommandOutcome:
    """Ejecuta ``execute`` una sola vez por actor/acción/clave (el llamador ya autorizó)."""
    key = validate_idempotency_key(idempotency_key)
    fingerprint = canonical_fingerprint(payload)
    with transaction.atomic():
        try:
            with transaction.atomic():
                receipt = InventoryCommand.objects.create(
                    actor=actor, action=action, idempotency_key=key, input_fingerprint=fingerprint
                )
        except IntegrityError:
            existing = InventoryCommand.objects.filter(
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
) -> CommandOutcome:
    """Autoriza (siempre antes del replay), reclama el recibo, ejecuta ``work`` y audita.

    ``work`` devuelve ``(estado HTTP, cuerpo, campos cambiados)``; los rechazos se auditan
    después del rollback con un motivo estable.
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
            actor=actor, action=action, idempotency_key=key, payload=payload, execute=execute
        )
    except (InventoryApplicationError, IdempotencyConflictError) as exc:
        reason = exc.code if isinstance(exc, InventoryApplicationError) else "idempotency_conflict"
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
