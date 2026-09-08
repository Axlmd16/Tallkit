from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.test import Client, override_settings


@pytest.fixture
def active_user(db: None) -> Any:
    return get_user_model().objects.create_user(username="operador", password="clave-segura")


def csrf_client() -> Client:
    return Client(enforce_csrf_checks=True)


def test_csrf_endpoint_sets_the_cookie() -> None:
    client = csrf_client()

    response = client.get("/api/v1/auth/csrf/")

    assert response.status_code == 204
    assert "csrftoken" in response.cookies
    assert response.cookies["csrftoken"]["samesite"] == "Lax"


@pytest.mark.django_db
def test_login_rejects_a_request_without_csrf(active_user: object) -> None:
    response = csrf_client().post(
        "/api/v1/auth/login/",
        {"username": "operador", "password": "clave-segura"},
        content_type="application/json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
@override_settings(SESSION_COOKIE_SECURE=True)
def test_login_creates_a_secure_session(active_user: object) -> None:
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
    assert response.json() == {"authenticated": True, "username": "operador"}
    assert response.cookies["sessionid"]["httponly"] is True
    assert response.cookies["sessionid"]["samesite"] == "Lax"
    assert response.cookies["sessionid"]["secure"] is True

    session_response = client.get("/api/v1/auth/session/")
    assert session_response.status_code == 200
    assert session_response.json() == {"authenticated": True, "username": "operador"}


@pytest.mark.django_db
def test_logout_requires_csrf_and_invalidates_the_session(active_user: object) -> None:
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
    assert session.json() == {"authenticated": False, "username": None}


@pytest.mark.django_db
def test_login_is_throttled_after_repeated_failures(active_user: object) -> None:
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
