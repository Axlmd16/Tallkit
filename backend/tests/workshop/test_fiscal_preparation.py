"""Preparación artesanal separada y discrepancia por reapertura posterior."""

from typing import Any

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    confirm_services,
    create,
    finalize,
    key,
    reopen,
    version,
)

from identity.application.authorization import BusinessPermissionDeniedError
from workshop.application import orders
from workshop.models import ServiceOperation

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(manager: Any, artisan_billing: Any, customer: Any, vehicle: Any) -> dict[str, Any]:
    return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)


def _operation(manager: Any, order: dict[str, Any], make_service: Any) -> ServiceOperation:
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="25.00")
    operation_id = confirm_services(manager, order["id"])["id"]
    return ServiceOperation.objects.get(pk=operation_id)


def test_manager_creates_artisan_draft_but_seller_cannot(
    manager: Any, seller: Any, order: dict[str, Any], make_service: Any
) -> None:
    from fiscal.application.preparations import create_draft

    operation = _operation(manager, order, make_service)
    result = create_draft(
        actor=manager,
        source_kind="ARTISAN",
        source_id=operation.pk,
        idempotency_key="fiscal:artisan:001",
    )
    assert result.preparation_id
    with pytest.raises(BusinessPermissionDeniedError):
        create_draft(
            actor=seller,
            source_kind="ARTISAN",
            source_id=operation.pk,
            idempotency_key="fiscal:artisan:002",
        )


def test_reopening_order_is_visible_without_cancelling_artisan_preparation(
    manager: Any, order: dict[str, Any], make_service: Any
) -> None:
    from fiscal.application.preparations import create_draft, query_discrepancy
    from fiscal.models import FiscalPreparation

    operation = _operation(manager, order, make_service)
    result = create_draft(
        actor=manager,
        source_kind="ARTISAN",
        source_id=operation.pk,
        idempotency_key="fiscal:artisan:001",
    )
    orders.update_order(
        actor=manager,
        order_id=order["id"],
        payload={
            "diagnosis": "Frenos",
            "expected_version": version(order["id"]),
            "idempotency_key": key(),
        },
    )
    finalize(manager, order["id"])
    reopen(manager, order["id"])

    discrepancy = query_discrepancy(actor=manager, preparation_id=result.preparation_id)
    assert discrepancy.source_changed
    assert not discrepancy.state_changed
    assert not discrepancy.corrections_changed
    assert FiscalPreparation.objects.get(pk=result.preparation_id).state == "DRAFT"


def test_later_artisan_void_is_reported_without_cancelling_preparation(
    manager: Any, admin: Any, order: dict[str, Any], make_service: Any
) -> None:
    """Escenario «Anulación artesanal posterior»: se muestra la discrepancia, sin cancelar."""
    from fiscal.application.preparations import create_draft, query_discrepancy
    from fiscal.models import FiscalPreparation
    from workshop.application import service_operations

    operation = _operation(manager, order, make_service)
    result = create_draft(
        actor=manager,
        source_kind="ARTISAN",
        source_id=operation.pk,
        idempotency_key="fiscal:artisan:void",
    )
    service_operations.void_operation(
        actor=admin,
        operation_id=operation.pk,
        payload={
            "reason": "Error de registro",
            "expected_version": operation.version,
            "idempotency_key": key(),
        },
    )

    discrepancy = query_discrepancy(actor=manager, preparation_id=result.preparation_id)
    assert discrepancy.state_changed
    assert (discrepancy.original_state, discrepancy.current_state) == ("CONFIRMED", "VOIDED")
    assert FiscalPreparation.objects.get(pk=result.preparation_id).state == "DRAFT"


def test_manager_draft_is_prefilled_with_cedula_and_services_only(
    manager: Any, order: dict[str, Any], make_service: Any, customer: Any
) -> None:
    from fiscal.application.preparations import create_draft, get_preparation

    operation = _operation(manager, order, make_service)
    result = create_draft(
        actor=manager,
        source_kind="ARTISAN",
        source_id=operation.pk,
        idempotency_key="fiscal:artisan:prefill",
    )
    detail = get_preparation(actor=manager, preparation_id=result.preparation_id)
    assert detail.draft is not None
    receiver = detail.draft["receiver"]
    assert receiver["identification_type"] == "05"
    assert receiver["identification"] == customer.identification
    assert customer.identification_type == "CI"
    assert detail.summary is not None
    assert detail.summary["kind"] == "ARTISAN"
    assert detail.summary["grand_total"] == "25.00"
    assert detail.draft["payments"]["forms"] == [{"payment_code": "01", "amount": "25.00"}]
