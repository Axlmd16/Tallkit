"""Concurrencia real sobre PostgreSQL: numeración, orden abierta única, transiciones y fotos."""

from typing import Any

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    create,
    finalize,
    image_bytes,
    key,
    upload,
    version,
)

from customer_registry.application.vehicles import transfer_vehicle_ownership
from customer_registry.models import Vehicle
from workshop.application import orders, photos, transitions
from workshop.models import (
    Intervention,
    MaintenanceCounter,
    MaintenanceOrder,
    OrderPhoto,
    StateTransition,
)

pytestmark = pytest.mark.django_db(transaction=True)


def outcome(results: list[tuple[str, Any]]) -> list[str]:
    return sorted("ok" if s == "ok" else getattr(v, "code", type(v).__name__) for s, v in results)


def complete_order(manager: Any, customer: Any, vehicle: Any, service: Any) -> dict[str, Any]:
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=10)
    add_line(manager, order["id"], service_id=service.pk)
    orders.update_order(
        actor=manager,
        order_id=order["id"],
        payload={
            "diagnosis": "Original",
            "expected_version": version(order["id"]),
            "idempotency_key": key(),
        },
    )
    return order


def test_parallel_creations_get_distinct_consecutive_numbers(  # type: ignore[no-untyped-def]
    run_parallel, manager, artisan, customer, make_vehicle
) -> None:
    first, second = make_vehicle(customer), make_vehicle(customer)
    results = run_parallel(
        lambda: create(manager, customer_id=customer.pk, vehicle_id=first.pk, odometer_km=1),
        lambda: create(manager, customer_id=customer.pk, vehicle_id=second.pk, odometer_km=1),
    )
    assert outcome(results) == ["ok", "ok"]
    numbers = sorted(MaintenanceOrder.objects.values_list("number", flat=True))
    assert numbers == ["ART-OT-000001", "ART-OT-000002"]


def test_parallel_creations_for_same_vehicle_create_one(  # type: ignore[no-untyped-def]
    run_parallel, manager, admin, artisan, customer, vehicle
) -> None:
    results = run_parallel(
        lambda: create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=1),
        lambda: create(admin, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=1),
    )
    assert outcome(results) == ["ok", "open_order_exists"]
    assert MaintenanceOrder.objects.count() == 1
    assert MaintenanceCounter.objects.get().last_number == 1


def test_edit_and_finalize_never_modify_a_finalized_order(  # type: ignore[no-untyped-def]
    run_parallel, manager, admin, artisan, customer, vehicle, make_service
) -> None:
    order = complete_order(manager, customer, vehicle, make_service())
    current = version(order["id"])
    results = run_parallel(
        lambda: orders.update_order(
            actor=admin,
            order_id=order["id"],
            payload={"notes": "Tarde", "expected_version": current, "idempotency_key": key()},
        ),
        lambda: transitions.finalize_order(
            actor=manager,
            order_id=order["id"],
            payload={"expected_version": current, "idempotency_key": key()},
        ),
    )
    assert outcome(results).count("ok") == 1
    stored = MaintenanceOrder.objects.get(pk=order["id"])
    if stored.state == "FINALIZED":
        assert stored.notes == ""
    else:
        assert stored.notes == "Tarde"
        assert not StateTransition.objects.exists()


def test_photo_upload_racing_finalization(  # type: ignore[no-untyped-def]
    run_parallel, manager, admin, artisan, customer, vehicle, make_service, private_media
) -> None:
    order = complete_order(manager, customer, vehicle, make_service())
    current = version(order["id"])
    results = run_parallel(
        lambda: photos.upload_photo(
            actor=admin,
            order_id=order["id"],
            file=upload(image_bytes()),
            description=None,
            idempotency_key=key(),
        ),
        lambda: finalize(manager, order["id"], expected_version=current),
    )
    assert "ok" in outcome(results)
    closed_at = Intervention.objects.get(order_id=order["id"]).closed_at
    assert closed_at is not None
    for photo in OrderPhoto.objects.all():
        assert photo.uploaded_at <= closed_at
    referenced = {
        name
        for pair in OrderPhoto.objects.values_list("storage_name", "thumbnail_name")
        for name in pair
    }
    on_disk = {
        p.relative_to(private_media).as_posix() for p in private_media.rglob("*") if p.is_file()
    }
    assert on_disk == referenced


def test_parallel_reopens_create_one_corrective_intervention(  # type: ignore[no-untyped-def]
    run_parallel, manager, admin, artisan, customer, vehicle, make_service
) -> None:
    order = complete_order(manager, customer, vehicle, make_service())
    finalize(manager, order["id"])
    current = version(order["id"])
    results = run_parallel(
        *(
            lambda actor=actor: transitions.reopen_order(
                actor=actor,
                order_id=order["id"],
                payload={"reason": "Ruido", "expected_version": current, "idempotency_key": key()},
            )
            for actor in (manager, admin)
        )
    )
    assert outcome(results).count("ok") == 1
    assert Intervention.objects.filter(order_id=order["id"], kind="CORRECTIVE").count() == 1
    assert StateTransition.objects.filter(to_state="REOPENED").count() == 1


def test_creation_racing_ownership_transfer_does_not_deadlock(  # type: ignore[no-untyped-def]
    run_parallel, manager, admin, artisan, customer, vehicle, make_customer
) -> None:
    buyer = make_customer()
    vehicle_version = Vehicle.objects.get(pk=vehicle.pk).version
    results = run_parallel(
        lambda: create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=1),
        lambda: transfer_vehicle_ownership(
            vehicle_id=vehicle.pk,
            new_owner_id=buyer.pk,
            expected_version=vehicle_version,
            actor=admin,
        ),
    )
    kinds = outcome(results)
    assert "concurrent_operation" not in kinds
    assert "ok" in kinds
    order = MaintenanceOrder.objects.first()
    if order is not None:
        assert order.customer_id == customer.pk
