"""Contrato HTTP del taller: códigos, problemas, paginación, importes, fotos y CSRF."""

from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from tests.workshop.workshop_helpers import image_bytes

pytestmark = pytest.mark.django_db
P = "/api/v1/maintenance-orders/"


@pytest.fixture
def api(manager) -> APIClient:  # type: ignore[no-untyped-def]
    client = APIClient()
    client.force_authenticate(user=manager)
    return client


@pytest.fixture
def created(api, artisan, customer, vehicle) -> dict[str, Any]:  # type: ignore[no-untyped-def]
    response = api.post(
        P,
        {
            "customer_id": customer.pk,
            "vehicle_id": vehicle.pk,
            "odometer_km": 5,
            "idempotency_key": "api-create-1",
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    body: dict[str, Any] = response.json()
    return body


def problem(response: Any, status: int, code: str) -> dict[str, Any]:
    assert response.status_code == status, response.content
    assert response["Content-Type"] == "application/problem+json"
    body: dict[str, Any] = response.json()
    assert body["code"] == code
    return body


def test_create_list_and_detail(api, created) -> None:  # type: ignore[no-untyped-def]
    assert created["number"] == "ART-OT-000001"
    page = api.get(P, {"search": "abc", "page_size": 5}).json()
    assert (page["count"], page["page"], page["page_size"], page["total_pages"]) == (1, 1, 5, 1)
    assert page["results"][0]["services_total"] == "0.00"
    assert api.get(P, {"state": "OPEN"}).json()["count"] == 1
    assert api.get(P, {"state": "FINALIZED"}).json()["count"] == 0
    assert api.get(P, {"state": "ABIERTA"}).status_code == 400
    detail = api.get(f"{P}{created['id']}/").json()
    assert detail["allowed_actions"] == [
        "edit",
        "manage_services",
        "change_price",
        "manage_photos",
        "finalize",
    ]
    assert [r["code"] for r in detail["pending_requirements"]] == ["diagnosis", "service_lines"]


def test_errors_use_problem_contract(api, created, customer, vehicle) -> None:  # type: ignore[no-untyped-def]
    body = problem(
        api.post(
            P,
            {
                "customer_id": customer.pk,
                "vehicle_id": vehicle.pk,
                "odometer_km": 1,
                "idempotency_key": "api-create-2",
            },
            format="json",
        ),
        409,
        "open_order_exists",
    )
    assert body["conflict"] == {"type": "maintenance_order", "id": created["id"]}
    problem(api.get(f"{P}999999/"), 404, "not_found")
    problem(
        api.patch(
            f"{P}{created['id']}/",
            {"state": "FINALIZED", "expected_version": 1, "idempotency_key": "api-patch-1"},
            format="json",
        ),
        400,
        "unknown_field",
    )
    problem(
        api.patch(
            f"{P}{created['id']}/",
            {"diagnosis": "x", "expected_version": 9, "idempotency_key": "api-patch-2"},
            format="json",
        ),
        409,
        "stale_record",
    )
    problem(
        api.get(P, {"date_from": "2026-02-01", "date_to": "2026-01-01"}), 400, "validation_error"
    )
    problem(api.get(P, {"page_size": 500}), 400, "validation_error")
    body = problem(
        api.post(
            f"{P}{created['id']}/finalize/",
            {"expected_version": 1, "idempotency_key": "api-fin-1"},
            format="json",
        ),
        400,
        "finalize_requirements",
    )
    assert body["details"] == {"pending": ["diagnosis", "service_lines"]}
    problem(
        api.post(
            f"{P}{created['id']}/reopen/",
            {"reason": "x", "expected_version": 1, "idempotency_key": "api-reo-1"},
            format="json",
        ),
        409,
        "invalid_state",
    )


def test_lines_finalize_and_reopen_via_http(api, created, make_service) -> None:  # type: ignore[no-untyped-def]
    service = make_service()
    oid = created["id"]
    body = api.post(
        f"{P}{oid}/service-lines/",
        {
            "service_id": service.pk,
            "quantity": 2,
            "applied_price": "12.345",
            "expected_version": 1,
            "idempotency_key": "api-line-0",
        },
        format="json",
    )
    problem(body, 400, "validation_error")
    body = api.post(
        f"{P}{oid}/service-lines/",
        {
            "service_id": service.pk,
            "quantity": 2,
            "applied_price": "12.50",
            "expected_version": 1,
            "idempotency_key": "api-line-1",
        },
        format="json",
    ).json()
    line = body["interventions"][0]["lines"][0]
    assert (line["subtotal"], body["services_total"]) == ("25.00", "25.00")
    body = api.patch(
        f"{P}{oid}/service-lines/{line['id']}/",
        {"quantity": 3, "expected_version": body["version"], "idempotency_key": "api-line-2"},
        format="json",
    ).json()
    assert body["services_total"] == "37.50"
    body = api.patch(
        f"{P}{oid}/",
        {
            "diagnosis": "Frenos",
            "expected_version": body["version"],
            "idempotency_key": "api-diag-1",
        },
        format="json",
    ).json()
    body = api.post(
        f"{P}{oid}/finalize/",
        {"expected_version": body["version"], "idempotency_key": "api-fin-2"},
        format="json",
    ).json()
    assert body["state"] == "FINALIZED"
    body = api.post(
        f"{P}{oid}/reopen/",
        {"reason": "Ruido", "expected_version": body["version"], "idempotency_key": "api-reo-2"},
        format="json",
    ).json()
    body = api.patch(
        f"{P}{oid}/current-intervention/",
        {
            "work_performed": "Ajuste",
            "expected_version": body["version"],
            "idempotency_key": "api-int-1",
        },
        format="json",
    ).json()
    removal = api.post(
        f"{P}{oid}/service-lines/{line['id']}/remove/",
        {"expected_version": body["version"], "idempotency_key": "api-line-3"},
        format="json",
    )
    problem(removal, 409, "not_editable")


def test_photo_upload_download_and_headers(api, created) -> None:  # type: ignore[no-untyped-def]
    oid = created["id"]
    response = api.post(
        f"{P}{oid}/photos/",
        {
            "file": SimpleUploadedFile("a.jpg", image_bytes(), "image/jpeg"),
            "description": "Golpe",
            "idempotency_key": "api-photo-1",
        },
        format="multipart",
    )
    assert response.status_code == 201, response.content
    photo = response.json()["photos"][0]
    for url, content_type in (
        (photo["file_url"], "image/jpeg"),
        (photo["thumbnail_url"], "image/webp"),
    ):
        file_response = api.get(url)
        assert file_response.status_code == 200
        assert file_response["Content-Type"] == content_type
        assert file_response["Cache-Control"] == "private, no-store"
        assert file_response["X-Content-Type-Options"] == "nosniff"
        assert file_response["Content-Security-Policy"] == "default-src 'none'"
        b"".join(file_response.streaming_content)
    problem(
        api.post(f"{P}{oid}/photos/", {"idempotency_key": "api-photo-2"}, format="multipart"),
        400,
        "validation_error",
    )
    problem(
        api.post(
            f"{P}{oid}/photos/",
            {
                "file": SimpleUploadedFile("a.jpg", b"%PDF-1.4", "image/jpeg"),
                "idempotency_key": "api-photo-3",
            },
            format="multipart",
        ),
        400,
        "invalid_image",
    )
    api.post(
        f"{P}{oid}/photos/{photo['id']}/remove/", {"idempotency_key": "api-photo-4"}, format="json"
    )
    problem(api.get(photo["file_url"]), 404, "not_found")
    problem(api.get(f"{P}{oid + 1}/photos/{photo['id']}/file/"), 404, "not_found")


def test_options_endpoints(api, created, customer, make_service) -> None:  # type: ignore[no-untyped-def]
    make_service(name="Alineación")
    customers = api.get(f"{P}customer-options/", {"search": "ana"}).json()
    assert customers["results"][0]["id"] == customer.pk
    vehicles = api.get(f"{P}vehicle-options/", {"customer_id": customer.pk}).json()
    assert vehicles["results"][0]["open_order"]["number"] == "ART-OT-000001"
    problem(api.get(f"{P}vehicle-options/"), 400, "validation_error")
    services = api.get(f"{P}service-options/", {"search": "alin"}).json()
    assert services["results"][0]["reference_price"] == "25.00"


def test_csrf_is_enforced_for_session_writes(manager, artisan, customer, vehicle) -> None:  # type: ignore[no-untyped-def]
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(manager)
    response = client.post(
        P,
        {
            "customer_id": customer.pk,
            "vehicle_id": vehicle.pk,
            "odometer_km": 1,
            "idempotency_key": "csrf-test-1",
        },
        format="json",
    )
    assert response.status_code == 403


def test_orders_cannot_be_deleted(api, created) -> None:  # type: ignore[no-untyped-def]
    response = api.delete(f"{P}{created['id']}/")
    assert response.status_code == 405
    assert api.get(f"{P}{created['id']}/").status_code == 200
