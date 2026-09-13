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


def test_problem_response_with_field_errors() -> None:
    from rest_framework.test import APIRequestFactory

    from config.api.errors import ProblemSerializer, problem_response

    factory = APIRequestFactory()
    request = factory.post("/api/v1/customers/")
    request.request_id = "test-uuid-1234"  # type: ignore[attr-defined]

    response = problem_response(
        request=request,
        status_code=400,
        title="Solicitud inválida",
        code="validation_error",
        detail="La solicitud contiene errores de validación.",
        errors={"identification": ["Este campo es obligatorio."], "phone": ["Número inválido."]},
    )

    assert response.status_code == 400
    assert response["Content-Type"] == "application/problem+json"
    assert response.data["errors"] == {
        "identification": ["Este campo es obligatorio."],
        "phone": ["Número inválido."],
    }
    assert response.data["code"] == "validation_error"
    assert response.data["request_id"] == "test-uuid-1234"

    serializer = ProblemSerializer(data=response.data)
    assert serializer.is_valid(), serializer.errors


def test_problem_response_with_sanitized_conflict() -> None:
    from rest_framework.test import APIRequestFactory

    from config.api.errors import ProblemSerializer, problem_response

    factory = APIRequestFactory()
    request = factory.post("/api/v1/customers/")
    request.request_id = "test-uuid-5678"  # type: ignore[attr-defined]

    response = problem_response(
        request=request,
        status_code=409,
        title="Conflicto con el estado actual",
        code="duplicate_identification",
        detail="Ya existe un cliente con esta identificación.",
        conflict={
            "type": "customer",
            "id": 42,
            "secret_internal_detail": "should_be_stripped",
        },
    )

    assert response.status_code == 409
    assert response["Content-Type"] == "application/problem+json"
    assert response.data["conflict"] == {
        "type": "customer",
        "id": 42,
    }
    assert "secret_internal_detail" not in response.data["conflict"]

    serializer = ProblemSerializer(data=response.data)
    assert serializer.is_valid(), serializer.errors


def test_problem_exception_handler_extracts_serializer_validation_errors() -> None:
    from typing import Any

    from rest_framework import exceptions, serializers
    from rest_framework.test import APIRequestFactory

    from config.api.errors import problem_exception_handler

    class SampleSerializer(serializers.Serializer[dict[str, Any]]):
        name = serializers.CharField()
        phone = serializers.CharField()

    s = SampleSerializer(data={})
    assert not s.is_valid()

    exc = exceptions.ValidationError(s.errors)
    factory = APIRequestFactory()
    request = factory.post("/api/v1/test/")
    request.request_id = "req-999"  # type: ignore[attr-defined]

    context = {"request": request}
    response = problem_exception_handler(exc, context)

    assert response is not None
    assert response.status_code == 400
    assert response["Content-Type"] == "application/problem+json"
    assert response.data["code"] == "validation_error"
    assert "name" in response.data["errors"]
    assert "phone" in response.data["errors"]


def test_internal_error_is_not_transformed_into_duplicate() -> None:
    from rest_framework.test import APIRequestFactory

    from config.api.errors import problem_exception_handler

    factory = APIRequestFactory()
    request = factory.get("/api/v1/test/")
    request.request_id = "req-500"  # type: ignore[attr-defined]

    exc = RuntimeError("Database connection died")
    response = problem_exception_handler(exc, {"request": request})
    # By default, unhandled 500 exceptions return None from DRF exception handler
    # and must never be masked as duplicate or 409
    assert response is None
