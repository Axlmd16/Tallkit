import pytest
from rest_framework import status
from rest_framework.test import APIClient

from customer_registry.application.customers import (
    CustomerNotFoundError,
    StaleCustomerRecordError,
    activate_customer,
    deactivate_customer,
)
from customer_registry.models import Customer, OwnershipPeriod, Vehicle, VehicleBrand
from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import Role
from identity.models import AuditEvent, AuditResult, User, UserRole


@pytest.fixture
def admin_user(db: None) -> User:
    user = User.objects.create_user(username="admin_state", password="password123")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    return user


@pytest.fixture
def manager_user(db: None) -> User:
    user = User.objects.create_user(username="manager_state", password="password123")
    UserRole.objects.create(user=user, role=Role.ENCARGADO_TALLER)
    return user


@pytest.fixture
def seller_user(db: None) -> User:
    user = User.objects.create_user(username="seller_state", password="password123")
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
def customer(db: None) -> Customer:
    return Customer.objects.create(
        person_type="NATURAL",
        name="Juan Pérez",
        identification_type="CI",
        identification="0912345678",
        phone="0987654321",
        is_active=True,
        version=1,
    )


# -----------------------------------------------------------------------------
# Service Tests
# -----------------------------------------------------------------------------


@pytest.mark.django_db
def test_deactivate_customer_success(admin_user: User, customer: Customer) -> None:
    # Also attach a vehicle to verify relations are preserved without cascade
    brand = VehicleBrand.objects.create(name="Toyota", is_active=True)
    vehicle = Vehicle.objects.create(
        brand=brand,
        plate="ABC-1234",
        model="Corolla",
        is_active=True,
        version=1,
    )
    OwnershipPeriod.objects.create(
        vehicle=vehicle,
        customer=customer,
        started_at="2026-09-01T00:00:00Z",
        ended_at=None,
    )

    updated = deactivate_customer(
        customer_id=customer.id,
        expected_version=1,
        actor=admin_user,
    )
    assert updated.is_active is False
    assert updated.version == 2

    # Vehicle and ownership period must remain untouched
    vehicle.refresh_from_db()
    assert vehicle.is_active is True
    assert vehicle.current_owner == customer

    event = AuditEvent.objects.filter(
        action="registry.customer_deactivated",
        target_id=str(customer.id),
    ).first()
    assert event is not None
    assert event.result == AuditResult.SUCCESS
    assert event.actor_id == admin_user.id


@pytest.mark.django_db
def test_deactivate_customer_idempotent_no_op(admin_user: User, customer: Customer) -> None:
    customer.is_active = False
    customer.version = 3
    customer.save()

    initial_audit_count = AuditEvent.objects.count()

    result = deactivate_customer(
        customer_id=customer.id,
        expected_version=3,
        actor=admin_user,
    )
    assert result.is_active is False
    assert result.version == 3
    assert AuditEvent.objects.count() == initial_audit_count


@pytest.mark.django_db
def test_deactivate_customer_permission_denied(
    manager_user: User, seller_user: User, customer: Customer
) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        deactivate_customer(customer_id=customer.id, expected_version=1, actor=manager_user)

    with pytest.raises(BusinessPermissionDeniedError):
        deactivate_customer(customer_id=customer.id, expected_version=1, actor=seller_user)


@pytest.mark.django_db
def test_deactivate_customer_stale_record(admin_user: User, customer: Customer) -> None:
    with pytest.raises(StaleCustomerRecordError):
        deactivate_customer(customer_id=customer.id, expected_version=999, actor=admin_user)

    event = AuditEvent.objects.filter(
        action="registry.customer_deactivate_rejected",
        target_id=str(customer.id),
    ).first()
    assert event is not None
    assert event.result == AuditResult.FAILURE
    assert event.reason == "stale_record"


@pytest.mark.django_db
def test_deactivate_customer_not_found(admin_user: User) -> None:
    with pytest.raises(CustomerNotFoundError):
        deactivate_customer(customer_id=99999, expected_version=1, actor=admin_user)


@pytest.mark.django_db
def test_reactivate_customer_success(admin_user: User, customer: Customer) -> None:
    customer.is_active = False
    customer.version = 2
    customer.save()

    updated = activate_customer(
        customer_id=customer.id,
        expected_version=2,
        actor=admin_user,
    )
    assert updated.is_active is True
    assert updated.version == 3

    event = AuditEvent.objects.filter(
        action="registry.customer_activated",
        target_id=str(customer.id),
    ).first()
    assert event is not None
    assert event.result == AuditResult.SUCCESS
    assert event.actor_id == admin_user.id


@pytest.mark.django_db
def test_reactivate_customer_idempotent_no_op(admin_user: User, customer: Customer) -> None:
    assert customer.is_active is True
    initial_audit_count = AuditEvent.objects.count()

    result = activate_customer(
        customer_id=customer.id,
        expected_version=1,
        actor=admin_user,
    )
    assert result.is_active is True
    assert result.version == 1
    assert AuditEvent.objects.count() == initial_audit_count


@pytest.mark.django_db
def test_reactivate_customer_permission_denied(
    manager_user: User, seller_user: User, customer: Customer
) -> None:
    customer.is_active = False
    customer.save()

    with pytest.raises(BusinessPermissionDeniedError):
        activate_customer(customer_id=customer.id, expected_version=1, actor=manager_user)

    with pytest.raises(BusinessPermissionDeniedError):
        activate_customer(customer_id=customer.id, expected_version=1, actor=seller_user)


@pytest.mark.django_db
def test_reactivate_customer_stale_record(admin_user: User, customer: Customer) -> None:
    customer.is_active = False
    customer.save()

    with pytest.raises(StaleCustomerRecordError):
        activate_customer(customer_id=customer.id, expected_version=999, actor=admin_user)

    event = AuditEvent.objects.filter(
        action="registry.customer_activate_rejected",
        target_id=str(customer.id),
    ).first()
    assert event is not None
    assert event.result == AuditResult.FAILURE
    assert event.reason == "stale_record"


@pytest.mark.django_db
def test_reactivate_customer_not_found(admin_user: User) -> None:
    with pytest.raises(CustomerNotFoundError):
        activate_customer(customer_id=99999, expected_version=1, actor=admin_user)


# -----------------------------------------------------------------------------
# API Tests
# -----------------------------------------------------------------------------


@pytest.mark.django_db
def test_deactivate_customer_api(
    admin_client: APIClient,
    manager_client: APIClient,
    seller_client: APIClient,
    customer: Customer,
) -> None:
    url = f"/api/v1/customers/{customer.id}/deactivate/"

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
        "/api/v1/customers/9999/deactivate/", {"expected_version": 1}, format="json"
    )
    assert res_nf.status_code == status.HTTP_404_NOT_FOUND

    # Success
    res_ok = admin_client.post(url, {"expected_version": 1}, format="json")
    assert res_ok.status_code == status.HTTP_200_OK
    assert res_ok.data["is_active"] is False
    assert res_ok.data["version"] == 2


@pytest.mark.django_db
def test_activate_customer_api(
    admin_client: APIClient,
    manager_client: APIClient,
    seller_client: APIClient,
    customer: Customer,
) -> None:
    customer.is_active = False
    customer.version = 2
    customer.save()

    url = f"/api/v1/customers/{customer.id}/activate/"

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
