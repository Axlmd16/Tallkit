from unittest.mock import patch

import pytest

from customer_registry.application.customers import CustomerNotFoundError
from customer_registry.application.vehicles import (
    DuplicatePlateError,
    DuplicateVinError,
    InactiveReferenceError,
    StaleVehicleRecordError,
    create_vehicle,
    transfer_vehicle_ownership,
    update_vehicle,
)
from customer_registry.domain.validation import (
    IdentificationType,
    PersonType,
    VehicleValidationError,
)
from customer_registry.models import Customer, OwnershipPeriod, Vehicle, VehicleBrand
from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import Role
from identity.models import AuditEvent, AuditResult, User, UserRole


@pytest.fixture
def admin_user(db: None) -> User:
    user = User.objects.create(username="admin_test")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    return user


@pytest.fixture
def encargado_user(db: None) -> User:
    user = User.objects.create(username="encargado_test")
    UserRole.objects.create(user=user, role=Role.ENCARGADO_TALLER)
    return user


@pytest.fixture
def vendedor_user(db: None) -> User:
    user = User.objects.create(username="vendedor_test")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    return user


@pytest.fixture
def brand(db: None) -> VehicleBrand:
    return VehicleBrand.objects.create(name="Toyota")


@pytest.fixture
def inactive_brand(db: None) -> VehicleBrand:
    return VehicleBrand.objects.create(name="Daewoo", is_active=False)


@pytest.fixture
def customer(db: None) -> Customer:
    return Customer.objects.create(
        person_type=PersonType.NATURAL.value,
        name="Carlos Vera",
        identification_type=IdentificationType.CI.value,
        identification="0912345678",
        phone="0991112233",
    )


@pytest.fixture
def customer2(db: None) -> Customer:
    return Customer.objects.create(
        person_type=PersonType.NATURAL.value,
        name="María López",
        identification_type=IdentificationType.CI.value,
        identification="0923456789",
        phone="0992223344",
    )


@pytest.fixture
def inactive_customer(db: None) -> Customer:
    return Customer.objects.create(
        person_type=PersonType.NATURAL.value,
        name="Cliente Inactivo",
        identification_type=IdentificationType.CI.value,
        identification="0999999999",
        phone="0999999999",
        is_active=False,
    )


@pytest.mark.django_db
def test_create_vehicle_success_by_admin_and_encargado(
    admin_user: User,
    encargado_user: User,
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    # Admin creates vehicle
    v1 = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="abc-1234 ",
        model=" Corolla ",
        color="Rojo",
        year=2020,
        vin=" 1hgcr2f83ha000001 ",
    )

    assert v1.id is not None
    assert v1.plate == "ABC-1234"  # Normalized: upper and stripped
    assert v1.model == "Corolla"
    assert v1.color == "Rojo"
    assert v1.year == 2020
    assert v1.vin == "1HGCR2F83HA000001"
    assert v1.brand == brand
    assert v1.is_active is True
    assert v1.version == 1
    assert v1.current_owner == customer
    assert v1.current_ownership is not None
    assert v1.current_ownership.ended_at is None

    audit_v1 = AuditEvent.objects.filter(
        action="registry.vehicle_created",
        target_id=str(v1.id),
        result=AuditResult.SUCCESS,
    ).first()
    assert audit_v1 is not None
    assert audit_v1.actor == admin_user

    # Encargado creates vehicle without optional fields
    v2 = create_vehicle(
        actor=encargado_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="xyz-9876",
        model="Yaris",
    )

    assert v2.id is not None
    assert v2.plate == "XYZ-9876"
    assert v2.color == ""
    assert v2.year is None
    assert v2.vin is None
    assert v2.current_owner == customer


@pytest.mark.django_db
def test_create_vehicle_denied_for_vendedor(
    vendedor_user: User,
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        create_vehicle(
            actor=vendedor_user,
            owner_id=customer.id,
            brand_id=brand.id,
            plate="ABC-1234",
            model="Corolla",
        )

    assert not Vehicle.objects.filter(plate="ABC-1234").exists()
    assert AuditEvent.objects.filter(
        action="registry.vehicle_created",
        result=AuditResult.DENIED,
        actor=vendedor_user,
    ).exists()


@pytest.mark.django_db
def test_create_vehicle_validation_errors(
    admin_user: User,
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    # Blank plate
    with pytest.raises(VehicleValidationError):
        create_vehicle(
            actor=admin_user,
            owner_id=customer.id,
            brand_id=brand.id,
            plate="   ",
            model="Corolla",
        )

    # Blank model
    with pytest.raises(VehicleValidationError):
        create_vehicle(
            actor=admin_user,
            owner_id=customer.id,
            brand_id=brand.id,
            plate="ABC-1234",
            model="   ",
        )

    # Invalid year
    with pytest.raises(VehicleValidationError):
        create_vehicle(
            actor=admin_user,
            owner_id=customer.id,
            brand_id=brand.id,
            plate="ABC-1234",
            model="Corolla",
            year=-5,
        )


@pytest.mark.django_db
def test_create_vehicle_inactive_references(
    admin_user: User,
    brand: VehicleBrand,
    inactive_brand: VehicleBrand,
    customer: Customer,
    inactive_customer: Customer,
) -> None:
    # Inactive customer
    with pytest.raises(InactiveReferenceError) as exc_info:
        create_vehicle(
            actor=admin_user,
            owner_id=inactive_customer.id,
            brand_id=brand.id,
            plate="ABC-1234",
            model="Corolla",
        )
    assert exc_info.value.reference_type == "customer"
    assert exc_info.value.reference_id == inactive_customer.id

    # Inactive brand
    with pytest.raises(InactiveReferenceError) as exc_info2:
        create_vehicle(
            actor=admin_user,
            owner_id=customer.id,
            brand_id=inactive_brand.id,
            plate="ABC-1234",
            model="Corolla",
        )
    assert exc_info2.value.reference_type == "brand"
    assert exc_info2.value.reference_id == inactive_brand.id


@pytest.mark.django_db
def test_create_vehicle_duplicate_plate_and_vin(
    admin_user: User,
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="PBX-1234",
        model="Corolla",
        vin="1HGCR2F83HA000099",
    )

    # Duplicate plate (different casing/spacing)
    with pytest.raises(DuplicatePlateError) as exc_plate:
        create_vehicle(
            actor=admin_user,
            owner_id=customer.id,
            brand_id=brand.id,
            plate=" pbx-1234 ",
            model="Hilux",
        )
    assert exc_plate.value.plate == "PBX-1234"

    # Duplicate VIN
    with pytest.raises(DuplicateVinError) as exc_vin:
        create_vehicle(
            actor=admin_user,
            owner_id=customer.id,
            brand_id=brand.id,
            plate="XYZ-9999",
            model="Hilux",
            vin=" 1hgcr2f83ha000099 ",
        )
    assert exc_vin.value.vin == "1HGCR2F83HA000099"

    # Multiple vehicles with null VIN succeed
    v_no_vin_1 = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="AAA-0001",
        model="M1",
        vin=None,
    )
    v_no_vin_2 = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="AAA-0002",
        model="M2",
        vin=None,
    )
    assert v_no_vin_1.vin is None
    assert v_no_vin_2.vin is None


@pytest.mark.django_db
def test_create_vehicle_atomic_rollback_on_audit_failure(
    admin_user: User,
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    with (
        patch(
            "customer_registry.application.vehicles.record_audit_event",
            side_effect=RuntimeError("Audit broker unavailable"),
        ),
        pytest.raises(RuntimeError, match="Audit broker unavailable"),
    ):
        create_vehicle(
            actor=admin_user,
            owner_id=customer.id,
            brand_id=brand.id,
            plate="FAIL-001",
            model="Test",
        )

    assert not Vehicle.objects.filter(plate="FAIL-001").exists()
    assert not OwnershipPeriod.objects.filter(customer=customer).exists()


@pytest.mark.django_db
def test_update_vehicle_success_and_version_bump(
    admin_user: User,
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    other_brand = VehicleBrand.objects.create(name="Honda")
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
        color="Blanco",
        year=2021,
    )

    updated = update_vehicle(
        vehicle_id=vehicle.id,
        expected_version=1,
        actor=admin_user,
        data={
            "brand_id": other_brand.id,
            "model": "Civic",
            "color": "Negro",
            "year": 2022,
            "vin": "2HGCR2F83HA000002",
        },
    )

    assert updated.version == 2
    assert updated.brand == other_brand
    assert updated.model == "Civic"
    assert updated.color == "Negro"
    assert updated.year == 2022
    assert updated.vin == "2HGCR2F83HA000002"

    audit = AuditEvent.objects.filter(
        action="registry.vehicle_updated",
        target_id=str(vehicle.id),
        result=AuditResult.SUCCESS,
    ).first()
    assert audit is not None
    assert "brand_id" in audit.metadata.get("changed_fields", [])
    assert "model" in audit.metadata.get("changed_fields", [])


@pytest.mark.django_db
def test_update_vehicle_noop_when_data_identical(
    admin_user: User,
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
        color="Blanco",
        year=2021,
        vin="1HGCR2F83HA000001",
    )

    initial_audit_count = AuditEvent.objects.count()

    updated = update_vehicle(
        vehicle_id=vehicle.id,
        expected_version=1,
        actor=admin_user,
        data={
            "brand_id": brand.id,
            "model": "Corolla",
            "color": "Blanco",
            "year": 2021,
            "vin": "1HGCR2F83HA000001",
        },
    )

    assert updated.version == 1
    # No new audit event produced
    assert AuditEvent.objects.count() == initial_audit_count


@pytest.mark.django_db
def test_update_vehicle_stale_record_detection(
    admin_user: User,
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
    )

    with pytest.raises(StaleVehicleRecordError) as exc_info:
        update_vehicle(
            vehicle_id=vehicle.id,
            expected_version=99,
            actor=admin_user,
            data={"model": "Corolla Cross"},
        )
    assert exc_info.value.current_version == 1


@pytest.mark.django_db
def test_update_vehicle_permits_preserving_existing_inactive_brand(
    admin_user: User,
    brand: VehicleBrand,
    inactive_brand: VehicleBrand,
    customer: Customer,
) -> None:
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
    )
    # Brand is now deactivated
    brand.is_active = False
    brand.save(update_fields=["is_active"])

    # Updating other fields while keeping the same inactive brand succeeds
    updated = update_vehicle(
        vehicle_id=vehicle.id,
        expected_version=1,
        actor=admin_user,
        data={
            "brand_id": brand.id,
            "model": "Corolla GLI",
        },
    )
    assert updated.version == 2
    assert updated.model == "Corolla GLI"
    assert updated.brand_id == brand.id

    # Trying to select a DIFFERENT inactive brand fails
    with pytest.raises(InactiveReferenceError) as exc_info:
        update_vehicle(
            vehicle_id=vehicle.id,
            expected_version=2,
            actor=admin_user,
            data={"brand_id": inactive_brand.id},
        )
    assert exc_info.value.reference_type == "brand"
    assert exc_info.value.reference_id == inactive_brand.id


@pytest.mark.django_db
def test_update_vehicle_duplicate_plate_and_vin_rejection(
    admin_user: User,
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1111",
        model="M1",
        vin="VIN-0000000000001",
    )
    v2 = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-2222",
        model="M2",
        vin="VIN-0000000000002",
    )

    # Trying to update v2 plate to v1's plate fails
    with pytest.raises(DuplicatePlateError):
        update_vehicle(
            vehicle_id=v2.id,
            expected_version=1,
            actor=admin_user,
            data={"plate": "ABC-1111"},
        )

    # Trying to update v2 VIN to v1's VIN fails
    with pytest.raises(DuplicateVinError):
        update_vehicle(
            vehicle_id=v2.id,
            expected_version=1,
            actor=admin_user,
            data={"vin": "VIN-0000000000001"},
        )


@pytest.mark.django_db
def test_transfer_vehicle_ownership_success_by_admin_and_encargado(
    admin_user: User,
    encargado_user: User,
    brand: VehicleBrand,
    customer: Customer,
    customer2: Customer,
) -> None:
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
    )
    assert vehicle.current_owner == customer
    initial_period = OwnershipPeriod.objects.get(vehicle=vehicle, ended_at__isnull=True)
    assert initial_period.customer == customer
    assert vehicle.version == 1

    # Transfer from customer to customer2 by Encargado
    updated = transfer_vehicle_ownership(
        vehicle_id=vehicle.id,
        new_owner_id=customer2.id,
        expected_version=1,
        actor=encargado_user,
    )

    assert updated.version == 2
    # Verify periods
    initial_period.refresh_from_db()
    assert initial_period.ended_at is not None

    new_period = OwnershipPeriod.objects.get(vehicle=vehicle, ended_at__isnull=True)
    assert new_period.customer == customer2
    assert new_period.started_at == initial_period.ended_at
    assert new_period.ended_at is None

    # Check total periods is 2
    assert OwnershipPeriod.objects.filter(vehicle=vehicle).count() == 2

    # Check audit event
    event = (
        AuditEvent.objects.filter(
            target_type="vehicle",
            target_id=str(vehicle.id),
            action="registry.vehicle_owner_changed",
        )
        .order_by("-id")
        .first()
    )
    assert event is not None
    assert event.actor == encargado_user
    assert event.result == AuditResult.SUCCESS.value
    assert event.metadata == {
        "previous_owner_id": customer.id,
        "new_owner_id": customer2.id,
    }


@pytest.mark.django_db
def test_transfer_vehicle_ownership_denied_for_vendedor(
    admin_user: User,
    vendedor_user: User,
    brand: VehicleBrand,
    customer: Customer,
    customer2: Customer,
) -> None:
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
    )

    with pytest.raises(BusinessPermissionDeniedError):
        transfer_vehicle_ownership(
            vehicle_id=vehicle.id,
            new_owner_id=customer2.id,
            expected_version=1,
            actor=vendedor_user,
        )

    # Periods unchanged
    assert OwnershipPeriod.objects.filter(vehicle=vehicle).count() == 1
    open_period = OwnershipPeriod.objects.get(vehicle=vehicle, ended_at__isnull=True)
    assert open_period.customer == customer

    # Check denial audit event
    denial_event = AuditEvent.objects.filter(
        target_type="vehicle",
        target_id=str(vehicle.id),
        action="registry.vehicle_owner_changed",
        result=AuditResult.DENIED.value,
    ).first()
    assert denial_event is not None
    assert denial_event.actor == vendedor_user


@pytest.mark.django_db
def test_transfer_vehicle_ownership_to_inactive_customer_rejected(
    admin_user: User,
    brand: VehicleBrand,
    customer: Customer,
    inactive_customer: Customer,
) -> None:
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
    )

    with pytest.raises(InactiveReferenceError) as exc_info:
        transfer_vehicle_ownership(
            vehicle_id=vehicle.id,
            new_owner_id=inactive_customer.id,
            expected_version=1,
            actor=admin_user,
        )
    assert exc_info.value.reference_type == "customer"
    assert exc_info.value.reference_id == inactive_customer.id

    # Verify no new period
    assert OwnershipPeriod.objects.filter(vehicle=vehicle).count() == 1
    open_p = OwnershipPeriod.objects.filter(vehicle=vehicle, ended_at__isnull=True).first()
    assert open_p is not None
    assert open_p.customer == customer


@pytest.mark.django_db
def test_transfer_vehicle_ownership_to_nonexistent_customer_rejected(
    admin_user: User,
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
    )

    with pytest.raises(CustomerNotFoundError):
        transfer_vehicle_ownership(
            vehicle_id=vehicle.id,
            new_owner_id=99999,
            expected_version=1,
            actor=admin_user,
        )


@pytest.mark.django_db
def test_transfer_vehicle_ownership_same_owner_is_idempotent_noop(
    admin_user: User,
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
    )

    audit_count_before = AuditEvent.objects.count()
    result = transfer_vehicle_ownership(
        vehicle_id=vehicle.id,
        new_owner_id=customer.id,
        expected_version=1,
        actor=admin_user,
    )

    assert result.id == vehicle.id
    assert result.version == 1
    # No new ownership period
    assert OwnershipPeriod.objects.filter(vehicle=vehicle).count() == 1
    # No new audit event
    assert AuditEvent.objects.count() == audit_count_before


@pytest.mark.django_db
def test_transfer_vehicle_ownership_stale_version_rejected(
    admin_user: User,
    brand: VehicleBrand,
    customer: Customer,
    customer2: Customer,
) -> None:
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
    )

    with pytest.raises(StaleVehicleRecordError) as exc_info:
        transfer_vehicle_ownership(
            vehicle_id=vehicle.id,
            new_owner_id=customer2.id,
            expected_version=99,
            actor=admin_user,
        )
    assert exc_info.value.current_version == 1


@pytest.mark.django_db
def test_transfer_vehicle_ownership_atomic_rollback_on_audit_failure(
    admin_user: User,
    brand: VehicleBrand,
    customer: Customer,
    customer2: Customer,
) -> None:
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
    )

    with (
        patch(
            "customer_registry.application.vehicles.record_audit_event",
            side_effect=RuntimeError("Audit broker failure"),
        ),
        pytest.raises(RuntimeError),
    ):
        transfer_vehicle_ownership(
            vehicle_id=vehicle.id,
            new_owner_id=customer2.id,
            expected_version=1,
            actor=admin_user,
        )

    # Rollback verified: exactly one period, still open, for customer
    assert OwnershipPeriod.objects.filter(vehicle=vehicle).count() == 1
    open_period = OwnershipPeriod.objects.get(vehicle=vehicle, ended_at__isnull=True)
    assert open_period.customer == customer
    vehicle.refresh_from_db()
    assert vehicle.version == 1
