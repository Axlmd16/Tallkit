import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from identity.domain.authorization import Role
from identity.models import UserRole

pytestmark = pytest.mark.django_db


def test_identity_user_is_the_configured_authentication_model() -> None:
    user_model = get_user_model()

    assert settings.AUTH_USER_MODEL == "identity.User"
    assert user_model._meta.label == "identity.User"


def test_user_defaults_to_no_forced_password_change_and_initial_auth_version() -> None:
    user = get_user_model().objects.create_user(username="operador", password="segura")

    assert user.must_change_password is False
    assert user.authorization_version == 1


def test_user_role_only_accepts_the_closed_role_catalog() -> None:
    field_choices = UserRole._meta.get_field("role").choices
    assert field_choices is not None
    choices = {value for value, _label in field_choices}

    assert choices == {role.value for role in Role}


def test_the_same_role_cannot_be_assigned_twice_to_one_user() -> None:
    user = get_user_model().objects.create_user(username="operador", password="segura")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)

    with pytest.raises(IntegrityError), transaction.atomic():
        UserRole.objects.create(user=user, role=Role.VENDEDOR)


def test_one_user_can_have_multiple_roles() -> None:
    user = get_user_model().objects.create_user(username="operador", password="segura")

    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    UserRole.objects.create(user=user, role=Role.ENCARGADO_TALLER)

    assert set(user.role_assignments.values_list("role", flat=True)) == {
        Role.VENDEDOR,
        Role.ENCARGADO_TALLER,
    }
