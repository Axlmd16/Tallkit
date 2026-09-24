"""Restricciones de persistencia del taller: respaldo de las reglas de aplicación."""

from decimal import Decimal
from typing import Any

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from workshop.models import (
    Intervention,
    MaintenanceCounter,
    MaintenanceOrder,
    OrderPhoto,
    ServiceLine,
    StateTransition,
    WorkshopCommand,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(artisan: dict[str, Any], customer, vehicle, admin, today) -> MaintenanceOrder:  # type: ignore[no-untyped-def]
    return make_order(artisan, customer, vehicle, admin, today, 1)


def make_order(artisan, customer, vehicle, user, today, n: int, **extra: Any) -> MaintenanceOrder:  # type: ignore[no-untyped-def]
    values: dict[str, Any] = {
        "sequence": n,
        "number": f"ART-OT-{n:06d}",
        "fiscal_entity": artisan["entity"],
        "customer": customer,
        "vehicle": vehicle,
        "customer_snapshot": {"schema_version": 1},
        "vehicle_snapshot": {"schema_version": 1},
        "opened_on": today,
        "odometer_km": 1000,
        "created_by": user,
        "updated_by": user,
    }
    values.update(extra)
    return MaintenanceOrder.objects.create(**values)


def assert_violates(factory) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(IntegrityError), transaction.atomic():
        factory()


def test_counter_is_seeded_single_row() -> None:
    assert MaintenanceCounter.objects.get().pk == 1
    assert_violates(lambda: MaintenanceCounter.objects.create(pk=2, last_number=0))


def test_number_and_sequence_are_unique_and_formatted(  # type: ignore[no-untyped-def]
    order: MaintenanceOrder, artisan, customer, make_vehicle, admin, today
) -> None:
    other = make_vehicle(customer)
    assert_violates(
        lambda: make_order(artisan, customer, other, admin, today, 1, number="ART-OT-000009")
    )
    assert_violates(
        lambda: make_order(artisan, customer, other, admin, today, 9, number="ART-OT-000001")
    )
    assert_violates(lambda: make_order(artisan, customer, other, admin, today, 9, number="OT-9"))


def test_one_open_order_per_vehicle(  # type: ignore[no-untyped-def]
    order: MaintenanceOrder, artisan, customer, vehicle, admin, today
) -> None:
    assert_violates(lambda: make_order(artisan, customer, vehicle, admin, today, 2))
    MaintenanceOrder.objects.filter(pk=order.pk).update(state="FINALIZED")
    make_order(artisan, customer, vehicle, admin, today, 2)
    assert_violates(
        lambda: make_order(artisan, customer, vehicle, admin, today, 3, state="REOPENED")
    )


def test_state_must_be_valid(artisan, customer, vehicle, admin, today) -> None:  # type: ignore[no-untyped-def]
    assert_violates(
        lambda: make_order(artisan, customer, vehicle, admin, today, 5, state="CANCELLED")
    )


def test_interventions_constraints(order: MaintenanceOrder, admin) -> None:  # type: ignore[no-untyped-def]
    Intervention.objects.create(order=order, kind="INITIAL", ordinal=1, opened_by=admin)
    assert_violates(
        lambda: Intervention.objects.create(order=order, kind="INITIAL", ordinal=2, opened_by=admin)
    )
    assert_violates(
        lambda: Intervention.objects.create(
            order=order, kind="CORRECTIVE", ordinal=2, cause="x", opened_by=admin
        )
    )
    Intervention.objects.filter(order=order).update(closed_at=timezone.now(), closed_by=admin)
    assert_violates(
        lambda: Intervention.objects.create(
            order=order, kind="CORRECTIVE", ordinal=2, cause="  ", opened_by=admin
        )
    )
    Intervention.objects.create(
        order=order, kind="CORRECTIVE", ordinal=2, cause="Ruido", opened_by=admin
    )


def test_service_line_checks(order: MaintenanceOrder, admin, make_service, artisan) -> None:  # type: ignore[no-untyped-def]
    intervention = Intervention.objects.create(
        order=order, kind="INITIAL", ordinal=1, opened_by=admin
    )
    service = make_service()

    def line(**extra: Any) -> ServiceLine:
        values: dict[str, Any] = {
            "intervention": intervention,
            "service": service,
            "service_name": service.name,
            "reference_price": Decimal("25.00"),
            "applied_price": Decimal("25.00"),
            "quantity": 1,
            "tax_definition": artisan["tax"],
            "tax_name": "IVA",
            "position": 1,
            "created_by": admin,
            "updated_by": admin,
        }
        values.update(extra)
        return ServiceLine.objects.create(**values)

    line()
    assert_violates(lambda: line(quantity=0))
    assert_violates(lambda: line(applied_price=Decimal("-1")))


def test_photo_content_type_check(order: MaintenanceOrder, admin) -> None:  # type: ignore[no-untyped-def]
    intervention = Intervention.objects.create(
        order=order, kind="INITIAL", ordinal=1, opened_by=admin
    )

    def photo(content_type: str, n: int) -> OrderPhoto:
        return OrderPhoto.objects.create(
            order=order,
            intervention=intervention,
            storage_name=f"a{n}.jpg",
            thumbnail_name=f"a{n}_thumb.webp",
            content_type=content_type,
            size_bytes=10,
            width=1,
            height=1,
            sha256="0" * 64,
            uploaded_by=admin,
        )

    photo("image/jpeg", 1)
    assert_violates(lambda: photo("image/gif", 2))


def test_transition_pairs(order: MaintenanceOrder, admin) -> None:  # type: ignore[no-untyped-def]
    intervention = Intervention.objects.create(
        order=order, kind="INITIAL", ordinal=1, opened_by=admin
    )

    def transition(source: str, target: str) -> StateTransition:
        return StateTransition.objects.create(
            order=order, intervention=intervention, from_state=source, to_state=target, actor=admin
        )

    transition("REGISTERED", "FINALIZED")
    transition("FINALIZED", "REOPENED")
    assert_violates(lambda: transition("REGISTERED", "REOPENED"))


def test_command_receipt_unique(admin) -> None:  # type: ignore[no-untyped-def]
    WorkshopCommand.objects.create(
        actor=admin, action="a", idempotency_key="key-12345", input_fingerprint="f"
    )
    assert_violates(
        lambda: WorkshopCommand.objects.create(
            actor=admin, action="a", idempotency_key="key-12345", input_fingerprint="g"
        )
    )
    assert_violates(
        lambda: WorkshopCommand.objects.create(
            actor=admin, action="a", idempotency_key="bad key", input_fingerprint="g"
        )
    )
