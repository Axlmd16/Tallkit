from datetime import timedelta

import pytest
from django.db import IntegrityError, models, transaction
from django.utils import timezone

from customer_registry.domain.validation import IdentificationType, PersonType
from customer_registry.models import Customer, OwnershipPeriod, Vehicle, VehicleBrand


@pytest.fixture
def brand(db: None) -> VehicleBrand:
    return VehicleBrand.objects.create(name="Toyota")


@pytest.fixture
def customer(db: None) -> Customer:
    return Customer.objects.create(
        person_type=PersonType.NATURAL.value,
        name="Juan Pérez",
        identification_type=IdentificationType.CI.value,
        identification="0912345678",
        phone="0991234567",
    )


@pytest.mark.django_db
def test_vehicle_creation_defaults_and_optional_fields(brand: VehicleBrand) -> None:
    vehicle = Vehicle.objects.create(
        plate="ABC1234",
        brand=brand,
        model="Corolla",
    )

    assert vehicle.id is not None
    assert vehicle.plate == "ABC1234"
    assert vehicle.brand == brand
    assert vehicle.model == "Corolla"
    assert vehicle.color == ""
    assert vehicle.year is None
    assert vehicle.vin is None
    assert vehicle.is_active is True
    assert vehicle.version == 1
    assert vehicle.created_at is not None
    assert vehicle.updated_at is not None
    assert str(vehicle) == "ABC1234 - Toyota Corolla"
    assert vehicle.current_ownership is None
    assert vehicle.current_owner is None


@pytest.mark.django_db
def test_vehicle_plate_uniqueness_across_active_and_inactive(brand: VehicleBrand) -> None:
    v1 = Vehicle.objects.create(
        plate="PBX1234",
        brand=brand,
        model="Yaris",
        is_active=False,
    )
    assert v1.is_active is False

    with pytest.raises(IntegrityError), transaction.atomic():
        Vehicle.objects.create(
            plate="PBX1234",
            brand=brand,
            model="Corolla",
        )


@pytest.mark.django_db
def test_vehicle_plate_and_model_cannot_be_blank(brand: VehicleBrand) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Vehicle.objects.create(
            plate="   ",
            brand=brand,
            model="Corolla",
        )

    with pytest.raises(IntegrityError), transaction.atomic():
        Vehicle.objects.create(
            plate="ABC1234",
            brand=brand,
            model="   ",
        )


@pytest.mark.django_db
def test_vehicle_vin_uniqueness_when_informed_and_multiple_nulls_allowed(
    brand: VehicleBrand,
) -> None:
    # Multiple null VINs are allowed
    v1 = Vehicle.objects.create(plate="ABC0001", brand=brand, model="M1", vin=None)
    v2 = Vehicle.objects.create(plate="ABC0002", brand=brand, model="M2", vin=None)
    assert v1.vin is None
    assert v2.vin is None

    # Informed VIN must be unique
    Vehicle.objects.create(
        plate="ABC0003",
        brand=brand,
        model="M3",
        vin="1HGCR2F83HA000001",
        is_active=False,
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        Vehicle.objects.create(
            plate="ABC0004",
            brand=brand,
            model="M4",
            vin="1HGCR2F83HA000001",
        )


@pytest.mark.django_db
def test_brand_protected_from_deletion_when_referenced_by_vehicle(
    brand: VehicleBrand,
) -> None:
    Vehicle.objects.create(
        plate="ABC1234",
        brand=brand,
        model="Hilux",
    )

    with pytest.raises(models.ProtectedError):
        brand.delete()


@pytest.mark.django_db
def test_ownership_period_creation_and_current_owner_property(
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    vehicle = Vehicle.objects.create(
        plate="ABC1234",
        brand=brand,
        model="RAV4",
    )
    now = timezone.now()
    period = OwnershipPeriod.objects.create(
        vehicle=vehicle,
        customer=customer,
        started_at=now,
    )

    assert period.id is not None
    assert period.ended_at is None
    assert vehicle.current_ownership == period
    assert vehicle.current_owner == customer
    assert str(period) == f"{customer.name} -> {vehicle.plate} (vigente)"


@pytest.mark.django_db
def test_ownership_period_at_most_one_open_period_per_vehicle(
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    vehicle = Vehicle.objects.create(
        plate="ABC1234",
        brand=brand,
        model="RAV4",
    )
    now = timezone.now()
    OwnershipPeriod.objects.create(
        vehicle=vehicle,
        customer=customer,
        started_at=now,
    )

    other_customer = Customer.objects.create(
        person_type=PersonType.NATURAL.value,
        name="María López",
        identification_type=IdentificationType.CI.value,
        identification="0923456789",
        phone="0987654321",
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        OwnershipPeriod.objects.create(
            vehicle=vehicle,
            customer=other_customer,
            started_at=now + timedelta(days=1),
            ended_at=None,
        )


@pytest.mark.django_db
def test_ownership_period_allows_multiple_closed_periods(
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    vehicle = Vehicle.objects.create(
        plate="ABC1234",
        brand=brand,
        model="RAV4",
    )
    t0 = timezone.now() - timedelta(days=30)
    t1 = timezone.now() - timedelta(days=15)
    t2 = timezone.now() - timedelta(days=10)

    other_customer = Customer.objects.create(
        person_type=PersonType.NATURAL.value,
        name="María López",
        identification_type=IdentificationType.CI.value,
        identification="0923456789",
        phone="0987654321",
    )

    # Closed period 1
    p1 = OwnershipPeriod.objects.create(
        vehicle=vehicle,
        customer=customer,
        started_at=t0,
        ended_at=t1,
    )
    # Closed period 2
    p2 = OwnershipPeriod.objects.create(
        vehicle=vehicle,
        customer=other_customer,
        started_at=t1,
        ended_at=t2,
    )
    # Open period
    p3 = OwnershipPeriod.objects.create(
        vehicle=vehicle,
        customer=customer,
        started_at=t2,
        ended_at=None,
    )

    assert p1.ended_at is not None
    assert p2.ended_at is not None
    assert p3.ended_at is None
    assert vehicle.current_owner == customer
    assert vehicle.ownership_periods.count() == 3


@pytest.mark.django_db
def test_ownership_period_ended_at_cannot_precede_started_at(
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    vehicle = Vehicle.objects.create(
        plate="ABC1234",
        brand=brand,
        model="RAV4",
    )
    now = timezone.now()

    with pytest.raises(IntegrityError), transaction.atomic():
        OwnershipPeriod.objects.create(
            vehicle=vehicle,
            customer=customer,
            started_at=now,
            ended_at=now - timedelta(seconds=1),
        )


@pytest.mark.django_db
def test_ownership_period_foreign_keys_protected(
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    vehicle = Vehicle.objects.create(
        plate="ABC1234",
        brand=brand,
        model="RAV4",
    )
    OwnershipPeriod.objects.create(
        vehicle=vehicle,
        customer=customer,
        started_at=timezone.now(),
    )

    with pytest.raises(models.ProtectedError):
        customer.delete()

    with pytest.raises(models.ProtectedError):
        vehicle.delete()
