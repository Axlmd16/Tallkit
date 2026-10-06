"""Contrato OpenAPI del resumen de inicio y de los filtros que enlaza."""

from typing import Any

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def schema(admin: Any) -> dict[str, Any]:
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get("/api/v1/schema/", HTTP_ACCEPT="application/json")
    assert response.status_code == 200
    return dict(response.json())


def parameters(schema: dict[str, Any], path: str) -> set[str]:
    return {item["name"] for item in schema["paths"][path]["get"].get("parameters", [])}


@pytest.mark.parametrize(
    ("path", "operation"),
    [
        ("/api/v1/home/pending/", "home_pending"),
        ("/api/v1/home/receivables/", "home_receivables"),
        ("/api/v1/home/collections/", "home_collections"),
    ],
)
def test_summary_routes_are_read_only_and_documented(
    schema: dict[str, Any], path: str, operation: str
) -> None:
    assert set(schema["paths"][path]) == {"get"}
    assert schema["paths"][path]["get"]["operationId"] == operation
    assert "200" in schema["paths"][path]["get"]["responses"]


def test_summary_shapes_carry_no_joint_total(schema: dict[str, Any]) -> None:
    components = schema["components"]["schemas"]
    assert set(components["Receivables"]["properties"]) == {"items"}
    assert set(components["Collections"]["properties"]) == {"timezone", "items"}
    assert set(components["PendingItem"]["properties"]) == {"key", "scope", "count"}


def test_linked_lists_document_their_new_filters(schema: dict[str, Any]) -> None:
    assert {"condition", "only_debt"} <= parameters(schema, "/api/v1/sales/receivables/")
    assert "condition" in parameters(schema, "/api/v1/service-operations/")
    assert "expires_within_days" in parameters(schema, "/api/v1/proformas/")
    states = next(
        item
        for item in schema["paths"]["/api/v1/maintenance-orders/"]["get"]["parameters"]
        if item["name"] == "state"
    )
    assert "OPEN" in states["schema"]["enum"]
