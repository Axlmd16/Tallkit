"""API de configuración fiscal centralizada: solo Administrador, sin producción."""

from itertools import combinations
from typing import Any
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from identity.domain.authorization import Role
from identity.models import User, UserRole
from workshop_configuration.application import official_catalog
from workshop_configuration.models import (
    FiscalEmissionPoint,
    FiscalEntity,
    FiscalEstablishment,
    OfficialCatalogEntry,
    TaxDefinition,
)

pytestmark = pytest.mark.django_db
BASE = "/api/v1/fiscal/configuration"


@pytest.fixture
def entity(db: None) -> FiscalEntity:
    official_catalog.ensure_installed()
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Comercial", address="Matriz"
    )


def _client(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _write(client: APIClient, method: str, path: str, data: dict[str, Any]) -> Any:
    return getattr(client, method)(path, data, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid4()))


def test_status_explains_state_and_fixed_test_environment(
    entity: FiscalEntity, role_admin: User
) -> None:
    response = _client(role_admin).get(f"{BASE}/entities/{entity.pk}/electronic-status/")
    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "NOT_CONFIGURED"
    assert body["environment"] == "TEST"
    assert body["causes"][0]["message"] == "Todavía no existe una configuración guardada."
    assert {warning["code"] for warning in body["warnings"]} == {"certificate_missing"}


def test_catalog_lists_all_payment_forms_with_provenance(
    role_admin: User, entity: FiscalEntity
) -> None:
    response = _client(role_admin).get(f"{BASE}/catalogs/payment_form/")
    assert response.status_code == 200
    rows = {row["code"]: row for row in response.json()}
    assert set(rows) == {"01", "15", "16", "17", "18", "19", "20", "21"}
    assert rows["16"]["source_version"] == "2.34"
    assert rows["16"]["downloaded_on"] == "2026-09-26"
    assert rows["01"]["description"] == "SIN UTILIZACION DEL SISTEMA FINANCIERO"
    assert _client(role_admin).get(f"{BASE}/catalogs/otro/").status_code == 400


def test_payment_forms_toggle_and_reject_cards(entity: FiscalEntity, role_admin: User) -> None:
    client = _client(role_admin)
    listed = client.get(f"{BASE}/entities/{entity.pk}/payment-forms/").json()
    assert {row["code"] for row in listed if row["enabled"]} == {"01", "20"}
    rejected = _write(
        client,
        "put",
        f"{BASE}/entities/{entity.pk}/payment-forms/19/",
        {"enabled": True, "expected_version": 0},
    )
    assert rejected.status_code == 400
    assert "payment_form_not_enableable_v1" in rejected.json()["detail"]
    changed = _write(
        client,
        "put",
        f"{BASE}/entities/{entity.pk}/payment-forms/20/",
        {"enabled": False, "expected_version": 0},
    )
    assert changed.status_code == 200
    assert not next(row for row in changed.json() if row["code"] == "20")["enabled"]
    stale = _write(
        client,
        "put",
        f"{BASE}/entities/{entity.pk}/payment-forms/20/",
        {"enabled": True, "expected_version": 0},
    )
    assert stale.status_code == 409


def test_defaults_designation_and_foreign_point(entity: FiscalEntity, role_admin: User) -> None:
    establishment = FiscalEstablishment.objects.create(
        fiscal_entity=entity, code="001", address="Local"
    )
    first = FiscalEmissionPoint.objects.create(establishment=establishment, code="001")
    second = FiscalEmissionPoint.objects.create(establishment=establishment, code="002")
    client = _client(role_admin)
    current = client.get(f"{BASE}/entities/{entity.pk}/preparation-defaults/").json()
    assert current["point_issue"] == "default_point_required"
    saved = _write(
        client,
        "put",
        f"{BASE}/entities/{entity.pk}/preparation-defaults/",
        {"expected_version": 0, "default_point_id": second.pk},
    )
    assert saved.status_code == 200
    assert saved.json()["effective_point_id"] == second.pk

    other = FiscalEntity.objects.create(
        entity_type="ARTESANAL", ruc="0991234567002", legal_name="Artesanal"
    )
    foreign = _write(
        client,
        "put",
        f"{BASE}/entities/{other.pk}/preparation-defaults/",
        {"expected_version": 0, "default_point_id": first.pk},
    )
    assert foreign.status_code == 400


def test_tax_mapping_uses_catalog_entry_and_lists_display_name(
    entity: FiscalEntity, role_admin: User
) -> None:
    definition = TaxDefinition.objects.create(fiscal_entity=entity, code="IVA", name="IVA venta")
    entry = OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=official_catalog.SELECTABLE_TAX_VERSION, code="4"
    )
    client = _client(role_admin)
    created = _write(
        client,
        "post",
        f"{BASE}/tax-mappings/",
        {
            "definition_id": definition.pk,
            "catalog_entry_id": entry.pk,
            "starts_on": "2026-01-01",
            "source": "Certificado RUC",
        },
    )
    assert created.status_code == 201, created.json()
    assert created.json()["display_name"] == "IVA 15 %"
    free_code = _write(
        client,
        "post",
        f"{BASE}/tax-mappings/",
        {
            "definition_id": definition.pk,
            "percentage_code": "4",
            "starts_on": "2026-01-01",
            "source": "Código libre",
        },
    )
    assert free_code.status_code == 400
    listed = client.get(f"{BASE}/entities/{entity.pk}/tax-mappings/").json()
    assert listed[0]["display_name"] == "IVA 15 %"
    assert listed[0]["definition_name"] == "IVA venta"


def _user(roles: frozenset[Role]) -> User:
    user = User.objects.create_user(username=f"u{uuid4().hex[:8]}", password="password123")
    for role in roles:
        UserRole.objects.create(user=user, role=role.value)
    return user


@pytest.mark.parametrize(
    "roles", [frozenset(c) for n in range(1, 4) for c in combinations(Role, n)]
)
def test_only_administrator_reads_or_writes_configuration(
    entity: FiscalEntity, roles: frozenset[Role]
) -> None:
    client = _client(_user(roles))
    allowed = Role.ADMINISTRADOR in roles
    reads = [
        f"{BASE}/entities/{entity.pk}/electronic-status/",
        f"{BASE}/entities/{entity.pk}/preparation-defaults/",
        f"{BASE}/entities/{entity.pk}/payment-forms/",
        f"{BASE}/entities/{entity.pk}/tax-mappings/",
        f"{BASE}/catalogs/tax_rate/",
    ]
    for path in reads:
        assert (client.get(path).status_code == 200) == allowed, path
    write = _write(
        client,
        "put",
        f"{BASE}/entities/{entity.pk}/payment-forms/20/",
        {"enabled": True, "expected_version": 0},
    )
    assert (write.status_code == 403) == (not allowed)
