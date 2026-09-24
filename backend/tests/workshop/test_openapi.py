"""Contrato OpenAPI del taller: rutas y métodos publicados."""

from typing import Any

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db
P = "/api/v1/maintenance-orders/"

EXPECTED = {
    P: {"get", "post"},
    P + "{id}/": {"get", "patch"},
    P + "{id}/current-intervention/": {"patch"},
    P + "{id}/service-lines/": {"post"},
    P + "{id}/service-lines/{line_id}/": {"patch"},
    P + "{id}/service-lines/{line_id}/remove/": {"post"},
    P + "{id}/finalize/": {"post"},
    P + "{id}/reopen/": {"post"},
    P + "{id}/photos/": {"post"},
    P + "{id}/photos/{photo_id}/remove/": {"post"},
    P + "{id}/photos/{photo_id}/file/": {"get"},
    P + "{id}/photos/{photo_id}/thumbnail/": {"get"},
    P + "customer-options/": {"get"},
    P + "vehicle-options/": {"get"},
    P + "service-options/": {"get"},
}


def test_workshop_paths_and_methods(admin: Any) -> None:
    client = APIClient()
    client.force_authenticate(user=admin)
    schema = client.get("/api/v1/schema/", HTTP_ACCEPT="application/json").json()
    published = {
        path: {m for m in ops if m in {"get", "post", "patch", "put", "delete"}}
        for path, ops in schema["paths"].items()
        if path.startswith(P)
    }
    assert published == EXPECTED
    assert "delete" not in str(published)
    create = schema["paths"][P]["post"]
    assert set(create["responses"]) >= {"201", "400", "403", "409"}
