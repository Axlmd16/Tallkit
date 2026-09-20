"""Estados de sesión y permisos retirados frente a las rutas y comandos del catálogo."""

from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from catalog.application import auxiliaries
from catalog.models import CatalogCommand, ProductCategory
from identity.application.authorization import BusinessPermissionDeniedError
from identity.application.users import update_user
from identity.domain.authorization import Role
from identity.models import User, UserRole

pytestmark = pytest.mark.django_db
PASSWORD = "Clave-segura-2026"

CATALOG_READS = (
    "/api/v1/products/",
    "/api/v1/product-categories/",
    "/api/v1/measurement-units/",
    "/api/v1/product-brands/",
    "/api/v1/services/",
    "/api/v1/suppliers/",
)


def make_user(username: str, *roles: Role, must_change_password: bool = False) -> User:
    user = get_user_model().objects.create_user(
        username=username, password=PASSWORD, must_change_password=must_change_password
    )
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    return user


def login(client: Client, username: str) -> None:
    client.get("/api/v1/auth/csrf/")
    response = client.post(
        "/api/v1/auth/login/",
        {"username": username, "password": PASSWORD},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200, response.content


def statuses(client: Client) -> dict[str, int]:
    return {url: client.get(url).status_code for url in CATALOG_READS}


def test_active_administrator_reads_every_catalog() -> None:
    make_user("admin_ok", Role.ADMINISTRADOR)
    client = Client()
    login(client, "admin_ok")
    assert set(statuses(client).values()) == {200}


def test_temporary_password_cannot_use_any_catalog_route() -> None:
    make_user("temporal", Role.ADMINISTRADOR, must_change_password=True)
    client = Client()
    login(client, "temporal")
    assert set(statuses(client).values()) == {403}
    post = client.post(
        "/api/v1/product-categories/",
        {"name": "X", "idempotency_key": "temp-key-0001"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert post.status_code == 403
    assert ProductCategory.objects.count() == 0


def test_deactivated_user_loses_access_on_the_next_request() -> None:
    user = make_user("desactivado", Role.ADMINISTRADOR)
    client = Client()
    login(client, "desactivado")
    assert client.get("/api/v1/products/").status_code == 200
    User.objects.filter(pk=user.pk).update(is_active=False)
    assert set(statuses(client).values()) == {403}


def test_invalidated_session_is_denied_after_a_role_reduction() -> None:
    user = make_user("reducido", Role.ADMINISTRADOR)
    administrator = make_user("otro_admin", Role.ADMINISTRADOR)
    client = Client()
    login(client, "reducido")
    assert client.get("/api/v1/suppliers/").status_code == 200

    update_user(actor=administrator, user_id=user.pk, username=user.username, roles=[Role.VENDEDOR])

    assert set(statuses(client).values()) == {403}


def test_replay_is_denied_after_the_permission_is_withdrawn() -> None:
    actor = make_user("retirado", Role.ADMINISTRADOR)
    payload: dict[str, Any] = {"name": "Frenos", "idempotency_key": "replay-key-0001"}
    first = auxiliaries.create_auxiliary("category", actor=actor, payload=payload)
    assert first.status == 201

    UserRole.objects.filter(user=actor).delete()
    reloaded = User.objects.get(pk=actor.pk)
    with pytest.raises(BusinessPermissionDeniedError):
        auxiliaries.create_auxiliary("category", actor=reloaded, payload=payload)

    assert ProductCategory.objects.count() == 1
    assert CatalogCommand.objects.count() == 1
