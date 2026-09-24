"""Carga, retiro y consistencia de fotografías privadas."""

from pathlib import Path
from typing import Any

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    create,
    error_of,
    finalize,
    image_bytes,
    key,
    reopen,
    upload,
    version,
)

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import AuditEvent
from workshop.application import orders, photos
from workshop.domain.photo_rules import MAX_PHOTOS_PER_ORDER
from workshop.models import MaintenanceOrder, OrderPhoto

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(manager, artisan, customer, vehicle) -> dict[str, Any]:  # type: ignore[no-untyped-def]
    return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)


def attach(actor: Any, order_id: int, content: bytes | None = None, **extra: Any) -> dict[str, Any]:
    extra.setdefault("idempotency_key", key())
    return photos.upload_photo(
        actor=actor,
        order_id=order_id,
        file=upload(content or image_bytes()),
        description=extra.pop("description", None),
        idempotency_key=extra["idempotency_key"],
    ).body


def remove(actor: Any, order_id: int, photo_id: int, **payload: Any) -> dict[str, Any]:
    payload.setdefault("idempotency_key", key())
    return photos.remove_photo(
        actor=actor, order_id=order_id, photo_id=photo_id, payload=payload
    ).body


def files_in(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*") if p.is_file()) if root.exists() else []


def finalize_order(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk)
    orders.update_order(
        actor=manager,
        order_id=order["id"],
        payload={
            "diagnosis": "Frenos",
            "expected_version": version(order["id"]),
            "idempotency_key": key(),
        },
    )
    finalize(manager, order["id"])


def test_valid_upload(manager, order, private_media) -> None:  # type: ignore[no-untyped-def]
    body = attach(manager, order["id"], description="  Golpe en puerta trasera ")
    [photo] = body["photos"]
    assert photo["description"] == "Golpe en puerta trasera"
    assert photo["uploaded_by"]["id"] == manager.pk
    assert photo["file_url"].endswith(f"/photos/{photo['id']}/file/")
    stored = OrderPhoto.objects.get()
    assert stored.intervention.kind == "INITIAL"
    assert len(files_in(private_media)) == 2
    assert body["version"] == order["version"]


def test_description_limit(manager, order, private_media) -> None:  # type: ignore[no-untyped-def]
    error = error_of(lambda: attach(manager, order["id"], description="x" * 201))
    assert "description" in error.errors
    assert files_in(private_media) == []


def test_invalid_file_leaves_nothing(manager, order, private_media) -> None:  # type: ignore[no-untyped-def]
    assert error_of(lambda: attach(manager, order["id"], b"%PDF-1.4")).code == "invalid_image"
    assert not OrderPhoto.objects.exists()
    assert files_in(private_media) == []


def test_photo_limit(manager, order) -> None:  # type: ignore[no-untyped-def]
    for _ in range(MAX_PHOTOS_PER_ORDER):
        attach(manager, order["id"])
    error = error_of(lambda: attach(manager, order["id"]))
    assert error.code == "photo_limit_reached"
    first = OrderPhoto.objects.first()
    assert first is not None
    remove(manager, order["id"], first.pk)
    attach(manager, order["id"])
    assert OrderPhoto.objects.filter(removed_at__isnull=True).count() == MAX_PHOTOS_PER_ORDER


def test_finalized_order_rejects_upload_without_files(  # type: ignore[no-untyped-def]
    manager, order, make_service, private_media
) -> None:
    finalize_order(manager, order, make_service)
    assert error_of(lambda: attach(manager, order["id"])).code == "not_editable"
    assert files_in(private_media) == []


def test_database_failure_after_writing_files_leaves_nothing(  # type: ignore[no-untyped-def]
    manager, order, private_media, monkeypatch
) -> None:
    def boom(*_: Any, **__: Any) -> Any:
        raise RuntimeError("fallo simulado de base")

    monkeypatch.setattr(OrderPhoto.objects, "create", boom)
    with pytest.raises(RuntimeError):
        attach(manager, order["id"])
    monkeypatch.undo()
    assert not OrderPhoto.objects.exists()
    assert files_in(private_media) == []


def test_idempotent_retry(manager, order, private_media) -> None:  # type: ignore[no-untyped-def]
    content = image_bytes()
    attach(manager, order["id"], content, idempotency_key="photo-retry-1")
    again = photos.upload_photo(
        actor=manager,
        order_id=order["id"],
        file=upload(content),
        description=None,
        idempotency_key="photo-retry-1",
    )
    assert again.replayed
    assert OrderPhoto.objects.count() == 1
    assert len(files_in(private_media)) == 2


def test_remove_is_audited_and_deletes_files(  # type: ignore[no-untyped-def]
    manager, order, private_media, django_capture_on_commit_callbacks
) -> None:
    photo_id = attach(manager, order["id"])["photos"][0]["id"]
    with django_capture_on_commit_callbacks(execute=True):
        body = remove(manager, order["id"], photo_id)
    assert body["photos"] == []
    stored = OrderPhoto.objects.get(pk=photo_id)
    assert stored.removed_by == manager
    assert stored.removed_at is not None
    assert files_in(private_media) == []
    assert (
        AuditEvent.objects.filter(action="maintenance.photo_remove", result="SUCCESS").count() == 1
    )
    with django_capture_on_commit_callbacks(execute=True):
        remove(manager, order["id"], photo_id)
    assert (
        AuditEvent.objects.filter(action="maintenance.photo_remove", result="SUCCESS").count() == 1
    )


def test_initial_photos_kept_while_reopened(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    photo_id = attach(manager, order["id"])["photos"][0]["id"]
    finalize_order(manager, order, make_service)
    assert error_of(lambda: remove(manager, order["id"], photo_id)).code == "not_editable"
    reopen(manager, order["id"])
    assert error_of(lambda: remove(manager, order["id"], photo_id)).code == "not_editable"
    body = attach(manager, order["id"])
    assert len(body["photos"]) == 2
    corrective = OrderPhoto.objects.exclude(pk=photo_id).get()
    assert corrective.intervention.kind == "CORRECTIVE"
    remove(manager, order["id"], corrective.pk)
    assert OrderPhoto.objects.get(pk=photo_id).removed_at is None


def test_seller_cannot_upload_or_remove(seller, manager, order) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(BusinessPermissionDeniedError):
        attach(seller, order["id"])
    photo_id = attach(manager, order["id"])["photos"][0]["id"]
    with pytest.raises(BusinessPermissionDeniedError):
        remove(seller, order["id"], photo_id)


def test_open_file_requires_permission_and_active_photo(manager, seller, order) -> None:  # type: ignore[no-untyped-def]
    photo_id = attach(manager, order["id"])["photos"][0]["id"]
    handle, content_type = photos.open_photo(
        actor=manager, order_id=order["id"], photo_id=photo_id, thumbnail=False
    )
    with handle:
        assert handle.read(3) == b"\xff\xd8\xff"
    assert content_type == "image/jpeg"
    thumb, thumb_type = photos.open_photo(
        actor=manager, order_id=order["id"], photo_id=photo_id, thumbnail=True
    )
    thumb.close()
    assert thumb_type == "image/webp"
    with pytest.raises(BusinessPermissionDeniedError):
        photos.open_photo(actor=seller, order_id=order["id"], photo_id=photo_id, thumbnail=False)
    assert (
        error_of(
            lambda: photos.open_photo(
                actor=manager, order_id=order["id"] + 99, photo_id=photo_id, thumbnail=False
            )
        ).code
        == "not_found"
    )
    MaintenanceOrder.objects.filter(pk=order["id"])  # la orden permanece consultable
