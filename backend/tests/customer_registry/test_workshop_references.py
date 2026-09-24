"""Interfaz pública de clientes y vehículos para el taller."""

import dataclasses
from datetime import timedelta

import pytest
from django.db import transaction
from django.utils import timezone

from customer_registry.application.workshop_references import (
    WorkshopReferenceError,
    get_vehicle_summary,
    list_customer_options,
    list_vehicle_options,
    lock_customer_and_vehicle,
)
from customer_registry.models import Customer, OwnershipPeriod, Vehicle, VehicleBrand

pytestmark = pytest.mark.django_db


def make_customer(n: int, **overrides: object) -> Customer:
    values: dict[str, object] = {
        "person_type": "NATURAL",
        "name": f"Cliente {n}",
        "identification_type": "CI",
        "identification": f"17123456{n:02d}",
        "phone": "0999999999",
    }
    values.update(overrides)
    return Customer.objects.create(**values)


@pytest.fixture
def brand() -> VehicleBrand:
    return VehicleBrand.objects.create(name="Toyota")


def make_vehicle(brand: VehicleBrand, owner: Customer, plate: str, **overrides: object) -> Vehicle:
    vehicle = Vehicle.objects.create(plate=plate, brand=brand, model="Hilux", **overrides)
    OwnershipPeriod.objects.create(
        vehicle=vehicle, customer=owner, started_at=timezone.now() - timedelta(days=5)
    )
    return vehicle


@pytest.mark.django_db(transaction=True)
def test_lock_requires_transaction(brand: VehicleBrand) -> None:
    customer = make_customer(1)
    vehicle = make_vehicle(brand, customer, "ABC-1")
    with pytest.raises(RuntimeError):
        lock_customer_and_vehicle(customer.pk, vehicle.pk)


def test_lock_returns_immutable_identifying_data(brand: VehicleBrand) -> None:
    customer = make_customer(1, name="Ana")
    vehicle = make_vehicle(brand, customer, "ABC-1")
    with transaction.atomic():
        pair = lock_customer_and_vehicle(customer.pk, vehicle.pk)
    assert (pair.customer.id, pair.customer.name, pair.customer.identification_type) == (
        customer.pk,
        "Ana",
        "CI",
    )
    assert (pair.vehicle.id, pair.vehicle.plate, pair.vehicle.brand_name, pair.vehicle.model) == (
        vehicle.pk,
        "ABC-1",
        "Toyota",
        "Hilux",
    )
    assert pair.vehicle.current_owner_id == customer.pk
    with pytest.raises(dataclasses.FrozenInstanceError):
        pair.customer.name = "x"  # type: ignore[misc]


@pytest.mark.parametrize(
    ("case", "field", "reason"),
    [
        ("missing_customer", "customer_id", "missing"),
        ("inactive_customer", "customer_id", "inactive"),
        ("missing_vehicle", "vehicle_id", "missing"),
        ("inactive_vehicle", "vehicle_id", "inactive"),
        ("not_owner", "vehicle_id", "not_owner"),
    ],
)
def test_lock_rejects_invalid_references(
    brand: VehicleBrand, case: str, field: str, reason: str
) -> None:
    customer = make_customer(1)
    other = make_customer(2)
    vehicle = make_vehicle(brand, customer, "ABC-1")
    customer_id, vehicle_id = customer.pk, vehicle.pk
    if case == "missing_customer":
        customer_id = 999999
    elif case == "inactive_customer":
        Customer.objects.filter(pk=customer.pk).update(is_active=False)
    elif case == "missing_vehicle":
        vehicle_id = 999999
    elif case == "inactive_vehicle":
        Vehicle.objects.filter(pk=vehicle.pk).update(is_active=False)
    else:
        customer_id = other.pk
    with transaction.atomic(), pytest.raises(WorkshopReferenceError) as error:
        lock_customer_and_vehicle(customer_id, vehicle_id)
    assert (error.value.field, error.value.reason) == (field, reason)


def test_customer_options_are_active_and_searchable() -> None:
    make_customer(1, name="Ana Uno")
    make_customer(2, name="Ana Dos", is_active=False)
    make_customer(3, name="Luis", identification="0102030405")
    page = list_customer_options(search="ana", page=1, page_size=10)
    assert [c.name for c in page.items] == ["Ana Uno"]
    assert list_customer_options(search="0102", page=1, page_size=10).total_count == 1


def test_vehicle_options_only_active_currently_owned(brand: VehicleBrand) -> None:
    ana = make_customer(1)
    luis = make_customer(2)
    make_vehicle(brand, ana, "AAA-1")
    make_vehicle(brand, ana, "AAA-2", is_active=False)
    sold = make_vehicle(brand, ana, "AAA-3")
    OwnershipPeriod.objects.filter(vehicle=sold).update(ended_at=timezone.now())
    OwnershipPeriod.objects.create(vehicle=sold, customer=luis, started_at=timezone.now())
    assert [v.plate for v in list_vehicle_options(ana.pk)] == ["AAA-1"]
    assert [v.plate for v in list_vehicle_options(luis.pk)] == ["AAA-3"]


def test_vehicle_summary_includes_inactive(brand: VehicleBrand) -> None:
    ana = make_customer(1)
    vehicle = make_vehicle(brand, ana, "AAA-1", is_active=False)
    summary = get_vehicle_summary(vehicle.pk)
    assert summary is not None
    assert (summary.plate, summary.is_active) == ("AAA-1", False)
    assert get_vehicle_summary(999999) is None
