"""Creación y edición de órdenes: relaciones, numeración, kilometraje y concurrencia optimista."""

from datetime import timedelta
from itertools import count
from typing import Any

import pytest

from customer_registry.models import Customer, OwnershipPeriod, Vehicle
from workshop.application import orders
from workshop.application.errors import WorkshopError
from workshop.models import Intervention, MaintenanceCounter, MaintenanceOrder
from workshop_configuration.models import FiscalEntity

pytestmark = pytest.mark.django_db
_keys = count(1)


def key() -> str:
    return f"key-{next(_keys):06d}"


def create(actor: Any, **payload: Any) -> dict[str, Any]:
    payload.setdefault("idempotency_key", key())
    return orders.create_order(actor=actor, payload=payload).body


def update(actor: Any, order_id: int, **payload: Any) -> dict[str, Any]:
    payload.setdefault("idempotency_key", key())
    return orders.update_order(actor=actor, order_id=order_id, payload=payload).body


def error_of(call) -> WorkshopError:  # type: ignore[no-untyped-def]
    with pytest.raises(WorkshopError) as error:
        call()
    return error.value


@pytest.fixture
def base(artisan, customer, vehicle):  # type: ignore[no-untyped-def]
    return {"customer_id": customer.pk, "vehicle_id": vehicle.pk, "odometer_km": 85000}


def test_create_valid_order(manager, base, customer, vehicle, today) -> None:  # type: ignore[no-untyped-def]
    body = create(manager, **base)
    order = MaintenanceOrder.objects.get(pk=body["id"])
    assert (order.state, order.number, order.sequence) == ("REGISTERED", "ART-OT-000001", 1)
    assert order.fiscal_entity.entity_type == "ARTESANAL"
    assert (order.opened_on, order.odometer_km, order.diagnosis) == (today, 85000, "")
    assert order.created_by == manager
    assert order.updated_by == manager
    assert order.customer_snapshot == {
        "schema_version": 1,
        "name": "Ana Pérez",
        "identification_type": "CI",
        "identification": "1712345678",
    }
    assert order.vehicle_snapshot == {
        "schema_version": 1,
        "plate": "ABC-1234",
        "brand": "Toyota",
        "model": "Hilux",
    }
    initial = Intervention.objects.get(order=order)
    assert (initial.kind, initial.ordinal, initial.closed_at) == ("INITIAL", 1, None)
    assert body["number"] == "ART-OT-000001"
    assert body["allowed_actions"][0] == "edit"
    assert MaintenanceCounter.objects.get().last_number == 1
    assert OwnershipPeriod.objects.get(vehicle=vehicle, ended_at__isnull=True).customer == customer


def test_vehicle_of_another_owner_is_rejected(manager, base, make_customer, vehicle) -> None:  # type: ignore[no-untyped-def]
    other = make_customer()
    error = error_of(lambda: create(manager, **{**base, "customer_id": other.pk}))
    assert (error.code, list(error.errors)) == ("validation_error", ["vehicle_id"])
    assert not MaintenanceOrder.objects.exists()
    assert MaintenanceCounter.objects.get().last_number == 0
    assert vehicle.current_owner != other


@pytest.mark.parametrize("which", ["customer", "vehicle"])
def test_inactive_references_are_rejected(manager, base, customer, vehicle, which) -> None:  # type: ignore[no-untyped-def]
    model = Customer if which == "customer" else Vehicle
    target = customer if which == "customer" else vehicle
    model.objects.filter(pk=target.pk).update(is_active=False)
    error = error_of(lambda: create(manager, **base))
    assert error.code == "inactive_reference"
    assert f"{which}_id" in error.errors


def test_future_date_and_missing_fields(manager, base, today) -> None:  # type: ignore[no-untyped-def]
    tomorrow = (today + timedelta(days=1)).isoformat()
    error = error_of(lambda: create(manager, customer_id=base["customer_id"], opened_on=tomorrow))
    assert {"vehicle_id", "opened_on", "odometer_km"} <= set(error.errors)


def test_missing_artisan_configuration(manager, customer, vehicle) -> None:  # type: ignore[no-untyped-def]
    assert not FiscalEntity.objects.filter(entity_type="ARTESANAL").exists()
    payload = {"customer_id": customer.pk, "vehicle_id": vehicle.pk, "odometer_km": 1}
    assert error_of(lambda: create(manager, **payload)).code == "configuration_missing"


def test_second_open_order_for_vehicle(manager, base) -> None:  # type: ignore[no-untyped-def]
    first = create(manager, **base)
    error = error_of(lambda: create(manager, **base))
    assert error.code == "open_order_exists"
    assert error.conflict == {"type": "maintenance_order", "id": first["id"]}
    assert "ART-OT-000001" in error.message
    assert MaintenanceCounter.objects.get().last_number == 1


def test_numbers_are_consecutive(manager, base, make_vehicle, customer) -> None:  # type: ignore[no-untyped-def]
    create(manager, **base)
    other = make_vehicle(customer)
    body = create(manager, **{**base, "vehicle_id": other.pk})
    assert body["number"] == "ART-OT-000002"


def test_idempotent_retry_creates_one_order(manager, base) -> None:  # type: ignore[no-untyped-def]
    first = create(manager, **base, idempotency_key="same-key-1")
    again = orders.create_order(actor=manager, payload={**base, "idempotency_key": "same-key-1"})
    assert again.replayed
    assert again.body["id"] == first["id"]
    assert MaintenanceOrder.objects.count() == 1


def finalize_previous(order_id: int, km: int, opened_on: Any) -> None:
    MaintenanceOrder.objects.filter(pk=order_id).update(
        state="FINALIZED", odometer_km=km, opened_on=opened_on
    )


def test_lower_odometer_requires_confirmation(manager, base, today) -> None:  # type: ignore[no-untyped-def]
    previous = create(manager, **base)
    finalize_previous(previous["id"], 90000, today - timedelta(days=30))
    error = error_of(lambda: create(manager, **{**base, "odometer_km": 80000}))
    assert error.code == "odometer_confirmation_required"
    assert error.details == {
        "last_known_km": 90000,
        "order_id": previous["id"],
        "order_number": "ART-OT-000001",
    }
    assert MaintenanceOrder.objects.count() == 1
    body = create(manager, **{**base, "odometer_km": 80000, "odometer_confirmed": True})
    order = MaintenanceOrder.objects.get(pk=body["id"])
    assert order.odometer_km == 80000
    assert order.odometer_confirmed_by == manager
    assert order.odometer_confirmed_at is not None


def test_editing_does_not_touch_previous_orders(manager, base, today) -> None:  # type: ignore[no-untyped-def]
    first = create(manager, **base)
    finalize_previous(first["id"], 50000, today - timedelta(days=60))
    current = create(manager, **{**base, "odometer_km": 70000})
    update(manager, current["id"], odometer_km=71000, expected_version=current["version"])
    assert MaintenanceOrder.objects.get(pk=first["id"]).odometer_km == 50000
    assert not hasattr(Vehicle, "odometer_km")


def test_progressive_diagnosis(manager, base) -> None:  # type: ignore[no-untyped-def]
    created = create(manager, **base)
    body = update(manager, created["id"], diagnosis="  Ruido  ", expected_version=1)
    assert (body["diagnosis"], body["state"], body["version"]) == ("Ruido", "REGISTERED", 2)
    order = MaintenanceOrder.objects.get(pk=created["id"])
    assert order.updated_at > order.created_at


def test_change_vehicle_updates_snapshot(manager, base, make_vehicle, customer) -> None:  # type: ignore[no-untyped-def]
    created = create(manager, **base)
    other = make_vehicle(customer, plate="XYZ-9", model="Corolla")
    update(manager, created["id"], vehicle_id=other.pk, expected_version=1)
    order = MaintenanceOrder.objects.get(pk=created["id"])
    assert (order.vehicle_id, order.vehicle_snapshot["plate"]) == (other.pk, "XYZ-9")


def test_stale_version_is_rejected(manager, admin, base) -> None:  # type: ignore[no-untyped-def]
    created = create(manager, **base)
    update(admin, created["id"], diagnosis="Primero", expected_version=1)
    error = error_of(
        lambda: update(manager, created["id"], diagnosis="Segundo", expected_version=1)
    )
    assert error.code == "stale_record"
    assert MaintenanceOrder.objects.get(pk=created["id"]).diagnosis == "Primero"


@pytest.mark.parametrize("field", ["state", "number", "created_by", "updated_at"])
def test_system_fields_are_rejected(manager, base, field) -> None:  # type: ignore[no-untyped-def]
    created = create(manager, **base)
    error = error_of(lambda: update(manager, created["id"], expected_version=1, **{field: "X"}))
    assert error.code == "unknown_field"
    assert MaintenanceOrder.objects.get(pk=created["id"]).state == "REGISTERED"


@pytest.mark.parametrize("state", ["FINALIZED", "REOPENED"])
def test_general_data_not_editable_outside_registered(manager, base, state) -> None:  # type: ignore[no-untyped-def]
    created = create(manager, **base)
    MaintenanceOrder.objects.filter(pk=created["id"]).update(state=state)
    error = error_of(lambda: update(manager, created["id"], diagnosis="x", expected_version=1))
    assert error.code == "not_editable"


def test_missing_order_is_not_found(manager, artisan) -> None:  # type: ignore[no-untyped-def]
    assert error_of(lambda: update(manager, 999999, expected_version=1)).code == "not_found"


def test_customer_and_vehicle_locked_by_linked_documents(  # type: ignore[no-untyped-def]
    manager, seller, base, make_vehicle, customer, stocked
) -> None:
    from tests.workshop.workshop_helpers import add_part, confirm_linked_sale, version

    created = create(manager, **base)
    add_part(manager, created["id"], stocked(5).pk, 1)
    confirmed = confirm_linked_sale(seller, created["id"])
    other = make_vehicle(customer, plate="XYZ-9", model="Corolla")

    error = error_of(
        lambda: update(
            manager, created["id"], vehicle_id=other.pk, expected_version=version(created["id"])
        )
    )

    assert error.code == "customer_locked_by_documents"
    assert confirmed["internal_number"] in error.message + str(error.errors)
    update(
        manager, created["id"], diagnosis="Sigue editable", expected_version=version(created["id"])
    )
    assert MaintenanceOrder.objects.get(pk=created["id"]).diagnosis == "Sigue editable"


def test_open_linked_sale_with_lines_blocks_customer_change(  # type: ignore[no-untyped-def]
    manager, base, make_vehicle, customer, stocked
) -> None:
    from tests.workshop.workshop_helpers import add_part, version

    created = create(manager, **base)
    add_part(manager, created["id"], stocked(5).pk, 1)
    other = make_vehicle(customer, plate="XYZ-8", model="Yaris")
    error = error_of(
        lambda: update(
            manager, created["id"], vehicle_id=other.pk, expected_version=version(created["id"])
        )
    )
    assert error.code == "customer_locked_by_documents"


def test_confirmed_service_operation_locks_customer(  # type: ignore[no-untyped-def]
    manager, base, make_vehicle, customer, make_service, artisan_billing
) -> None:
    from tests.workshop.workshop_helpers import add_line, confirm_services, version

    created = create(manager, **base)
    add_line(manager, created["id"], service_id=make_service().pk)
    operation = confirm_services(manager, created["id"])
    other = make_vehicle(customer, plate="XYZ-7", model="Rav4")
    error = error_of(
        lambda: update(
            manager, created["id"], vehicle_id=other.pk, expected_version=version(created["id"])
        )
    )
    assert error.code == "customer_locked_by_documents"
    assert operation["internal_number"] in error.message
