import json
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model

from identity.application.audit import record_audit_event
from identity.models import AuditResult

pytestmark = pytest.mark.django_db


def test_records_a_successful_event_with_its_actor_and_safe_metadata() -> None:
    actor = get_user_model().objects.create_user(username="administrador")

    event = record_audit_event(
        actor=actor,
        action="identity.roles_changed",
        target_type="user",
        target_id="42",
        result=AuditResult.SUCCESS,
        request_id=uuid4(),
        metadata={"roles_added": ["VENDEDOR"]},
    )

    assert event.actor == actor
    assert event.result == AuditResult.SUCCESS
    assert event.metadata == {"roles_added": ["VENDEDOR"]}


def test_records_a_failed_event_without_claiming_a_confirmed_actor() -> None:
    event = record_audit_event(
        actor=None,
        action="authentication.login_failed",
        target_type="authentication",
        target_id="unconfirmed",
        result=AuditResult.FAILURE,
        reason="invalid_credentials",
        metadata={"attempts": 2},
    )

    assert event.actor is None
    assert event.reason == "invalid_credentials"
    assert event.metadata == {"attempts": 2}


def test_discards_secrets_and_unnecessary_metadata_before_persisting() -> None:
    secret_values = {"actual-secret", "temporary-secret", "session-secret"}

    event = record_audit_event(
        actor=None,
        action="identity.password_reset",
        target_type="user",
        target_id="42",
        result=AuditResult.SUCCESS,
        metadata={
            "password": "actual-secret",
            "temporary_credential": "temporary-secret",
            "session_secret": "session-secret",
            "unexpected_personal_data": "private-value",
            "changed_fields": ["password"],
        },
    )

    serialized = json.dumps(event.metadata)
    assert event.metadata == {"changed_fields": ["password"]}
    assert all(secret not in serialized for secret in secret_values)
