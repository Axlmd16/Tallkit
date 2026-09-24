"""Ejecución idempotente de comandos del taller con recibo persistente propio.

Adapta el patrón de ventas sin importarlo: se autoriza antes del replay, el recibo se reclama
por inserción única en un savepoint y se completa en la misma transacción; cualquier
excepción revierte orden, efectos y recibo. El recibo guarda solo la identidad del resultado y
el replay proyecta el estado actual con los permisos vigentes del actor.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from shared.command_values import (
    InvalidIdempotencyKeyError,
    canonical_fingerprint,
    validate_idempotency_key,
)
from shared.transactions import retryable_transaction
from workshop.application.errors import WorkshopError, field_error
from workshop.models import WorkshopCommand

TARGET_TYPE = "maintenance_order"


@dataclass(frozen=True)
class CommandOutcome:
    status: int
    body: dict[str, Any]
    replayed: bool = False


@dataclass(frozen=True)
class CommandResult:
    """Identidad del recurso afectado (orden u operación) y campos cambiados para la auditoría."""

    status: int
    order_id: int
    changed: tuple[str, ...] = ()


Projector = Callable[[int], dict[str, Any]]


def validated_key(payload: dict[str, Any]) -> str:
    try:
        return validate_idempotency_key(payload.get("idempotency_key"))
    except InvalidIdempotencyKeyError as exc:
        raise field_error("validation_error", "idempotency_key", str(exc)) from None


def execute_write(
    *,
    actor: User,
    permissions: tuple[str, ...],
    action: str,
    target_id: str,
    payload: dict[str, Any],
    fingerprint_payload: dict[str, Any] | None = None,
    work: Callable[[], CommandResult],
    project: Projector,
    request_id: UUID | None = None,
    target_type: str = TARGET_TYPE,
) -> CommandOutcome:
    """Autoriza, reclama el recibo, ejecuta ``work`` una sola vez y audita el resultado."""
    for permission in permissions:
        require_permission(
            actor=actor,
            permission=permission,
            request_id=request_id,
            denial_action=action,
            target_type=target_type,
            target_id=target_id,
        )
    try:
        key = validated_key(payload)
        fingerprint = canonical_fingerprint(fingerprint_payload or payload)
        return _run(actor, action, key, fingerprint, work, project, request_id, target_type)
    except WorkshopError as exc:
        record_audit_event(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=target_id,
            result=AuditResult.FAILURE,
            reason=exc.code,
            request_id=request_id,
        )
        raise


def _run(
    actor: User,
    action: str,
    key: str,
    fingerprint: str,
    work: Callable[[], CommandResult],
    project: Projector,
    request_id: UUID | None,
    target_type: str = TARGET_TYPE,
) -> CommandOutcome:
    with retryable_transaction():
        try:
            with transaction.atomic():
                receipt = WorkshopCommand.objects.create(
                    actor=actor, action=action, idempotency_key=key, input_fingerprint=fingerprint
                )
        except IntegrityError:
            existing = WorkshopCommand.objects.filter(
                actor=actor, action=action, idempotency_key=key
            ).first()
            if existing is None or existing.result_id is None or existing.response_status is None:
                raise
            if existing.input_fingerprint != fingerprint:
                raise WorkshopError(
                    "idempotency_conflict",
                    "La clave de idempotencia ya se usó con otra solicitud.",
                    {"idempotency_key": ["Clave reutilizada con datos distintos."]},
                ) from None
            return CommandOutcome(
                existing.response_status, project(existing.result_id), replayed=True
            )
        result = work()
        receipt.response_status = result.status
        receipt.result_kind = target_type
        receipt.result_id = result.order_id
        receipt.save(update_fields=["response_status", "result_kind", "result_id"])
        if result.changed:
            record_audit_event(
                actor=actor,
                action=action,
                target_type=target_type,
                target_id=str(result.order_id),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": list(result.changed)},
            )
        return CommandOutcome(result.status, project(result.order_id))


def find_receipt(actor: User, action: str, payload: dict[str, Any]) -> WorkshopCommand | None:
    """Recibo completado para la clave enviada; permite responder reintentos sin repetir E/S."""
    try:
        key = validate_idempotency_key(payload.get("idempotency_key"))
    except InvalidIdempotencyKeyError:
        return None
    return WorkshopCommand.objects.filter(
        actor=actor, action=action, idempotency_key=key, result_id__isnull=False
    ).first()
