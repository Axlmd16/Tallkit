"""Operación artesanal de servicios: vista previa, confirmación, numeración e idempotencia."""

from decimal import Decimal
from typing import Any
from unittest import mock

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    confirm_services,
    create,
    error_of,
    finalize,
    key,
    lines_of,
    preview_services,
    reopen,
    update_line,
    version,
)

from catalog.models import Service
from identity.application.authorization import BusinessPermissionDeniedError
from inventory.models import InventoryMovement, InventoryPosition
from workshop.application import orders, service_operations
from workshop.models import MaintenanceOrder, ServiceLine, ServiceOperation, ServiceOperationLine
from workshop_configuration.models import NumberAllocation, TaxDefinition, TaxPeriod

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(manager, artisan_billing, customer, vehicle) -> dict[str, Any]:  # type: ignore[no-untyped-def]
    return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)


def _diagnose(manager: Any, order_id: int) -> None:
    orders.update_order(
        actor=manager,
        order_id=order_id,
        payload={
            "diagnosis": "Frenos",
            "expected_version": version(order_id),
            "idempotency_key": key(),
        },
    )


def test_preview_has_no_effects_and_returns_digest(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="11.50", quantity=2)
    before = version(order["id"])

    body = preview_services(manager, order["id"], "CONTADO")

    assert body["totals"] == {"base": "20.00", "tax": "3.00", "total": "23.00"}
    [line] = body["lines"]
    assert (line["base_amount"], line["tax_amount"], line["total_amount"]) == (
        "20.00",
        "3.00",
        "23.00",
    )
    assert body["issues"] == []
    assert len(body["review_digest"]) == 64
    assert body["warnings"] == []
    assert version(order["id"]) == before
    assert not ServiceOperation.objects.exists()
    assert not NumberAllocation.objects.exists()


def test_confirm_documents_pending_initial_lines(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    service = make_service(name="Alineación")
    add_line(manager, order["id"], service_id=service.pk, applied_price="25.00")
    add_line(manager, order["id"], service_id=service.pk, applied_price="30.00")
    positions_before = list(InventoryPosition.objects.values_list())

    body = confirm_services(manager, order["id"], "CREDITO")

    assert body["internal_number"] == "ART-SER-000001"
    assert (body["condition"], body["state"], body["grand_total"]) == (
        "CREDITO",
        "CONFIRMED",
        "55.00",
    )
    assert [line["service_name"] for line in body["lines"]] == ["Alineación", "Alineación"]
    assert body["balance"] == "55.00"
    assert body["payment_state"] == "PENDING"
    assert body["fiscal_snapshot"]["entity"]["type"] == "ARTESANAL"
    assert ServiceOperationLine.objects.filter(is_current=True).count() == 2
    assert MaintenanceOrder.objects.get(pk=order["id"]).number == "ART-OT-000001"
    assert list(InventoryPosition.objects.values_list()) == positions_before
    assert not InventoryMovement.objects.exists()


def test_new_lines_go_to_a_second_operation(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service(name="Alineación").pk)
    first = confirm_services(manager, order["id"])
    add_line(
        manager, order["id"], service_id=make_service(name="Balanceo").pk, applied_price="15.00"
    )

    second = confirm_services(manager, order["id"])

    assert [line["service_name"] for line in second["lines"]] == ["Balanceo"]
    assert (first["internal_number"], second["internal_number"]) == (
        "ART-SER-000001",
        "ART-SER-000002",
    )


def test_nothing_to_document(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    error = error_of(lambda: confirm_services(manager, order["id"], review_digest="0" * 64))
    assert error.code == "nothing_to_document"
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="0.00")
    error = error_of(lambda: confirm_services(manager, order["id"]))
    assert error.code == "nothing_to_document"
    assert not NumberAllocation.objects.exists()


def test_zero_priced_lines_accompany_charged_lines(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="0.00")
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="10.00")
    body = confirm_services(manager, order["id"])
    assert [line["total_amount"] for line in body["lines"]] == ["0.00", "10.00"]


def test_corrective_lines_are_never_documented(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk)
    _diagnose(manager, order["id"])
    confirm_services(manager, order["id"])
    finalize(manager, order["id"])
    reopen(manager, order["id"])
    add_line(manager, order["id"], service_id=make_service().pk)

    error = error_of(lambda: confirm_services(manager, order["id"]))

    assert error.code == "nothing_to_document"
    corrective = ServiceLine.objects.filter(intervention__kind="CORRECTIVE").get()
    assert not corrective.documentations.exists()


def test_finalized_order_can_be_documented(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="80.00")
    _diagnose(manager, order["id"])
    finalize(manager, order["id"])
    body = confirm_services(manager, order["id"])
    assert body["grand_total"] == "80.00"
    assert MaintenanceOrder.objects.get(pk=order["id"]).state == "FINALIZED"


def test_changed_line_requires_new_review(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    [line] = lines_of(add_line(manager, order["id"], service_id=make_service().pk))
    digest = preview_services(manager, order["id"])["review_digest"]
    update_line(manager, order["id"], line["id"], applied_price="28.00")
    error = error_of(lambda: confirm_services(manager, order["id"], review_digest=digest))
    assert error.code == "review_required"
    assert not ServiceOperation.objects.exists()


def test_changed_condition_requires_new_review(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk)
    digest = preview_services(manager, order["id"], "CONTADO")["review_digest"]
    error = error_of(
        lambda: confirm_services(manager, order["id"], "CREDITO", review_digest=digest)
    )
    assert error.code == "review_required"


def test_missing_tax_validity_is_an_error_not_an_exemption(  # type: ignore[no-untyped-def]
    manager, order, make_service, artisan_billing
) -> None:
    orphan = TaxDefinition.objects.create(
        fiscal_entity=artisan_billing["entity"], code="SIN", name="Sin vigencia"
    )
    zero = TaxDefinition.objects.create(
        fiscal_entity=artisan_billing["entity"], code="CERO", name="Cero"
    )
    TaxPeriod.objects.create(tax_definition=zero, rate=Decimal("0"), starts_on="2025-01-01")
    add_line(manager, order["id"], service_id=make_service(tax_definition=zero).pk)
    add_line(manager, order["id"], service_id=make_service(tax_definition=orphan).pk)

    preview = preview_services(manager, order["id"])
    assert [issue["code"] for issue in preview["issues"]] == ["configuration_missing"]
    error = error_of(lambda: confirm_services(manager, order["id"]))

    assert error.code == "configuration_missing"
    assert not NumberAllocation.objects.exists()


def test_catalog_changes_do_not_alter_confirmed_operation(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    service = make_service(name="Alineación")
    add_line(manager, order["id"], service_id=service.pk, applied_price="25.00")
    body = confirm_services(manager, order["id"])
    service.name = "Otro"
    service.reference_price = Decimal("99.00")
    service.save()
    detail = service_operations.get_operation(actor=manager, operation_id=body["id"])
    assert (detail["lines"][0]["service_name"], detail["grand_total"]) == ("Alineación", "25.00")


def test_retry_with_same_key_returns_same_operation(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk)
    payload = {
        "condition": "CONTADO",
        "review_digest": preview_services(manager, order["id"])["review_digest"],
        "idempotency_key": key(),
        "expected_version": version(order["id"]),
    }
    first = service_operations.confirm_operation(
        actor=manager, order_id=order["id"], payload=dict(payload)
    )
    second = service_operations.confirm_operation(
        actor=manager, order_id=order["id"], payload=dict(payload)
    )
    assert second.replayed
    assert first.body["id"] == second.body["id"]
    assert ServiceOperation.objects.count() == 1
    conflict = error_of(
        lambda: service_operations.confirm_operation(
            actor=manager, order_id=order["id"], payload={**payload, "condition": "CREDITO"}
        )
    )
    assert conflict.code == "idempotency_conflict"


def test_failure_while_numbering_leaves_lines_pending(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk)
    with (
        mock.patch.object(
            service_operations, "allocate_artisan_number", side_effect=RuntimeError("fallo")
        ),
        pytest.raises(RuntimeError),
    ):
        confirm_services(manager, order["id"])
    assert not ServiceOperation.objects.exists()
    assert not ServiceOperationLine.objects.exists()
    assert confirm_services(manager, order["id"])["internal_number"] == "ART-SER-000001"


def test_seller_cannot_preview_or_confirm(seller, manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk)
    with pytest.raises(BusinessPermissionDeniedError):
        preview_services(seller, order["id"])
    with pytest.raises(BusinessPermissionDeniedError):
        confirm_services(seller, order["id"], review_digest="0" * 64)


def test_orders_predating_billing_warn_before_confirming(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk)
    MaintenanceOrder.objects.filter(pk=order["id"]).update(predates_billing=True)
    body = preview_services(manager, order["id"])
    assert [w["code"] for w in body["warnings"]] == ["predates_billing"]


def test_preview_and_confirm_carry_the_service_code_into_the_operation_lines(  # type: ignore[no-untyped-def]
    manager, order, make_service
) -> None:
    service = make_service(name="Alineación", code="SRV-000042")
    add_line(manager, order["id"], service_id=service.pk, applied_price="25.00")

    preview = preview_services(manager, order["id"], "CONTADO")
    assert [line["service_code"] for line in preview["lines"]] == ["SRV-000042"]

    body = confirm_services(manager, order["id"], "CONTADO")
    assert [line["service_code"] for line in body["lines"]] == ["SRV-000042"]
    stored = ServiceOperationLine.objects.get()
    assert stored.service_code == "SRV-000042"
    Service.objects.filter(pk=service.pk).update(code="SRV-000099")
    stored.refresh_from_db()
    assert stored.service_code == "SRV-000042"
