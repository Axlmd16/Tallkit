"""Detalle de servicio: nota opcional por línea, conservada al documentar (DP-035, regla 3).

Cubre los requisitos «Detalle de servicio en la línea» y «Detalle de servicio conservado en la
operación» de las specs `servicios-aplicados-al-mantenimiento` y `operacion-artesanal-de-servicios`.
"""

from typing import Any

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
    remove_line,
    reopen,
    update_line,
    version,
)

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import AuditEvent
from workshop.application import service_operations
from workshop.domain.input import parse_line_create, parse_line_update
from workshop.models import ServiceLine, ServiceOperationLine

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(manager, artisan, customer, vehicle) -> dict[str, Any]:  # type: ignore[no-untyped-def]
    return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)


def _finalize(manager, order_id: int) -> None:  # type: ignore[no-untyped-def]
    from workshop.models import MaintenanceOrder

    MaintenanceOrder.objects.filter(pk=order_id).update(diagnosis="Frenos")
    finalize(manager, order_id)


# --- Modelo (3.1) -----------------------------------------------------------------------------


def test_new_lines_start_without_detail(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk)
    assert ServiceLine.objects.get().detail == ""


def test_detail_column_admits_three_hundred_characters() -> None:
    assert ServiceLine._meta.get_field("detail").max_length == 300
    assert ServiceOperationLine._meta.get_field("detail").max_length == 300


# --- Entrada (3.2) ----------------------------------------------------------------------------


def test_create_input_distinguishes_absent_empty_and_written_detail() -> None:
    base = {"service_id": 1, "expected_version": 1, "idempotency_key": key()}
    assert parse_line_create(base).detail is None
    assert parse_line_create({**base, "detail": ""}).detail == ""
    assert parse_line_create({**base, "detail": "  incluye rectificado  "}).detail == (
        "incluye rectificado"
    )


def test_update_input_distinguishes_absent_empty_and_written_detail() -> None:
    base = {"expected_version": 1, "idempotency_key": key()}
    assert parse_line_update(base).detail is None
    assert parse_line_update({**base, "detail": ""}).detail == ""
    assert parse_line_update({**base, "detail": "frenos delanteros"}).detail == "frenos delanteros"


def test_detail_accepts_exactly_three_hundred_characters() -> None:
    base = {"expected_version": 1, "idempotency_key": key()}
    assert len(parse_line_update({**base, "detail": "d" * 300}).detail or "") == 300


@pytest.mark.parametrize(
    "detail", ["d" * 301, "dos\nlíneas", "dos\rlíneas", 12, ["lista"], {"a": 1}]
)
def test_detail_over_the_limit_multiline_or_not_text_is_rejected_without_trimming(
    detail: Any,
) -> None:
    from workshop.domain.input import InputError

    base = {"expected_version": 1, "idempotency_key": key()}
    for parse, extra in ((parse_line_update, {}), (parse_line_create, {"service_id": 1})):
        with pytest.raises(InputError) as caught:
            parse({**base, **extra, "detail": detail})
        assert "detail" in caught.value.errors


# --- Líneas (3.3) -----------------------------------------------------------------------------


def test_add_a_line_with_detail_keeps_it_without_changing_the_amounts(  # type: ignore[no-untyped-def]
    manager, order, make_service
) -> None:
    service = make_service(name="Alineación", reference_price="25.00")
    body = add_line(
        manager, order["id"], service_id=service.pk, detail="incluye rotación de llantas"
    )
    [line] = lines_of(body)
    assert line["detail"] == "incluye rotación de llantas"
    assert (line["applied_price"], line["subtotal"], body["services_total"]) == (
        "25.00",
        "25.00",
        "25.00",
    )


def test_add_a_line_without_detail_does_not_require_it(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    [line] = lines_of(add_line(manager, order["id"], service_id=make_service().pk))
    assert line["detail"] == ""


def test_write_the_detail_later_without_changing_the_total(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    before = add_line(manager, order["id"], service_id=make_service().pk)
    [line] = lines_of(before)
    after = update_line(manager, order["id"], line["id"], detail="frenos delanteros")
    assert lines_of(after)[0]["detail"] == "frenos delanteros"
    assert after["services_total"] == before["services_total"]
    assert after["version"] == before["version"] + 1


def test_an_empty_detail_removes_it_and_the_same_text_changes_nothing(  # type: ignore[no-untyped-def]
    manager, order, make_service
) -> None:
    [line] = lines_of(add_line(manager, order["id"], service_id=make_service().pk, detail="uno"))
    same = update_line(manager, order["id"], line["id"], detail="uno")
    assert same["version"] == version(order["id"])
    assert lines_of(same)[0]["detail"] == "uno"
    cleared = update_line(manager, order["id"], line["id"], detail="")
    assert lines_of(cleared)[0]["detail"] == ""
    assert ServiceLine.objects.get().detail == ""


def test_the_audit_records_the_changed_field_and_never_the_text(  # type: ignore[no-untyped-def]
    manager, order, make_service
) -> None:
    [line] = lines_of(add_line(manager, order["id"], service_id=make_service().pk))
    secret = "placa PBA1234 del cliente"
    update_line(manager, order["id"], line["id"], detail=secret)
    event = AuditEvent.objects.filter(action="maintenance.service_line_update").latest("id")
    assert event.metadata["changed_fields"] == ["detail"]
    assert secret not in str(event.metadata)
    assert not AuditEvent.objects.filter(metadata__icontains=secret).exists()


def test_a_documented_line_rejects_changing_its_detail(  # type: ignore[no-untyped-def]
    manager, admin, artisan_billing, customer, vehicle, make_service
) -> None:
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=5)
    [line] = lines_of(add_line(manager, order["id"], service_id=make_service().pk, detail="uno"))
    operation = confirm_services(manager, order["id"])
    for actor in (manager, admin):
        error = error_of(lambda a=actor: update_line(a, order["id"], line["id"], detail="dos"))
        assert error.code == "line_documented"
        assert operation["internal_number"] in error.message
    assert ServiceLine.objects.get().detail == "uno"


def test_a_finalized_order_rejects_changing_the_detail(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    [line] = lines_of(add_line(manager, order["id"], service_id=make_service().pk))
    _finalize(manager, order["id"])
    error = error_of(lambda: update_line(manager, order["id"], line["id"], detail="tarde"))
    assert error.code == "not_editable"
    assert "reábrala" in error.message.lower()
    assert ServiceLine.objects.get().detail == ""


def test_repeated_service_keeps_an_independent_detail_per_line(  # type: ignore[no-untyped-def]
    manager, order, make_service
) -> None:
    service = make_service(name="Alineación")
    add_line(manager, order["id"], service_id=service.pk, detail="eje delantero")
    body = add_line(manager, order["id"], service_id=service.pk)
    first, second = lines_of(body)
    update_line(manager, order["id"], second["id"], detail="eje trasero")
    stored = list(ServiceLine.objects.order_by("position").values_list("detail", flat=True))
    assert (first["detail"], stored) == ("eje delantero", ["eje delantero", "eje trasero"])


def test_the_catalog_does_not_keep_the_detail_so_a_new_line_starts_empty(  # type: ignore[no-untyped-def]
    manager, order, make_service
) -> None:
    service = make_service()
    add_line(manager, order["id"], service_id=service.pk, detail="solo esta línea")
    body = add_line(manager, order["id"], service_id=service.pk)
    assert [line["detail"] for line in lines_of(body)] == ["solo esta línea", ""]


def test_a_corrective_line_also_accepts_a_detail(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order["id"], service_id=make_service().pk)
    _finalize(manager, order["id"])
    reopen(manager, order["id"])
    body = add_line(manager, order["id"], service_id=make_service().pk, detail="ajuste sin cargo")
    assert lines_of(body, ordinal=2)[0]["detail"] == "ajuste sin cargo"


def test_two_simultaneous_edits_of_the_same_version_apply_only_one(  # type: ignore[no-untyped-def]
    manager, order, make_service
) -> None:
    [line] = lines_of(add_line(manager, order["id"], service_id=make_service().pk))
    stale = version(order["id"])
    update_line(manager, order["id"], line["id"], detail="primero", expected_version=stale)
    error = error_of(
        lambda: update_line(
            manager, order["id"], line["id"], detail="segundo", expected_version=stale
        )
    )
    assert error.code == "stale_record"
    assert ServiceLine.objects.get().detail == "primero"


def test_retrying_the_same_key_creates_one_line_with_one_detail(  # type: ignore[no-untyped-def]
    manager, order, make_service
) -> None:
    service = make_service()
    payload: dict[str, Any] = {
        "service_id": service.pk,
        "detail": "una vez",
        "idempotency_key": key(),
        "expected_version": version(order["id"]),
    }
    add_line(manager, order["id"], **payload)
    add_line(manager, order["id"], **payload)
    assert list(ServiceLine.objects.values_list("detail", flat=True)) == ["una vez"]


def test_reusing_a_key_with_another_detail_is_a_conflict(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    service = make_service()
    first: dict[str, Any] = {
        "service_id": service.pk,
        "detail": "uno",
        "idempotency_key": key(),
        "expected_version": version(order["id"]),
    }
    add_line(manager, order["id"], **first)
    error = error_of(lambda: add_line(manager, order["id"], **{**first, "detail": "dos"}))
    assert error.code == "idempotency_conflict"


def test_a_seller_cannot_write_the_detail(seller, manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    [line] = lines_of(add_line(manager, order["id"], service_id=make_service().pk, detail="uno"))
    with pytest.raises(BusinessPermissionDeniedError):
        update_line(seller, order["id"], line["id"], detail="dos")
    assert ServiceLine.objects.get().detail == "uno"


def test_removing_a_line_with_detail_leaves_the_others_untouched(  # type: ignore[no-untyped-def]
    manager, order, make_service
) -> None:
    add_line(manager, order["id"], service_id=make_service().pk, detail="se queda")
    removable = lines_of(
        add_line(manager, order["id"], service_id=make_service().pk, detail="sale")
    )
    remove_line(manager, order["id"], removable[1]["id"])
    assert list(ServiceLine.objects.values_list("detail", flat=True)) == ["se queda"]


# --- Operación artesanal (3.4) ----------------------------------------------------------------


def _operation_lines(operation_id: int) -> list[str]:
    return list(
        ServiceOperationLine.objects.filter(operation_id=operation_id)
        .order_by("position")
        .values_list("detail", flat=True)
    )


def test_confirming_keeps_a_historical_copy_of_the_detail(  # type: ignore[no-untyped-def]
    manager, artisan_billing, customer, vehicle, make_service
) -> None:
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=5)
    [line] = lines_of(
        add_line(manager, order["id"], service_id=make_service().pk, detail="rotación de llantas")
    )
    operation = confirm_services(manager, order["id"])
    assert _operation_lines(operation["id"]) == ["rotación de llantas"]
    assert [item["detail"] for item in operation["lines"]] == ["rotación de llantas"]
    # El cambio posterior en la orden no altera la copia.
    ServiceLine.objects.filter(pk=line["id"]).update(detail="otro texto")
    detail = service_operations.operation_detail(operation["id"], manager)
    assert [item["detail"] for item in detail["lines"]] == ["rotación de llantas"]


def test_the_preview_shows_the_detail_to_review(  # type: ignore[no-untyped-def]
    manager, artisan_billing, customer, vehicle, make_service
) -> None:
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=5)
    add_line(manager, order["id"], service_id=make_service().pk, detail="frenos delanteros")
    preview = preview_services(manager, order["id"])
    assert [item["detail"] for item in preview["lines"]] == ["frenos delanteros"]


def test_a_detail_changed_after_the_review_requires_a_new_review(  # type: ignore[no-untyped-def]
    manager, artisan_billing, customer, vehicle, make_service
) -> None:
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=5)
    [line] = lines_of(
        add_line(manager, order["id"], service_id=make_service().pk, detail="frenos delanteros")
    )
    digest = preview_services(manager, order["id"])["review_digest"]
    update_line(manager, order["id"], line["id"], detail="frenos traseros")
    error = error_of(lambda: confirm_services(manager, order["id"], review_digest=digest))
    assert error.code in {"review_required", "stale_record"}
    assert not ServiceOperationLine.objects.exists()


def test_a_line_without_detail_confirms_with_an_empty_copy(  # type: ignore[no-untyped-def]
    manager, artisan_billing, customer, vehicle, make_service
) -> None:
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=5)
    add_line(manager, order["id"], service_id=make_service().pk)
    operation = confirm_services(manager, order["id"])
    assert _operation_lines(operation["id"]) == [""]


def test_voiding_keeps_the_original_text_and_the_corrected_one_goes_to_the_new_operation(  # type: ignore[no-untyped-def]
    manager, admin, artisan_billing, customer, vehicle, make_service
) -> None:
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=5)
    [line] = lines_of(
        add_line(manager, order["id"], service_id=make_service().pk, detail="texto original")
    )
    first = confirm_services(manager, order["id"])
    service_operations.void_operation(
        actor=admin,
        operation_id=first["id"],
        payload={"reason": "Detalle equivocado", "expected_version": 1, "idempotency_key": key()},
    )
    update_line(manager, order["id"], line["id"], detail="texto corregido")
    second = confirm_services(manager, order["id"])
    assert _operation_lines(first["id"]) == ["texto original"]
    assert _operation_lines(second["id"]) == ["texto corregido"]
    assert second["id"] != first["id"]


def test_operations_confirmed_before_the_detail_existed_show_it_empty(  # type: ignore[no-untyped-def]
    manager, artisan_billing, customer, vehicle, make_service
) -> None:
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=5)
    add_line(manager, order["id"], service_id=make_service().pk)
    operation = confirm_services(manager, order["id"])
    ServiceOperationLine.objects.filter(operation_id=operation["id"]).update(detail="")
    detail = service_operations.operation_detail(operation["id"], manager)
    assert [item["detail"] for item in detail["lines"]] == [""]


# --- HTTP ------------------------------------------------------------------------------------


def test_the_detail_travels_through_the_http_api(manager, order, make_service) -> None:  # type: ignore[no-untyped-def]
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=manager)
    base = f"/api/v1/maintenance-orders/{order['id']}/service-lines/"
    created = client.post(
        base,
        {
            "service_id": make_service().pk,
            "detail": "frenos delanteros",
            "expected_version": version(order["id"]),
            "idempotency_key": "detail-http-1",
        },
        format="json",
    )
    assert created.status_code == 201, created.content
    line = created.json()["interventions"][0]["lines"][0]
    assert line["detail"] == "frenos delanteros"
    updated = client.patch(
        f"{base}{line['id']}/",
        {
            "detail": "frenos y discos",
            "expected_version": created.json()["version"],
            "idempotency_key": "detail-http-2",
        },
        format="json",
    )
    assert updated.status_code == 200, updated.content
    assert updated.json()["interventions"][0]["lines"][0]["detail"] == "frenos y discos"
    rejected = client.patch(
        f"{base}{line['id']}/",
        {
            "detail": "x" * 301,
            "expected_version": updated.json()["version"],
            "idempotency_key": "detail-http-3",
        },
        format="json",
    )
    assert rejected.status_code == 400
    assert "detail" in rejected.json()["errors"]
