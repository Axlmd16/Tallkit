import pytest
from rest_framework.test import APIClient

from identity.domain.authorization import ROLE_PERMISSIONS, Role
from identity.models import User, UserRole

pytestmark = pytest.mark.django_db


def client_for(role: Role) -> APIClient:
    user = User.objects.create_user(username=role.value.lower())
    UserRole.objects.create(user=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_administrator_reads_exactly_the_fixed_role_catalog() -> None:
    response = client_for(Role.ADMINISTRADOR).get("/api/v1/roles/")

    assert response.status_code == 200
    assert response.json() == [
        {
            "code": role.value,
            "permissions": sorted(ROLE_PERMISSIONS[role]),
        }
        for role in Role
    ]


@pytest.mark.parametrize("role", [Role.VENDEDOR, Role.ENCARGADO_TALLER])
def test_other_roles_cannot_read_the_role_catalog(role: Role) -> None:
    assert client_for(role).get("/api/v1/roles/").status_code == 403


def test_fixed_roles_cannot_be_created_edited_or_deleted() -> None:
    client = client_for(Role.ADMINISTRADOR)

    assert client.post("/api/v1/roles/", {"code": "NUEVO"}, format="json").status_code == 405
    assert client.patch("/api/v1/roles/VENDEDOR/", {}, format="json").status_code == 404
    assert client.delete("/api/v1/roles/VENDEDOR/").status_code == 404
    assert list(Role) == [
        Role.ADMINISTRADOR,
        Role.VENDEDOR,
        Role.ENCARGADO_TALLER,
    ]
