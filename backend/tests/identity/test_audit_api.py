from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from identity.application.audit import record_audit_event
from identity.domain.authorization import Role
from identity.models import AuditEvent, AuditResult, User, UserRole

pytestmark = pytest.mark.django_db


def client_for(role: Role) -> tuple[APIClient, User]:
    user = User.objects.create_user(username=role.value.lower())
    UserRole.objects.create(user=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def test_administrator_filters_paginated_audit_in_business_timezone() -> None:
    client, administrator = client_for(Role.ADMINISTRADOR)
    other = User.objects.create_user(username="otro")
    wanted = record_audit_event(
        actor=administrator,
        action="identity.user_updated",
        target_type="user",
        target_id=str(other.pk),
        result=AuditResult.SUCCESS,
    )
    record_audit_event(
        actor=other,
        action="authentication.login_failed",
        target_type="authentication",
        target_id="unconfirmed",
        result=AuditResult.FAILURE,
    )
    now = timezone.now()

    filters = {
        "user": str(administrator.pk),
        "from": (now - timedelta(days=1)).isoformat(),
        "to": (now + timedelta(days=1)).isoformat(),
        "action": "identity.user_updated",
        "target_type": "user",
        "target_id": str(other.pk),
        "result": AuditResult.SUCCESS.value,
        "page": "1",
        "page_size": "10",
    }
    response = client.get("/api/v1/audit/", filters)

    assert response.status_code == 200
    assert response.json()["count"] == 1
    item = response.json()["results"][0]
    assert item["id"] == wanted.pk
    assert item["occurred_at"].endswith("-05:00")


@pytest.mark.parametrize("role", [Role.VENDEDOR, Role.ENCARGADO_TALLER])
def test_non_administrator_cannot_reveal_audit_events(role: Role) -> None:
    client, _user = client_for(role)
    AuditEvent.objects.create(
        action="identity.user_updated",
        target_type="user",
        target_id="42",
        result=AuditResult.SUCCESS,
    )

    response = client.get("/api/v1/audit/")

    assert response.status_code == 403
    assert b"identity.user_updated" not in response.content


def test_audit_api_is_read_only_and_preserves_the_original_event() -> None:
    client, _administrator = client_for(Role.ADMINISTRADOR)
    event = AuditEvent.objects.create(
        action="identity.user_updated",
        target_type="user",
        target_id="42",
        result=AuditResult.SUCCESS,
    )

    detail = client.get(f"/api/v1/audit/{event.pk}/")
    changed = client.patch(
        f"/api/v1/audit/{event.pk}/", {"result": AuditResult.FAILURE}, format="json"
    )
    deleted = client.delete(f"/api/v1/audit/{event.pk}/")

    assert detail.status_code == 200
    assert changed.status_code == 405
    assert deleted.status_code == 405
    event.refresh_from_db()
    assert event.result == AuditResult.SUCCESS


def test_administrator_queries_registry_audit_events_and_transfer_metadata() -> None:
    client, admin = client_for(Role.ADMINISTRADOR)
    other = User.objects.create_user(username="taller_user")

    # Customer created event
    record_audit_event(
        actor=admin,
        action="registry.customer_created",
        target_type="customer",
        target_id="101",
        result=AuditResult.SUCCESS,
        metadata={"changed_fields": ["name", "identification"]},
    )
    # Brand deactivated event
    record_audit_event(
        actor=admin,
        action="registry.brand_deactivated",
        target_type="vehicle_brand",
        target_id="5",
        result=AuditResult.SUCCESS,
    )
    # Vehicle ownership transfer event with minimum metadata
    transfer_event = record_audit_event(
        actor=other,
        action="registry.vehicle_owner_changed",
        target_type="vehicle",
        target_id="42",
        result=AuditResult.SUCCESS,
        metadata={
            "previous_owner_id": 101,
            "new_owner_id": 102,
            "path": "/api/v1/vehicles/42/transfer/?token=secret",
        },
    )

    # 1. Filter by target_type="vehicle"
    response = client.get("/api/v1/audit/", {"target_type": "vehicle"})
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    item = results[0]
    assert item["id"] == transfer_event.pk
    assert item["action"] == "registry.vehicle_owner_changed"
    assert item["target_type"] == "vehicle"
    assert item["target_id"] == "42"
    assert item["metadata"]["previous_owner_id"] == 101
    assert item["metadata"]["new_owner_id"] == 102
    # Check that path was sanitized without query params
    assert item["metadata"]["path"] == "/api/v1/vehicles/42/transfer/"
    # Check business timezone (-05:00 for America/Guayaquil)
    assert item["occurred_at"].endswith("-05:00")

    # 2. Filter by target_type="customer" and target_id="101"
    response = client.get("/api/v1/audit/", {"target_type": "customer", "target_id": "101"})
    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["results"][0]["action"] == "registry.customer_created"

    # 3. Filter by target_type="vehicle_brand"
    response = client.get("/api/v1/audit/", {"target_type": "vehicle_brand"})
    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["results"][0]["action"] == "registry.brand_deactivated"

    # 4. Filter by action="registry.vehicle_owner_changed"
    response = client.get("/api/v1/audit/", {"action": "registry.vehicle_owner_changed"})
    assert response.status_code == 200
    assert response.json()["count"] == 1


def test_audit_api_rejects_invalid_filters() -> None:
    client, _admin = client_for(Role.ADMINISTRADOR)

    # Invalid from date
    res = client.get("/api/v1/audit/", {"from": "not-a-datetime"})
    assert res.status_code == 400
    assert res.json()["code"] == "invalid_filters"

    # Invalid to date
    res = client.get("/api/v1/audit/", {"to": "not-a-datetime"})
    assert res.status_code == 400
    assert res.json()["code"] == "invalid_filters"

    # Invalid page number
    res = client.get("/api/v1/audit/", {"page": "0"})
    assert res.status_code == 400
    assert res.json()["code"] == "invalid_filters"

    # Invalid page size
    res = client.get("/api/v1/audit/", {"page_size": "-5"})
    assert res.status_code == 400
    assert res.json()["code"] == "invalid_filters"


def test_administrator_can_consult_permission_denial_events() -> None:
    admin_client, _admin = client_for(Role.ADMINISTRADOR)
    vendedor_client, vendedor = client_for(Role.VENDEDOR)

    # Vendedor attempts a brand write operation directly via API and gets 403
    denied_response = vendedor_client.post(
        "/api/v1/vehicle-brands/",
        {"name": "No Autorizado"},
        format="json",
    )
    assert denied_response.status_code == 403

    # Administrator queries audit for DENIED results
    audit_response = admin_client.get(
        "/api/v1/audit/",
        {"result": "DENIED", "user": str(vendedor.pk)},
    )
    assert audit_response.status_code == 200
    results = audit_response.json()["results"]
    assert len(results) >= 1
    event = results[0]
    assert event["result"] == "DENIED"
    assert event["actor"]["id"] == vendedor.pk
