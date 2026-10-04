"""Selección mínima de proveedores para registrar una entrada: nombre y nada más."""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework.test import APIClient

from identity.models import UserRole
from supplier_registry.models import Supplier

pytestmark = pytest.mark.django_db
OPTIONS = "/api/v1/suppliers/options/"
CATALOG = "/api/v1/suppliers/"


def client_for(*roles: str) -> APIClient:
    user = get_user_model().objects.create_user(
        username="opt-" + "-".join(roles).lower(), password="x" * 14
    )
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def suppliers(db: None) -> dict[str, Supplier]:
    return {
        "active": Supplier.objects.create(
            name="Repuestos Andinos",
            identification_type="RUC",
            identification="1790012345001",
            phone="099 111 2222",
            email="ventas@andinos.example",
            address="Av. Secreta 123",
        ),
        "other": Supplier.objects.create(name="Lubricantes del Sur"),
        "inactive": Supplier.objects.create(name="Proveedor Cerrado", is_active=False),
    }


def test_the_seller_receives_only_id_and_name_of_active_suppliers(
    suppliers: dict[str, Supplier],
) -> None:
    response = client_for("VENDEDOR").get(OPTIONS)
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 2
    assert body["results"] == [
        {"id": suppliers["other"].pk, "name": "Lubricantes del Sur"},
        {"id": suppliers["active"].pk, "name": "Repuestos Andinos"},
    ]
    text = response.content.decode()
    for private in ("1790012345001", "099 111 2222", "andinos.example", "Secreta", "Cerrado"):
        assert private not in text


def test_the_administrator_may_use_the_same_selection(suppliers: dict[str, Supplier]) -> None:
    assert client_for("ADMINISTRADOR").get(OPTIONS).json()["count"] == 2


def test_the_search_matches_names_and_never_identifications(
    suppliers: dict[str, Supplier],
) -> None:
    client = client_for("VENDEDOR")
    assert [r["name"] for r in client.get(f"{OPTIONS}?search=andin").json()["results"]] == [
        "Repuestos Andinos"
    ]
    assert client.get(f"{OPTIONS}?search=1790012345001").json()["count"] == 0
    assert client.get(f"{OPTIONS}?search=zzz").json()["results"] == []


def test_the_selection_is_paginated(suppliers: dict[str, Supplier]) -> None:
    client = client_for("VENDEDOR")
    page = client.get(f"{OPTIONS}?page=2&page_size=1").json()
    assert (page["count"], page["page"], page["total_pages"]) == (2, 2, 2)
    assert [r["name"] for r in page["results"]] == ["Repuestos Andinos"]
    for bad in ("page=0", "page_size=101", "page_size=0", "page=x"):
        assert client.get(f"{OPTIONS}?{bad}").status_code == 400


def test_the_workshop_manager_and_anonymous_users_are_denied(
    suppliers: dict[str, Supplier],
) -> None:
    denied = client_for("ENCARGADO_TALLER").get(OPTIONS)
    assert denied.status_code == 403
    assert "Repuestos" not in denied.content.decode()
    assert Client().get(OPTIONS).status_code in {401, 403}


def test_the_seller_still_cannot_use_the_supplier_catalog(suppliers: dict[str, Supplier]) -> None:
    client = client_for("VENDEDOR")
    assert client.get(CATALOG).status_code == 403
    assert client.get(f"{CATALOG}{suppliers['active'].pk}/").status_code == 403
    assert client.post(f"{CATALOG}matches/", {"name": "Andinos"}, format="json").status_code == 403
    assert client.post(CATALOG, {"name": "Nuevo"}, format="json").status_code == 403
    assert (
        client.patch(
            f"{CATALOG}{suppliers['active'].pk}/", {"name": "X"}, format="json"
        ).status_code
        == 403
    )


def test_the_selection_is_read_only(suppliers: dict[str, Supplier]) -> None:
    client = client_for("VENDEDOR")
    assert client.post(OPTIONS, {"name": "X"}, format="json").status_code == 405
    assert Supplier.objects.count() == 3
