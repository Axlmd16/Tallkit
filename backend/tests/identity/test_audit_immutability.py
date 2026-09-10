import pytest

from identity.models import AuditEvent, AuditEventImmutableError

pytestmark = pytest.mark.django_db


@pytest.fixture
def event() -> AuditEvent:
    return AuditEvent.objects.create(
        action="identity.user_updated",
        target_type="user",
        target_id="42",
        result="SUCCESS",
    )


def test_an_existing_audit_event_cannot_be_updated(event: AuditEvent) -> None:
    event.reason = "reescribir historia"

    with pytest.raises(AuditEventImmutableError):
        event.save()

    event.refresh_from_db()
    assert event.reason == ""


def test_an_audit_event_cannot_be_deleted(event: AuditEvent) -> None:
    event_id = event.pk

    with pytest.raises(AuditEventImmutableError):
        event.delete()

    assert AuditEvent.objects.filter(pk=event_id).exists()


def test_a_correction_is_recorded_as_an_additional_event(event: AuditEvent) -> None:
    correction = AuditEvent.objects.create(
        action="identity.audit_correction",
        target_type="audit_event",
        target_id=str(event.pk),
        result="SUCCESS",
        reason="Aclaración administrativa",
    )

    assert AuditEvent.objects.filter(pk=event.pk).exists()
    assert correction.pk != event.pk
    assert AuditEvent.objects.count() == 2
