"""Resumen de inicio: qué recibe cada rol, separación por RUC, solo lectura y sin auditoría."""

import uuid
from datetime import timedelta
from typing import Any

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from identity.models import AuditEvent
from workshop_configuration.application import official_catalog, withholding_settings
from workshop_configuration.application.electronic_profiles import save_profile
from workshop_configuration.models import FiscalEntity

pytestmark = pytest.mark.django_db
H = "/api/v1/home/"
ROUTES = (f"{H}pending/", f"{H}receivables/", f"{H}collections/")

COMMERCIAL_PENDING = [
    ("cash_sales_unpaid", "commercial"),
    ("proformas_expiring", "commercial"),
    ("withholdings_pending", "commercial"),
    ("sale_drafts", "commercial"),
    ("proforma_drafts", "commercial"),
]
ARTISAN_PENDING = [
    ("open_orders", None),
    ("cash_services_unpaid", "artisan"),
    ("withholdings_pending", "artisan"),
]


def keys(body: dict[str, Any]) -> list[tuple[str, str | None]]:
    return [(item["key"], item["scope"]) for item in body["items"]]


def scopes(body: dict[str, Any]) -> list[str]:
    return [item["scope"] for item in body["items"]]


@pytest.fixture
def artisan_entity(db: None) -> FiscalEntity:
    official_catalog.ensure_installed()
    return FiscalEntity.objects.create(
        entity_type="ARTESANAL", ruc="0991234567001", legal_name="Taller", address="Matriz"
    )


# --- Qué recibe cada rol ---------------------------------------------------------------------


def test_seller_receives_only_commercial_indicators(client_for: Any, seller: Any) -> None:
    api = client_for(seller)
    pending = api.get(ROUTES[0]).json()
    assert sorted(keys(pending), key=str) == sorted(COMMERCIAL_PENDING, key=str)
    assert pending["qualification"] is None
    assert scopes(api.get(ROUTES[1]).json()) == ["commercial"]
    assert scopes(api.get(ROUTES[2]).json()) == ["commercial"]


def test_manager_receives_only_workshop_indicators(client_for: Any, manager: Any) -> None:
    api = client_for(manager)
    pending = api.get(ROUTES[0]).json()
    assert sorted(keys(pending), key=str) == sorted(ARTISAN_PENDING, key=str)
    assert pending["qualification"] is None
    assert scopes(api.get(ROUTES[1]).json()) == ["artisan"]
    assert scopes(api.get(ROUTES[2]).json()) == ["artisan"]


@pytest.mark.parametrize("who", ["seller_manager", "admin"])
def test_accumulated_roles_receive_the_union(
    who: str, client_for: Any, request: pytest.FixtureRequest
) -> None:
    api = client_for(request.getfixturevalue(who))
    pending = api.get(ROUTES[0]).json()
    assert sorted(keys(pending), key=str) == sorted(COMMERCIAL_PENDING + ARTISAN_PENDING, key=str)
    assert scopes(api.get(ROUTES[1]).json()) == ["commercial", "artisan"]
    assert scopes(api.get(ROUTES[2]).json()) == ["commercial", "artisan"]


def test_user_without_roles_receives_empty_blocks(client_for: Any, nobody: Any) -> None:
    api = client_for(nobody)
    assert api.get(ROUTES[0]).json() == {"items": [], "qualification": None}
    assert api.get(ROUTES[1]).json() == {"items": []}
    assert api.get(ROUTES[2]).json()["items"] == []


@pytest.mark.parametrize("route", ROUTES)
def test_anonymous_request_is_rejected(route: str) -> None:
    assert APIClient().get(route).status_code in {401, 403}


@pytest.mark.parametrize("route", ROUTES)
def test_user_with_temporary_password_is_rejected(route: str, client_for: Any, seller: Any) -> None:
    seller.must_change_password = True
    seller.save(update_fields=["must_change_password"])
    assert client_for(seller).get(route).status_code == 403


@pytest.mark.parametrize("route", ROUTES)
def test_routes_are_read_only(route: str, client_for: Any, admin: Any) -> None:
    assert client_for(admin).post(route, {}, format="json").status_code == 405


# --- Forma de los datos ----------------------------------------------------------------------


def test_pending_counts_start_at_zero(client_for: Any, admin: Any) -> None:
    body = client_for(admin).get(ROUTES[0]).json()
    assert all(item["count"] == 0 for item in body["items"])
    assert all(set(item) == {"key", "scope", "count"} for item in body["items"])


def test_receivables_never_carry_a_joint_total(client_for: Any, admin: Any) -> None:
    body = client_for(admin).get(ROUTES[1]).json()
    assert set(body) == {"items"}
    assert body["items"] == [
        {"scope": "commercial", "balance": "0.00", "customers": 0},
        {"scope": "artisan", "balance": "0.00", "customers": 0},
    ]


def test_collections_cover_seven_business_days_per_entity(client_for: Any, admin: Any) -> None:
    body = client_for(admin).get(ROUTES[2]).json()
    assert set(body) == {"timezone", "items"}
    assert body["timezone"] == "America/Guayaquil"
    today = timezone.localdate()
    expected = [(today - timedelta(days=offset)).isoformat() for offset in range(6, -1, -1)]
    for item in body["items"]:
        assert set(item) == {"scope", "total", "days"}
        assert [day["date"] for day in item["days"]] == expected
        assert all(day["amount"] == "0.00" for day in item["days"])
        assert item["total"] == "0.00"


# --- Retenciones y calificación artesanal ----------------------------------------------------


def test_withholdings_of_an_entity_that_does_not_register_them_are_omitted(
    client_for: Any, admin: Any, artisan_entity: FiscalEntity
) -> None:
    withholding_settings.set_withholding_settings(
        actor=admin,
        entity_id=artisan_entity.pk,
        expected_version=0,
        idempotency_key=str(uuid.uuid4()),
        registration_enabled=False,
    )
    found = keys(client_for(admin).get(ROUTES[0]).json())
    assert ("withholdings_pending", "artisan") not in found
    assert ("withholdings_pending", "commercial") in found


def test_only_the_administrator_receives_the_qualification_notice(
    client_for: Any, admin: Any, manager: Any, artisan_entity: FiscalEntity
) -> None:
    from tests.workshop_configuration.profile_helpers import profile_conditions, qualification

    ends_on = timezone.localdate() + timedelta(days=45)
    save_profile(
        actor=admin,
        entity_id=artisan_entity.pk,
        expected_revision=0,
        idempotency_key="home-api-profile",
        payload={
            "conditions": profile_conditions(
                artisan_qualification=qualification(ends_on.isoformat())
            )
        },
    )
    assert client_for(admin).get(ROUTES[0]).json()["qualification"] == {
        "entity_id": artisan_entity.pk,
        "expires_on": ends_on.isoformat(),
        "days_left": 45,
        "expired": False,
    }
    assert client_for(manager).get(ROUTES[0]).json()["qualification"] is None


# --- Solo lectura, sin auditoría y con consultas acotadas ------------------------------------


@pytest.mark.parametrize("who", ["seller", "manager", "nobody", "admin"])
def test_reading_the_summary_writes_nothing_and_audits_nothing(
    who: str, client_for: Any, request: pytest.FixtureRequest
) -> None:
    api = client_for(request.getfixturevalue(who))
    before = AuditEvent.objects.count()
    with CaptureQueriesContext(connection) as captured:
        for route in ROUTES:
            assert api.get(route).status_code == 200
    writes = [
        query["sql"]
        for query in captured
        if query["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
    ]
    assert writes == []
    assert AuditEvent.objects.count() == before


@pytest.mark.parametrize(("route", "limit"), list(zip(ROUTES, (22, 8, 6), strict=True)))
def test_each_route_stays_within_its_query_budget(
    route: str, limit: int, client_for: Any, admin: Any
) -> None:
    api = client_for(admin)
    with CaptureQueriesContext(connection) as captured:
        assert api.get(route).status_code == 200
    assert len(captured) <= limit, [query["sql"][:90] for query in captured]
