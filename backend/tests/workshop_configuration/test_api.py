"""Pruebas HTTP para la API de configuración operativa y fiscal.

Tareas 5.1, 5.2, 5.3 — trazabilidad: decisión 6 del diseño,
spec "Acceso administrativo a la configuración", "Idempotencia de comandos administrativos".
"""

from datetime import date, timedelta

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from identity.domain.authorization import Role
from identity.models import User, UserRole
from workshop_configuration.models import (
    DocumentSeries,
    FiscalEntity,
    NumberingScope,
    TaxDefinition,
    TaxPeriod,
    Warehouse,
    WorkshopConfiguration,
)


# ---------------------------------------------------------------------------
# Fixtures comunes
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_client(db: None) -> APIClient:
    user = User.objects.create_user(username="wc-admin", password="p")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def seller_client(db: None) -> APIClient:
    user = User.objects.create_user(username="wc-seller", password="p")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon_client(db: None) -> APIClient:
    return APIClient()


@pytest.fixture
def initialized(db: None) -> dict[str, object]:
    """Estado post-inicialización directo (sin pasar por el API)."""
    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    comercial = FiscalEntity.objects.create(
        entity_type="COMERCIAL",
        ruc="0991234567001",
        legal_name="Taller Comercial",
    )
    artesanal = FiscalEntity.objects.create(
        entity_type="ARTESANAL",
        ruc="1791234567001",
        legal_name="Taller Artesanal",
    )
    warehouse = Warehouse.objects.create(pk=1, name="Bodega principal")
    return {
        "comercial": comercial,
        "artesanal": artesanal,
        "warehouse": warehouse,
    }


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------


BASE = "/api/v1/workshop-configuration"


@pytest.mark.django_db
def test_status_not_initialized(admin_client: APIClient) -> None:
    resp = admin_client.get(f"{BASE}/status/")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["is_initialized"] is False


@pytest.mark.django_db
def test_status_initialized(admin_client: APIClient, initialized: dict) -> None:
    resp = admin_client.get(f"{BASE}/status/")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["is_initialized"] is True


@pytest.mark.django_db
def test_status_requires_auth(anon_client: APIClient) -> None:
    resp = anon_client.get(f"{BASE}/status/")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_status_requires_admin_permission(seller_client: APIClient) -> None:
    resp = seller_client.get(f"{BASE}/status/")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Initialize
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_initialize_success(admin_client: APIClient) -> None:
    resp = admin_client.post(
        f"{BASE}/initialize/",
        {
            "commercial_ruc": "0991234567001",
            "commercial_legal_name": "Taller Comercial",
            "artisanal_ruc": "1791234567001",
            "artisanal_legal_name": "Taller Artesanal",
            "warehouse_name": "Bodega principal",
            "idempotency_key": "init-test-001",
        },
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    assert "installation_id" in resp.data

    # La segunda llamada con la misma clave es idempotente
    resp2 = admin_client.post(
        f"{BASE}/initialize/",
        {
            "commercial_ruc": "0991234567001",
            "commercial_legal_name": "Taller Comercial",
            "artisanal_ruc": "1791234567001",
            "artisanal_legal_name": "Taller Artesanal",
            "warehouse_name": "Bodega principal",
            "idempotency_key": "init-test-001",
        },
        format="json",
    )
    assert resp2.status_code == status.HTTP_200_OK
    assert resp2.data["installation_id"] == resp.data["installation_id"]


@pytest.mark.django_db
def test_initialize_conflict_if_already_done(admin_client: APIClient, initialized: dict) -> None:
    resp = admin_client.post(
        f"{BASE}/initialize/",
        {
            "commercial_ruc": "0991234567001",
            "commercial_legal_name": "Taller Comercial",
            "artisanal_ruc": "1791234567001",
            "artisanal_legal_name": "Taller Artesanal",
            "warehouse_name": "Bodega principal",
            "idempotency_key": "init-conflict-001",
        },
        format="json",
    )
    assert resp.status_code == status.HTTP_409_CONFLICT
    assert resp["Content-Type"] == "application/problem+json"
    assert "code" in resp.data


@pytest.mark.django_db
def test_initialize_requires_admin(seller_client: APIClient) -> None:
    resp = seller_client.post(
        f"{BASE}/initialize/",
        {
            "commercial_ruc": "0991234567001",
            "commercial_legal_name": "Taller Comercial",
            "artisanal_ruc": "1791234567001",
            "artisanal_legal_name": "Taller Artesanal",
            "warehouse_name": "Bodega principal",
            "idempotency_key": "init-seller-001",
        },
        format="json",
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_initialize_validation_error(admin_client: APIClient) -> None:
    resp = admin_client.post(
        f"{BASE}/initialize/",
        {
            "commercial_ruc": "INVALIDO",
            "commercial_legal_name": "TC",
            "artisanal_ruc": "1791234567001",
            "artisanal_legal_name": "TA",
            "warehouse_name": "Bodega",
            "idempotency_key": "init-val-001",
        },
        format="json",
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert resp["Content-Type"] == "application/problem+json"


# ---------------------------------------------------------------------------
# Entities
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_entities(admin_client: APIClient, initialized: dict) -> None:
    resp = admin_client.get(f"{BASE}/entities/")
    assert resp.status_code == status.HTTP_200_OK
    types = {e["entity_type"] for e in resp.data}
    assert types == {"COMERCIAL", "ARTESANAL"}


@pytest.mark.django_db
def test_list_entities_seller_denied(seller_client: APIClient, initialized: dict) -> None:
    resp = seller_client.get(f"{BASE}/entities/")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_get_entity(admin_client: APIClient, initialized: dict) -> None:
    entity: FiscalEntity = initialized["comercial"]
    resp = admin_client.get(f"{BASE}/entities/{entity.pk}/")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["ruc"] == "0991234567001"
    assert resp.data["entity_type"] == "COMERCIAL"


@pytest.mark.django_db
def test_get_entity_not_found(admin_client: APIClient, initialized: dict) -> None:
    resp = admin_client.get(f"{BASE}/entities/99999/")
    assert resp.status_code == status.HTTP_404_NOT_FOUND
    assert resp["Content-Type"] == "application/problem+json"


@pytest.mark.django_db
def test_update_entity_legal_name(admin_client: APIClient, initialized: dict) -> None:
    entity: FiscalEntity = initialized["comercial"]
    resp = admin_client.patch(
        f"{BASE}/entities/{entity.pk}/",
        {"legal_name": "Taller Comercial Actualizado", "expected_version": 1},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["legal_name"] == "Taller Comercial Actualizado"
    assert resp.data["version"] == 2


@pytest.mark.django_db
def test_update_entity_stale_version(admin_client: APIClient, initialized: dict) -> None:
    entity: FiscalEntity = initialized["comercial"]
    resp = admin_client.patch(
        f"{BASE}/entities/{entity.pk}/",
        {"legal_name": "Nuevo Nombre", "expected_version": 99},
        format="json",
    )
    assert resp.status_code == status.HTTP_409_CONFLICT
    assert resp["Content-Type"] == "application/problem+json"


@pytest.mark.django_db
def test_update_entity_type_immutable(admin_client: APIClient, initialized: dict) -> None:
    entity: FiscalEntity = initialized["comercial"]
    resp = admin_client.patch(
        f"{BASE}/entities/{entity.pk}/",
        {"entity_type": "ARTESANAL", "expected_version": 1},
        format="json",
    )
    assert resp.status_code == status.HTTP_409_CONFLICT
    assert resp["Content-Type"] == "application/problem+json"


# ---------------------------------------------------------------------------
# Warehouse
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_warehouse(admin_client: APIClient, initialized: dict) -> None:
    resp = admin_client.get(f"{BASE}/warehouse/")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["name"] == "Bodega principal"
    assert resp.data["is_active"] is True


@pytest.mark.django_db
def test_update_warehouse(admin_client: APIClient, initialized: dict) -> None:
    resp = admin_client.patch(
        f"{BASE}/warehouse/",
        {"name": "Depósito central", "expected_version": 1},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["name"] == "Depósito central"
    assert resp.data["version"] == 2


@pytest.mark.django_db
def test_update_warehouse_stale(admin_client: APIClient, initialized: dict) -> None:
    resp = admin_client.patch(
        f"{BASE}/warehouse/",
        {"name": "Nuevo nombre", "expected_version": 99},
        format="json",
    )
    assert resp.status_code == status.HTTP_409_CONFLICT


@pytest.mark.django_db
def test_warehouse_seller_denied(seller_client: APIClient, initialized: dict) -> None:
    resp = seller_client.get(f"{BASE}/warehouse/")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Tax Definitions
# ---------------------------------------------------------------------------


@pytest.fixture
def tax_def(initialized: dict, admin_client: APIClient) -> TaxDefinition:
    entity: FiscalEntity = initialized["comercial"]
    return TaxDefinition.objects.create(
        fiscal_entity=entity,
        code="IVA",
        name="IVA",
    )


@pytest.mark.django_db
def test_list_taxes(admin_client: APIClient, tax_def: TaxDefinition) -> None:
    entity_id = tax_def.fiscal_entity_id
    resp = admin_client.get(f"{BASE}/taxes/?entity_id={entity_id}")
    assert resp.status_code == status.HTTP_200_OK
    assert len(resp.data) >= 1
    assert any(t["code"] == "IVA" for t in resp.data)


@pytest.mark.django_db
def test_create_tax_def(admin_client: APIClient, initialized: dict) -> None:
    entity: FiscalEntity = initialized["comercial"]
    resp = admin_client.post(
        f"{BASE}/taxes/",
        {"entity_id": entity.pk, "code": "ice", "name": "Impuesto al Consumo"},
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.data["code"] == "ICE"  # normalizado


@pytest.mark.django_db
def test_create_tax_def_seller_denied(seller_client: APIClient, initialized: dict) -> None:
    entity: FiscalEntity = initialized["comercial"]
    resp = seller_client.post(
        f"{BASE}/taxes/",
        {"entity_id": entity.pk, "code": "ICE", "name": "ICE"},
        format="json",
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Tax Periods
# ---------------------------------------------------------------------------


@pytest.fixture
def period(tax_def: TaxDefinition, admin_client: APIClient) -> TaxPeriod:
    return TaxPeriod.objects.create(
        tax_definition=tax_def,
        rate="15.0000",
        starts_on=date(2025, 1, 1),
        ends_on=None,
    )


@pytest.mark.django_db
def test_list_periods(admin_client: APIClient, period: TaxPeriod) -> None:
    td_id = period.tax_definition_id
    resp = admin_client.get(f"{BASE}/taxes/{td_id}/periods/")
    assert resp.status_code == status.HTTP_200_OK
    assert len(resp.data) == 1
    # La tarifa debe ser cadena, no número
    assert isinstance(resp.data[0]["rate"], str)


@pytest.mark.django_db
def test_create_period(admin_client: APIClient, tax_def: TaxDefinition) -> None:
    resp = admin_client.post(
        f"{BASE}/taxes/{tax_def.pk}/periods/",
        {"rate": "15.0000", "starts_on": "2025-01-01"},
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.data["rate"] == "15.0000"


@pytest.mark.django_db
def test_create_period_invalid_rate(admin_client: APIClient, tax_def: TaxDefinition) -> None:
    resp = admin_client.post(
        f"{BASE}/taxes/{tax_def.pk}/periods/",
        {"rate": "150", "starts_on": "2025-01-01"},
        format="json",
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_update_period_stale(admin_client: APIClient, period: TaxPeriod) -> None:
    resp = admin_client.patch(
        f"{BASE}/periods/{period.pk}/",
        {"rate": "12.0000", "expected_version": 99},
        format="json",
    )
    assert resp.status_code == status.HTTP_409_CONFLICT


@pytest.mark.django_db
def test_schedule_successor_success(admin_client: APIClient, period: TaxPeriod) -> None:
    future_date = (date.today() + timedelta(days=30)).isoformat()
    resp = admin_client.post(
        f"{BASE}/periods/{period.pk}/schedule-successor/",
        {
            "new_rate": "12.0000",
            "successor_starts_on": future_date,
            "expected_version": period.version,
        },
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.data["rate"] == "12.0000"


@pytest.mark.django_db
def test_schedule_successor_past_date(admin_client: APIClient, period: TaxPeriod) -> None:
    past_date = (date.today() - timedelta(days=1)).isoformat()
    resp = admin_client.post(
        f"{BASE}/periods/{period.pk}/schedule-successor/",
        {
            "new_rate": "12.0000",
            "successor_starts_on": past_date,
            "expected_version": period.version,
        },
        format="json",
    )
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# ---------------------------------------------------------------------------
# Document Series
# ---------------------------------------------------------------------------


@pytest.fixture
def scope_series(initialized: dict) -> dict[str, object]:
    entity: FiscalEntity = initialized["comercial"]
    scope = NumberingScope.objects.create(
        fiscal_entity=entity,
        document_type="VENTA",
    )
    series = DocumentSeries.objects.create(
        numbering_scope=scope,
        code="COM-VEN",
        is_active=True,
        last_number=0,
    )
    return {"scope": scope, "series": series}


@pytest.mark.django_db
def test_list_series(admin_client: APIClient, scope_series: dict) -> None:
    scope: NumberingScope = scope_series["scope"]
    resp = admin_client.get(f"{BASE}/series/?scope_id={scope.pk}")
    assert resp.status_code == status.HTTP_200_OK
    assert any(s["code"] == "COM-VEN" for s in resp.data)


@pytest.mark.django_db
def test_get_series(admin_client: APIClient, scope_series: dict) -> None:
    series: DocumentSeries = scope_series["series"]
    resp = admin_client.get(f"{BASE}/series/{series.pk}/")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["code"] == "COM-VEN"


@pytest.mark.django_db
def test_update_series_code(admin_client: APIClient, scope_series: dict) -> None:
    series: DocumentSeries = scope_series["series"]
    resp = admin_client.patch(
        f"{BASE}/series/{series.pk}/",
        {"code": "COM-NEW", "expected_version": series.version},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["code"] == "COM-NEW"


@pytest.mark.django_db
def test_update_series_code_after_use(admin_client: APIClient, scope_series: dict) -> None:
    series: DocumentSeries = scope_series["series"]
    series.last_number = 1
    series.save()
    resp = admin_client.patch(
        f"{BASE}/series/{series.pk}/",
        {"code": "COM-NEW", "expected_version": series.version},
        format="json",
    )
    assert resp.status_code == status.HTTP_409_CONFLICT


@pytest.mark.django_db
def test_replace_series(admin_client: APIClient, scope_series: dict) -> None:
    series: DocumentSeries = scope_series["series"]
    series.last_number = 1
    series.save()
    resp = admin_client.post(
        f"{BASE}/series/{series.pk}/replace/",
        {"new_code": "COM-VEN-2", "expected_version": series.version},
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.data["code"] == "COM-VEN-2"
    assert resp.data["is_active"] is True


@pytest.mark.django_db
def test_series_seller_denied(seller_client: APIClient, scope_series: dict) -> None:
    scope: NumberingScope = scope_series["scope"]
    resp = seller_client.get(f"{BASE}/series/?scope_id={scope.pk}")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Problem+JSON y correlación
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_error_response_has_problem_json_content_type(
    admin_client: APIClient,
) -> None:
    """Los errores devuelven application/problem+json."""
    resp = admin_client.get(f"{BASE}/entities/99999/")
    assert resp.status_code == status.HTTP_404_NOT_FOUND
    assert "application/problem+json" in resp["Content-Type"]
    assert "code" in resp.data
    assert "title" in resp.data


@pytest.mark.django_db
def test_rate_is_always_string_in_response(admin_client: APIClient, period: TaxPeriod) -> None:
    """La tarifa NUNCA viene como float/decimal JSON, siempre como cadena."""
    td_id = period.tax_definition_id
    resp = admin_client.get(f"{BASE}/taxes/{td_id}/periods/")
    assert resp.status_code == status.HTTP_200_OK
    for p in resp.data:
        assert isinstance(p["rate"], str), f"rate debe ser str, fue {type(p['rate'])}"


# ---------------------------------------------------------------------------
# OpenAPI schema
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_openapi_schema_includes_workshop_configuration(admin_client: APIClient) -> None:
    """El esquema OpenAPI debe incluir los paths de workshop-configuration."""
    resp = admin_client.get("/api/v1/schema/")
    assert resp.status_code == status.HTTP_200_OK
    schema_text = str(resp.content)
    assert "workshop-configuration" in schema_text
    assert "initialize" in schema_text
    assert "entities" in schema_text
    assert "warehouse" in schema_text
    assert "taxes" in schema_text
    assert "series" in schema_text
