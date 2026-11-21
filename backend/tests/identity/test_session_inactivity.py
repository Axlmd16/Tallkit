from unittest.mock import patch

import pytest
from django.conf import settings
from django.test import Client, override_settings

from identity.domain.authorization import Role
from identity.models import User, UserRole

pytestmark = pytest.mark.django_db


def make_user() -> User:
    user = User.objects.create_user(username="operador", password="clave-segura")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
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


def test_login_sets_initial_last_activity_timestamp() -> None:
    make_user()
    client = Client()

    with patch("identity.api.authentication.time.time", return_value=1_000_000.0):
        login(client)

    assert client.session["last_activity_ts"] == 1_000_000


@override_settings(SESSION_INACTIVITY_TIMEOUT_SECONDS=3600)
def test_session_remains_authenticated_within_inactivity_threshold() -> None:
    make_user()
    client = Client()

    with patch("identity.api.authentication.time.time", return_value=1_000_000.0):
        login(client)

    with patch("identity.middleware.time.time", return_value=1_001_800.0):
        response = client.get("/api/v1/auth/session/")

    assert response.status_code == 200
    assert response.json()["authenticated"] is True
    assert client.session["last_activity_ts"] == 1_001_800


@override_settings(SESSION_INACTIVITY_TIMEOUT_SECONDS=3600)
def test_session_skips_redundant_write_when_elapsed_is_under_refresh_interval() -> None:
    make_user()
    client = Client()

    with patch("identity.api.authentication.time.time", return_value=1_000_000.0):
        login(client)

    with patch("identity.middleware.time.time", return_value=1_000_030.0):
        response = client.get("/api/v1/auth/session/")

    assert response.status_code == 200
    assert response.json()["authenticated"] is True
    assert client.session["last_activity_ts"] == 1_000_000


@override_settings(SESSION_INACTIVITY_TIMEOUT_SECONDS=3600)
def test_session_expires_when_inactivity_exceeds_threshold() -> None:
    make_user()
    client = Client()

    with patch("identity.api.authentication.time.time", return_value=1_000_000.0):
        login(client)

    with patch("identity.middleware.time.time", return_value=1_003_601.0):
        session_response = client.get("/api/v1/auth/session/")
        protected_response = client.get("/api/v1/users/")

    assert session_response.json()["authenticated"] is False
    assert "_auth_user_id" not in client.session
    assert protected_response.status_code == 403


@override_settings(SESSION_INACTIVITY_TIMEOUT_SECONDS=0)
def test_session_inactivity_is_disabled_when_threshold_is_zero() -> None:
    make_user()
    client = Client()

    with patch("identity.api.authentication.time.time", return_value=1_000_000.0):
        login(client)

    with patch("identity.middleware.time.time", return_value=2_000_000.0):
        response = client.get("/api/v1/auth/session/")

    assert response.status_code == 200
    assert response.json()["authenticated"] is True


def test_session_inactivity_middleware_runs_after_authorization_version() -> None:
    authorization_index = settings.MIDDLEWARE.index(
        "identity.middleware.AuthorizationVersionMiddleware"
    )
    inactivity_index = settings.MIDDLEWARE.index("identity.middleware.SessionInactivityMiddleware")

    assert inactivity_index == authorization_index + 1
