import json
from uuid import uuid4

import pytest
from django.core.exceptions import ValidationError

from identity.application.credentials import (
    BusinessPermissionDeniedError,
    IncorrectCurrentPasswordError,
    OperationAlreadyProcessedError,
    change_password,
    reset_password,
)
from identity.domain.authorization import Role
from identity.models import AuditEvent, User, UserRole

pytestmark = pytest.mark.django_db


@pytest.fixture
def user() -> User:
    return User.objects.create_user(
        username="operador",
        password="Clave-anterior-segura-2026",
        must_change_password=True,
    )


def test_changes_own_password_and_clears_the_temporary_restriction(user: User) -> None:
    change_password(
        user=user,
        current_password="Clave-anterior-segura-2026",
        new_password="Nueva-clave-muy-segura-2026",
    )

    user.refresh_from_db()
    assert user.check_password("Nueva-clave-muy-segura-2026") is True
    assert user.check_password("Clave-anterior-segura-2026") is False
    assert user.must_change_password is False
    event = AuditEvent.objects.get(action="identity.password_changed")
    serialized_event = json.dumps(event.metadata)
    assert "Clave-anterior-segura-2026" not in serialized_event
    assert "Nueva-clave-muy-segura-2026" not in serialized_event


def test_rejects_an_incorrect_current_password_without_changing_it(user: User) -> None:
    with pytest.raises(IncorrectCurrentPasswordError):
        change_password(
            user=user,
            current_password="incorrecta",
            new_password="Nueva-clave-muy-segura-2026",
        )

    user.refresh_from_db()
    assert user.check_password("Clave-anterior-segura-2026") is True


def test_rejects_a_new_password_that_fails_django_validators(user: User) -> None:
    with pytest.raises(ValidationError):
        change_password(
            user=user,
            current_password="Clave-anterior-segura-2026",
            new_password="123",
        )

    user.refresh_from_db()
    assert user.check_password("Clave-anterior-segura-2026") is True


def make_actor(username: str, role: Role) -> User:
    actor = User.objects.create_user(username=username)
    UserRole.objects.create(user=actor, role=role)
    return actor


def test_administrator_resets_to_a_one_time_temporary_credential(user: User) -> None:
    actor = make_actor("administrador", Role.ADMINISTRADOR)
    operation_id = uuid4()
    initial_version = user.authorization_version

    temporary_password = reset_password(
        actor=actor,
        user_id=user.pk,
        operation_id=operation_id,
    )

    user.refresh_from_db()
    assert temporary_password
    assert user.check_password(temporary_password) is True
    assert user.check_password("Clave-anterior-segura-2026") is False
    assert user.must_change_password is True
    assert user.authorization_version == initial_version + 1
    event = AuditEvent.objects.get(action="identity.password_reset", operation_id=operation_id)
    assert temporary_password not in json.dumps(event.metadata)


def test_repeating_a_reset_operation_does_not_generate_or_reveal_another_secret(
    user: User,
) -> None:
    actor = make_actor("administrador", Role.ADMINISTRADOR)
    operation_id = uuid4()
    first_password = reset_password(
        actor=actor,
        user_id=user.pk,
        operation_id=operation_id,
    )
    user.refresh_from_db()
    version_after_first = user.authorization_version

    with pytest.raises(OperationAlreadyProcessedError):
        reset_password(actor=actor, user_id=user.pk, operation_id=operation_id)

    user.refresh_from_db()
    assert user.authorization_version == version_after_first
    assert user.check_password(first_password) is True
    assert (
        AuditEvent.objects.filter(
            action="identity.password_reset", operation_id=operation_id
        ).count()
        == 1
    )


def test_a_new_reset_operation_intentionally_replaces_the_previous_secret(user: User) -> None:
    actor = make_actor("administrador", Role.ADMINISTRADOR)

    first_password = reset_password(actor=actor, user_id=user.pk, operation_id=uuid4())
    second_password = reset_password(actor=actor, user_id=user.pk, operation_id=uuid4())

    user.refresh_from_db()
    assert first_password != second_password
    assert user.check_password(first_password) is False
    assert user.check_password(second_password) is True


def test_non_administrator_cannot_reset_another_users_password(user: User) -> None:
    actor = make_actor("vendedor", Role.VENDEDOR)
    previous_hash = user.password

    with pytest.raises(BusinessPermissionDeniedError):
        reset_password(actor=actor, user_id=user.pk, operation_id=uuid4())

    user.refresh_from_db()
    assert user.password == previous_hash
    assert AuditEvent.objects.filter(
        action="identity.password_reset_denied",
        actor=actor,
        target_type="user",
        target_id=str(user.pk),
    ).exists()
