import pytest
from django.test import Client
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from identity.models import User

pytestmark = pytest.mark.django_db


class OrdinaryProtectedView(APIView):
    def post(self, request: Request) -> Response:
        return Response({"executed": True})


def make_user(*, must_change_password: bool) -> User:
    return User.objects.create_user(
        username="operador",
        password="Clave-temporal-segura-2026",
        must_change_password=must_change_password,
    )


def test_temporary_credential_cannot_execute_an_ordinary_protected_action() -> None:
    user = make_user(must_change_password=True)
    request = APIRequestFactory().post("/accion/")
    force_authenticate(request, user=user)

    response = OrdinaryProtectedView.as_view()(request)

    assert response.status_code == 403


def test_completed_password_change_allows_an_ordinary_protected_action() -> None:
    user = make_user(must_change_password=False)
    request = APIRequestFactory().post("/accion/")
    force_authenticate(request, user=user)

    response = OrdinaryProtectedView.as_view()(request)

    assert response.status_code == 200


def test_temporary_credential_can_consult_and_close_its_session() -> None:
    make_user(must_change_password=True)
    client = Client(enforce_csrf_checks=True)
    client.get("/api/v1/auth/csrf/")
    token = client.cookies["csrftoken"].value
    login_response = client.post(
        "/api/v1/auth/login/",
        {"username": "operador", "password": "Clave-temporal-segura-2026"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )
    rotated_token = client.cookies["csrftoken"].value

    session_response = client.get("/api/v1/auth/session/")
    logout_response = client.post("/api/v1/auth/logout/", HTTP_X_CSRFTOKEN=rotated_token)

    assert login_response.status_code == 200
    assert session_response.status_code == 200
    assert session_response.json()["must_change_password"] is True
    assert logout_response.status_code == 204
