from __future__ import annotations

from typing import Any

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db
P = "/api/v1/fiscal/"


@pytest.fixture
def schema(role_admin: Any) -> dict[str, Any]:
    client = APIClient()
    client.force_authenticate(user=role_admin)
    response = client.get("/api/v1/schema/", HTTP_ACCEPT="application/json")
    assert response.status_code == 200
    return dict(response.json())


def test_fiscal_routes_and_local_semantics_are_published(schema: dict[str, Any]) -> None:
    expected = {
        P + "preparations/": {"get", "post"},
        P + "preparations/{preparation_id}/": {"get", "patch"},
        P + "preparations/{preparation_id}/review/": {"post"},
        P + "preparations/{preparation_id}/prepare/": {"post"},
        P + "preparations/{preparation_id}/cancel/": {"post"},
        P + "preparations/{preparation_id}/test-identity/": {"post"},
        P + "archive/": {"get", "post"},
        P + "archive/export/": {"post"},
        P + "archive/{dossier_id}/download/": {"get"},
        P + "archive/{dossier_id}/link/": {"post"},
        P + "corrections/": {"get", "post"},
        P + "corrections/{request_id}/": {"get"},
        P + "corrections/{request_id}/prepare/": {"post"},
        P + "corrections/{request_id}/cancel/": {"post"},
        P + "corrections/{request_id}/replace/": {"post"},
        P + "corrections/{request_id}/evidence/": {"post"},
        P + "readiness/": {"get", "post"},
        P + "readiness/restorations/": {"post"},
        P + "configuration/entities/{entity_id}/electronic-profile/": {"get", "put"},
        P + "configuration/entities/{entity_id}/establishments/": {"get", "post"},
        P + "configuration/establishments/{establishment_id}/": {"patch"},
        P + "configuration/establishments/{establishment_id}/points/": {"post"},
        P + "configuration/points/{point_id}/": {"patch"},
        P + "configuration/tax-mappings/": {"post"},
        P + "configuration/entities/{entity_id}/electronic-status/": {"get"},
        P + "configuration/entities/{entity_id}/preparation-defaults/": {"get", "put"},
        P + "configuration/entities/{entity_id}/withholding-settings/": {"get", "put"},
        P + "configuration/catalogs/{kind}/": {"get"},
        P + "configuration/entities/{entity_id}/tax-mappings/": {"get"},
        P + "configuration/entities/{entity_id}/payment-forms/": {"get"},
        P + "configuration/entities/{entity_id}/payment-forms/{code}/": {"put"},
        P + "configuration/numbering-antecedents/": {"post"},
    }
    for path, methods in expected.items():
        assert path in schema["paths"], path
        assert methods == set(schema["paths"][path]) - {"parameters"}

    archive = schema["paths"][P + "archive/"]["get"]
    assert "no verificada" in archive["description"].lower()
    assert {parameter["name"] for parameter in archive["parameters"]} >= {
        "fiscal_entity_id",
        "environment",
        "document_type",
        "issued_from",
        "issued_to",
        "page",
        "page_size",
    }
    page_schema = archive["responses"]["200"]["content"]["application/json"]["schema"]
    assert page_schema["$ref"].endswith("/FiscalArchivePage")
    prepare = schema["paths"][P + "preparations/{preparation_id}/prepare/"]["post"]
    assert {"400", "403", "404", "409"} <= set(prepare["responses"])


def test_fiscal_contract_uses_strings_for_money_and_publishes_limits(
    schema: dict[str, Any],
) -> None:
    components = schema["components"]["schemas"]
    assert components["FiscalArchiveSummary"]["properties"]["total"]["type"] == "string"
    assert components["FiscalCorrectionLineWrite"]["properties"]["base_amount"]["type"] == "string"
    assert components["FiscalArchiveUpload"]["properties"]["xml"]["format"] == "binary"
    assert components["FiscalArchiveExport"]["properties"]["dossier_ids"]["maxItems"] == 100


def test_existing_sales_and_workshop_contracts_remain_visible(schema: dict[str, Any]) -> None:
    assert "/api/v1/sales/" in schema["paths"]
    assert "/api/v1/service-operations/{id}/document/" in schema["paths"]
