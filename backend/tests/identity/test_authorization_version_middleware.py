import pytest
from django.conf import settings
from django.test import Client

from identity.application.users import update_user
from identity.domain.authorization import Role
from identity.models import User, UserRole

pytestmark = pytest.mark.django_db


def make_user() -> User:
    user = User.objects.create_user(username="operador", password="clave-segura")
    UserRole.objects.bulk_create(
        [
            UserRole(user=user, role=Role.VENDEDOR),
            UserRole(user=user, role=Role.ENCARGADO_TALLER),
        ]
    )
    return user


def login(client: Client) -> None:
    client.get("/api/v1/auth/csrf/")
    token = client.cookies["csrftoken"].value
    response = client.post(
        "/api/v1/auth/login/",
        {"username": "operador", "password": "clave-segura"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert response.status_code == 200


def test_login_copies_the_current_authorization_version_to_the_session() -> None:
    user = make_user()
    client = Client()

    login(client)

    assert client.session["authorization_version"] == user.authorization_version


def test_a_session_with_the_current_version_remains_authenticated() -> None:
    make_user()
    client = Client()
    login(client)

    assert client.get("/api/v1/auth/session/").json()["authenticated"] is True


def test_a_stale_session_is_closed_after_a_role_reduction() -> None:
    user = make_user()
    administrator = User.objects.create_user(username="administrador")
    UserRole.objects.create(user=administrator, role=Role.ADMINISTRADOR)
    client = Client()
    login(client)

    update_user(
        actor=administrator,
        user_id=user.pk,
        username=user.username,
        roles=[Role.ENCARGADO_TALLER],
    )

    payload = client.get("/api/v1/auth/session/").json()
    assert payload["authenticated"] is False
    assert "_auth_user_id" not in client.session


def test_an_inactive_account_loses_its_existing_session() -> None:
    user = make_user()
    client = Client()
    login(client)
    User.objects.filter(pk=user.pk).update(is_active=False)

    assert client.get("/api/v1/auth/session/").json()["authenticated"] is False


def test_authorization_middleware_runs_after_django_authentication() -> None:
    authentication_index = settings.MIDDLEWARE.index(
        "django.contrib.auth.middleware.AuthenticationMiddleware"
    )
    authorization_index = settings.MIDDLEWARE.index(
        "identity.middleware.AuthorizationVersionMiddleware"
    )

    assert authorization_index == authentication_index + 1
