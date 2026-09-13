from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.db import close_old_connections

from customer_registry.application.vehicles import (
    InactiveReferenceError,
    StaleVehicleRecordError,
    create_vehicle,
    transfer_vehicle_ownership,
)
from customer_registry.domain.validation import IdentificationType, PersonType
from customer_registry.models import Customer, OwnershipPeriod, VehicleBrand
from identity.domain.authorization import Role
from identity.models import User, UserRole


@pytest.fixture
def admin_user(db: None) -> User:
    user = User.objects.create(username="admin_conc")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    return user


@pytest.fixture
def brand(db: None) -> VehicleBrand:
    return VehicleBrand.objects.create(name="Toyota Concurrency")


@pytest.fixture
def customer_a(db: None) -> Customer:
    return Customer.objects.create(
        person_type=PersonType.NATURAL.value,
        name="Cliente A",
        identification_type=IdentificationType.CI.value,
        identification="0911111111",
        phone="0991111111",
    )


@pytest.fixture
def customer_b(db: None) -> Customer:
    return Customer.objects.create(
        person_type=PersonType.NATURAL.value,
        name="Cliente B",
        identification_type=IdentificationType.CI.value,
        identification="0922222222",
        phone="0992222222",
    )


@pytest.fixture
def customer_c(db: None) -> Customer:
    return Customer.objects.create(
        person_type=PersonType.NATURAL.value,
        name="Cliente C",
        identification_type=IdentificationType.CI.value,
        identification="0933333333",
        phone="0993333333",
    )


@pytest.mark.django_db(transaction=True)
def test_concurrent_transfers_same_vehicle_leaves_single_winner(
    admin_user: User,
    brand: VehicleBrand,
    customer_a: Customer,
    customer_b: Customer,
    customer_c: Customer,
) -> None:
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer_a.id,
        brand_id=brand.id,
        plate="CON-0001",
        model="Corolla",
    )
    barrier = Barrier(2)

    def transfer(target_customer_id: int) -> str:
        close_old_connections()
        barrier.wait()
        try:
            actor = User.objects.get(id=admin_user.id)
            transfer_vehicle_ownership(
                vehicle_id=vehicle.id,
                new_owner_id=target_customer_id,
                expected_version=1,
                actor=actor,
            )
            return "transferred"
        except StaleVehicleRecordError:
            return "stale"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(transfer, [customer_b.id, customer_c.id]))

    # Exactly one succeeded and one received StaleVehicleRecordError
    assert sorted(results) == ["stale", "transferred"]

    # Verify database integrity: exactly one open period
    open_periods = OwnershipPeriod.objects.filter(vehicle=vehicle, ended_at__isnull=True)
    assert open_periods.count() == 1
    winner_period = open_periods.first()
    assert winner_period is not None
    assert winner_period.customer_id in (customer_b.id, customer_c.id)

    # Total periods: exactly 2 (initial period + 1 transfer)
    all_periods = list(OwnershipPeriod.objects.filter(vehicle=vehicle).order_by("started_at", "id"))
    assert len(all_periods) == 2
    initial_p, second_p = all_periods[0], all_periods[1]
    assert initial_p.customer_id == customer_a.id
    assert initial_p.ended_at == second_p.started_at
    assert second_p.ended_at is None

    # Version bumped to 2
    vehicle.refresh_from_db()
    assert vehicle.version == 2


@pytest.mark.django_db(transaction=True)
def test_bidirectional_concurrent_transfers_avoid_deadlock_with_ordered_locking(
    admin_user: User,
    brand: VehicleBrand,
    customer_a: Customer,
    customer_b: Customer,
) -> None:
    # Ensure customer IDs are distinct and ordered
    v1 = create_vehicle(
        actor=admin_user,
        owner_id=customer_a.id,
        brand_id=brand.id,
        plate="BIDI-0001",
        model="Corolla",
    )
    v2 = create_vehicle(
        actor=admin_user,
        owner_id=customer_b.id,
        brand_id=brand.id,
        plate="BIDI-0002",
        model="Yaris",
    )

    barrier = Barrier(2)

    # Thread 1 transfers v1 (A -> B)
    # Thread 2 transfers v2 (B -> A)
    # Since both involve {customer_a.id, customer_b.id}, deterministic sorting
    # ensures both acquire customer locks in identical order (min_id then max_id).
    def do_transfer(params: tuple[int, int]) -> str:
        veh_id, target_id = params
        close_old_connections()
        barrier.wait()
        try:
            actor = User.objects.get(id=admin_user.id)
            transfer_vehicle_ownership(
                vehicle_id=veh_id,
                new_owner_id=target_id,
                expected_version=1,
                actor=actor,
            )
            return "ok"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                do_transfer,
                [(v1.id, customer_b.id), (v2.id, customer_a.id)],
            )
        )

    # Both must succeed without deadlock
    assert results == ["ok", "ok"]

    # Verify both transfers took effect
    v1.refresh_from_db()
    v2.refresh_from_db()
    assert v1.current_owner == customer_b
    assert v2.current_owner == customer_a


@pytest.mark.django_db(transaction=True)
def test_transfer_vs_new_owner_deactivation_concurrency(
    admin_user: User,
    brand: VehicleBrand,
    customer_a: Customer,
    customer_b: Customer,
) -> None:
    vehicle = create_vehicle(
        actor=admin_user,
        owner_id=customer_a.id,
        brand_id=brand.id,
        plate="ACT-0001",
        model="Corolla",
    )
    barrier = Barrier(2)

    def do_transfer() -> str:
        close_old_connections()
        barrier.wait()
        try:
            actor = User.objects.get(id=admin_user.id)
            transfer_vehicle_ownership(
                vehicle_id=vehicle.id,
                new_owner_id=customer_b.id,
                expected_version=1,
                actor=actor,
            )
            return "transferred"
        except InactiveReferenceError:
            return "rejected_inactive"
        finally:
            close_old_connections()

    def do_deactivate() -> str:
        close_old_connections()
        barrier.wait()
        try:
            from django.db import transaction

            with transaction.atomic():
                c = Customer.objects.select_for_update().get(id=customer_b.id)
                c.is_active = False
                c.save(update_fields=["is_active"])
            return "deactivated"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        t1 = executor.submit(do_transfer)
        t2 = executor.submit(do_deactivate)
        transfer_result = t1.result()
        deactivate_result = t2.result()

    assert deactivate_result == "deactivated"
    # Transfer either completed before deactivation ("transferred") or
    # was rejected because customer_b was deactivated first ("rejected_inactive").
    assert transfer_result in ("transferred", "rejected_inactive")

    # In either case, the vehicle has exactly one open period and is consistent:
    open_periods = OwnershipPeriod.objects.filter(vehicle=vehicle, ended_at__isnull=True)
    assert open_periods.count() == 1
