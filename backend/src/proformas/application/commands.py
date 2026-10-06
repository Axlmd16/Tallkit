"""Ejecución idempotente de comandos de proformas con recibo persistente propio.

El recibo se reclama por inserción única en un savepoint y se completa antes del commit;
cualquier excepción revierte documento, efectos y recibo provisional. El recibo conserva solo
la identidad del resultado: al repetir se proyecta con los permisos vigentes. La unidad
completa corre en una transacción cuyo conflicto transitorio se traduce tras el rollback.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from proformas.application.errors import ProformaApplicationError, field_error
from proformas.domain.validity import TransitionError
from proformas.models import ProformaCommand
from shared.command_values import (
    InvalidIdempotencyKeyError,
    canonical_fingerprint,
    validate_idempotency_key,
)
from shared.transactions import retryable_transaction

TARGET_TYPE = "proforma"


@dataclass(frozen=True)
class CommandOutcome:
    status: int
    body: dict[str, Any]
    replayed: bool = False


@dataclass(frozen=True)
class CommandResult:
    """Identidad del hecho producido y campos cambiados para la auditoría."""

    status: int
    id: int
    changed: tuple[str, ...] = ()
    # Vínculo producido (oferta de origen o venta generada), sin datos personales.
    link: str = ""


Projector = Callable[[int], dict[str, Any]]


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
        raise ProformaApplicationError(
            "unknown_field",
            "La solicitud contiene campos no admitidos.",
            {name: ["Campo no admitido."] for name in unknown},
        )


def transition_error(error: TransitionError) -> ProformaApplicationError:
    return ProformaApplicationError(error.code, error.message)  # type: ignore[arg-type]


def _run(
    *,
    actor: User,
    action: str,
    key: str,
    fingerprint: str,
    execute: Callable[[], CommandResult],
    project: Projector,
    request_id: UUID | None,
) -> CommandOutcome:
    with retryable_transaction():
        try:
            with transaction.atomic():
                receipt = ProformaCommand.objects.create(
                    actor=actor, action=action, idempotency_key=key, input_fingerprint=fingerprint
                )
        except IntegrityError:
            existing = ProformaCommand.objects.filter(
                actor=actor, action=action, idempotency_key=key
            ).first()
            if existing is None:
                raise
            if existing.input_fingerprint != fingerprint:
                raise ProformaApplicationError(
                    "idempotency_conflict",
                    "La clave de intento ya se usó con otro contenido.",
                    {"idempotency_key": ["Use una clave nueva para una solicitud distinta."]},
                ) from None
            if existing.response_status is None or existing.result_id is None:
                raise
            return CommandOutcome(
                existing.response_status, project(existing.result_id), replayed=True
            )
        result = execute()
        receipt.response_status = result.status
        receipt.result_kind = TARGET_TYPE
        receipt.result_id = result.id
        receipt.save(update_fields=["response_status", "result_kind", "result_id"])
        if result.changed:
            record_audit_event(
                actor=actor,
                action=action,
                target_type=TARGET_TYPE,
                target_id=str(result.id),
                result=AuditResult.SUCCESS,
                reason=result.link,
                request_id=request_id,
                metadata={"changed_fields": list(result.changed)},
            )
        return CommandOutcome(result.status, project(result.id))


def execute_write(
    *,
    actor: User,
    permissions: tuple[str, ...],
    action: str,
    target_id: str,
    request_id: UUID | None,
    payload: dict[str, Any],
    work: Callable[[], CommandResult],
    project: Projector,
) -> CommandOutcome:
    """Autoriza (siempre antes del replay), reclama el recibo, ejecuta ``work`` y audita.

    Los rechazos se auditan después del rollback con un motivo estable y sin datos personales.
    """
    for permission in permissions:
        require_permission(
            actor=actor,
            permission=permission,
            request_id=request_id,
            denial_action=action,
            target_type=TARGET_TYPE,
            target_id=target_id,
        )
    try:
        key = validated_key(payload)
        return _run(
            actor=actor,
            action=action,
            key=key,
            # El destino forma parte del intento: la misma clave sobre otra oferta es conflicto.
            fingerprint=canonical_fingerprint({**payload, "_target": target_id}),
            execute=work,
            project=project,
            request_id=request_id,
        )
    except ProformaApplicationError as exc:
        record_audit_event(
            actor=actor,
            action=action,
            target_type=TARGET_TYPE,
            target_id=target_id,
            result=AuditResult.FAILURE,
            reason=exc.code,
            request_id=request_id,
        )
        raise
