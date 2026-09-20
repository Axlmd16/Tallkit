"""Errores uniformes (design §6) y consulta de auditoría de los eventos nuevos."""

from typing import Any

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from catalog.models import MeasurementUnit, Product, ProductBrand, ProductCategory
from identity.models import AuditEvent, UserRole
from supplier_registry.models import Supplier
from workshop_configuration.models import TaxDefinition

pytestmark = pytest.mark.django_db


def client_for(role: str) -> APIClient:
    user = get_user_model().objects.create_user(username=f"err_{role.lower()}", password="pw")
    UserRole.objects.create(user=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def world(commercial_tax: TaxDefinition, artisanal_tax: TaxDefinition) -> dict[str, Any]:
    category = ProductCategory.objects.create(name="Cat")
    unit = MeasurementUnit.objects.create(name="Unidad")
    product = Product.objects.create(
        code="EXIST",
        name="Existente",
        category=category,
        unit=unit,
        content_quantity=1,
        sale_price=1,
        tax_definition=commercial_tax,
    )
    return {
        "category": category,
        "unit": unit,
        "product": product,
        "commercial": commercial_tax,
        "artisanal": artisanal_tax,
    }


def product_body(world: dict[str, Any], key: str, **override: Any) -> dict[str, Any]:
    return {
        "code": key.upper(),
        "name": f"Producto {key}",
        "category_id": world["category"].pk,
        "unit_id": world["unit"].pk,
        "tax_definition_id": world["commercial"].pk,
        "content_quantity": "1",
        "sale_price": "1.00",
        "idempotency_key": key,
        **override,
    }


def assert_problem(response: Any, status: int, code: str, field: str | None = None) -> None:
    assert response.status_code == status, response.data
    assert response["Content-Type"] == "application/problem+json"
    assert response.data["code"] == code
    assert "request_id" in response.data
    if field is not None:  # ``errors`` solo aparece con errores por campo
        assert response.data["errors"][field]
    else:
        assert "errors" not in response.data or isinstance(response.data["errors"], dict)


def test_field_and_reference_errors_are_uniform(world: dict[str, Any]) -> None:
    admin = client_for("ADMINISTRADOR")
    post = admin.post

    assert_problem(
        post(
            "/api/v1/products/",
            product_body(world, "err-a-0001", sale_price="-1"),
            format="json",
        ),
        400,
        "validation_error",
        "sale_price",
    )
    assert_problem(
        post("/api/v1/products/", product_body(world, "err-a-0002", stock=1), format="json"),
        400,
        "unknown_field",
    )
    assert_problem(
        post(
            "/api/v1/products/",
            product_body(world, "err-a-0003", code="exist"),
            format="json",
        ),
        409,
        "duplicate_code",
        "code",
    )
    assert_problem(
        post(
            "/api/v1/product-categories/",
            {"name": " cat ", "idempotency_key": "err-a-0004"},
            format="json",
        ),
        409,
        "duplicate_name",
        "name",
    )
    Supplier.objects.create(
        name="Con documento", identification_type="CI", identification="0912345678"
    )
    assert_problem(
        post(
            "/api/v1/suppliers/",
            {
                "name": "Otro",
                "identification_type": "CI",
                "identification": "0912345678",
                "idempotency_key": "err-a-0005",
            },
            format="json",
        ),
        409,
        "duplicate_identification",
        "identification",
    )
    inactive = ProductBrand.objects.create(name="Inactiva", is_active=False)
    assert_problem(
        post(
            "/api/v1/products/",
            product_body(world, "err-a-0006", product_brand_id=inactive.pk),
            format="json",
        ),
        400,
        "inactive_reference",
        "product_brand_id",
    )
    assert_problem(
        post(
            "/api/v1/products/",
            product_body(world, "err-a-0007", tax_definition_id=world["artisanal"].pk),
            format="json",
        ),
        400,
        "invalid_tax_scope",
        "tax_definition_id",
    )
    assert_problem(
        post(
            f"/api/v1/product-categories/{world['category'].pk}/deactivate/",
            {"expected_version": 1, "idempotency_key": "err-a-0008"},
            format="json",
        ),
        409,
        "category_has_active_products",
    )
    assert_problem(
        admin.patch(
            f"/api/v1/products/{world['product'].pk}/",
            {"expected_version": 9, "name": "x", "idempotency_key": "err-a-0009"},
            format="json",
        ),
        409,
        "stale_record",
    )
    first = product_body(world, "err-a-0010")
    assert post("/api/v1/products/", first, format="json").status_code == 201
    assert_problem(
        post("/api/v1/products/", {**first, "name": "Distinto"}, format="json"),
        409,
        "idempotency_conflict",
    )
    assert_problem(admin.get("/api/v1/products/99999/"), 404, "not_found")


def test_permission_and_method_errors_are_uniform(world: dict[str, Any]) -> None:
    seller = client_for("VENDEDOR")
    denied = seller.post("/api/v1/products/", product_body(world, "err-b-0001"), format="json")
    assert denied.status_code == 403
    assert denied["Content-Type"] == "application/problem+json"
    assert "request_id" in denied.data
    admin = client_for("ADMINISTRADOR")
    for method in ("put", "delete"):
        response = getattr(admin, method)(f"/api/v1/products/{world['product'].pk}/")
        assert response.status_code == 405
        assert response["Content-Type"] == "application/problem+json"
    # sin filtrar existencia ni duplicados a quien no puede consultar
    assert APIClient().get(
        f"/api/v1/suppliers/{Supplier.objects.create(name='S').pk}/"
    ).status_code in {401, 403}
    assert seller.get("/api/v1/suppliers/").status_code == 403


def test_new_audit_events_are_readable_only_by_administrator(world: dict[str, Any]) -> None:
    admin = client_for("ADMINISTRADOR")
    manager = client_for("ENCARGADO_TALLER")
    assert (
        admin.post(
            "/api/v1/products/", product_body(world, "err-c-0001"), format="json"
        ).status_code
        == 201
    )
    assert AuditEvent.objects.filter(action="catalog.product_created").exists()

    listed = admin.get("/api/v1/audit/", {"action": "catalog.product_created"})
    assert listed.status_code == 200
    assert listed.json()["count"] == 1
    assert listed.json()["results"][0]["action"] == "catalog.product_created"

    assert manager.get("/api/v1/audit/", {"action": "catalog.product_created"}).status_code == 403
    assert client_for("VENDEDOR").get("/api/v1/audit/").status_code == 403
