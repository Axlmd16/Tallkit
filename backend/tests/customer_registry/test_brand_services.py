from unittest.mock import patch

import pytest

from customer_registry.application.brands import (
    BrandNotFoundError,
    BrandValidationError,
    StaleBrandRecordError,
    activate_brand,
    create_brand,
    deactivate_brand,
    get_brand,
    search_brands,
    update_brand,
)
from customer_registry.application.vehicles import (
    InactiveReferenceError,
    create_vehicle,
    update_vehicle,
)
from customer_registry.models import Customer, Vehicle, VehicleBrand
from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import Role
from identity.models import AuditEvent, AuditResult, User, UserRole


@pytest.fixture
def admin_user(db: None) -> User:
    user = User.objects.create_user(username="admin_user", password="password123")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    return user


@pytest.fixture
def workshop_manager_user(db: None) -> User:
    user = User.objects.create_user(username="manager_user", password="password123")
    UserRole.objects.create(user=user, role=Role.ENCARGADO_TALLER)
    return user


@pytest.fixture
def seller_user(db: None) -> User:
    user = User.objects.create_user(username="seller_user", password="password123")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    return user


@pytest.fixture
def unprivileged_user(db: None) -> User:
    return User.objects.create_user(username="unprivileged_user", password="password123")


@pytest.mark.django_db
def test_create_brand_success_for_admin_and_workshop_manager(
    admin_user: User, workshop_manager_user: User
) -> None:
    brand1 = create_brand(name="  Toyota  ", actor=admin_user)
    assert brand1.id is not None
    assert brand1.name == "Toyota"
    assert brand1.is_active is True
    assert brand1.version == 1

    event1 = AuditEvent.objects.filter(
        action="registry.brand_created", target_id=str(brand1.id)
    ).first()
    assert event1 is not None
    assert event1.result == AuditResult.SUCCESS

    brand2 = create_brand(name="Hyundai", actor=workshop_manager_user)
    assert brand2.id is not None
    assert brand2.name == "Hyundai"


@pytest.mark.django_db
def test_create_brand_denied_for_seller_and_unprivileged(
    seller_user: User, unprivileged_user: User
) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        create_brand(name="Nissan", actor=seller_user)

    with pytest.raises(BusinessPermissionDeniedError):
        create_brand(name="Nissan", actor=unprivileged_user)


@pytest.mark.django_db
def test_create_brand_validation_error_and_audit(admin_user: User) -> None:
    with pytest.raises(BrandValidationError):
        create_brand(name="   ", actor=admin_user)

    event = AuditEvent.objects.filter(action="registry.brand_create_rejected").first()
    assert event is not None
    assert event.result == AuditResult.FAILURE
    assert event.reason == "validation_error"


@pytest.mark.django_db
def test_update_brand_success_and_stale_detection(workshop_manager_user: User) -> None:
    brand = VehicleBrand.objects.create(name="Toyoota", version=1)

    updated = update_brand(
        brand_id=brand.id,
        name="Toyota",
        expected_version=1,
        actor=workshop_manager_user,
    )
    assert updated.name == "Toyota"
    assert updated.version == 2

    # Stale version detection
    with pytest.raises(StaleBrandRecordError):
        update_brand(
            brand_id=brand.id,
            name="Toyota Motor",
            expected_version=1,  # Now version is 2
            actor=workshop_manager_user,
        )

    stale_event = AuditEvent.objects.filter(action="registry.brand_update_rejected").first()
    assert stale_event is not None
    assert stale_event.reason == "stale_record"


@pytest.mark.django_db
def test_update_brand_noop_when_name_unchanged(admin_user: User) -> None:
    brand = VehicleBrand.objects.create(name="Chevrolet", version=1)
    audit_count_before = AuditEvent.objects.count()

    result = update_brand(
        brand_id=brand.id,
        name="  Chevrolet  ",
        expected_version=1,
        actor=admin_user,
    )
    assert result.version == 1
    assert AuditEvent.objects.count() == audit_count_before


@pytest.mark.django_db
def test_deactivate_and_activate_brand_permissions_and_lifecycle(
    admin_user: User, workshop_manager_user: User, seller_user: User
) -> None:
    brand = VehicleBrand.objects.create(name="Kia", is_active=True, version=1)

    # Workshop manager and seller cannot deactivate
    with pytest.raises(BusinessPermissionDeniedError):
        deactivate_brand(brand_id=brand.id, expected_version=1, actor=workshop_manager_user)

    with pytest.raises(BusinessPermissionDeniedError):
        deactivate_brand(brand_id=brand.id, expected_version=1, actor=seller_user)

    # Admin deactivates
    deactivated = deactivate_brand(brand_id=brand.id, expected_version=1, actor=admin_user)
    assert deactivated.is_active is False
    assert deactivated.version == 2

    event_deact = AuditEvent.objects.filter(action="registry.brand_deactivated").first()
    assert event_deact is not None
    assert event_deact.result == AuditResult.SUCCESS

    # No-op deactivate
    noop_deact = deactivate_brand(brand_id=brand.id, expected_version=2, actor=admin_user)
    assert noop_deact.version == 2

    # Workshop manager cannot activate
    with pytest.raises(BusinessPermissionDeniedError):
        activate_brand(brand_id=brand.id, expected_version=2, actor=workshop_manager_user)

    # Admin activates
    activated = activate_brand(brand_id=brand.id, expected_version=2, actor=admin_user)
    assert activated.is_active is True
    assert activated.version == 3

    event_act = AuditEvent.objects.filter(action="registry.brand_activated").first()
    assert event_act is not None
    assert event_act.result == AuditResult.SUCCESS

    # No-op activate
    noop_act = activate_brand(brand_id=brand.id, expected_version=3, actor=admin_user)
    assert noop_act.version == 3


@pytest.mark.django_db
def test_brand_not_found_raises_error(admin_user: User) -> None:
    with pytest.raises(BrandNotFoundError):
        update_brand(brand_id=99999, name="Test", expected_version=1, actor=admin_user)

    with pytest.raises(BrandNotFoundError):
        deactivate_brand(brand_id=99999, expected_version=1, actor=admin_user)

    with pytest.raises(BrandNotFoundError):
        activate_brand(brand_id=99999, expected_version=1, actor=admin_user)

    with pytest.raises(BrandNotFoundError):
        get_brand(brand_id=99999, actor=admin_user)


@pytest.mark.django_db
def test_brand_queries_accessible_by_all_three_roles(
    admin_user: User, workshop_manager_user: User, seller_user: User
) -> None:
    brand = VehicleBrand.objects.create(name="Mazda", is_active=True)

    assert get_brand(brand_id=brand.id, actor=admin_user).name == "Mazda"
    assert get_brand(brand_id=brand.id, actor=workshop_manager_user).name == "Mazda"
    assert get_brand(brand_id=brand.id, actor=seller_user).name == "Mazda"

    page_admin = search_brands(actor=admin_user, query="Maz")
    assert page_admin.total_count == 1
    assert page_admin.items[0].id == brand.id

    page_seller = search_brands(actor=seller_user, query="Maz")
    assert page_seller.total_count == 1

    page_manager = search_brands(actor=workshop_manager_user, is_active=True)
    assert page_manager.total_count >= 1


@pytest.mark.django_db
def test_brand_atomic_rollback_on_audit_failure(admin_user: User) -> None:
    with (
        patch(
            "customer_registry.application.brands.record_audit_event",
            side_effect=RuntimeError("Audit broker failed"),
        ),
        pytest.raises(RuntimeError),
    ):
        create_brand(name="RollbackBrand", actor=admin_user)

    assert not VehicleBrand.objects.filter(name="RollbackBrand").exists()


@pytest.mark.django_db
def test_deactivate_brand_preserves_vehicles_without_cascade(
    admin_user: User,
) -> None:
    brand = VehicleBrand.objects.create(name="Nissan", is_active=True, version=1)
    customer = Customer.objects.create(
        person_type="NATURAL",
        name="Elena Ramos",
        identification_type="CI",
        identification="0922334455",
        phone="0922334455",
        is_active=True,
    )
    # Vehicle 1 active, Vehicle 2 inactive
    v1 = Vehicle.objects.create(
        brand=brand,
        plate="NIS-0001",
        model="Sentra",
        is_active=True,
        version=1,
    )
    v2 = Vehicle.objects.create(
        brand=brand,
        plate="NIS-0002",
        model="Versa",
        is_active=False,
        version=1,
    )

    # Deactivate the brand
    deactivated_brand = deactivate_brand(
        brand_id=brand.id,
        expected_version=1,
        actor=admin_user,
    )
    assert deactivated_brand.is_active is False
    assert deactivated_brand.version == 2

    # Vehicles' is_active states must NOT have changed in cascade
    v1.refresh_from_db()
    v2.refresh_from_db()
    assert v1.is_active is True
    assert v2.is_active is False

    # Updating other fields of existing vehicle with deactivated brand succeeds
    updated_v1 = update_vehicle(
        actor=admin_user,
        vehicle_id=v1.id,
        expected_version=1,
        data={"color": "Azul", "model": "Sentra B17"},
    )
    assert updated_v1.color == "Azul"
    assert updated_v1.model == "Sentra B17"
    assert updated_v1.brand_id == brand.id

    # Creating a new vehicle with the deactivated brand is rejected
    with pytest.raises(InactiveReferenceError) as exc_info:
        create_vehicle(
            actor=admin_user,
            owner_id=customer.id,
            brand_id=brand.id,
            plate="NIS-9999",
            model="Kicks",
        )
    assert exc_info.value.reference_id == brand.id

    # Changing another vehicle's brand to this deactivated brand is rejected
    other_brand = VehicleBrand.objects.create(name="Honda", is_active=True, version=1)
    v3 = Vehicle.objects.create(
        brand=other_brand,
        plate="HON-1111",
        model="Civic",
        is_active=True,
        version=1,
    )
    with pytest.raises(InactiveReferenceError) as exc_info2:
        update_vehicle(
            actor=admin_user,
            vehicle_id=v3.id,
            expected_version=1,
            data={"brand_id": brand.id},
        )
    assert exc_info2.value.reference_id == brand.id
