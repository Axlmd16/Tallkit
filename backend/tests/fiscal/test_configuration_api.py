"""API de configuración fiscal centralizada: solo Administrador, sin producción."""

from datetime import timedelta
from itertools import combinations
from typing import Any
from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from tests.workshop_configuration.profile_helpers import (
    applicable,
    profile_conditions,
    qualification,
)

from identity.domain.authorization import Role
from identity.models import User, UserRole
from workshop_configuration.application import official_catalog
from workshop_configuration.models import (
    ElectronicProfileRevision,
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
        f"{BASE}/entities/{entity.pk}/electronic-profile/",
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


PROFILE = f"{BASE}/entities/%d/electronic-profile/"


def _put_profile(client: APIClient, entity: FiscalEntity, revision: int, **overrides: Any) -> Any:
    return _write(
        client,
        "put",
        PROFILE % entity.pk,
        {"expected_revision": revision, "conditions": profile_conditions(**overrides)},
    )


def test_unconfigured_profile_offers_the_closed_options(
    entity: FiscalEntity, role_admin: User
) -> None:
    body = _client(role_admin).get(PROFILE % entity.pk).json()
    assert body["revision"] == 0
    assert body["conditions_format"] == 2
    assert body["regime_legend"] is None
    assert body["options"]["tax_regime"] == [
        {"value": "GENERAL", "label": "General"},
        {"value": "RIMPE_EMPRENDEDOR", "label": "RIMPE Emprendedor"},
        {"value": "RIMPE_NEGOCIO_POPULAR", "label": "RIMPE Negocio Popular"},
    ]
    assert body["options"]["accounting_obligation"] == [
        {"value": "SI", "label": "Sí"},
        {"value": "NO", "label": "No"},
    ]


def test_profile_is_saved_in_closed_format_and_exposes_the_derived_legend(
    entity: FiscalEntity, role_admin: User
) -> None:
    client = _client(role_admin)
    first = _put_profile(client, entity, 0, artisan_qualification=qualification())
    assert first.status_code == 200
    body = first.json()
    assert body["conditions_format"] == 2
    assert body["regime_legend"] is None
    assert body["conditions"]["accounting_obligation"]["value"] == "NO"
    assert "rimpe" not in body["conditions"]
    second = _put_profile(client, entity, 1, tax_regime=applicable("RIMPE_EMPRENDEDOR"))
    assert second.json()["regime_legend"] == "CONTRIBUYENTE RÉGIMEN RIMPE"
    assert client.get(PROFILE % entity.pk).json()["regime_legend"] == "CONTRIBUYENTE RÉGIMEN RIMPE"


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"accounting_obligation": applicable("Sí, desde 2024")}, "accounting_obligation.value"),
        ({"withholding_agent": applicable("NAC-0012")}, "withholding_agent.value"),
        ({"rimpe": {"status": "UNKNOWN"}}, "conditions"),
    ],
)
def test_profile_rejects_free_text_with_field_errors(
    entity: FiscalEntity, role_admin: User, overrides: dict[str, Any], field: str
) -> None:
    response = _put_profile(_client(role_admin), entity, 0, **overrides)
    assert response.status_code == 400
    assert field in response.json()["errors"]
    assert not ElectronicProfileRevision.objects.exists()


def test_legacy_revision_is_read_only_and_a_new_declaration_replaces_it(
    entity: FiscalEntity, role_admin: User
) -> None:
    ElectronicProfileRevision.objects.create(
        fiscal_entity=entity,
        revision=1,
        conditions_format=1,
        conditions={
            "accounting_obligation": {
                "status": "APPLICABLE",
                "value": "no obligado",
                "source": "Certificado",
                "starts_on": "2026-01-01",
            }
        },
        created_by=role_admin,
    )
    client = _client(role_admin)
    legacy = client.get(PROFILE % entity.pk).json()
    assert legacy["conditions_format"] == 1
    assert legacy["conditions"]["accounting_obligation"]["value"] == "no obligado"
    assert legacy["regime_legend"] is None
    rejected = _write(
        client,
        "put",
        PROFILE % entity.pk,
        {"expected_revision": 1, "conditions": legacy["conditions"]},
    )
    assert rejected.status_code == 400
    declared = _put_profile(client, entity, 1)
    assert declared.status_code == 200
    assert declared.json()["revision"] == 2
    assert declared.json()["conditions_format"] == 2
    assert ElectronicProfileRevision.objects.get(revision=1).conditions_format == 1


@pytest.mark.parametrize("role", ["role_seller", "role_manager"])
def test_operational_roles_cannot_read_or_write_the_qualification(
    entity: FiscalEntity, role_admin: User, request: pytest.FixtureRequest, role: str
) -> None:
    admin = _client(role_admin)
    assert _put_profile(admin, entity, 0, artisan_qualification=qualification()).status_code == 200
    operational = _client(request.getfixturevalue(role))
    read = operational.get(PROFILE % entity.pk)
    assert read.status_code == 403
    assert "JNDA-12345" not in read.content.decode()
    write = _put_profile(operational, entity, 1, artisan_qualification=qualification("2030-01-01"))
    assert write.status_code == 403
    assert "JNDA-12345" not in write.content.decode()
    assert ElectronicProfileRevision.objects.count() == 1


def test_status_endpoint_reports_the_qualification_expiry_warning(
    entity: FiscalEntity, role_admin: User
) -> None:
    ends_on = (timezone.localdate() + timedelta(days=30)).isoformat()
    client = _client(role_admin)
    assert (
        _put_profile(client, entity, 0, artisan_qualification=qualification(ends_on)).status_code
        == 200
    )
    warnings = client.get(f"{BASE}/entities/{entity.pk}/electronic-status/").json()["warnings"]
    expiring = next(w for w in warnings if w["code"] == "artisan_qualification_expiring")
    assert ends_on in expiring["message"]
    assert "30 días" in expiring["message"]


def _zero_rate_mapping(entity: FiscalEntity, admin: User) -> tuple[Any, Any]:
    from datetime import date
    from decimal import Decimal

    from workshop_configuration.application.fiscal_tax_mapping import create_mapping
    from workshop_configuration.models import TaxPeriod

    definition = TaxDefinition.objects.create(fiscal_entity=entity, code="IVA0", name="IVA ventas")
    period = TaxPeriod.objects.create(
        tax_definition=definition, rate=Decimal("0"), starts_on=date(2025, 1, 1)
    )
    entry = OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=official_catalog.SELECTABLE_TAX_VERSION, code="0"
    )
    mapping = create_mapping(
        actor=admin,
        definition_id=definition.pk,
        catalog_entry_id=entry.pk,
        starts_on=date(2025, 1, 1),
        ends_on=None,
        source="Certificado de RUC",
    )
    return period, mapping


def test_mapping_successor_is_scheduled_through_the_api(
    entity: FiscalEntity, role_admin: User
) -> None:
    from workshop_configuration.application.taxes import schedule_successor

    period, mapping = _zero_rate_mapping(entity, role_admin)
    day = timezone.localdate() + timedelta(days=30)
    schedule_successor(
        actor=role_admin,
        period_id=period.pk,
        expected_version=period.version,
        new_rate="15",
        successor_starts_on=day,
    )
    fifteen = OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=official_catalog.SELECTABLE_TAX_VERSION, code="4"
    )
    path = f"{BASE}/tax-mappings/{mapping.pk}/successor/"
    body = {
        "catalog_entry_id": fifteen.pk,
        "starts_on": day.isoformat(),
        "source": "Pasa a RIMPE Emprendedor",
    }

    created = _write(_client(role_admin), "post", path, body)

    assert created.status_code == 201
    assert created.json()["percentage_code"] == "4"
    assert created.json()["starts_on"] == day.isoformat()
    assert created.json()["ends_on"] is None
    mapping.refresh_from_db()
    assert mapping.ends_on == day - timedelta(days=1)

    again = _write(_client(role_admin), "post", path, body)
    # Ya no está abierta: no se programa un segundo cambio sobre la misma correspondencia.
    assert again.status_code == 400


def test_mapping_successor_rejects_a_past_date_and_other_roles(
    entity: FiscalEntity, role_admin: User, role_seller: User
) -> None:
    _, mapping = _zero_rate_mapping(entity, role_admin)
    fifteen = OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=official_catalog.SELECTABLE_TAX_VERSION, code="4"
    )
    path = f"{BASE}/tax-mappings/{mapping.pk}/successor/"
    past = {
        "catalog_entry_id": fifteen.pk,
        "starts_on": timezone.localdate().isoformat(),
        "source": "Cambio",
    }

    rejected = _write(_client(role_admin), "post", path, past)
    assert rejected.status_code == 400
    assert "starts_on" in rejected.json()["errors"]
    denied = _write(_client(role_seller), "post", path, past)
    assert denied.status_code == 403
    mapping.refresh_from_db()
    assert mapping.ends_on is None


def test_withholding_settings_default_change_and_validation(
    entity: FiscalEntity, role_admin: User, role_seller: User
) -> None:
    client = _client(role_admin)
    path = f"{BASE}/entities/{entity.pk}/withholding-settings/"
    current = client.get(path).json()
    assert current == {
        "entity_id": entity.pk,
        "version": 0,
        "registration_enabled": True,
        "warning_percentage": "20.00",
    }
    saved = _write(
        client,
        "put",
        path,
        {"expected_version": 0, "registration_enabled": False, "warning_percentage": None},
    )
    assert saved.status_code == 200
    assert saved.json()["registration_enabled"] is False
    assert saved.json()["warning_percentage"] is None
    assert saved.json()["version"] == 1

    invalid = _write(client, "put", path, {"expected_version": 1, "warning_percentage": "150"})
    assert invalid.status_code == 400
    stale = _write(client, "put", path, {"expected_version": 0, "registration_enabled": True})
    assert stale.status_code == 409

    seller = _client(role_seller)
    assert seller.get(path).status_code == 403
    denied = _write(seller, "put", path, {"expected_version": 1, "registration_enabled": True})
    assert denied.status_code == 403
    assert client.get(path).json()["registration_enabled"] is False
