"""Contrato OpenAPI de ventas: rutas, métodos, límites publicados y errores."""

from typing import Any

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db
P = "/api/v1/sales/"

EXPECTED = {
    P: {"get", "post"},
    P + "{id}/": {"get", "patch"},
    P + "draft-preview/": {"post"},
    P + "{id}/preview/": {"post"},
    P + "{id}/confirm/": {"post"},
    P + "{id}/document/": {"get"},
    P + "{id}/payments/": {"get", "post"},
    P + "{id}/payments/preview/": {"post"},
    P + "{id}/payments/{payment_id}/correction-preview/": {"post"},
    P + "{id}/payments/{payment_id}/correct/": {"post"},
    P + "{id}/returns/": {"get", "post"},
    P + "{id}/returns/preview/": {"post"},
    P + "{id}/refunds/": {"get", "post"},
    P + "{id}/refunds/preview/": {"post"},
    P + "{id}/void-preview/": {"post"},
    P + "{id}/void/": {"post"},
    P + "receivables/": {"get"},
    P + "operations/{operation_id}/": {"get"},
    P + "customer-options/": {"get"},
    P + "product-options/": {"get"},
}


@pytest.fixture
def schema(admin: Any) -> dict[str, Any]:
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get("/api/v1/schema/", HTTP_ACCEPT="application/json")
    assert response.status_code == 200
    return dict(response.json())


def path_key(schema: dict[str, Any], suffix: str) -> str:
    matches = [p for p in schema["paths"] if p.replace("{pk}", "{id}") == suffix]
    assert matches, suffix
    return str(matches[0])


def test_every_route_and_method_is_documented_and_no_delete_exists(schema: dict[str, Any]) -> None:
    for suffix, methods in EXPECTED.items():
        operations = set(schema["paths"][path_key(schema, suffix)]) - {"parameters"}
        assert methods == operations, suffix
    assert not any("delete" in schema["paths"][path_key(schema, s)] for s in EXPECTED)


def component(schema: dict[str, Any], name: str) -> dict[str, Any]:
    return dict(schema["components"]["schemas"][name])


def test_published_limits_are_in_the_schema(schema: dict[str, Any]) -> None:
    write = component(schema, "SaleWrite")
    assert write["properties"]["lines"]["maxItems"] == 200
    assert write["properties"]["notes"]["maxLength"] == 2000
    assert component(schema, "PaymentWrite")["properties"]["parts"]["maxItems"] == 2
    assert component(schema, "CorrectionWrite")["properties"]["reason"]["maxLength"] == 500
    assert component(schema, "ReturnWrite")["properties"]["lines"]["maxItems"] == 200
    assert component(schema, "VoidWrite")["properties"]["reason"]["minLength"] == 1
    assert component(schema, "Part")["properties"]["amount"]["type"] == "string"


def test_decimals_are_strings_and_lists_use_the_public_envelope(schema: dict[str, Any]) -> None:
    sale = component(schema, "Sale")
    for field in ("base_total", "tax_total", "grand_total"):
        assert sale["properties"][field]["type"] == "string"
    page = component(schema, "SalePage")
    assert set(page["properties"]) == {"count", "page", "page_size", "total_pages", "results"}
    receivables = component(schema, "ReceivablesPage")
    assert {"receivable_total", "refund_due_total"} <= set(receivables["properties"])
    unit = component(schema, "SaleLineWrite")["properties"]["quantity"]
    assert unit["type"] == "string"


def test_error_responses_and_query_parameters_are_declared(schema: dict[str, Any]) -> None:
    confirm = schema["paths"][path_key(schema, P + "{id}/confirm/")]["post"]
    assert {"200", "400", "403", "404", "409"} <= set(confirm["responses"])
    problem = confirm["responses"]["409"]["content"]
    assert "application/json" in problem or "application/problem+json" in problem
    params = {p["name"]: p for p in schema["paths"][path_key(schema, P)]["get"]["parameters"]}
    assert {
        "customer_id",
        "state",
        "payment_state",
        "date_from",
        "date_to",
        "page",
        "page_size",
    } <= set(params)
    assert {"min_age_days", "customer_id"} <= {
        p["name"]
        for p in schema["paths"][path_key(schema, P + "receivables/")]["get"]["parameters"]
    }
    assert "Sales" in {
        t
        for op in schema["paths"][path_key(schema, P)].values()
        if isinstance(op, dict)
        for t in op.get("tags", [])
    }


def test_existing_contracts_were_not_changed(schema: dict[str, Any]) -> None:
    for path in ("/api/v1/purchases/", "/api/v1/inventory/operations/", "/api/v1/users/"):
        assert any(p.startswith(path) for p in schema["paths"]), path
    assert "Confirm" in schema["components"]["schemas"]  # compras conserva su componente
    assert "SaleConfirm" in schema["components"]["schemas"]


def test_sale_list_and_receivables_publish_origin_filter(admin: Any) -> None:
    client = APIClient()
    client.force_authenticate(user=admin)
    schema = client.get("/api/v1/schema/", HTTP_ACCEPT="application/json").json()
    for path in (P, P + "receivables/"):
        params = {p["name"]: p for p in schema["paths"][path]["get"]["parameters"]}
        assert set(params["origin"]["schema"]["enum"]) == {"DIRECT", "MAINTENANCE"}
