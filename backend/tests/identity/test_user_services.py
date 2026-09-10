from uuid import uuid4

import pytest
from django.contrib.auth import authenticate, get_user_model

from identity.application.credentials import BusinessPermissionDeniedError
from identity.application.users import (
    DuplicateUsernameError,
    InvalidRolesError,
    LastActiveAdministratorError,
    create_user,
    set_user_active,
    update_user,
)
from identity.domain.authorization import Role
from identity.models import AuditEvent, AuditResult, User

pytestmark = pytest.mark.django_db


@pytest.fixture
def actor() -> User:
    user = get_user_model().objects.create_user(username="administrador")
    user.role_assignments.create(role=Role.ADMINISTRADOR)
    return user


def test_create_user_with_multiple_roles_and_audit(actor: User) -> None:
    request_id = uuid4()

    user = create_user(
        actor=actor,
        username="operador",
        first_name="Ana",
        last_name="Pérez",
        email="ana@example.test",
        is_active=True,
        roles=[Role.VENDEDOR, Role.ENCARGADO_TALLER],
        request_id=request_id,
    )

    assert user.check_password("anything") is False
    assert set(user.role_assignments.values_list("role", flat=True)) == {
        Role.VENDEDOR,
        Role.ENCARGADO_TALLER,
    }
    event = AuditEvent.objects.get(action="identity.user_created")
    assert event.actor == actor
    assert event.target_id == str(user.pk)
    assert event.result == AuditResult.SUCCESS
    assert event.request_id == request_id


def test_create_user_rejects_a_repeated_login_identifier(actor: User) -> None:
    get_user_model().objects.create_user(username="operador")

    with pytest.raises(DuplicateUsernameError):
        create_user(actor=actor, username="operador", roles=[Role.VENDEDOR])

    assert get_user_model().objects.filter(username="operador").count() == 1


def test_create_user_rejects_an_actor_without_permission() -> None:
    seller = get_user_model().objects.create_user(username="vendedor")
    seller.role_assignments.create(role=Role.VENDEDOR)

    with pytest.raises(BusinessPermissionDeniedError):
        create_user(actor=seller, username="operador", roles=[Role.VENDEDOR])

    assert not get_user_model().objects.filter(username="operador").exists()
    assert AuditEvent.objects.filter(
        action="authorization.permission_denied",
        actor=seller,
        target_type="user",
        target_id="uncreated",
        result=AuditResult.DENIED,
    ).exists()


@pytest.mark.parametrize("roles", [[], ["ROL_INVENTADO"]])
def test_create_user_rejects_missing_or_unknown_roles(actor: User, roles: list[str]) -> None:
    with pytest.raises(InvalidRolesError):
        create_user(actor=actor, username="operador", roles=roles)

    assert not get_user_model().objects.filter(username="operador").exists()


def test_adding_a_role_preserves_existing_roles_without_invalidating_sessions(
    actor: User,
) -> None:
    user = create_user(actor=actor, username="operador", roles=[Role.VENDEDOR])
    initial_version = user.authorization_version

    updated = update_user(
        actor=actor,
        user_id=user.pk,
        username="operador",
        first_name="Ana",
        last_name="Pérez",
        email="ana@example.test",
        roles=[Role.VENDEDOR, Role.ENCARGADO_TALLER],
    )

    assert updated.authorization_version == initial_version
    assert set(updated.role_assignments.values_list("role", flat=True)) == {
        Role.VENDEDOR,
        Role.ENCARGADO_TALLER,
    }


def test_removing_a_role_increments_authorization_version(actor: User) -> None:
    user = create_user(
        actor=actor,
        username="operador",
        roles=[Role.VENDEDOR, Role.ENCARGADO_TALLER],
    )
    initial_version = user.authorization_version

    updated = update_user(
        actor=actor,
        user_id=user.pk,
        username="operador",
        roles=[Role.ENCARGADO_TALLER],
    )

    assert updated.authorization_version == initial_version + 1
    assert set(updated.role_assignments.values_list("role", flat=True)) == {Role.ENCARGADO_TALLER}


def test_repeating_the_same_declared_state_is_idempotent(actor: User) -> None:
    user = create_user(
        actor=actor,
        username="operador",
        first_name="Ana",
        roles=[Role.VENDEDOR],
    )
    initial_version = user.authorization_version
    initial_events = AuditEvent.objects.count()

    updated = update_user(
        actor=actor,
        user_id=user.pk,
        username="operador",
        first_name="Ana",
        roles=[Role.VENDEDOR],
    )

    assert updated.authorization_version == initial_version
    assert AuditEvent.objects.count() == initial_events


def test_invalid_role_update_preserves_the_previous_assignment(actor: User) -> None:
    user = create_user(actor=actor, username="operador", roles=[Role.VENDEDOR])

    with pytest.raises(InvalidRolesError):
        update_user(
            actor=actor,
            user_id=user.pk,
            username="operador",
            roles=["ROL_INVENTADO"],
        )

    assert set(user.role_assignments.values_list("role", flat=True)) == {Role.VENDEDOR}


def test_update_user_rejects_an_actor_without_permission(actor: User) -> None:
    user = create_user(actor=actor, username="operador", roles=[Role.VENDEDOR])
    seller = get_user_model().objects.create_user(username="vendedor")
    seller.role_assignments.create(role=Role.VENDEDOR)

    with pytest.raises(BusinessPermissionDeniedError):
        update_user(
            actor=seller,
            user_id=user.pk,
            username="modificado",
            roles=[Role.VENDEDOR],
        )

    user.refresh_from_db()
    assert user.username == "operador"
    assert AuditEvent.objects.filter(
        action="authorization.permission_denied",
        actor=seller,
        target_type="user",
        target_id=str(user.pk),
        result=AuditResult.DENIED,
    ).exists()


def test_duplicate_username_update_is_audited(actor: User) -> None:
    user = create_user(actor=actor, username="operador", roles=[Role.VENDEDOR])
    create_user(actor=actor, username="ocupado", roles=[Role.VENDEDOR])

    with pytest.raises(DuplicateUsernameError):
        update_user(
            actor=actor,
            user_id=user.pk,
            username="ocupado",
            roles=[Role.VENDEDOR],
        )

    assert AuditEvent.objects.filter(
        action="identity.user_update_rejected",
        actor=actor,
        target_id=str(user.pk),
        result=AuditResult.FAILURE,
        reason="duplicate_username",
    ).exists()


def test_deactivating_a_user_invalidates_access_and_preserves_roles(actor: User) -> None:
    user = create_user(actor=actor, username="operador", roles=[Role.VENDEDOR])
    user.set_password("segura")
    user.save(update_fields=["password"])
    initial_version = user.authorization_version

    updated = set_user_active(actor=actor, user_id=user.pk, is_active=False)

    assert updated.is_active is False
    assert updated.authorization_version == initial_version + 1
    assert set(updated.role_assignments.values_list("role", flat=True)) == {Role.VENDEDOR}
    assert authenticate(username="operador", password="segura") is None
    assert AuditEvent.objects.filter(
        action="identity.user_deactivated", target_id=str(user.pk)
    ).exists()


def test_reactivating_a_user_preserves_its_credentials_and_roles(actor: User) -> None:
    user = create_user(
        actor=actor,
        username="operador",
        roles=[Role.ENCARGADO_TALLER],
        is_active=False,
    )
    user.set_password("segura")
    user.save(update_fields=["password"])
    initial_version = user.authorization_version

    updated = set_user_active(actor=actor, user_id=user.pk, is_active=True)

    assert updated.authorization_version == initial_version + 1
    assert authenticate(username="operador", password="segura") == updated
    assert set(updated.role_assignments.values_list("role", flat=True)) == {Role.ENCARGADO_TALLER}


def test_repeating_the_same_active_state_is_idempotent(actor: User) -> None:
    user = create_user(actor=actor, username="operador", roles=[Role.VENDEDOR])
    initial_version = user.authorization_version
    initial_events = AuditEvent.objects.count()

    updated = set_user_active(actor=actor, user_id=user.pk, is_active=True)

    assert updated.authorization_version == initial_version
    assert AuditEvent.objects.count() == initial_events


def test_state_change_rejects_an_actor_without_permission(actor: User) -> None:
    user = create_user(actor=actor, username="operador", roles=[Role.VENDEDOR])
    seller = get_user_model().objects.create_user(username="vendedor")
    seller.role_assignments.create(role=Role.VENDEDOR)

    with pytest.raises(BusinessPermissionDeniedError):
        set_user_active(actor=seller, user_id=user.pk, is_active=False)

    user.refresh_from_db()
    assert user.is_active is True
    assert AuditEvent.objects.filter(
        action="authorization.permission_denied",
        actor=seller,
        target_type="user",
        target_id=str(user.pk),
        result=AuditResult.DENIED,
    ).exists()


def test_cannot_deactivate_the_last_active_administrator(actor: User) -> None:
    with pytest.raises(LastActiveAdministratorError):
        set_user_active(actor=actor, user_id=actor.pk, is_active=False)

    actor.refresh_from_db()
    assert actor.is_active is True


def test_cannot_remove_the_role_from_the_last_active_administrator(actor: User) -> None:
    actor.role_assignments.create(role=Role.VENDEDOR)

    with pytest.raises(LastActiveAdministratorError):
        update_user(
            actor=actor,
            user_id=actor.pk,
            username=actor.username,
            roles=[Role.VENDEDOR],
        )

    assert set(actor.role_assignments.values_list("role", flat=True)) == {
        Role.ADMINISTRADOR,
        Role.VENDEDOR,
    }


def test_can_deactivate_an_administrator_when_another_one_is_active(actor: User) -> None:
    first = create_user(actor=actor, username="admin-1", roles=[Role.ADMINISTRADOR])
    create_user(actor=actor, username="admin-2", roles=[Role.ADMINISTRADOR])

    updated = set_user_active(actor=actor, user_id=first.pk, is_active=False)

    assert updated.is_active is False
