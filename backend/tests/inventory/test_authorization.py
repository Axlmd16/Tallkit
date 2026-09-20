"""Autorización, proyecciones y ausencia de filtraciones económicas en inventario."""

from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from identity.domain.authorization import Role
from identity.models import UserRole
from inventory.models import InventoryOperation

pytestmark = pytest.mark.django_db
BASE = "/api/v1/inventory/"
D = Decimal
FORBIDDEN_KEYS = {
    "unit_cost",
    "average_cost",
    "average_after",
    "inventory_value",
    "value_after",
    "value_before",
    "value_delta",
    "value_in",
    "value_out",
    "entry_value",
    "opening_value",
    "closing_value",
    "applied_unit_cost",
    "rounding_adjustment",
    "supplier",
    "totals",
    "tax",
}


def walk(value: Any, path: str = "") -> list[str]:
    """Rutas de todas las claves prohibidas, recorriendo listas y objetos anidados."""
    found: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            if key in FORBIDDEN_KEYS:
                found.append(f"{path}.{key}")
            found += walk(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            found += walk(child, f"{path}[{index}]")
    return found


def client_for(*roles: Role) -> APIClient:
    user = get_user_model().objects.create_user(
        username="c-" + "-".join(roles) if roles else "c-none", password="x" * 14
    )
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def world(admin: Any, product: Any, warehouse: Any, commercial_world: Any) -> dict[str, Any]:
    return dict(commercial_world)


@pytest.fixture
def commercial_world(admin: Any, product: Any, warehouse: Any) -> dict[str, Any]:
    """Un ingreso confirmado por el flujo real de compras y una carga inicial de otro producto."""
    from datetime import date

    from purchasing.application import purchases
    from supplier_registry.models import Supplier
    from workshop_configuration.models import (
        DocumentSeries,
        FiscalEntity,
        NumberingScope,
        TaxDefinition,
        TaxPeriod,
    )

    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    tax = TaxDefinition.objects.get(fiscal_entity=entity, code="IVA")
    TaxPeriod.objects.create(tax_definition=tax, rate=D("10"), starts_on=date(2025, 1, 1))
    scope = NumberingScope.objects.create(fiscal_entity=entity, document_type="INGRESO")
    DocumentSeries.objects.create(numbering_scope=scope, code="COM-ING", is_active=True)
    supplier = Supplier.objects.create(name="Proveedor Secreto SA")
    draft = purchases.create_draft(
        actor=admin,
        payload={
            "idempotency_key": "world-key-0001",
            "supplier_id": supplier.pk,
            "document_type": "FACTURA",
            "supplier_reference": "SECRETO-1",
            "document_date": "2026-01-15",
            "lines": [
                {
                    "product_id": product.pk,
                    "quantity": "4",
                    "unit_cost": "7.00",
                    "tax_definition_id": tax.pk,
                    "tax_recoverability": "NON_RECOVERABLE",
                }
            ],
        },
    ).body
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    purchase = purchases.confirm_purchase(
        actor=admin,
        purchase_id=draft["id"],
        payload={
            "idempotency_key": "world-key-0002",
            "expected_version": 1,
            "review_token": review["review_token"],
        },
    ).body
    return {
        "purchase": purchase,
        "operation_id": purchase["inventory_operation_id"],
        "product": product,
    }


READS = ("", "products/{p}/", "products/{p}/kardex/", "operations/{o}/")


def urls(world: dict[str, Any]) -> list[str]:
    return [
        BASE + suffix.format(p=world["product"].pk, o=world["operation_id"]) for suffix in READS
    ]


def test_every_role_reads_operative_data_but_only_the_administrator_sees_valuation(
    world: dict[str, Any],
) -> None:
    operative_roles = (
        (Role.VENDEDOR,),
        (Role.ENCARGADO_TALLER,),
        (Role.VENDEDOR, Role.ENCARGADO_TALLER),
    )
    for roles in operative_roles:
        client = client_for(*roles)
        for url in urls(world):
            response = client.get(url)
            assert response.status_code == 200, url
            assert walk(response.json()) == [], (url, walk(response.json()))
    admin_client = client_for(Role.ADMINISTRADOR)
    economic = admin_client.get(urls(world)[2]).json()
    assert walk(economic), "el administrador sí recibe la valoración"


def test_responses_never_leak_purchase_amounts_or_supplier_data_to_operative_roles(
    world: dict[str, Any],
) -> None:
    client = client_for(Role.ENCARGADO_TALLER)
    texts = [client.get(url).content.decode() for url in urls(world)]
    for text in texts:
        for secret in ("Proveedor Secreto", "SECRETO-1", "7.00", "28.00", "30.80"):
            assert secret not in text


def test_error_messages_and_denied_writes_do_not_reveal_economics(world: dict[str, Any]) -> None:
    client = client_for(Role.ENCARGADO_TALLER)
    responses = [
        client.get(BASE + "products/999999/"),
        client.get(BASE + "products/999999/kardex/"),
        client.get(BASE + "operations/999999/"),
        client.post(BASE + "operations/", {"unit_cost": "9.99"}, format="json"),
        client.post(f"/api/v1/purchases/{world['purchase']['id']}/void/", {}, format="json"),
    ]
    for response in responses:
        assert response.status_code in {403, 404}
        body = response.content.decode()
        for word in ("unit_cost", "9.99", "Proveedor Secreto", "average_cost"):
            assert word not in body


def test_inventory_view_permission_does_not_grant_purchase_access_or_origin_links(
    world: dict[str, Any],
) -> None:
    operative = client_for(Role.ENCARGADO_TALLER)
    detail = operative.get(BASE + f"operations/{world['operation_id']}/").json()
    assert detail["origin"]["type"] == "PURCHASE"
    assert detail["origin"]["reference"].startswith("INV-")
    assert "origin_url" not in detail
    assert "reason" not in detail
    assert operative.get(f"/api/v1/purchases/{world['purchase']['id']}/").status_code == 403
    admin = client_for(Role.ADMINISTRADOR)
    allowed = admin.get(BASE + f"operations/{world['operation_id']}/").json()
    assert allowed["origin"]["origin_url"] == f"/purchases/{world['purchase']['id']}"


def test_no_query_parameter_raises_the_projection(world: dict[str, Any]) -> None:
    operative = client_for(Role.VENDEDOR)
    for url in urls(world):
        for param in ("include_valuation=true", "role=admin", "expand=economic"):
            assert operative.get(f"{url}?{param}").status_code == 400
    assert not InventoryOperation.objects.filter(state="PREPARED").exists()


def test_replay_is_denied_after_the_permission_is_withdrawn(
    admin: Any, product: Any, warehouse: Any
) -> None:
    from identity.application.authorization import BusinessPermissionDeniedError
    from identity.models import User
    from inventory.application import operations
    from inventory.models import InventoryCommand

    payload = {
        "idempotency_key": "replay-key-0002",
        "kind": "INITIAL_LOAD",
        "product_id": product.pk,
        "quantity": "3",
        "unit_cost": "1.00",
    }
    assert operations.create_operation(actor=admin, payload=payload).status == 201
    UserRole.objects.filter(user=admin).delete()
    with pytest.raises(BusinessPermissionDeniedError):
        operations.create_operation(actor=User.objects.get(pk=admin.pk), payload=payload)
    assert InventoryCommand.objects.count() == 1
    assert InventoryOperation.objects.count() == 1


def test_sessions_lose_manual_operations_when_the_role_is_reduced(
    admin: Any, product: Any, warehouse: Any
) -> None:
    from identity.application.users import update_user

    multi = get_user_model().objects.create_user(username="multi-inv", password="Clave-segura-2026")
    UserRole.objects.create(user=multi, role=Role.ADMINISTRADOR)
    UserRole.objects.create(user=multi, role=Role.VENDEDOR)
    from django.test import Client

    client = Client()
    client.get("/api/v1/auth/csrf/")
    client.post(
        "/api/v1/auth/login/",
        {"username": "multi-inv", "password": "Clave-segura-2026"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert client.get(BASE + "operations/").status_code == 200
    update_user(actor=admin, user_id=multi.pk, username="multi-inv", roles=[Role.VENDEDOR])
    assert client.get(BASE + "operations/").status_code == 403
