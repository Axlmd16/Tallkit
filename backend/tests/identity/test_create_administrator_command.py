from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from identity.domain.authorization import Role, effective_permissions

pytestmark = pytest.mark.django_db


def test_createsuperuser_bootstraps_an_active_business_administrator(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", "temporal-segura")

    call_command(
        "createsuperuser",
        username="administrador",
        email="",
        interactive=False,
        stdout=StringIO(),
    )

    user = get_user_model().objects.get(username="administrador")
    assert user.is_active is True
    assert user.is_staff is True
    assert user.is_superuser is True
    assert set(user.role_assignments.values_list("role", flat=True)) == {Role.ADMINISTRADOR}


def test_django_superuser_flag_does_not_grant_business_permissions() -> None:
    user = get_user_model().objects.create_user(
        username="tecnico",
        password="segura",
        is_superuser=True,
    )

    roles = {Role(assignment.role) for assignment in user.role_assignments.all()}

    assert effective_permissions(roles) == frozenset()
