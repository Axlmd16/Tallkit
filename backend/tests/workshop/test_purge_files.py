"""Limpieza recuperable de archivos huérfanos de fotografías."""

import os
import time
from pathlib import Path
from typing import Any

import pytest
from django.core.management import call_command
from tests.workshop.workshop_helpers import create, image_bytes, key, upload

from workshop.application import photos
from workshop.models import OrderPhoto

pytestmark = pytest.mark.django_db


def age(path: Path, seconds: int) -> None:
    past = time.time() - seconds
    os.utime(path, (past, past))


def test_purge_removes_only_old_orphans(manager, artisan, customer, vehicle, private_media) -> None:  # type: ignore[no-untyped-def]
    order: dict[str, Any] = create(
        manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=1
    )
    photos.upload_photo(
        actor=manager,
        order_id=order["id"],
        file=upload(image_bytes()),
        description=None,
        idempotency_key=key(),
    )
    folder = private_media / "maintenance" / str(order["id"])
    old_orphan = folder / "huerfano.jpg"
    old_orphan.write_bytes(b"x")
    recent_orphan = folder / "reciente.jpg"
    recent_orphan.write_bytes(b"x")
    for path in folder.iterdir():
        if path != recent_orphan:
            age(path, 7200)
    removed = OrderPhoto.objects.get()
    removed_paths = [private_media / removed.storage_name, private_media / removed.thumbnail_name]

    call_command("purge_workshop_files", "--older-than-minutes", "60")
    assert not old_orphan.exists()
    assert recent_orphan.exists()
    assert all(p.exists() for p in removed_paths)

    OrderPhoto.objects.filter(pk=removed.pk).update(removed_at="2026-01-01T00:00:00Z")
    call_command("purge_workshop_files", "--older-than-minutes", "60")
    assert not any(p.exists() for p in removed_paths)
    call_command("purge_workshop_files", "--older-than-minutes", "60")
    assert recent_orphan.exists()


def test_purge_without_folder_is_harmless(private_media) -> None:  # type: ignore[no-untyped-def]
    call_command("purge_workshop_files")
    assert not private_media.exists()
