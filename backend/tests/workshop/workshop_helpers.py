"""Ayudas compartidas por las pruebas del taller."""

from itertools import count
from typing import Any

import pytest
from django.utils import timezone

from customer_registry.models import Customer, OwnershipPeriod, Vehicle
from workshop.application import orders, service_lines, transitions
from workshop.application.errors import WorkshopError
from workshop.models import MaintenanceOrder

_keys = count(1)


def key() -> str:
    return f"hk-{next(_keys):08d}"


def version(order_id: int) -> int:
    return MaintenanceOrder.objects.get(pk=order_id).version


def create(actor: Any, **payload: Any) -> dict[str, Any]:
    payload.setdefault("idempotency_key", key())
    return orders.create_order(actor=actor, payload=payload).body


def add_line(actor: Any, order_id: int, **payload: Any) -> dict[str, Any]:
    payload.setdefault("idempotency_key", key())
    payload.setdefault("expected_version", version(order_id))
    return service_lines.add_line(actor=actor, order_id=order_id, payload=payload).body


def update_line(actor: Any, order_id: int, line_id: int, **payload: Any) -> dict[str, Any]:
    payload.setdefault("idempotency_key", key())
    payload.setdefault("expected_version", version(order_id))
    return service_lines.update_line(
        actor=actor, order_id=order_id, line_id=line_id, payload=payload
    ).body


def remove_line(actor: Any, order_id: int, line_id: int, **payload: Any) -> dict[str, Any]:
    payload.setdefault("idempotency_key", key())
    payload.setdefault("expected_version", version(order_id))
    return service_lines.remove_line(
        actor=actor, order_id=order_id, line_id=line_id, payload=payload
    ).body


def finalize(actor: Any, order_id: int, **payload: Any) -> dict[str, Any]:
    payload.setdefault("idempotency_key", key())
    payload.setdefault("expected_version", version(order_id))
    return transitions.finalize_order(actor=actor, order_id=order_id, payload=payload).body


def reopen(actor: Any, order_id: int, **payload: Any) -> dict[str, Any]:
    payload.setdefault("idempotency_key", key())
    payload.setdefault("expected_version", version(order_id))
    payload.setdefault("reason", "Ruido tras cambio de pastillas")
    return transitions.reopen_order(actor=actor, order_id=order_id, payload=payload).body


def update_intervention(actor: Any, order_id: int, **payload: Any) -> dict[str, Any]:
    payload.setdefault("idempotency_key", key())
    payload.setdefault("expected_version", version(order_id))
    return transitions.update_current_intervention(
        actor=actor, order_id=order_id, payload=payload
    ).body


def error_of(call: Any) -> WorkshopError:
    with pytest.raises(WorkshopError) as error:
        call()
    return error.value


def lines_of(body: dict[str, Any], ordinal: int = 1) -> list[dict[str, Any]]:
    intervention = next(i for i in body["interventions"] if i["ordinal"] == ordinal)
    lines: list[dict[str, Any]] = intervention["lines"]
    return lines


def transfer(vehicle: Vehicle, new_owner: Customer) -> None:
    now = timezone.now()
    OwnershipPeriod.objects.filter(vehicle=vehicle, ended_at__isnull=True).update(ended_at=now)
    OwnershipPeriod.objects.create(vehicle=vehicle, customer=new_owner, started_at=now)


def image_bytes(fmt: str = "JPEG", size: tuple[int, int] = (64, 48), **save: Any) -> bytes:
    from io import BytesIO

    from PIL import Image

    buffer = BytesIO()
    mode = "RGBA" if fmt in {"PNG", "WEBP"} else "RGB"
    Image.new(mode, size, (200, 30, 30)).save(buffer, format=fmt, **save)
    return buffer.getvalue()


def animated_bytes(fmt: str) -> bytes:
    from io import BytesIO

    from PIL import Image

    buffer = BytesIO()
    frames = [Image.new("RGB", (16, 16), color) for color in ((255, 0, 0), (0, 255, 0))]
    frames[0].save(buffer, format=fmt, save_all=True, append_images=frames[1:], duration=100)
    return buffer.getvalue()


def upload(content: bytes, name: str = "foto.jpg", content_type: str = "image/jpeg") -> Any:
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(name, content, content_type=content_type)
