"""Anulación administrativa de la operación artesanal y cadena de reemplazo."""

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.utils import timezone
from tests.workshop.workshop_helpers import (
    add_line,
    confirm_services,
    create,
    error_of,
    key,
    lines_of,
    preview_services,
    update_line,
)

from identity.application.authorization import BusinessPermissionDeniedError
from workshop.application import service_operations
from workshop.models import ArtisanPayment, ServiceOperation, ServiceOperationLine

pytestmark = pytest.mark.django_db


@pytest.fixture
def documented(manager, artisan_billing, customer, vehicle, make_service) -> dict[str, Any]:  # type: ignore[no-untyped-def]
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=5)
    [line] = lines_of(
        add_line(manager, order["id"], service_id=make_service().pk, applied_price="40.00")
    )
    operation = confirm_services(manager, order["id"], "CREDITO")
    return {"order": order, "line": line, "operation": operation}


def _void(actor: Any, operation_id: int, **payload: Any) -> Any:
    payload.setdefault("reason", "Precio aplicado equivocado")
    payload.setdefault("expected_version", 1)
    payload.setdefault("idempotency_key", key())
    return service_operations.void_operation(
        actor=actor, operation_id=operation_id, payload=payload
    )


def test_admin_voids_and_releases_lines(admin, documented) -> None:  # type: ignore[no-untyped-def]
    body = _void(admin, documented["operation"]["id"]).body

    assert (body["state"], body["internal_number"]) == ("VOIDED", "ART-SER-000001")
    assert (body["balance"], body["void_reason"]) == ("0.00", "Precio aplicado equivocado")
    assert body["voided_by"]["id"] == admin.pk
    assert not ServiceOperationLine.objects.filter(is_current=True).exists()
    preview = service_operations.void_preview(actor=admin, operation_id=body["id"])
    assert preview["can_void"] is False


def test_void_is_blocked_by_effective_payments(admin, documented) -> None:  # type: ignore[no-untyped-def]
    operation = ServiceOperation.objects.get(pk=documented["operation"]["id"])
    now = timezone.now()
    ArtisanPayment.objects.create(
        operation_id=uuid.uuid4(),
        service_operation=operation,
        amount=Decimal("30.00"),
        effective_at=now,
        effective_date=now.date(),
        created_by=admin,
    )
    preview = service_operations.void_preview(actor=admin, operation_id=operation.pk)
    assert preview["can_void"] is False
    assert preview["blockers"]

    error = error_of(lambda: _void(admin, operation.pk))

    assert error.code == "payments_block_void"
    operation.refresh_from_db()
    assert operation.state == "CONFIRMED"


def test_manager_cannot_void(manager, documented) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(BusinessPermissionDeniedError):
        _void(manager, documented["operation"]["id"])
    assert ServiceOperation.objects.get().state == "CONFIRMED"


def test_void_requires_reason_and_retry_is_idempotent(admin, documented) -> None:  # type: ignore[no-untyped-def]
    operation_id = documented["operation"]["id"]
    assert error_of(lambda: _void(admin, operation_id, reason="  ")).code == "validation_error"
    request_key = key()
    first = _void(admin, operation_id, idempotency_key=request_key)
    second = _void(admin, operation_id, idempotency_key=request_key)
    assert second.replayed
    assert first.body["id"] == second.body["id"]
    assert error_of(lambda: _void(admin, operation_id)).code == "invalid_state"


def test_redocumenting_after_void_records_replacement(  # type: ignore[no-untyped-def]
    manager, admin, documented
) -> None:
    order_id = documented["order"]["id"]
    _void(admin, documented["operation"]["id"])
    update_line(manager, order_id, documented["line"]["id"], applied_price="35.00")
    warnings = preview_services(manager, order_id, "CREDITO")["warnings"]
    assert [w["code"] for w in warnings] == ["replaces_voided"]

    replacement = confirm_services(manager, order_id, "CREDITO")

    assert replacement["internal_number"] == "ART-SER-000002"
    assert replacement["replaces"] == {
        "id": documented["operation"]["id"],
        "internal_number": "ART-SER-000001",
    }
    original = service_operations.get_operation(
        actor=admin, operation_id=documented["operation"]["id"]
    )
    assert original["replaced_by"] == [
        {"id": replacement["id"], "internal_number": "ART-SER-000002"}
    ]
