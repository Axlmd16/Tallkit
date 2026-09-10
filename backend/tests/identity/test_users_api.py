from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from identity.domain.authorization import Role
from identity.models import AuditEvent, AuditResult, User, UserRole

pytestmark = pytest.mark.django_db


def user_with_role(username: str, role: Role) -> User:
    user = User.objects.create_user(username=username, password="Clave-segura-2026")
    UserRole.objects.create(user=user, role=role)
    return user


def authenticated_client(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_administrator_can_create_list_and_edit_a_multirole_user() -> None:
    administrator = user_with_role("administrador", Role.ADMINISTRADOR)
    client = authenticated_client(administrator)

    created = client.post(
        "/api/v1/users/",
        {
            "username": "operador",
            "first_name": "Ana",
            "last_name": "Pérez",
            "email": "ana@example.test",
            "is_active": True,
            "roles": [Role.VENDEDOR, Role.ENCARGADO_TALLER],
        },
        format="json",
    )
    listed = client.get("/api/v1/users/", {"search": "ana", "role": Role.VENDEDOR})
    edited = client.patch(
        f"/api/v1/users/{created.json()['id']}/",
        {"first_name": "Andrea", "roles": [Role.ENCARGADO_TALLER]},
        format="json",
    )

    assert created.status_code == 201
    assert created.json()["roles"] == [Role.ENCARGADO_TALLER, Role.VENDEDOR]
    assert listed.status_code == 200
    assert listed.json()["count"] == 1
    assert listed.json()["results"][0]["username"] == "operador"
    assert edited.status_code == 200
    assert edited.json()["first_name"] == "Andrea"
    assert edited.json()["roles"] == [Role.ENCARGADO_TALLER]


@pytest.mark.parametrize("roles", [[], ["ROL_INVENTADO"]])
def test_user_creation_validation_returns_problem_details(roles: list[str]) -> None:
    administrator = user_with_role("administrador", Role.ADMINISTRADOR)

    response = authenticated_client(administrator).post(
        "/api/v1/users/",
        {"username": "operador", "roles": roles},
        format="json",
    )

    assert response.status_code == 400
    assert response["Content-Type"].startswith("application/problem+json")
    assert response.json()["code"] == "invalid_roles"
    assert not User.objects.filter(username="operador").exists()


def test_invalid_user_payload_is_audited_without_persisting_submitted_data() -> None:
    administrator = user_with_role("administrador", Role.ADMINISTRADOR)

    response = authenticated_client(administrator).post(
        "/api/v1/users/",
        {
            "username": "operador",
            "email": "correo-invalido",
            "roles": [Role.VENDEDOR],
        },
        format="json",
    )

    assert response.status_code == 400
    event = AuditEvent.objects.get(action="identity.user_create_rejected")
    assert event.actor == administrator
    assert event.result == AuditResult.FAILURE
    assert event.reason == "invalid_user"
    assert "correo-invalido" not in str(event.metadata)


def test_non_administrator_cannot_list_or_create_users() -> None:
    seller = user_with_role("vendedor", Role.VENDEDOR)
    client = authenticated_client(seller)

    listed = client.get("/api/v1/users/")
    created = client.post(
        "/api/v1/users/",
        {"username": "otro", "roles": [Role.VENDEDOR]},
        format="json",
    )

    assert listed.status_code == 403
    assert created.status_code == 403
    assert not User.objects.filter(username="otro").exists()


def test_generic_patch_cannot_activate_or_deactivate_a_user() -> None:
    administrator = user_with_role("administrador", Role.ADMINISTRADOR)
    seller = user_with_role("vendedor", Role.VENDEDOR)

    response = authenticated_client(administrator).patch(
        f"/api/v1/users/{seller.pk}/",
        {"is_active": False},
        format="json",
    )

    seller.refresh_from_db()
    assert response.status_code == 400
    assert seller.is_active is True
    assert AuditEvent.objects.filter(
        action="identity.user_update_rejected",
        actor=administrator,
        target_id=str(seller.pk),
        result=AuditResult.FAILURE,
        reason="explicit_state_action_required",
    ).exists()


def test_administrator_uses_explicit_deactivate_and_activate_actions() -> None:
    administrator = user_with_role("administrador", Role.ADMINISTRADOR)
    seller = user_with_role("vendedor", Role.VENDEDOR)
    client = authenticated_client(administrator)

    deactivated = client.post(f"/api/v1/users/{seller.pk}/deactivate/", format="json")
    activated = client.post(f"/api/v1/users/{seller.pk}/activate/", format="json")

    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False
    assert activated.status_code == 200
    assert activated.json()["is_active"] is True


def test_api_rejects_deactivating_the_last_active_administrator() -> None:
    administrator = user_with_role("administrador", Role.ADMINISTRADOR)

    response = authenticated_client(administrator).post(
        f"/api/v1/users/{administrator.pk}/deactivate/", format="json"
    )

    assert response.status_code == 409
    assert response.json()["code"] == "last_active_administrator"


def test_password_reset_returns_the_temporary_secret_only_for_the_original_operation() -> None:
    administrator = user_with_role("administrador", Role.ADMINISTRADOR)
    seller = user_with_role("vendedor", Role.VENDEDOR)
    operation_id = uuid4()
    client = authenticated_client(administrator)

    first = client.post(
        f"/api/v1/users/{seller.pk}/reset-password/",
        {"operation_id": str(operation_id)},
        format="json",
    )
    repeated = client.post(
        f"/api/v1/users/{seller.pk}/reset-password/",
        {"operation_id": str(operation_id)},
        format="json",
    )

    assert first.status_code == 200
    assert first.json()["temporary_password"]
    assert repeated.status_code == 409
    assert "temporary_password" not in repeated.json()
    assert AuditEvent.objects.filter(
        action="identity.password_reset_rejected",
        actor=administrator,
        target_id=str(seller.pk),
        result=AuditResult.FAILURE,
        reason="operation_already_processed",
    ).exists()


def test_seller_cannot_call_administrative_user_actions() -> None:
    seller = user_with_role("vendedor", Role.VENDEDOR)
    other = user_with_role("otro", Role.VENDEDOR)
    client = authenticated_client(seller)

    deactivated = client.post(f"/api/v1/users/{other.pk}/deactivate/", format="json")
    reset = client.post(
        f"/api/v1/users/{other.pk}/reset-password/",
        {"operation_id": str(uuid4())},
        format="json",
    )

    assert deactivated.status_code == 403
    assert reset.status_code == 403
    assert (
        AuditEvent.objects.filter(
            action="authorization.permission_denied",
            actor=seller,
            result=AuditResult.DENIED,
        ).count()
        == 2
    )
