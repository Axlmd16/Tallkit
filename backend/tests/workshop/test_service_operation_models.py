"""Restricciones de persistencia de la operación artesanal y sus pagos."""

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone
from tests.workshop.workshop_helpers import add_line, create

from workshop.models import (
    ArtisanPayment,
    ArtisanPaymentPart,
    MaintenanceOrder,
    ServiceLine,
    ServiceOperation,
    ServiceOperationLine,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def line(manager, artisan, customer, vehicle, make_service) -> ServiceLine:  # type: ignore[no-untyped-def]
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=1)
    add_line(manager, order["id"], service_id=make_service().pk)
    return ServiceLine.objects.get()


def _operation(line: ServiceLine, manager: Any, number: str = "ART-SER-000001", **extra: Any):  # type: ignore[no-untyped-def]
    order = MaintenanceOrder.objects.get(pk=line.intervention.order_id)
    values: dict[str, Any] = {
        "order": order,
        "fiscal_entity_id": order.fiscal_entity_id,
        "customer_id": order.customer_id,
        "customer_snapshot": {"schema_version": 1},
        "vehicle_snapshot": {"schema_version": 1},
        "fiscal_snapshot": {"schema_version": 1},
        "internal_number": number,
        "condition": "CONTADO",
        "operational_date": date(2026, 9, 24),
        "base_total": Decimal("20.00"),
        "tax_total": Decimal("3.00"),
        "grand_total": Decimal("23.00"),
        "created_by": manager,
    }
    values.update(extra)
    return ServiceOperation.objects.create(**values)


def _doc_line(operation: Any, line: ServiceLine, **extra: Any) -> ServiceOperationLine:
    values: dict[str, Any] = {
        "operation": operation,
        "service_line": line,
        "position": 1,
        "service_id": line.service_id,
        "service_name": line.service_name,
        "quantity": 1,
        "reference_price": Decimal("23.00"),
        "applied_price": Decimal("23.00"),
        "tax_definition_id": line.tax_definition_id,
        "tax_snapshot": {"schema_version": 1},
        "tax_rate": Decimal("15"),
        "base_amount": Decimal("20.00"),
        "tax_amount": Decimal("3.00"),
        "total_amount": Decimal("23.00"),
    }
    values.update(extra)
    return ServiceOperationLine.objects.create(**values)


def _violates(call: Any) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        call()


def test_internal_number_is_unique(line, manager) -> None:  # type: ignore[no-untyped-def]
    _operation(line, manager)
    _violates(lambda: _operation(line, manager))


def test_totals_must_be_positive_and_consistent(line, manager) -> None:  # type: ignore[no-untyped-def]
    _violates(
        lambda: _operation(
            line, manager, base_total=Decimal(0), tax_total=Decimal(0), grand_total=Decimal(0)
        )
    )
    _violates(lambda: _operation(line, manager, "ART-SER-000002", grand_total=Decimal("24.00")))


def test_voided_requires_reason_and_timestamp(line, manager) -> None:  # type: ignore[no-untyped-def]
    _violates(lambda: _operation(line, manager, state="VOIDED"))
    _operation(
        line,
        manager,
        "ART-SER-000003",
        state="VOIDED",
        void_reason="Error",
        voided_at=timezone.now(),
        voided_by=manager,
    )


def test_a_line_is_documented_once_while_current(line, manager) -> None:  # type: ignore[no-untyped-def]
    first = _operation(line, manager)
    _doc_line(first, line)
    second = _operation(line, manager, "ART-SER-000002")
    _violates(lambda: _doc_line(second, line))
    ServiceOperationLine.objects.filter(operation=first).update(is_current=False)
    _doc_line(second, line)


def test_line_amounts_are_consistent(line, manager) -> None:  # type: ignore[no-untyped-def]
    operation = _operation(line, manager)
    _violates(lambda: _doc_line(operation, line, total_amount=Decimal("22.00")))


def test_payment_and_parts_are_positive(line, manager) -> None:  # type: ignore[no-untyped-def]
    operation = _operation(line, manager)
    now = timezone.now()
    _violates(
        lambda: ArtisanPayment.objects.create(
            operation_id=uuid.uuid4(),
            service_operation=operation,
            amount=Decimal(0),
            effective_at=now,
            effective_date=now.date(),
            created_by=manager,
        )
    )
    payment = ArtisanPayment.objects.create(
        operation_id=uuid.uuid4(),
        service_operation=operation,
        amount=Decimal("10.00"),
        effective_at=now,
        effective_date=now.date(),
        created_by=manager,
    )
    ArtisanPaymentPart.objects.create(payment=payment, method="EFECTIVO", amount=Decimal("10.00"))
    _violates(
        lambda: ArtisanPaymentPart.objects.create(
            payment=payment, method="EFECTIVO", amount=Decimal("1.00")
        )
    )
    _violates(
        lambda: ArtisanPaymentPart.objects.create(
            payment=payment, method="CREDITO", amount=Decimal("1.00")
        )
    )


def test_orders_existing_before_billing_are_flagged_by_default_false(line) -> None:  # type: ignore[no-untyped-def]
    order = MaintenanceOrder.objects.get(pk=line.intervention.order_id)
    assert order.predates_billing is False
