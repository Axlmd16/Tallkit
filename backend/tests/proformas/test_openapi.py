"""Contrato OpenAPI de proformas y del origen proforma en ventas."""

from typing import Any

import pytest
from django.urls import get_resolver
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db
P = "/api/v1/proformas/"

EXPECTED = {
    P: {"get", "post"},
    P + "{id}/": {"get", "patch"},
    P + "draft-preview/": {"post"},
    P + "{id}/issue-preview/": {"get"},
    P + "{id}/issue/": {"post"},
    P + "{id}/void/": {"post"},
    P + "{id}/copy/": {"post"},
    P + "{id}/conversion-preview/": {"get"},
    P + "{id}/convert/": {"post"},
    P + "{id}/document/": {"get"},
    P + "{id}/document/logo/": {"get"},
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


def component(schema: dict[str, Any], operation: dict[str, Any], status: str) -> dict[str, Any]:
    content = operation["responses"][status]["content"]
    ref = next(iter(content.values()))["schema"]["$ref"]
    return dict(schema["components"]["schemas"][ref.rsplit("/", 1)[-1]])


def test_every_route_and_method_is_documented_and_no_delete_exists(schema: dict[str, Any]) -> None:
    documented = {p for p in schema["paths"] if p.startswith(P)}
    assert {path_key(schema, suffix) for suffix in EXPECTED} == documented
    for suffix, methods in EXPECTED.items():
        operations = set(schema["paths"][path_key(schema, suffix)]) - {"parameters"}
        assert methods == operations, suffix


def test_documented_routes_match_the_real_ones(schema: dict[str, Any]) -> None:
    resolver = get_resolver()
    for suffix in EXPECTED:
        concrete = suffix.replace("{id}", "1")
        assert resolver.resolve(concrete), concrete
    names = {
        pattern.name
        for pattern in __import__("proformas.api.urls", fromlist=["urlpatterns"]).urlpatterns
    }
    assert len(names) == len(EXPECTED)


def test_operations_are_tagged_identified_and_document_conflicts(schema: dict[str, Any]) -> None:
    seen = set()
    for suffix, methods in EXPECTED.items():
        for method in methods:
            operation = schema["paths"][path_key(schema, suffix)][method]
            assert operation["tags"] == ["Proformas"]
            assert operation["operationId"].startswith("proformas_")
            seen.add(operation["operationId"])
            assert "403" in operation["responses"], (suffix, method)
            if method in {"post", "patch"}:
                assert {"400", "409"} <= set(operation["responses"]), (suffix, method)
    assert len(seen) == sum(len(m) for m in EXPECTED.values())


def test_writes_publish_examples_of_conflicts(schema: dict[str, Any]) -> None:
    for suffix in ("{id}/issue/", "{id}/convert/", "{id}/void/"):
        operation = schema["paths"][path_key(schema, P + suffix)]["post"]
        examples = next(iter(operation["responses"]["409"]["content"].values()))["examples"]
        codes = {example["value"]["code"] for example in examples.values()}
        assert {
            "proforma_converted",
            "review_required",
            "stale_record",
            "proforma_expired",
        } <= codes
    create = schema["paths"][path_key(schema, P)]["post"]
    request_examples = next(iter(create["requestBody"]["content"].values()))["examples"]
    example = next(iter(request_examples.values()))["value"]
    assert set(example) == {"idempotency_key", "customer_id", "lines"}


def test_write_contract_has_no_economic_fields(schema: dict[str, Any]) -> None:
    schemas = schema["components"]["schemas"]
    for name in ("ProformaWrite", "PatchedProformaPatch", "ProformaLineWrite", "DraftPreview"):
        matches = [key for key in schemas if key == name or key == f"{name}Request"]
        assert matches, name
        for key in matches:
            fields = set(schemas[key]["properties"])
            assert not fields & {
                "unit_price",
                "price",
                "discount",
                "tax_rate",
                "total",
                "condition",
                "state",
                "internal_number",
            }, key
    assert schemas["ProformaLineWrite"]["properties"]["quantity"]["type"] == "string"


def test_response_decimals_are_strings_and_states_are_enumerated(schema: dict[str, Any]) -> None:
    detail = component(schema, schema["paths"][path_key(schema, P + "{id}/")]["get"], "200")
    for field in ("base_total", "tax_total", "grand_total"):
        assert detail["properties"][field]["type"] == "string", field
    state = detail["properties"]["state"]
    enum = (
        state.get("enum")
        or schema["components"]["schemas"][state["allOf"][0]["$ref"].rsplit("/", 1)[-1]]["enum"]
    )
    assert set(enum) == {"DRAFT", "VALID", "EXPIRED", "CONVERTED", "VOIDED"}
    assert not [name for name in detail["properties"] if "cost" in name]
    listing = schema["paths"][path_key(schema, P)]["get"]
    params = {p["name"]: p for p in listing["parameters"]}
    assert set(params["state"]["schema"]["enum"]) == set(enum)
    assert {"search", "customer_id", "page", "page_size"} <= set(params)


def test_logo_route_documents_binary_and_absence(schema: dict[str, Any]) -> None:
    operation = schema["paths"][path_key(schema, P + "{id}/document/logo/")]["get"]
    assert {"200", "204", "403", "404"} <= set(operation["responses"])
    assert "image/*" in operation["responses"]["200"]["content"]


def test_sales_contract_gains_the_proforma_origin_without_breaking(schema: dict[str, Any]) -> None:
    sales = "/api/v1/sales/"
    listing = schema["paths"][sales]["get"]
    origin = next(p for p in listing["parameters"] if p["name"] == "origin")
    assert origin["schema"]["enum"] == ["DIRECT", "MAINTENANCE", "PROFORMA"]
    schemas = schema["components"]["schemas"]
    assert set(schemas["SaleOrigin"]["properties"]) == {
        "type",
        "order_id",
        "order_number",
        "proforma_id",
        "proforma_number",
    }
    sale = schemas["Sale"]
    assert "quote_comparison" in sale["properties"]
    assert "quote_comparison" not in sale.get("required", [])
    assert "origin" in sale["required"]
    for name in ("SaleWrite", "SaleWriteRequest", "PatchedSalePatch", "PatchedSalePatchRequest"):
        if name in schemas:
            assert not {"origin", "origin_type", "proforma_id"} & set(schemas[name]["properties"])
    for suffix in ("{id}/confirm/", "{id}/payments/", "receivables/"):
        assert any(p.replace("{pk}", "{id}") == sales + suffix for p in schema["paths"]), suffix
