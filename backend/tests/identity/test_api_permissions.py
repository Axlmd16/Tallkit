from typing import ClassVar

import pytest
from django.contrib.auth import get_user_model
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from identity.api.permissions import HasBusinessPermission
from identity.domain.authorization import Role
from identity.models import AuditEvent, AuditResult, User, UserRole

pytestmark = pytest.mark.django_db


class ProtectedActionView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "ventas.confirmar"
    executions: ClassVar[list[str]] = []

    def post(self, request: Request) -> Response:
        self.executions.append(request.user.get_username())
        return Response({"executed": True})


class CriticalAdministrativeActionView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "usuarios.desactivar"
    audited_permission_denial_methods = frozenset({"POST"})

    def post(self, request: Request) -> Response:
        return Response({"executed": True})


@pytest.fixture(autouse=True)
def clear_executions() -> None:
    ProtectedActionView.executions.clear()


def user_with_roles(username: str, *roles: Role) -> User:
    user = get_user_model().objects.create_user(username=username, password="segura")
    UserRole.objects.bulk_create([UserRole(user=user, role=role) for role in roles])
    return user


@pytest.mark.parametrize(
    "roles",
    [
        (Role.ADMINISTRADOR,),
        (Role.VENDEDOR,),
        (Role.ENCARGADO_TALLER, Role.VENDEDOR),
    ],
)
def test_a_role_or_union_with_the_permission_is_authorized(roles: tuple[Role, ...]) -> None:
    user = user_with_roles("autorizado", *roles)
    request = APIRequestFactory().post("/accion/")
    force_authenticate(request, user=user)

    response = ProtectedActionView.as_view()(request)

    assert response.status_code == 200
    assert ProtectedActionView.executions == ["autorizado"]


@pytest.mark.parametrize("role", [Role.ENCARGADO_TALLER])
def test_calling_the_view_directly_without_permission_is_denied_without_effects(
    role: Role,
) -> None:
    user = user_with_roles("no-autorizado", role)
    request = APIRequestFactory().post("/accion/")
    force_authenticate(request, user=user)

    response = ProtectedActionView.as_view()(request)

    assert response.status_code == 403
    assert ProtectedActionView.executions == []


def test_no_roles_is_denied_by_default() -> None:
    user = user_with_roles("sin-rol")
    request = APIRequestFactory().post("/accion/")
    force_authenticate(request, user=user)

    response = ProtectedActionView.as_view()(request)

    assert response.status_code == 403
    assert ProtectedActionView.executions == []


def test_critical_administrative_denial_is_audited() -> None:
    user = user_with_roles("vendedor", Role.VENDEDOR)
    request = APIRequestFactory().post("/api/v1/users/42/deactivate/")
    request.request_id = "319f55e1-85d9-43df-9134-472dc937b17e"  # type: ignore[attr-defined]
    force_authenticate(request, user=user)

    response = CriticalAdministrativeActionView.as_view()(request)

    assert response.status_code == 403
    event = AuditEvent.objects.get(action="authorization.permission_denied")
    assert event.actor == user
    assert event.result == AuditResult.DENIED
    assert event.target_id == "usuarios.desactivar"
    assert event.metadata == {
        "method": "POST",
        "path": "/api/v1/users/42/deactivate/",
        "permission": "usuarios.desactivar",
    }
