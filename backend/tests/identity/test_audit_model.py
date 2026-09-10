from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone

from identity.models import AuditEvent

pytestmark = pytest.mark.django_db


def test_audit_event_keeps_the_business_trace_with_an_optional_actor() -> None:
    before = timezone.now()
    event = AuditEvent.objects.create(
        actor=None,
        action="authentication.login_failed",
        target_type="user",
        target_id="desconocido",
        result="FAILURE",
        reason="invalid_credentials",
        request_id=uuid4(),
        metadata={"attempts": 1},
    )

    assert event.actor is None
    assert event.occurred_at >= before
    assert event.metadata == {"attempts": 1}


def test_deleting_an_actor_preserves_the_audit_event() -> None:
    actor = get_user_model().objects.create_user(username="administrador")
    event = AuditEvent.objects.create(
        actor=actor,
        action="identity.user_updated",
        target_type="user",
        target_id="42",
        result="SUCCESS",
    )

    actor.delete()

    event.refresh_from_db()
    assert event.actor is None


def test_an_operation_identifier_cannot_repeat_for_the_same_action() -> None:
    operation_id = uuid4()
    event_data = {
        "action": "identity.password_reset",
        "target_type": "user",
        "target_id": "42",
        "result": "SUCCESS",
        "operation_id": operation_id,
    }
    AuditEvent.objects.create(**event_data)

    with pytest.raises(IntegrityError), transaction.atomic():
        AuditEvent.objects.create(**event_data)


def test_events_without_an_operation_identifier_are_not_artificially_unique() -> None:
    event_data = {
        "action": "authentication.login_failed",
        "target_type": "user",
        "target_id": "desconocido",
        "result": "FAILURE",
    }

    AuditEvent.objects.create(**event_data)
    AuditEvent.objects.create(**event_data)

    assert AuditEvent.objects.count() == 2
