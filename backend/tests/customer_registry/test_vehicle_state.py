import pytest
from rest_framework import status
from rest_framework.test import APIClient

from customer_registry.application.vehicles import (
    DuplicatePlateError,
    DuplicateVinError,
    StaleVehicleRecordError,
    VehicleNotFoundError,
    activate_vehicle,
    create_vehicle,
    deactivate_vehicle,
)
from customer_registry.models import Customer, OwnershipPeriod, Vehicle, VehicleBrand
from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import Role
from identity.models import AuditEvent, AuditResult, User, UserRole


@pytest.fixture
def admin_user(db: None) -> User:
    user = User.objects.create_user(username="admin_vstate", password="password123")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    return user


@pytest.fixture
def manager_user(db: None) -> User:
    user = User.objects.create_user(username="manager_vstate", password="password123")
    UserRole.objects.create(user=user, role=Role.ENCARGADO_TALLER)
    return user


@pytest.fixture
def seller_user(db: None) -> User:
    user = User.objects.create_user(username="seller_vstate", password="password123")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    return user


@pytest.fixture
def admin_client(admin_user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def manager_client(manager_user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=manager_user)
    return client


@pytest.fixture
def seller_client(seller_user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=seller_user)
    return client


@pytest.fixture
def sample_data(db: None) -> tuple[Customer, VehicleBrand, Vehicle]:
    customer = Customer.objects.create(
        person_type="NATURAL",
        name="Carlos Mendoza",
        identification_type="CI",
        identification="0911223344",
        phone="0911223344",
        is_active=True,
        version=1,
    )
    brand = VehicleBrand.objects.create(name="Ford", is_active=True, version=1)
    vehicle = Vehicle.objects.create(
        brand=brand,
        plate="ABC-5678",
        model="Ranger",
        vin="1FORD999999999999",
        is_active=True,
        version=1,
    )
    OwnershipPeriod.objects.create(
        vehicle=vehicle,
        customer=customer,
        started_at="2026-09-01T00:00:00Z",
        ended_at=None,
    )
    return customer, brand, vehicle


# -----------------------------------------------------------------------------
# Service Tests
# -----------------------------------------------------------------------------


@pytest.mark.django_db
def test_deactivate_vehicle_success(
    admin_user: User, sample_data: tuple[Customer, VehicleBrand, Vehicle]
) -> None:
    customer, _brand, vehicle = sample_data

    updated = deactivate_vehicle(
        vehicle_id=vehicle.id,
        expected_version=1,
        actor=admin_user,
    )
    assert updated.is_active is False
    assert updated.version == 2

    # Owner and period preserved
    assert updated.current_owner == customer
    assert updated.ownership_periods.count() == 1
    period = updated.ownership_periods.first()
    assert period is not None
    assert period.ended_at is None

    event = AuditEvent.objects.filter(
        action="registry.vehicle_deactivated",
        target_id=str(vehicle.id),
    ).first()
    assert event is not None
    assert event.result == AuditResult.SUCCESS
    assert event.actor_id == admin_user.id


@pytest.mark.django_db
def test_deactivate_vehicle_idempotent_no_op(
    admin_user: User, sample_data: tuple[Customer, VehicleBrand, Vehicle]
) -> None:
    _, _, vehicle = sample_data
    vehicle.is_active = False
    vehicle.version = 4
    vehicle.save()

    initial_audit_count = AuditEvent.objects.count()

    result = deactivate_vehicle(
        vehicle_id=vehicle.id,
        expected_version=4,
        actor=admin_user,
    )
    assert result.is_active is False
    assert result.version == 4
    assert AuditEvent.objects.count() == initial_audit_count


@pytest.mark.django_db
def test_deactivate_vehicle_permission_denied(
    manager_user: User, seller_user: User, sample_data: tuple[Customer, VehicleBrand, Vehicle]
) -> None:
    _, _, vehicle = sample_data

    with pytest.raises(BusinessPermissionDeniedError):
        deactivate_vehicle(vehicle_id=vehicle.id, expected_version=1, actor=manager_user)

    with pytest.raises(BusinessPermissionDeniedError):
        deactivate_vehicle(vehicle_id=vehicle.id, expected_version=1, actor=seller_user)


@pytest.mark.django_db
def test_deactivate_vehicle_stale_record(
    admin_user: User, sample_data: tuple[Customer, VehicleBrand, Vehicle]
) -> None:
    _, _, vehicle = sample_data

    with pytest.raises(StaleVehicleRecordError):
        deactivate_vehicle(vehicle_id=vehicle.id, expected_version=999, actor=admin_user)

    event = AuditEvent.objects.filter(
        action="registry.vehicle_deactivate_rejected",
        target_id=str(vehicle.id),
    ).first()
    assert event is not None
    assert event.result == AuditResult.FAILURE
    assert event.reason == "stale_record"


@pytest.mark.django_db
def test_deactivate_vehicle_not_found(admin_user: User) -> None:
    with pytest.raises(VehicleNotFoundError):
        deactivate_vehicle(vehicle_id=99999, expected_version=1, actor=admin_user)


@pytest.mark.django_db
def test_reactivate_vehicle_success(
    admin_user: User, sample_data: tuple[Customer, VehicleBrand, Vehicle]
) -> None:
    customer, brand, vehicle = sample_data
    vehicle.is_active = False
    vehicle.version = 2
    vehicle.save()

    # Even if brand or customer becomes inactive, reactivating vehicle restores it without error
    brand.is_active = False
    brand.save()
    customer.is_active = False
    customer.save()

    updated = activate_vehicle(
        vehicle_id=vehicle.id,
        expected_version=2,
        actor=admin_user,
    )
    assert updated.is_active is True
    assert updated.version == 3

    # Brand and customer should NOT be automatically reactivated
    brand.refresh_from_db()
    customer.refresh_from_db()
    assert brand.is_active is False
    assert customer.is_active is False

    event = AuditEvent.objects.filter(
        action="registry.vehicle_activated",
        target_id=str(vehicle.id),
    ).first()
    assert event is not None
    assert event.result == AuditResult.SUCCESS


@pytest.mark.django_db
def test_reactivate_vehicle_idempotent_no_op(
    admin_user: User, sample_data: tuple[Customer, VehicleBrand, Vehicle]
) -> None:
    _, _, vehicle = sample_data
    assert vehicle.is_active is True
    initial_audit_count = AuditEvent.objects.count()

    result = activate_vehicle(
        vehicle_id=vehicle.id,
        expected_version=1,
        actor=admin_user,
    )
    assert result.is_active is True
    assert result.version == 1
    assert AuditEvent.objects.count() == initial_audit_count


@pytest.mark.django_db
def test_reactivate_vehicle_permission_denied(
    manager_user: User, seller_user: User, sample_data: tuple[Customer, VehicleBrand, Vehicle]
) -> None:
    _, _, vehicle = sample_data
    vehicle.is_active = False
    vehicle.save()

    with pytest.raises(BusinessPermissionDeniedError):
        activate_vehicle(vehicle_id=vehicle.id, expected_version=1, actor=manager_user)

    with pytest.raises(BusinessPermissionDeniedError):
        activate_vehicle(vehicle_id=vehicle.id, expected_version=1, actor=seller_user)


@pytest.mark.django_db
def test_reactivate_vehicle_stale_record(
    admin_user: User, sample_data: tuple[Customer, VehicleBrand, Vehicle]
) -> None:
    _, _, vehicle = sample_data
    vehicle.is_active = False
    vehicle.save()

    with pytest.raises(StaleVehicleRecordError):
        activate_vehicle(vehicle_id=vehicle.id, expected_version=999, actor=admin_user)

    event = AuditEvent.objects.filter(
        action="registry.vehicle_activate_rejected",
        target_id=str(vehicle.id),
    ).first()
    assert event is not None
    assert event.result == AuditResult.FAILURE
    assert event.reason == "stale_record"


@pytest.mark.django_db
def test_duplicate_plate_and_vin_rejected_against_inactive_vehicle(
    admin_user: User, sample_data: tuple[Customer, VehicleBrand, Vehicle]
) -> None:
    _customer, brand, vehicle = sample_data
    vehicle.is_active = False
    vehicle.save()

    # Another customer
    c2 = Customer.objects.create(
        person_type="NATURAL",
        name="Otro Cliente",
        identification_type="CI",
        identification="0955443322",
        phone="0955443322",
        is_active=True,
    )

    # Attempt to create vehicle with same plate as inactive vehicle
    with pytest.raises(DuplicatePlateError):
        create_vehicle(
            actor=admin_user,
            owner_id=c2.id,
            brand_id=brand.id,
            plate="abc-5678",  # Normalized comparison
            model="New Model",
        )

    # Attempt to create vehicle with same VIN as inactive vehicle
    with pytest.raises(DuplicateVinError):
        create_vehicle(
            actor=admin_user,
            owner_id=c2.id,
            brand_id=brand.id,
            plate="XYZ-9999",
            model="New Model",
            vin="1ford999999999999",
        )


# -----------------------------------------------------------------------------
# API Tests
# -----------------------------------------------------------------------------


@pytest.mark.django_db
def test_deactivate_vehicle_api(
    admin_client: APIClient,
    manager_client: APIClient,
    seller_client: APIClient,
    sample_data: tuple[Customer, VehicleBrand, Vehicle],
) -> None:
    _, _, vehicle = sample_data
    url = f"/api/v1/vehicles/{vehicle.id}/deactivate/"

    # Denied for manager and seller
    res_mgr = manager_client.post(url, {"expected_version": 1}, format="json")
    assert res_mgr.status_code == status.HTTP_403_FORBIDDEN

    res_seller = seller_client.post(url, {"expected_version": 1}, format="json")
    assert res_seller.status_code == status.HTTP_403_FORBIDDEN

    # Missing expected_version
    res_bad = admin_client.post(url, {}, format="json")
    assert res_bad.status_code == status.HTTP_400_BAD_REQUEST

    # Stale record
    res_stale = admin_client.post(url, {"expected_version": 999}, format="json")
    assert res_stale.status_code == status.HTTP_409_CONFLICT
    assert res_stale.data["code"] == "stale_record"

    # Not found
    res_nf = admin_client.post(
        "/api/v1/vehicles/9999/deactivate/", {"expected_version": 1}, format="json"
    )
    assert res_nf.status_code == status.HTTP_404_NOT_FOUND

    # Success
    res_ok = admin_client.post(url, {"expected_version": 1}, format="json")
    assert res_ok.status_code == status.HTTP_200_OK
    assert res_ok.data["is_active"] is False
    assert res_ok.data["version"] == 2


@pytest.mark.django_db
def test_activate_vehicle_api(
    admin_client: APIClient,
    manager_client: APIClient,
    seller_client: APIClient,
    sample_data: tuple[Customer, VehicleBrand, Vehicle],
) -> None:
    _, _, vehicle = sample_data
    vehicle.is_active = False
    vehicle.version = 2
    vehicle.save()

    url = f"/api/v1/vehicles/{vehicle.id}/activate/"

    # Denied for manager and seller
    res_mgr = manager_client.post(url, {"expected_version": 2}, format="json")
    assert res_mgr.status_code == status.HTTP_403_FORBIDDEN

    res_seller = seller_client.post(url, {"expected_version": 2}, format="json")
    assert res_seller.status_code == status.HTTP_403_FORBIDDEN

    # Stale record
    res_stale = admin_client.post(url, {"expected_version": 999}, format="json")
    assert res_stale.status_code == status.HTTP_409_CONFLICT
    assert res_stale.data["code"] == "stale_record"

    # Success
    res_ok = admin_client.post(url, {"expected_version": 2}, format="json")
    assert res_ok.status_code == status.HTTP_200_OK
    assert res_ok.data["is_active"] is True
    assert res_ok.data["version"] == 3
