"""Carga, reemplazo y retiro del logotipo de una entidad fiscal (diseño D3).

Solo el Administrador (`entidades_fiscales.editar`) administra el logotipo. Cada comando exige
clave de idempotencia y se serializa por entidad con un bloqueo de fila; el archivo nuevo se
escribe fuera de la transacción y se descarta ante cualquier fallo, y el anterior se borra
cuando la transacción confirma. El logotipo no altera la `version` de la entidad.
"""

import hashlib
from collections.abc import Callable
from dataclasses import asdict, dataclass
from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from shared.command_values import canonical_fingerprint, validate_idempotency_key
from workshop_configuration.application import logo_storage
from workshop_configuration.application.entity_warehouse import FiscalEntityNotFoundError
from workshop_configuration.application.initialization import IdempotencyConflictError
from workshop_configuration.application.logo_storage import LogoImageError
from workshop_configuration.models import ConfigurationCommand, FiscalEntity, FiscalEntityLogo

UPLOAD_ACTION = "fiscal_entity.logo_upload"
REMOVE_ACTION = "fiscal_entity.logo_remove"
PERMISSION = "entidades_fiscales.editar"
TARGET_TYPE = "fiscal_entity"
AUDIT_PREFIX = "workshop_configuration.fiscal_entity_logo"


@dataclass(frozen=True)
class LogoCommandResult:
    entity_id: int
    logo: dict[str, Any] | None


def logo_summary(logo: FiscalEntityLogo | None) -> dict[str, Any] | None:
    if logo is None:
        return None
    return {
        "revision": logo.revision,
        "content_type": logo.content_type,
        "width": logo.width,
        "height": logo.height,
        "size_bytes": logo.size_bytes,
        "uploaded_at": logo.uploaded_at.isoformat(),
    }


def current_logo(entity_id: int) -> FiscalEntityLogo | None:
    return FiscalEntityLogo.objects.filter(fiscal_entity_id=entity_id).first()


def _authorize(actor: User, action: str, entity_id: int, request_id: UUID | None) -> None:
    require_permission(
        actor=actor,
        permission=PERMISSION,
        request_id=request_id,
        denial_action=f"{AUDIT_PREFIX}_{action}",
        target_type=TARGET_TYPE,
        target_id=str(entity_id),
    )


def _require_entity(entity_id: int) -> None:
    if not FiscalEntity.objects.filter(pk=entity_id).exists():
        raise FiscalEntityNotFoundError(f"Entidad fiscal {entity_id} no encontrada.")


def _audit(
    actor: User,
    entity_id: int,
    event: str,
    result: AuditResult = AuditResult.SUCCESS,
    reason: str = "",
    request_id: UUID | None = None,
) -> None:
    record_audit_event(
        actor=actor,
        action=f"{AUDIT_PREFIX}_{event}",
        target_type=TARGET_TYPE,
        target_id=str(entity_id),
        result=result,
        reason=reason,
        request_id=request_id,
        metadata={"changed_fields": ["logo"]},
    )


def _stored_result(
    actor: User, action: str, key: str, fingerprint: str
) -> LogoCommandResult | None:
    receipt = ConfigurationCommand.objects.filter(
        actor=actor, action=action, idempotency_key=key
    ).first()
    if receipt is None:
        return None
    if receipt.input_fingerprint != fingerprint:
        raise IdempotencyConflictError("La clave corresponde a otra entrada.")
    return LogoCommandResult(**receipt.result)


def _lock_entity(entity_id: int) -> FiscalEntity:
    entity = FiscalEntity.objects.select_for_update().filter(pk=entity_id).first()
    if entity is None:
        raise FiscalEntityNotFoundError(f"Entidad fiscal {entity_id} no encontrada.")
    return entity


def _run(
    *,
    actor: User,
    action: str,
    key: str,
    fingerprint: str,
    work: Callable[[], LogoCommandResult],
) -> tuple[LogoCommandResult, bool]:
    """Ejecuta `work` con el recibo; devuelve el resultado y si fue una repetición."""
    with transaction.atomic():
        try:
            with transaction.atomic():
                receipt = ConfigurationCommand.objects.create(
                    actor=actor,
                    action=action,
                    idempotency_key=key,
                    input_fingerprint=fingerprint,
                    response_status=200,
                    result={},
                )
        except IntegrityError:
            stored = _stored_result(actor, action, key, fingerprint)
            if stored is None:  # pragma: no cover - el recibo acaba de colisionar
                raise
            return stored, True
        result = work()
        receipt.result = asdict(result)
        receipt.save(update_fields=["result"])
        return result, False


def upload_entity_logo(
    *,
    actor: User,
    entity_id: int,
    file: logo_storage.UploadedImage,
    idempotency_key: object,
    request_id: UUID | None = None,
) -> LogoCommandResult:
    _authorize(actor, "uploaded", entity_id, request_id)
    key = validate_idempotency_key(idempotency_key)
    _require_entity(entity_id)
    try:
        raw = logo_storage.read_upload(file)
    except LogoImageError as error:
        _audit(actor, entity_id, "rejected", AuditResult.FAILURE, error.code, request_id)
        raise
    fingerprint = canonical_fingerprint(
        {"entity_id": entity_id, "sha256": hashlib.sha256(raw).hexdigest()}
    )
    stored = _stored_result(actor, UPLOAD_ACTION, key, fingerprint)
    if stored is not None:
        return stored
    try:
        logo = logo_storage.inspect_logo(_Buffered(raw, file.name))
    except LogoImageError as error:
        _audit(actor, entity_id, "rejected", AuditResult.FAILURE, error.code, request_id)
        raise
    new_name = logo_storage.store_logo(entity_id, logo)

    def work() -> LogoCommandResult:
        entity = _lock_entity(entity_id)
        previous = current_logo(entity_id)
        entity.logo_revision += 1
        entity.save(update_fields=["logo_revision"])
        if previous is not None:
            old_name = previous.storage_name
            previous.delete()
            transaction.on_commit(lambda: logo_storage.delete_files(old_name))
        created = FiscalEntityLogo.objects.create(
            fiscal_entity=entity,
            storage_name=new_name,
            content_type=logo.content_type,
            extension=logo.extension,
            size_bytes=len(logo.content),
            width=logo.width,
            height=logo.height,
            sha256=logo.sha256,
            revision=entity.logo_revision,
            uploaded_by=actor,
        )
        _audit(actor, entity_id, "replaced" if previous else "uploaded", request_id=request_id)
        return LogoCommandResult(entity_id, logo_summary(created))

    try:
        result, replayed = _run(
            actor=actor, action=UPLOAD_ACTION, key=key, fingerprint=fingerprint, work=work
        )
    except BaseException:
        logo_storage.delete_files(new_name)
        raise
    if replayed:
        logo_storage.delete_files(new_name)
    return result


def remove_entity_logo(
    *,
    actor: User,
    entity_id: int,
    idempotency_key: object,
    request_id: UUID | None = None,
) -> LogoCommandResult:
    _authorize(actor, "removed", entity_id, request_id)
    key = validate_idempotency_key(idempotency_key)
    _require_entity(entity_id)
    fingerprint = canonical_fingerprint({"entity_id": entity_id})

    def work() -> LogoCommandResult:
        _lock_entity(entity_id)
        previous = current_logo(entity_id)
        if previous is None:
            return LogoCommandResult(entity_id, None)
        old_name = previous.storage_name
        previous.delete()
        transaction.on_commit(lambda: logo_storage.delete_files(old_name))
        _audit(actor, entity_id, "removed", request_id=request_id)
        return LogoCommandResult(entity_id, None)

    result, _ = _run(actor=actor, action=REMOVE_ACTION, key=key, fingerprint=fingerprint, work=work)
    return result


class _Buffered:
    """Contenido ya leído, presentado con la interfaz de archivo subido."""

    def __init__(self, content: bytes, name: str | None) -> None:
        self.size: int | None = len(content)
        self.name = name
        self._content = content

    def read(self, size: int = -1) -> bytes:
        return self._content if size < 0 else self._content[:size]
