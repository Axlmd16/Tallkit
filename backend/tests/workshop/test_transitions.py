"""Finalización, reapertura e intervención correctiva."""

from typing import Any

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    create,
    error_of,
    finalize,
    lines_of,
    reopen,
    update_intervention,
    version,
)

from workshop.application import orders, transitions
from workshop.models import Intervention, MaintenanceOrder, StateTransition

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(manager, artisan, customer, vehicle) -> dict[str, Any]:  # type: ignore[no-untyped-def]
    return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)


def complete(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk)
    add_line(manager, order["id"], service_id=make_service().pk)
    orders.update_order(
        actor=manager,
        order_id=order["id"],
        payload={
            "diagnosis": "Pastillas gastadas",
            "expected_version": version(order["id"]),
            "idempotency_key": "diag-0001",
        },
    )


def test_incomplete_order_lists_requirements(manager, order) -> None:  # type: ignore[no-untyped-def]
    error = error_of(lambda: finalize(manager, order["id"]))
    assert error.code == "finalize_requirements"
    assert set(error.errors["requirements"]) == {
        "Registre el diagnóstico.",
        "Agregue al menos un servicio.",
    }
    assert error.details == {"pending": ["diagnosis", "service_lines"]}
    assert MaintenanceOrder.objects.get(pk=order["id"]).state == "REGISTERED"
    assert not StateTransition.objects.exists()


def test_finalize_complete_order(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    complete(manager, order, make_service)
    body = finalize(manager, order["id"])
    assert body["state"] == "FINALIZED"
    assert body["last_finalized_by"]["id"] == manager.pk
    assert body["allowed_actions"] == ["reopen"]
    [transition] = body["transitions"]
    assert (transition["from_state"], transition["to_state"], transition["actor"]["id"]) == (
        "REGISTERED",
        "FINALIZED",
        manager.pk,
    )
    assert Intervention.objects.get(order_id=order["id"]).closed_at is not None


def test_repeated_finalization_is_idempotent(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    complete(manager, order, make_service)
    payload: dict[str, Any] = {
        "expected_version": version(order["id"]),
        "idempotency_key": "fin-retry-1",
    }
    transitions.finalize_order(actor=manager, order_id=order["id"], payload=dict(payload))
    again = transitions.finalize_order(actor=manager, order_id=order["id"], payload=dict(payload))
    assert again.replayed
    assert again.body["state"] == "FINALIZED"
    assert StateTransition.objects.count() == 1
    other = error_of(
        lambda: finalize(manager, order["id"], expected_version=payload["expected_version"] + 1)
    )
    assert other.code == "invalid_state"


def test_reopen_requires_reason(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    complete(manager, order, make_service)
    finalize(manager, order["id"])
    error = error_of(lambda: reopen(manager, order["id"], reason="   "))
    assert "reason" in error.errors
    assert MaintenanceOrder.objects.get(pk=order["id"]).state == "FINALIZED"


def test_reopen_only_from_finalized(manager, order) -> None:  # type: ignore[no-untyped-def]
    assert error_of(lambda: reopen(manager, order["id"])).code == "invalid_state"


def test_reopen_blocked_by_other_open_order(  # type: ignore[no-untyped-def]
    manager, order, make_service, customer, vehicle
) -> None:
    complete(manager, order, make_service)
    finalize(manager, order["id"])
    other = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=200)
    error = error_of(lambda: reopen(manager, order["id"]))
    assert error.code == "open_order_exists"
    assert error.conflict == {"type": "maintenance_order", "id": other["id"]}
    assert MaintenanceOrder.objects.get(pk=order["id"]).state == "FINALIZED"


def test_reopen_after_transfer_keeps_customer(  # type: ignore[no-untyped-def]
    manager, order, make_service, make_customer, vehicle, customer
) -> None:
    from tests.workshop.workshop_helpers import transfer

    complete(manager, order, make_service)
    finalize(manager, order["id"])
    transfer(vehicle, make_customer())
    body = reopen(manager, order["id"])
    assert (body["state"], body["customer"]["id"]) == ("REOPENED", customer.pk)


def test_full_cycle_preserves_history(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    complete(manager, order, make_service)
    finalize(manager, order["id"])
    body = reopen(manager, order["id"], reason="Ruido tras cambio de pastillas")
    assert body["allowed_actions"] == [
        "edit_intervention",
        "manage_services",
        "manage_photos",
        "finalize",
    ]
    corrective = body["interventions"][1]
    assert (corrective["kind"], corrective["cause"], corrective["is_open"]) == (
        "CORRECTIVE",
        "Ruido tras cambio de pastillas",
        True,
    )
    assert error_of(lambda: finalize(manager, order["id"])).details == {
        "pending": ["work_performed"]
    }
    update_intervention(
        manager, order["id"], work_performed="Ajuste de calipers", notes="Sin cargo"
    )
    body = finalize(manager, order["id"])
    assert body["number"] == order["number"]
    assert len(lines_of(body)) == 2
    assert [(t["from_state"], t["to_state"]) for t in body["transitions"]] == [
        ("REGISTERED", "FINALIZED"),
        ("FINALIZED", "REOPENED"),
        ("REOPENED", "FINALIZED"),
    ]
    assert body["transitions"][1]["reason"] == "Ruido tras cambio de pastillas"
    assert body["diagnosis"] == "Pastillas gastadas"
    initial = Intervention.objects.get(order_id=order["id"], kind="INITIAL")
    assert initial.closed_at is not None


def test_intervention_update_only_when_reopened(manager, order) -> None:  # type: ignore[no-untyped-def]
    error = error_of(lambda: update_intervention(manager, order["id"], work_performed="x"))
    assert error.code == "not_editable"


def test_initial_intervention_locked_while_reopened(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    complete(manager, order, make_service)
    finalize(manager, order["id"])
    reopen(manager, order["id"])
    error = error_of(
        lambda: orders.update_order(
            actor=manager,
            order_id=order["id"],
            payload={
                "diagnosis": "Otro",
                "expected_version": version(order["id"]),
                "idempotency_key": "x-000001",
            },
        )
    )
    assert error.code == "not_editable"
    assert MaintenanceOrder.objects.get(pk=order["id"]).diagnosis == "Pastillas gastadas"


def test_seller_cannot_reopen(seller, manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    from identity.application.authorization import BusinessPermissionDeniedError

    complete(manager, order, make_service)
    finalize(manager, order["id"])
    with pytest.raises(BusinessPermissionDeniedError):
        reopen(seller, order["id"])
    assert MaintenanceOrder.objects.get(pk=order["id"]).state == "FINALIZED"
