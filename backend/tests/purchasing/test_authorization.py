"""Autorización de entradas: cada ruta con los tres roles y sus combinaciones."""

from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework.test import APIClient

from identity.application.authorization import BusinessPermissionDeniedError
from identity.application.users import update_user
from identity.domain.authorization import Role
from identity.models import User, UserRole
from purchasing.application import entries
from purchasing.models import PurchaseCommand

pytestmark = pytest.mark.django_db
BASE = "/api/v1/purchases/"
PASSWORD = "Clave-segura-2026"


def user_with(username: str, *roles: Role) -> User:
    user = get_user_model().objects.create_user(username=username, password=PASSWORD)
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    return user


def client_for(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def routes(purchase_id: int) -> list[tuple[str, str]]:
    return [
        ("get", BASE),
        ("post", f"{BASE}entries/"),
        ("post", f"{BASE}entries/review/"),
        ("get", f"{BASE}{purchase_id}/"),
        ("post", f"{BASE}{purchase_id}/void-preview/"),
        ("post", f"{BASE}{purchase_id}/void/"),
    ]


# none: ninguna ruta; entries: todas salvo la anulación; all: todas.
ROLE_SETS = [
    ((Role.VENDEDOR,), "entries"),
    ((Role.ENCARGADO_TALLER,), "none"),
    ((Role.VENDEDOR, Role.ENCARGADO_TALLER), "entries"),
    ((Role.ADMINISTRADOR,), "all"),
    ((Role.ADMINISTRADOR, Role.VENDEDOR), "all"),
    ((Role.ADMINISTRADOR, Role.VENDEDOR, Role.ENCARGADO_TALLER), "all"),
]
VOID_ROUTES = ("void-preview/", "void/")


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Any) -> None:
    """Contexto comercial, bodega y serie COM-ING."""


def register(actor: Any, product: Any, key: str = "entry-key-800001") -> dict[str, Any]:
    payload = {"idempotency_key": key, "lines": [{"product_id": product.pk, "quantity": "2"}]}
    return dict(entries.register_entry(actor=actor, payload=payload).body)


@pytest.mark.parametrize(("roles", "reach"), ROLE_SETS)
def test_routes_follow_the_entry_permissions_of_each_role_combination(
    roles: tuple[Role, ...], reach: str, admin: Any, product: Any
) -> None:
    purchase = register(admin, product)
    client = client_for(user_with("combo-" + "-".join(roles), *roles))
    for method, url in routes(purchase["id"]):
        status = getattr(client, method)(url, {}, format="json").status_code
        allowed = reach == "all" or (reach == "entries" and not url.endswith(VOID_ROUTES))
        if allowed:
            assert status != 403, (method, url)
        else:
            assert status == 403, (method, url)


def test_removing_the_administrator_role_invalidates_the_session(admin: Any) -> None:
    multi = user_with("multi", Role.ADMINISTRADOR, Role.ENCARGADO_TALLER)
    client = Client()
    client.get("/api/v1/auth/csrf/")
    login = client.post(
        "/api/v1/auth/login/",
        {"username": "multi", "password": PASSWORD},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert login.status_code == 200
    assert client.get(BASE).status_code == 200
    update_user(actor=admin, user_id=multi.pk, username="multi", roles=[Role.ENCARGADO_TALLER])
    assert client.get(BASE).status_code == 403  # debe autenticarse de nuevo
    relogin = Client()
    relogin.get("/api/v1/auth/csrf/")
    relogin.post(
        "/api/v1/auth/login/",
        {"username": "multi", "password": PASSWORD},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=relogin.cookies["csrftoken"].value,
    )
    assert relogin.get(BASE).status_code == 403  # solo aplican los permisos vigentes


def test_removing_the_seller_role_invalidates_the_session_and_the_entry_permissions() -> None:
    seller = user_with("vend-multi", Role.VENDEDOR, Role.ENCARGADO_TALLER)
    admin = user_with("admin-x", Role.ADMINISTRADOR)
    client = Client()
    client.get("/api/v1/auth/csrf/")
    client.post(
        "/api/v1/auth/login/",
        {"username": "vend-multi", "password": PASSWORD},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert client.get(BASE).status_code == 200
    update_user(
        actor=admin, user_id=seller.pk, username="vend-multi", roles=[Role.ENCARGADO_TALLER]
    )
    assert client.get(BASE).status_code == 403


def test_authorization_is_checked_before_any_idempotent_replay(admin: Any, product: Any) -> None:
    payload = {
        "idempotency_key": "entry-key-800002",
        "lines": [{"product_id": product.pk, "quantity": "2"}],
    }
    assert entries.register_entry(actor=admin, payload=payload).status == 201
    UserRole.objects.filter(user=admin).delete()
    reloaded = User.objects.get(pk=admin.pk)
    with pytest.raises(BusinessPermissionDeniedError):
        entries.register_entry(actor=reloaded, payload=payload)
    assert PurchaseCommand.objects.count() == 1


def test_temporary_password_and_inactive_users_are_denied(admin: Any) -> None:
    temporary = user_with("temporal", Role.ADMINISTRADOR)
    User.objects.filter(pk=temporary.pk).update(must_change_password=True)
    assert client_for(User.objects.get(pk=temporary.pk)).get(BASE).status_code == 403
    inactive = user_with("inactivo", Role.ADMINISTRADOR)
    User.objects.filter(pk=inactive.pk).update(is_active=False)
    assert client_for(User.objects.get(pk=inactive.pk)).get(BASE).status_code in {401, 403}
