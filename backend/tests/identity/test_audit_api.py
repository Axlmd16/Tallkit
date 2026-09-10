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
