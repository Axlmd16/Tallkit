"""Fotografías de la intervención abierta: carga, retiro y entrega autorizada.

La carga valida y escribe los archivos fuera de la transacción y crea el registro después de
bloquear la orden; si la orden dejó de estar abierta o algo falla, los archivos se borran. Un
registro de fotografía solo existe con sus archivos completos.
"""

from typing import IO, Any
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from identity.application.authorization import require_permission
from identity.models import User
from workshop.application import photo_storage, projection
from workshop.application.commands import (
    TARGET_TYPE,
    CommandOutcome,
    CommandResult,
    execute_write,
    find_receipt,
)
from workshop.application.errors import WorkshopError, not_editable, not_found
from workshop.application.orders import parsed
from workshop.application.support import ensure_state, lock_order, open_intervention
from workshop.domain.input import parse_photo_description, parse_version_only
from workshop.domain.photo_rules import MAX_PHOTOS_PER_ORDER
from workshop.domain.states import OrderState
from workshop.models import OrderPhoto

UPLOAD_ACTION = "maintenance.photo_add"


def _authorize(
    actor: User, permission: str, action: str, order_id: int, request_id: UUID | None
) -> None:
    require_permission(
        actor=actor,
        permission=permission,
        request_id=request_id,
        denial_action=action,
        target_type=TARGET_TYPE,
        target_id=str(order_id),
    )


def upload_photo(
    *,
    actor: User,
    order_id: int,
    file: photo_storage.UploadedImage,
    description: object,
    idempotency_key: object,
    request_id: UUID | None = None,
) -> CommandOutcome:
    _authorize(actor, "mantenimientos.gestionar_fotos", UPLOAD_ACTION, order_id, request_id)
    text = parsed(lambda: parse_photo_description(description))
    control = {"idempotency_key": idempotency_key}
    receipt = find_receipt(actor, UPLOAD_ACTION, control)
    image = None if receipt else photo_storage.inspect_image(file)
    if receipt is not None:
        return execute_write(
            actor=actor,
            permissions=(),
            action=UPLOAD_ACTION,
            target_id=str(order_id),
            payload=control,
            fingerprint_payload={"order_id": order_id, "description": text},
            work=lambda: CommandResult(201, order_id),
            project=lambda pk: projection.order_detail(pk, actor),
            request_id=request_id,
        )
    assert image is not None
    stored = photo_storage.store(order_id, image)

    def work() -> CommandResult:
        order = lock_order(order_id)
        ensure_state(order, OrderState.REGISTERED, OrderState.REOPENED)
        intervention = open_intervention(order)
        current = OrderPhoto.objects.filter(order=order, removed_at__isnull=True).count()
        if current >= MAX_PHOTOS_PER_ORDER:
            message = f"La orden ya tiene el máximo de {MAX_PHOTOS_PER_ORDER} fotografías."
            raise WorkshopError("photo_limit_reached", message, {"file": [message]})
        OrderPhoto.objects.create(
            order=order,
            intervention=intervention,
            storage_name=stored.storage_name,
            thumbnail_name=stored.thumbnail_name,
            content_type=image.content_type,
            size_bytes=len(image.content),
            width=image.width,
            height=image.height,
            sha256=image.sha256,
            description=text,
            uploaded_by=actor,
        )
        return CommandResult(201, order.pk, ("photos",))

    try:
        return execute_write(
            actor=actor,
            permissions=(),
            action=UPLOAD_ACTION,
            target_id=str(order_id),
            payload=control,
            fingerprint_payload={"order_id": order_id, "description": text},
            work=work,
            project=lambda pk: projection.order_detail(pk, actor),
            request_id=request_id,
        )
    except BaseException:
        photo_storage.delete_files(stored.storage_name, stored.thumbnail_name)
        raise


def remove_photo(
    *,
    actor: User,
    order_id: int,
    photo_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    def work() -> CommandResult:
        parsed(lambda: parse_version_only({**payload, "expected_version": 1}))
        order = lock_order(order_id)
        photo = OrderPhoto.objects.select_for_update().filter(pk=photo_id, order=order).first()
        if photo is None:
            raise WorkshopError("not_found", "Fotografía no encontrada.")
        if photo.removed_at is not None:
            return CommandResult(200, order.pk)
        if order.state == OrderState.FINALIZED.value:
            raise not_editable(order.state)
        intervention = open_intervention(order)
        if photo.intervention_id != intervention.pk:
            raise WorkshopError(
                "not_editable",
                "La fotografía pertenece a una intervención finalizada y se conserva.",
            )
        photo.removed_at = timezone.now()
        photo.removed_by = actor
        photo.save(update_fields=["removed_at", "removed_by"])
        names = (photo.storage_name, photo.thumbnail_name)
        transaction.on_commit(lambda: photo_storage.delete_files(*names))
        return CommandResult(200, order.pk, ("photos",))

    return execute_write(
        actor=actor,
        permissions=("mantenimientos.gestionar_fotos",),
        action="maintenance.photo_remove",
        target_id=str(order_id),
        payload={**payload, "photo_id": photo_id},
        work=work,
        project=lambda pk: projection.order_detail(pk, actor),
        request_id=request_id,
    )


def open_photo(
    *, actor: User, order_id: int, photo_id: int, thumbnail: bool, request_id: UUID | None = None
) -> tuple[IO[bytes], str]:
    """Abre el archivo de una fotografía vigente; exige permiso de consulta de la orden."""
    _authorize(actor, "mantenimientos.ver", "maintenance.photo_view", order_id, request_id)
    photo = OrderPhoto.objects.filter(
        pk=photo_id, order_id=order_id, removed_at__isnull=True
    ).first()
    if photo is None:
        raise not_found()
    name = photo.thumbnail_name if thumbnail else photo.storage_name
    try:
        handle = photo_storage.open_file(name)
    except FileNotFoundError:
        raise not_found() from None
    return handle, "image/webp" if thumbnail else photo.content_type
