"""Líneas de servicio: catálogo, precio aplicado, cantidades, total e historia."""

from decimal import Decimal
from typing import Any

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    create,
    error_of,
    finalize,
    key,
    lines_of,
    remove_line,
    reopen,
    update_line,
    version,
)

from catalog.models import Service
from workshop.application import service_lines
from workshop.models import ServiceLine

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(manager, artisan, customer, vehicle) -> dict[str, Any]:  # type: ignore[no-untyped-def]
    return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)


def test_add_service_copies_reference_price(manager, order, make_service, artisan) -> None:  # type: ignore[no-untyped-def]
    service = make_service(name="Alineación", reference_price=Decimal("25.00"))
    body = add_line(manager, order["id"], service_id=service.pk)
    [line] = lines_of(body)
    assert (line["service_name"], line["reference_price"], line["applied_price"]) == (
        "Alineación",
        "25.00",
        "25.00",
    )
    assert (line["quantity"], line["subtotal"], body["services_total"]) == (1, "25.00", "25.00")
    stored = ServiceLine.objects.get()
    assert (stored.tax_definition_id, stored.tax_name) == (artisan["tax"].pk, "IVA servicios")
    assert body["version"] == order["version"] + 1


def test_adjusted_price_does_not_touch_catalog(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    service = make_service(name="Cambio de embrague", reference_price=Decimal("300.00"))
    body = add_line(manager, order["id"], service_id=service.pk, applied_price="350.00")
    [line] = lines_of(body)
    assert (line["reference_price"], line["applied_price"]) == ("300.00", "350.00")
    service.refresh_from_db()
    assert service.reference_price == Decimal("300.00")


def test_zero_price_is_allowed(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    body = add_line(manager, order["id"], service_id=make_service().pk, applied_price="0")
    assert lines_of(body)[0]["subtotal"] == "0.00"


@pytest.mark.parametrize("price", ["-1.00", "10.005", "abc"])
def test_invalid_price_is_rejected(manager, order, make_service, price) -> None:  # type: ignore[no-untyped-def]
    error = error_of(
        lambda: add_line(manager, order["id"], service_id=make_service().pk, applied_price=price)
    )
    assert "applied_price" in error.errors
    assert not ServiceLine.objects.exists()


def test_inactive_missing_or_free_service_rejected(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    inactive = make_service(is_active=False)
    assert error_of(lambda: add_line(manager, order["id"], service_id=inactive.pk)).code == (
        "inactive_reference"
    )
    assert (
        "service_id" in error_of(lambda: add_line(manager, order["id"], service_id=999999)).errors
    )
    free = error_of(lambda: add_line(manager, order["id"], service_name="Libre", applied_price="5"))
    assert free.code == "unknown_field"
    assert not ServiceLine.objects.exists()


def test_repeated_service_forms_independent_lines(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    service = make_service(name="Alineación", reference_price=Decimal("25.00"))
    add_line(manager, order["id"], service_id=service.pk)
    body = add_line(manager, order["id"], service_id=service.pk, applied_price="30.00")
    assert [line["applied_price"] for line in lines_of(body)] == ["25.00", "30.00"]
    assert body["services_total"] == "55.00"


def test_retry_with_same_key_creates_one_line(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    payload = {
        "service_id": make_service().pk,
        "expected_version": version(order["id"]),
        "idempotency_key": "line-retry-1",
    }
    service_lines.add_line(actor=manager, order_id=order["id"], payload=dict(payload))
    again = service_lines.add_line(actor=manager, order_id=order["id"], payload=dict(payload))
    assert again.replayed
    assert ServiceLine.objects.count() == 1


def test_change_quantity_and_remove(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    first = add_line(manager, order["id"], service_id=make_service().pk, applied_price="12.50")
    line_id = lines_of(first)[0]["id"]
    body = update_line(manager, order["id"], line_id, quantity=3)
    assert (lines_of(body)[0]["subtotal"], body["services_total"]) == ("37.50", "37.50")
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="1.00")
    body = remove_line(manager, order["id"], line_id)
    assert body["services_total"] == "1.00"
    assert len(lines_of(body)) == 1


@pytest.mark.parametrize("quantity", [0, -1, 1.5])
def test_invalid_quantity(manager, order, make_service, quantity) -> None:  # type: ignore[no-untyped-def]
    line_id = lines_of(add_line(manager, order["id"], service_id=make_service().pk))[0]["id"]
    error = error_of(lambda: update_line(manager, order["id"], line_id, quantity=quantity))
    assert "quantity" in error.errors


def test_discount_fields_are_rejected(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    line_id = lines_of(add_line(manager, order["id"], service_id=make_service().pk))[0]["id"]
    for field in ("discount", "discount_percent"):
        error = error_of(lambda f=field: update_line(manager, order["id"], line_id, **{f: 5}))
        assert error.code == "unknown_field"


def test_catalog_changes_do_not_alter_existing_lines(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    service = make_service(name="Alineación", reference_price=Decimal("25.00"))
    add_line(manager, order["id"], service_id=service.pk)
    Service.objects.filter(pk=service.pk).update(
        reference_price=Decimal("28.00"), name="Alineación 3D"
    )
    body = add_line(manager, order["id"], service_id=service.pk)
    old, new = lines_of(body)
    assert (old["service_name"], old["reference_price"], old["applied_price"]) == (
        "Alineación",
        "25.00",
        "25.00",
    )
    assert (new["service_name"], new["reference_price"]) == ("Alineación 3D", "28.00")
    Service.objects.filter(pk=service.pk).update(is_active=False)
    detail = add_line(manager, order["id"], service_id=make_service().pk)
    assert lines_of(detail)[0]["service_is_active"] is False
    assert lines_of(detail)[0]["service_name"] == "Alineación"


def test_stale_version_rejected(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    error = error_of(
        lambda: add_line(manager, order["id"], service_id=make_service().pk, expected_version=99)
    )
    assert error.code == "stale_record"


def complete_and_finalize(manager, order, make_service) -> int:  # type: ignore[no-untyped-def]
    from workshop.models import MaintenanceOrder

    add_line(manager, order["id"], service_id=make_service().pk, applied_price="120.00")
    MaintenanceOrder.objects.filter(pk=order["id"]).update(diagnosis="Frenos")
    finalize(manager, order["id"])
    line_id: int = lines_of(create_detail(manager, order["id"]))[0]["id"]
    return line_id


def create_detail(actor: Any, order_id: int) -> dict[str, Any]:
    from workshop.application.projection import order_detail

    return order_detail(order_id, actor)


def test_lines_blocked_when_finalized(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    line_id = complete_and_finalize(manager, order, make_service)
    for call in (
        lambda: add_line(manager, order["id"], service_id=make_service().pk),
        lambda: update_line(manager, order["id"], line_id, quantity=2),
        lambda: remove_line(manager, order["id"], line_id),
    ):
        assert error_of(call).code == "not_editable"


def test_corrective_lines_are_free_and_initial_locked(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    initial_line = complete_and_finalize(manager, order, make_service)
    reopen(manager, order["id"])
    assert error_of(lambda: update_line(manager, order["id"], initial_line, quantity=2)).code == (
        "not_editable"
    )
    assert error_of(lambda: remove_line(manager, order["id"], initial_line)).code == "not_editable"
    service = make_service(name="Ajuste de frenos", reference_price=Decimal("20.00"))
    body = add_line(manager, order["id"], service_id=service.pk)
    [corrective] = lines_of(body, 2)
    assert (
        corrective["applied_price"],
        corrective["reference_price"],
        corrective["no_charge"],
    ) == (
        "0.00",
        "20.00",
        True,
    )
    assert body["services_total"] == "120.00"
    error = error_of(
        lambda: add_line(manager, order["id"], service_id=service.pk, applied_price="5.00")
    )
    assert "applied_price" in error.errors
    error = error_of(
        lambda: update_line(manager, order["id"], corrective["id"], applied_price="5.00")
    )
    assert "applied_price" in error.errors


def test_price_change_requires_permission(manager, order, make_service, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from identity.application import authorization

    original = authorization.has_permission

    def without_price(actor, permission):  # type: ignore[no-untyped-def]
        if permission == "mantenimientos.cambiar_precio_servicio":
            return False
        return original(actor, permission)

    monkeypatch.setattr("identity.application.authorization.has_permission", without_price)
    service = make_service(reference_price=Decimal("10.00"))
    from identity.application.authorization import BusinessPermissionDeniedError

    with pytest.raises(BusinessPermissionDeniedError):
        add_line(manager, order["id"], service_id=service.pk, applied_price="11.00")
    body = add_line(manager, order["id"], service_id=service.pk, applied_price="10.00")
    assert lines_of(body)[0]["applied_price"] == "10.00"
    body = add_line(manager, order["id"], service_id=service.pk, idempotency_key=key())
    assert len(lines_of(body)) == 2


@pytest.mark.parametrize("field", ["subtotal", "total", "reference_price"])
def test_client_amounts_are_not_accepted(manager, order, make_service, field) -> None:  # type: ignore[no-untyped-def]
    error = error_of(
        lambda: add_line(manager, order["id"], service_id=make_service().pk, **{field: "1.00"})
    )
    assert error.code == "unknown_field"
    assert not ServiceLine.objects.exists()


# --- Líneas documentadas en una operación artesanal ------------------------------------------


def test_documented_line_is_locked_until_its_operation_is_voided(  # type: ignore[no-untyped-def]
    manager, admin, artisan_billing, customer, vehicle, make_service
) -> None:
    from tests.workshop.workshop_helpers import confirm_services

    from workshop.application import service_operations

    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=5)
    [line] = lines_of(add_line(manager, order["id"], service_id=make_service().pk))
    operation = confirm_services(manager, order["id"])

    for call in (
        lambda: update_line(manager, order["id"], line["id"], applied_price="30.00"),
        lambda: remove_line(manager, order["id"], line["id"]),
    ):
        error = error_of(call)
        assert error.code == "line_documented"
        assert operation["internal_number"] in error.message

    detail = lines_of(orders_detail(manager, order["id"]))[0]
    assert detail["documented_by"] == {
        "id": operation["id"],
        "number": operation["internal_number"],
    }

    service_operations.void_operation(
        actor=admin,
        operation_id=operation["id"],
        payload={"reason": "Precio equivocado", "expected_version": 1, "idempotency_key": key()},
    )
    body = update_line(manager, order["id"], line["id"], applied_price="30.00")
    [edited] = lines_of(body)
    assert (edited["applied_price"], edited["documented_by"]) == ("30.00", None)
    assert version(order["id"]) > 1


def orders_detail(actor: Any, order_id: int) -> dict[str, Any]:
    from workshop.application import queries

    return queries.get_order(actor=actor, order_id=order_id)
