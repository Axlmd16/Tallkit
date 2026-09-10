import pytest
from rest_framework.test import APIClient

from identity.domain.authorization import Role
from identity.models import User, UserRole

pytestmark = pytest.mark.django_db


def test_openapi_contains_the_complete_identity_contract() -> None:
    administrator = User.objects.create_user(username="administrador")
    UserRole.objects.create(user=administrator, role=Role.ADMINISTRADOR)
    client = APIClient()
    client.force_authenticate(user=administrator)

    response = client.get("/api/v1/schema/", HTTP_ACCEPT="application/json")

    assert response.status_code == 200
    schema = response.json()
    expected_operations = {
        "/api/v1/auth/csrf/": {"get"},
        "/api/v1/auth/login/": {"post"},
        "/api/v1/auth/logout/": {"post"},
        "/api/v1/auth/session/": {"get"},
        "/api/v1/auth/change-password/": {"post"},
        "/api/v1/users/": {"get", "post"},
        "/api/v1/users/{user_id}/": {"get", "patch"},
        "/api/v1/users/{user_id}/activate/": {"post"},
        "/api/v1/users/{user_id}/deactivate/": {"post"},
        "/api/v1/users/{user_id}/reset-password/": {"post"},
        "/api/v1/roles/": {"get"},
        "/api/v1/audit/": {"get"},
        "/api/v1/audit/{event_id}/": {"get"},
    }
    for path, operations in expected_operations.items():
        assert path in schema["paths"]
        assert operations <= set(schema["paths"][path])

    reset_response_schema = schema["paths"]["/api/v1/users/{user_id}/reset-password/"]["post"][
        "responses"
    ]["200"]["content"]["application/json"]["schema"]
    component_name = reset_response_schema["$ref"].rsplit("/", maxsplit=1)[-1]
    assert "temporary_password" in schema["components"]["schemas"][component_name]["properties"]
