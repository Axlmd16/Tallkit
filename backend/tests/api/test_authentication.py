from typing import Any, cast

import pytest
from django.contrib.auth import get_user_model
from django.test import Client, override_settings
from django.urls import resolve

from identity.domain.authorization import ROLE_PERMISSIONS, Role
from identity.models import AuditEvent, User, UserRole


@pytest.fixture
def active_user(db: None) -> User:
    user = get_user_model().objects.create_user(username="operador", password="clave-segura")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    return user


def csrf_client() -> Client:
    return Client(enforce_csrf_checks=True)


def test_authentication_views_belong_to_the_identity_boundary() -> None:
    for path in [
        "/api/v1/auth/csrf/",
        "/api/v1/auth/login/",
        "/api/v1/auth/logout/",
        "/api/v1/auth/session/",
    ]:
        view_class = cast(Any, resolve(path).func).view_class
        assert view_class.__module__ == "identity.api.authentication"


def test_csrf_endpoint_sets_the_cookie() -> None:
    client = csrf_client()

    response = client.get("/api/v1/auth/csrf/")

    assert response.status_code == 204
    assert "csrftoken" in response.cookies
    assert response.cookies["csrftoken"]["samesite"] == "Lax"


@pytest.mark.django_db
def test_login_rejects_a_request_without_csrf(active_user: User) -> None:
    response = csrf_client().post(
        "/api/v1/auth/login/",
        {"username": "operador", "password": "clave-segura"},
        content_type="application/json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
@override_settings(SESSION_COOKIE_SECURE=True)
def test_login_creates_a_secure_session(
    active_user: User, caplog: pytest.LogCaptureFixture
) -> None:
    client = csrf_client()
    client.get("/api/v1/auth/csrf/")
    token = client.cookies["csrftoken"].value

    response = client.post(
        "/api/v1/auth/login/",
        {"username": "operador", "password": "clave-segura"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )

    assert response.status_code == 200
    assert response.json() == {
        "authenticated": True,
        "username": "operador",
        "roles": [Role.VENDEDOR],
        "permissions": sorted(ROLE_PERMISSIONS[Role.VENDEDOR]),
        "must_change_password": False,
    }
    assert response.cookies["sessionid"]["httponly"] is True
    assert response.cookies["sessionid"]["samesite"] == "Lax"
    assert response.cookies["sessionid"]["secure"] is True

    session_response = client.get("/api/v1/auth/session/")
    assert session_response.status_code == 200
    assert session_response.json() == response.json()
    login_event = AuditEvent.objects.get(action="authentication.login_succeeded")
    assert str(login_event.request_id) == response.headers["X-Request-ID"]
    assert any(
        response.headers["X-Request-ID"] in record.getMessage()
        and "request_completed" in record.getMessage()
        for record in caplog.records
    )


@pytest.mark.django_db
def test_logout_requires_csrf_and_invalidates_the_session(active_user: User) -> None:
    client = csrf_client()
    client.get("/api/v1/auth/csrf/")
    token = client.cookies["csrftoken"].value
    client.post(
        "/api/v1/auth/login/",
        {"username": "operador", "password": "clave-segura"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )
    rotated_token = client.cookies["csrftoken"].value

    rejected = client.post("/api/v1/auth/logout/")
    accepted = client.post("/api/v1/auth/logout/", HTTP_X_CSRFTOKEN=rotated_token)
    session = client.get("/api/v1/auth/session/")

    assert rejected.status_code == 403
    assert accepted.status_code == 204
    assert session.json() == {
        "authenticated": False,
        "username": None,
        "roles": [],
        "permissions": [],
        "must_change_password": False,
    }
    assert AuditEvent.objects.filter(action="authentication.logout", actor=active_user).exists()


@pytest.mark.django_db
def test_session_exposes_the_union_of_roles_without_internal_flags() -> None:
    user = get_user_model().objects.create_user(
        username="multirrol",
        password="clave-segura",
        must_change_password=True,
    )
    UserRole.objects.bulk_create(
        [
            UserRole(user=user, role=Role.VENDEDOR),
            UserRole(user=user, role=Role.ENCARGADO_TALLER),
        ]
    )
    client = Client()
    client.force_login(user)
    session = client.session
    session["authorization_version"] = user.authorization_version
    session.save()

    payload = client.get("/api/v1/auth/session/").json()

    assert payload["roles"] == [Role.ENCARGADO_TALLER, Role.VENDEDOR]
    assert payload["permissions"] == sorted(
        ROLE_PERMISSIONS[Role.VENDEDOR] | ROLE_PERMISSIONS[Role.ENCARGADO_TALLER]
    )
    assert payload["must_change_password"] is True
    assert "authorization_version" not in payload
    assert "password" not in payload


@pytest.mark.django_db
def test_login_is_throttled_after_repeated_failures(active_user: User) -> None:
    client = csrf_client()
    client.get("/api/v1/auth/csrf/")
    token = client.cookies["csrftoken"].value

    responses = [
        client.post(
            "/api/v1/auth/login/",
            {"username": "operador", "password": "incorrecta"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        for _ in range(6)
    ]

    assert [response.status_code for response in responses[:5]] == [400] * 5
    assert responses[5].status_code == 429
    event = AuditEvent.objects.get(action="authentication.login_throttled")
    assert event.actor is None
    assert event.target_id == "unconfirmed"
    assert "incorrecta" not in str(event.metadata)


@pytest.mark.django_db
def test_user_changes_own_password_and_keeps_the_current_session(active_user: User) -> None:
    client = csrf_client()
    client.get("/api/v1/auth/csrf/")
    token = client.cookies["csrftoken"].value
    client.post(
        "/api/v1/auth/login/",
        {"username": "operador", "password": "clave-segura"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )
    rotated_token = client.cookies["csrftoken"].value

    changed = client.post(
        "/api/v1/auth/change-password/",
        {
            "current_password": "clave-segura",
            "new_password": "Nueva-clave-muy-segura-2026",
        },
        content_type="application/json",
        HTTP_X_CSRFTOKEN=rotated_token,
    )
    session = client.get("/api/v1/auth/session/")

    active_user.refresh_from_db()
    assert changed.status_code == 204
    assert active_user.check_password("Nueva-clave-muy-segura-2026") is True
    assert active_user.check_password("clave-segura") is False
    assert session.json()["authenticated"] is True


@pytest.mark.django_db
def test_temporary_user_can_change_password_but_wrong_current_password_is_rejected() -> None:
    user = get_user_model().objects.create_user(
        username="temporal",
        password="Clave-temporal-segura-2026",
        must_change_password=True,
    )
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    client = csrf_client()
    client.get("/api/v1/auth/csrf/")
    token = client.cookies["csrftoken"].value
    client.post(
        "/api/v1/auth/login/",
        {"username": "temporal", "password": "Clave-temporal-segura-2026"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )
    rotated_token = client.cookies["csrftoken"].value

    rejected = client.post(
        "/api/v1/auth/change-password/",
        {"current_password": "incorrecta", "new_password": "Nueva-clave-segura-2026"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=rotated_token,
    )
    accepted = client.post(
        "/api/v1/auth/change-password/",
        {
            "current_password": "Clave-temporal-segura-2026",
            "new_password": "Nueva-clave-segura-2026",
        },
        content_type="application/json",
        HTTP_X_CSRFTOKEN=rotated_token,
    )

    user.refresh_from_db()
    assert rejected.status_code == 400
    assert accepted.status_code == 204
    assert user.must_change_password is False
