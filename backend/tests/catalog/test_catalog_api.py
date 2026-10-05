from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework.test import APIClient

from catalog.models import (
    MeasurementUnit,
    Product,
    ProductBrand,
    ProductCategory,
    Service,
)
from identity.models import AuditEvent, UserRole
from supplier_registry.models import Supplier
from workshop_configuration.models import TaxDefinition

pytestmark = pytest.mark.django_db
ALL3 = {"admin", "manager", "seller"}
ADMIN = {"admin"}
ADMIN_MANAGER = {"admin", "manager"}


def client_for(*roles: str) -> APIClient:
    user = get_user_model().objects.create_user(
        username="u_" + "_".join(roles or ["none"]), password="pw"
    )
    for r in roles:
        UserRole.objects.create(user=user, role=r)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


ROLE_NAMES = {"admin": "ADMINISTRADOR", "manager": "ENCARGADO_TALLER", "seller": "VENDEDOR"}


@pytest.fixture
def objs(commercial_tax: TaxDefinition, artisanal_tax: TaxDefinition) -> dict[str, int]:
    cat = ProductCategory.objects.create(name="C")
    unit = MeasurementUnit.objects.create(name="U")
    brand = ProductBrand.objects.create(name="B")
    product = Product.objects.create(
        code="P",
        name="P",
        category=cat,
        unit=unit,
        content_quantity=1,
        sale_price=1,
        tax_definition=commercial_tax,
    )
    service = Service.objects.create(
        code="SRV-900001", name="S", reference_price=1, tax_definition=artisanal_tax
    )
    supplier = Supplier.objects.create(name="Sup")
    return {
        "product-categories": cat.pk,
        "measurement-units": unit.pk,
        "product-brands": brand.pk,
        "products": product.pk,
        "services": service.pk,
        "suppliers": supplier.pk,
    }


def routes(objs: dict[str, int]) -> list[tuple[str, str, set[str]]]:
    out: list[tuple[str, str, set[str]]] = []
    for base in ("products", "product-categories", "measurement-units", "product-brands"):
        pk = objs[base]
        out += [
            ("get", f"/api/v1/{base}/", ALL3),
            ("post", f"/api/v1/{base}/", ADMIN),
            ("get", f"/api/v1/{base}/{pk}/", ALL3),
            ("patch", f"/api/v1/{base}/{pk}/", ADMIN),
            ("post", f"/api/v1/{base}/{pk}/activate/", ADMIN),
            ("post", f"/api/v1/{base}/{pk}/deactivate/", ADMIN),
        ]
    pk = objs["services"]
    out += [
        ("get", "/api/v1/services/", ALL3),
        ("post", "/api/v1/services/", ADMIN_MANAGER),
        ("get", f"/api/v1/services/{pk}/", ALL3),
        ("patch", f"/api/v1/services/{pk}/", ADMIN_MANAGER),
        ("post", f"/api/v1/services/{pk}/activate/", ADMIN_MANAGER),
        ("post", f"/api/v1/services/{pk}/deactivate/", ADMIN_MANAGER),
        ("get", "/api/v1/products/tax-options/", ADMIN),
        ("get", "/api/v1/services/tax-options/", ADMIN_MANAGER),
    ]
    pk = objs["suppliers"]
    out += [
        ("get", "/api/v1/suppliers/", ADMIN),
        ("post", "/api/v1/suppliers/", ADMIN),
        ("post", "/api/v1/suppliers/matches/", ADMIN),
        ("get", f"/api/v1/suppliers/{pk}/", ADMIN),
        ("patch", f"/api/v1/suppliers/{pk}/", ADMIN),
        ("post", f"/api/v1/suppliers/{pk}/activate/", ADMIN),
        ("post", f"/api/v1/suppliers/{pk}/deactivate/", ADMIN),
    ]
    return out


def call(client: APIClient, method: str, url: str) -> int:
    kwargs: dict[str, Any] = {} if method == "get" else {"data": {}, "format": "json"}
    return int(getattr(client, method)(url, **kwargs).status_code)


def test_permission_matrix_all_roles_and_unions(objs: dict[str, int]) -> None:
    combos: list[tuple[str, ...]] = [
        ("admin",),
        ("manager",),
        ("seller",),
        ("manager", "seller"),
        (),
    ]
    for combo in combos:
        client = client_for(*[ROLE_NAMES[r] for r in combo])
        for method, url, allowed in routes(objs):
            expected_ok = bool(allowed & set(combo))
            status = call(client, method, url)
            assert (status != 403) == expected_ok, (combo, method, url, status)
            get_user_model().objects.filter(username__startswith="u_").delete()
            client = client_for(*[ROLE_NAMES[r] for r in combo])


def test_anonymous_and_forbidden_methods(objs: dict[str, int]) -> None:
    anon = APIClient()
    for method, url, _ in routes(objs):
        assert call(anon, method, url) == 403, (method, url)
    admin = client_for("ADMINISTRADOR")
    for base, pk in objs.items():
        assert admin.delete(f"/api/v1/{base}/{pk}/").status_code == 405
        assert admin.put(f"/api/v1/{base}/{pk}/", {}, format="json").status_code == 405


def test_denied_write_audited_once_and_reads_not_audited(objs: dict[str, int]) -> None:
    seller = client_for("VENDEDOR")
    call(seller, "post", "/api/v1/products/")
    call(seller, "get", "/api/v1/products/")
    assert AuditEvent.objects.filter(result="DENIED").count() == 1


def test_csrf_required_for_session_writes() -> None:
    user = get_user_model().objects.create_user(username="csrf_admin", password="ValidPassword123!")
    UserRole.objects.create(user=user, role="ADMINISTRADOR")
    client = Client(enforce_csrf_checks=True)
    client.get("/api/v1/auth/csrf/")
    token = client.cookies["csrftoken"].value
    login = client.post(
        "/api/v1/auth/login/",
        {"username": "csrf_admin", "password": "ValidPassword123!"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert login.status_code == 200
    token = client.cookies["csrftoken"].value
    post: dict[str, Any] = {"content_type": "application/json"}
    assert client.post("/api/v1/suppliers/matches/", {"name": "x"}, **post).status_code == 403
    assert client.post("/api/v1/suppliers/", {"name": "x"}, **post).status_code == 403
    assert client.get("/api/v1/suppliers/").status_code == 200
    ok = client.post("/api/v1/suppliers/matches/", {"name": "x"}, HTTP_X_CSRFTOKEN=token, **post)
    assert ok.status_code == 200


def test_crud_flow_replay_errors_and_contract(
    objs: dict[str, int], commercial_tax: TaxDefinition
) -> None:
    admin = client_for("ADMINISTRADOR")
    body = {
        "code": "abc",
        "name": "Aceite",
        "category_id": objs["product-categories"],
        "unit_id": objs["measurement-units"],
        "tax_definition_id": commercial_tax.pk,
        "content_quantity": "1.5",
        "sale_price": "10.50",
        "idempotency_key": "api-key-0001",
    }
    created = admin.post("/api/v1/products/", body, format="json")
    assert created.status_code == 201
    assert created.data["sale_price"] == "10.50"
    assert created.data["code"] == "ABC"
    replay = admin.post("/api/v1/products/", body, format="json")
    assert (replay.status_code, replay.data["id"]) == (201, created.data["id"])
    assert Product.objects.count() == 2
    conflict = admin.post("/api/v1/products/", {**body, "name": "Otro"}, format="json")
    assert conflict.status_code == 409
    assert conflict["Content-Type"] == "application/problem+json"
    assert conflict.data["code"] == "idempotency_conflict"
    dup = admin.post(
        "/api/v1/products/", {**body, "idempotency_key": "api-key-0002"}, format="json"
    )
    assert (dup.status_code, dup.data["code"]) == (409, "duplicate_code")
    assert dup.data["errors"]["code"]
    assert "id" not in str(dup.data.get("conflict", ""))  # no filtra datos del duplicado
    bad_cases: list[tuple[dict[str, Any], str]] = [
        ({"sale_price": 10.5}, "validation_error"),
        ({"sale_price": "1.001"}, "validation_error"),
        ({"stock": 3}, "unknown_field"),
        ({"cost": "1.00"}, "unknown_field"),
    ]
    for bad, code in bad_cases:
        r = admin.post(
            "/api/v1/products/",
            {**body, "code": "z", "idempotency_key": "api-key-0003", **bad},
            format="json",
        )
        assert (r.status_code, r.data["code"]) == (400, code), bad
        assert r.data["request_id"] is None or isinstance(r.data["request_id"], str)
    stale = admin.patch(
        f"/api/v1/products/{created.data['id']}/",
        {"expected_version": 5, "name": "x", "idempotency_key": "api-key-0004"},
        format="json",
    )
    assert (stale.status_code, stale.data["code"]) == (409, "stale_record")
    assert admin.get("/api/v1/products/99999/").status_code == 404
    assert admin.get("/api/v1/products/?page=0").status_code == 400
    listing = admin.get("/api/v1/products/?page_size=1&search=abc")
    assert set(listing.data) == {"count", "page", "page_size", "total_pages", "results"}
    assert listing.data["count"] == 1
    assert not {"stock", "cost", "balance"} & set(listing.data["results"][0])


def test_category_deactivation_blocked_via_api(objs: dict[str, int]) -> None:
    admin = client_for("ADMINISTRADOR")
    r = admin.post(
        f"/api/v1/product-categories/{objs['product-categories']}/deactivate/",
        {"expected_version": 1, "idempotency_key": "api-key-0010"},
        format="json",
    )
    assert (r.status_code, r.data["code"]) == (409, "category_has_active_products")


def test_tax_options_endpoints_fixed_scope(
    objs: dict[str, int], commercial_tax: TaxDefinition, artisanal_tax: TaxDefinition
) -> None:
    admin = client_for("ADMINISTRADOR")
    prod = admin.get("/api/v1/products/tax-options/")
    assert [o["id"] for o in prod.data["results"]] == [commercial_tax.pk]
    assert set(prod.data["results"][0]) == {
        "id",
        "code",
        "name",
        "entity_type",
        "rate",
        "tax_status",
    }
    serv = admin.get("/api/v1/services/tax-options/?entity_type=COMERCIAL")
    assert [o["id"] for o in serv.data["results"]] == [artisanal_tax.pk]  # ámbito no manipulable


def test_service_managed_by_manager_and_supplier_matches(
    objs: dict[str, int], artisanal_tax: TaxDefinition
) -> None:
    manager = client_for("ENCARGADO_TALLER")
    r = manager.post(
        "/api/v1/services/",
        {
            "name": "Alineación",
            "reference_price": "12",
            "tax_definition_id": artisanal_tax.pk,
            "idempotency_key": "api-key-0020",
        },
        format="json",
    )
    assert r.status_code == 201
    admin = client_for("ADMINISTRADOR")
    m = admin.post("/api/v1/suppliers/matches/", {"name": " sup "}, format="json")
    assert m.status_code == 200
    assert m.data == {
        "results": [{"id": objs["suppliers"], "name": "Sup", "is_active": True}],
        "has_more": False,
    }
    minimal = admin.post(
        "/api/v1/suppliers/",
        {"name": "Sin datos", "idempotency_key": "api-key-0021"},
        format="json",
    )
    assert (minimal.status_code, minimal.data["identification"]) == (201, None)


def test_non_object_body_rejected(objs: dict[str, int]) -> None:
    admin = client_for("ADMINISTRADOR")
    r = admin.post("/api/v1/suppliers/", [1, 2], format="json")
    assert (r.status_code, r.data["code"]) == (400, "validation_error")


def _long_code_product(objs: dict[str, int], tax: TaxDefinition, code: str, **extra: Any) -> None:
    Product.objects.create(
        code=code,
        name=f"Producto {code[:6]}",
        category=ProductCategory.objects.get(pk=objs["product-categories"]),
        unit=MeasurementUnit.objects.get(pk=objs["measurement-units"]),
        content_quantity=1,
        sale_price=1,
        tax_definition=tax,
        **extra,
    )


def test_code_over_limit_filter_lists_only_the_long_codes_with_their_length(
    objs: dict[str, int], commercial_tax: TaxDefinition
) -> None:
    _long_code_product(objs, commercial_tax, "A" * 26)
    _long_code_product(objs, commercial_tax, "B" * 40)
    _long_code_product(objs, commercial_tax, "C" * 30, is_active=False)
    _long_code_product(objs, commercial_tax, "D" * 25)
    admin = client_for("ADMINISTRADOR")
    response = admin.get("/api/v1/products/?code_over_limit=true&is_active=all")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 3
    assert {row["code"]: row["code_length"] for row in body["results"]} == {
        "A" * 26: 26,
        "B" * 40: 40,
        "C" * 30: 30,
    }
    active_only = admin.get("/api/v1/products/?code_over_limit=true").json()
    assert active_only["count"] == 2
    assert "code_length" not in admin.get("/api/v1/products/").json()["results"][0]


def test_code_over_limit_filter_without_matches_is_an_empty_page(objs: dict[str, int]) -> None:
    response = client_for("ADMINISTRADOR").get("/api/v1/products/?code_over_limit=true")
    assert response.status_code == 200
    assert response.json()["results"] == []
    assert response.json()["count"] == 0


@pytest.mark.parametrize("role", ["VENDEDOR", "ENCARGADO_TALLER"])
def test_code_over_limit_filter_requires_the_product_edit_permission(
    objs: dict[str, int], commercial_tax: TaxDefinition, role: str
) -> None:
    _long_code_product(objs, commercial_tax, "A" * 26)
    client = client_for(role)
    denied = client.get("/api/v1/products/?code_over_limit=true")
    assert denied.status_code == 403
    assert "A" * 26 not in denied.content.decode()
    assert client.get("/api/v1/products/").status_code == 200


def test_code_over_limit_only_accepts_true_and_is_not_a_label_filter(
    objs: dict[str, int],
) -> None:
    admin = client_for("ADMINISTRADOR")
    invalid = admin.get("/api/v1/products/?code_over_limit=false")
    assert invalid.status_code == 400
    assert "code_over_limit" in invalid.json()["errors"]
    labels = admin.get("/api/v1/products/label-data/?code_over_limit=true")
    assert labels.status_code == 400


def test_service_code_is_assigned_exposed_and_never_accepted_from_the_client(
    objs: dict[str, int], artisanal_tax: TaxDefinition
) -> None:
    manager = client_for("ENCARGADO_TALLER")
    body = {
        "name": "Alineación",
        "reference_price": "12",
        "tax_definition_id": artisanal_tax.pk,
    }
    created = manager.post(
        "/api/v1/services/", {**body, "idempotency_key": "api-key-0030"}, format="json"
    )
    assert created.status_code == 201
    code = created.json()["code"]
    assert code.startswith("SRV-")
    assert len(code) <= 25
    detail = manager.get(f"/api/v1/services/{created.json()['id']}/").json()
    assert detail["code"] == code
    assert [row["code"] for row in manager.get("/api/v1/services/").json()["results"]].count(
        code
    ) == 1
    found = manager.get(f"/api/v1/services/?search={code.lower()}").json()
    assert [row["id"] for row in found["results"]] == [created.json()["id"]]
    rejected = manager.post(
        "/api/v1/services/",
        {**body, "code": "MI-CODIGO", "idempotency_key": "api-key-0031"},
        format="json",
    )
    assert rejected.status_code == 400
    assert "code" in rejected.json()["errors"]
    edited = manager.patch(
        f"/api/v1/services/{created.json()['id']}/",
        {"expected_version": 1, "code": "OTRO", "idempotency_key": "api-key-0032"},
        format="json",
    )
    assert edited.status_code == 400
    assert Service.objects.get(pk=created.json()["id"]).code == code
