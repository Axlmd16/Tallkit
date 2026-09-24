"""Matriz de permisos del taller por rol y combinación, incluidas descargas de archivos."""

from typing import Any

import pytest
from rest_framework.test import APIClient
from tests.workshop.workshop_helpers import create, image_bytes, key, upload

from identity.models import AuditEvent
from workshop.application import photos

pytestmark = pytest.mark.django_db
P = "/api/v1/maintenance-orders/"


@pytest.fixture
def setup(manager, artisan, customer, vehicle, make_service) -> dict[str, Any]:  # type: ignore[no-untyped-def]
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=1)
    body = photos.upload_photo(
        actor=manager,
        order_id=order["id"],
        file=upload(image_bytes()),
        description=None,
        idempotency_key=key(),
    ).body
    return {
        "order": order,
        "photo": body["photos"][0],
        "service": make_service(),
        "customer": customer,
    }


def requests(setup: dict[str, Any]) -> list[tuple[str, str, dict[str, Any] | None]]:
    oid = setup["order"]["id"]
    pid = setup["photo"]["id"]
    command = {"expected_version": 1, "idempotency_key": key()}
    return [
        ("get", P, None),
        ("get", f"{P}{oid}/", None),
        ("get", f"{P}{oid}/photos/{pid}/file/", None),
        ("get", f"{P}{oid}/photos/{pid}/thumbnail/", None),
        ("get", f"{P}customer-options/", None),
        ("get", f"{P}vehicle-options/?customer_id={setup['customer'].pk}", None),
        ("get", f"{P}service-options/", None),
        (
            "post",
            P,
            {"customer_id": 1, "vehicle_id": 1, "odometer_km": 1, "idempotency_key": key()},
        ),
        ("patch", f"{P}{oid}/", {"diagnosis": "x", **command}),
        ("patch", f"{P}{oid}/current-intervention/", {"notes": "x", **command}),
        ("post", f"{P}{oid}/service-lines/", {"service_id": setup["service"].pk, **command}),
        ("patch", f"{P}{oid}/service-lines/1/", {"quantity": 2, **command}),
        ("post", f"{P}{oid}/service-lines/1/remove/", command),
        ("post", f"{P}{oid}/finalize/", command),
        ("post", f"{P}{oid}/reopen/", {"reason": "x", **command}),
        ("post", f"{P}{oid}/photos/{pid}/remove/", {"idempotency_key": key()}),
    ]


def call(client: APIClient, method: str, url: str, data: dict[str, Any] | None) -> Any:
    return (
        getattr(client, method)(url, data, format="json") if data is not None else client.get(url)
    )


def test_seller_is_denied_everywhere(seller, setup) -> None:  # type: ignore[no-untyped-def]
    client = APIClient()
    client.force_authenticate(user=seller)
    for method, url, data in requests(setup):
        response = call(client, method, url, data)
        assert response.status_code == 403, (method, url, response.status_code)
        assert "number" not in response.content.decode()
    photo = client.post(
        f"{P}{setup['order']['id']}/photos/",
        {"file": upload(image_bytes()), "idempotency_key": key()},
        format="multipart",
    )
    assert photo.status_code == 403
    assert AuditEvent.objects.filter(actor=seller, result="DENIED").exists()


def test_anonymous_cannot_read_files(setup) -> None:  # type: ignore[no-untyped-def]
    client = APIClient()
    for suffix in ("file", "thumbnail"):
        response = client.get(f"{P}{setup['order']['id']}/photos/{setup['photo']['id']}/{suffix}/")
        assert response.status_code in (401, 403)
        assert response["Content-Type"].startswith("application/")


@pytest.mark.parametrize("who", ["admin", "manager", "seller_manager"])
def test_workshop_roles_are_allowed(request, setup, who) -> None:  # type: ignore[no-untyped-def]
    client = APIClient()
    client.force_authenticate(user=request.getfixturevalue(who))
    for method, url, data in requests(setup):
        response = call(client, method, url, data)
        assert response.status_code != 403, (who, method, url, response.content)
