"""Contrato fiscal artesanal limitado a la operación de servicios."""

from dataclasses import FrozenInstanceError
from typing import Any

import pytest
from django.db import transaction
from tests.workshop.workshop_helpers import add_line, confirm_services, create

from workshop.models import ServiceOperation

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(manager: Any, artisan_billing: Any, customer: Any, vehicle: Any) -> dict[str, Any]:
    return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)


def test_artisan_source_contains_services_and_no_commercial_parts(
    manager: Any, order: dict[str, Any], make_service: Any
) -> None:
    from workshop.application.fiscal_source import read_fiscal_source

    add_line(
        manager,
        order["id"],
        service_id=make_service(name="Alineación").pk,
        applied_price="25.00",
    )
    operation_id = confirm_services(manager, order["id"], "CREDITO")["id"]
    source = read_fiscal_source(operation_id)

    assert source.state == "CONFIRMED"
    assert source.grand_total == "25.00"
    assert source.issuer_snapshot["entity"]["type"] == "ARTESANAL"
    assert [(line.description, line.quantity) for line in source.lines] == [("Alineación", "1")]
    assert not hasattr(source, "parts")
    assert not hasattr(source.lines[0], "product_id")
    with pytest.raises(FrozenInstanceError):
        source.state = "VOIDED"


def test_locking_read_does_not_change_artisan_operation(
    manager: Any, order: dict[str, Any], make_service: Any
) -> None:
    from workshop.application.fiscal_source import lock_fiscal_source, read_fiscal_source

    add_line(manager, order["id"], service_id=make_service().pk, applied_price="25.00")
    operation_id = confirm_services(manager, order["id"])["id"]
    before = ServiceOperation.objects.get(pk=operation_id)
    with transaction.atomic():
        locked = lock_fiscal_source(operation_id)
    current = ServiceOperation.objects.get(pk=operation_id)

    assert locked == read_fiscal_source(operation_id)
    assert (current.state, current.version, current.internal_number) == (
        before.state,
        before.version,
        before.internal_number,
    )
