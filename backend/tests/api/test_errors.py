import pytest
from django.contrib.auth import get_user_model
from django.test import Client


@pytest.mark.django_db
def test_invalid_login_uses_the_problem_error_contract() -> None:
    get_user_model().objects.create_user(username="operador", password="clave-segura")
    client = Client(enforce_csrf_checks=True)
    client.get("/api/v1/auth/csrf/")

    response = client.post(
        "/api/v1/auth/login/",
        {"username": "operador", "password": "incorrecta"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )

    payload = response.json()
    assert response.status_code == 400
    assert payload["type"] == "about:blank"
    assert payload["title"] == "Solicitud inválida"
    assert payload["status"] == 400
    assert payload["code"] == "invalid_credentials"
    assert payload["request_id"] == response.headers["X-Request-ID"]
