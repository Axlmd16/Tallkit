from typing import Any
from unittest.mock import patch

import pytest

from catalog.application import auxiliaries, products, queries, services
from catalog.application.commands import IdempotencyConflictError
from catalog.application.errors import CatalogApplicationError
from catalog.models import CatalogCommand, Product, ProductCategory, Service
from customer_registry.models import VehicleBrand
from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import AuditEvent, AuditResult
from workshop_configuration.models import TaxDefinition, TaxPeriod

pytestmark = pytest.mark.django_db
_counter = iter(range(1, 10_000))


def key() -> str:
    return f"test-key-{next(_counter):06d}"


def make_aux(actor: Any, kind: str, **fields: Any) -> dict[str, Any]:
    out = auxiliaries.create_auxiliary(
        kind, actor=actor, payload={"name": "X", **fields, "idempotency_key": key()}
    )
    return out.body


def product_payload(cat: dict, unit: dict, tax: TaxDefinition, **kw: Any) -> dict[str, Any]:
    return {
        "code": "ace-1",
        "name": "Aceite",
        "category_id": cat["id"],
        "unit_id": unit["id"],
        "tax_definition_id": tax.pk,
        "content_quantity": "1",
        "sale_price": "10.50",
        "idempotency_key": key(),
        **kw,
    }


@pytest.fixture
def base(role_admin: Any, commercial_tax: TaxDefinition) -> dict[str, Any]:
    return {
        "cat": make_aux(role_admin, "category", name="Lubricantes"),
        "unit": make_aux(role_admin, "unit", name="Litro", symbol="L"),
        "tax": commercial_tax,
        "admin": role_admin,
    }


def new_product(base: dict[str, Any], **kw: Any) -> dict[str, Any]:
    payload = product_payload(base["cat"], base["unit"], base["tax"], **kw)
    return products.create_product(actor=base["admin"], payload=payload).body


# ---------------- auxiliares ----------------


def test_auxiliary_lifecycle_and_audit(role_admin: Any) -> None:
    created = make_aux(role_admin, "category", name="  Frenos ", description="d")
    assert created["name"] == "Frenos"
    assert created["version"] == 1
    upd = auxiliaries.update_auxiliary(
        "category",
        created["id"],
        actor=role_admin,
        payload={"expected_version": 1, "name": "Frenos y pastillas", "idempotency_key": key()},
    ).body
    assert (upd["version"], upd["description"]) == (2, "d")
    noop = auxiliaries.update_auxiliary(
        "category",
        created["id"],
        actor=role_admin,
        payload={"expected_version": 2, "name": "Frenos y pastillas", "idempotency_key": key()},
    ).body
    assert noop["version"] == 2
    off = auxiliaries.set_auxiliary_active(
        "category",
        created["id"],
        active=False,
        actor=role_admin,
        payload={"expected_version": 2, "idempotency_key": key()},
    ).body
    assert (off["is_active"], off["version"]) == (False, 3)
    actions = list(
        AuditEvent.objects.filter(target_type="product_category").values_list("action", flat=True)
    )
    assert sorted(actions) == [
        "catalog.category_created",
        "catalog.category_deactivated",
        "catalog.category_updated",
    ]  # el no-op no crea evento


def test_duplicate_name_including_inactive_and_replay(role_admin: Any) -> None:
    first = make_aux(role_admin, "brand", name="Bosch")
    auxiliaries.set_auxiliary_active(
        "brand",
        first["id"],
        active=False,
        actor=role_admin,
        payload={"expected_version": 1, "idempotency_key": key()},
    )
    with pytest.raises(CatalogApplicationError) as exc:
        make_aux(role_admin, "brand", name=" bosch ")
    assert exc.value.code == "duplicate_name"
    assert AuditEvent.objects.filter(
        action="catalog.brand_created", result=AuditResult.FAILURE, reason="duplicate_name"
    ).exists()
    k = key()
    payload = {"name": "Otra", "idempotency_key": k}
    one = auxiliaries.create_auxiliary("brand", actor=role_admin, payload=payload)
    two = auxiliaries.create_auxiliary("brand", actor=role_admin, payload=payload)
    assert two.replayed
    assert two.body == one.body
    with pytest.raises(IdempotencyConflictError):
        auxiliaries.create_auxiliary(
            "brand", actor=role_admin, payload={"name": "Distinta", "idempotency_key": k}
        )


def test_auxiliary_validation_unknown_and_stale(role_admin: Any) -> None:
    for bad, code in [
        ({"name": "  "}, "validation_error"),
        ({"name": "A", "stock": 1}, "unknown_field"),
        ({"name": "A", "parent_id": 1}, "unknown_field"),
    ]:
        with pytest.raises(CatalogApplicationError) as exc:
            auxiliaries.create_auxiliary(
                "category", actor=role_admin, payload={**bad, "idempotency_key": key()}
            )
        assert exc.value.code == code
    created = make_aux(role_admin, "unit", name="Kg")
    with pytest.raises(CatalogApplicationError) as exc:
        auxiliaries.update_auxiliary(
            "unit",
            created["id"],
            actor=role_admin,
            payload={"expected_version": 9, "name": "Kilo", "idempotency_key": key()},
        )
    assert exc.value.code == "stale_record"
    with pytest.raises(CatalogApplicationError) as exc:
        auxiliaries.update_auxiliary(
            "unit",
            9999,
            actor=role_admin,
            payload={"expected_version": 1, "name": "Kilo", "idempotency_key": key()},
        )
    assert exc.value.code == "not_found"


@pytest.mark.parametrize("fixture", ["role_manager", "role_seller"])
def test_auxiliary_writes_denied_for_non_admin(
    fixture: str, request: pytest.FixtureRequest
) -> None:
    actor = request.getfixturevalue(fixture)
    with pytest.raises(BusinessPermissionDeniedError):
        auxiliaries.create_auxiliary(
            "category", actor=actor, payload={"name": "A", "idempotency_key": key()}
        )
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 1
    assert CatalogCommand.objects.count() == 0


# ---------------- productos ----------------


def test_create_product_normalizes_and_projects_tax(base: dict[str, Any]) -> None:
    TaxPeriod.objects.create(tax_definition=base["tax"], rate="15", starts_on="2020-01-01")
    vb = VehicleBrand.objects.create(name="Toyota")
    p = new_product(base, vehicle_brand_ids=[vb.pk], is_kit=True)
    assert p["code"] == "ACE-1"
    assert p["sale_price"] == "10.50"
    assert p["content_quantity"] == "1.000000"
    assert p["is_kit"] is True
    assert p["vehicle_brands"] == [{"id": vb.pk, "name": "Toyota", "is_active": True}]
    assert p["tax"]["tax_status"] == "applicable"
    assert p["tax"]["rate"] == "15.0000"
    assert not {"stock", "cost", "supplier"} & set(p)


def test_product_references_and_tax_scope(
    base: dict[str, Any], artisanal_tax: TaxDefinition
) -> None:
    inactive = make_aux(base["admin"], "brand", name="Vieja")
    auxiliaries.set_auxiliary_active(
        "brand",
        inactive["id"],
        active=False,
        actor=base["admin"],
        payload={"expected_version": 1, "idempotency_key": key()},
    )
    cases = [
        ({"product_brand_id": inactive["id"]}, "inactive_reference"),
        ({"category_id": 99999}, "validation_error"),
        ({"tax_definition_id": artisanal_tax.pk}, "invalid_tax_scope"),
        ({"tax_definition_id": 99999}, "validation_error"),
        ({"sale_price": "1.005"}, "validation_error"),
        ({"vehicle_brand_ids": [99999]}, "validation_error"),
        ({"stock": 3}, "unknown_field"),
    ]
    for override, code in cases:
        with pytest.raises(CatalogApplicationError) as exc:
            products.create_product(
                actor=base["admin"],
                payload=product_payload(base["cat"], base["unit"], base["tax"], **override),
            )
        assert exc.value.code == code, override
    assert Product.objects.count() == 0


def test_duplicate_code_including_inactive(base: dict[str, Any]) -> None:
    p = new_product(base)
    products.set_product_active(
        p["id"],
        active=False,
        actor=base["admin"],
        payload={"expected_version": 1, "idempotency_key": key()},
    )
    with pytest.raises(CatalogApplicationError) as exc:
        new_product(base, code=" ACE-1 ", name="Otro")
    assert exc.value.code == "duplicate_code"
    assert Product.objects.count() == 1
    assert CatalogCommand.objects.filter(action="catalog.product_created").count() == 1


def test_update_product_partial_versions_and_compatibilities(base: dict[str, Any]) -> None:
    a = VehicleBrand.objects.create(name="A")
    b = VehicleBrand.objects.create(name="B")
    p = new_product(base, vehicle_brand_ids=[a.pk])
    out = products.update_product(
        p["id"],
        actor=base["admin"],
        payload={
            "expected_version": 1,
            "vehicle_brand_ids": [b.pk],
            "name": "Aceite 2",
            "idempotency_key": key(),
        },
    ).body
    assert out["version"] == 2
    assert [v["id"] for v in out["vehicle_brands"]] == [b.pk]
    cleared = products.update_product(
        p["id"],
        actor=base["admin"],
        payload={"expected_version": 2, "product_brand_id": None, "idempotency_key": key()},
    ).body
    assert cleared["version"] == 2  # no-op: nada cambió
    with pytest.raises(CatalogApplicationError) as exc:
        products.update_product(
            p["id"],
            actor=base["admin"],
            payload={"expected_version": 1, "name": "Otra", "idempotency_key": key()},
        )
    assert exc.value.code == "stale_record"


def test_price_change_requires_extra_permission(base: dict[str, Any]) -> None:
    p = new_product(base)
    payload = {"expected_version": 1, "sale_price": "12.00", "idempotency_key": key()}
    with (
        patch("catalog.application.products.has_permission", return_value=False),
        pytest.raises(BusinessPermissionDeniedError),
    ):
        products.update_product(p["id"], actor=base["admin"], payload=payload)
    assert queries.get_product(p["id"])["sale_price"] == "10.50"
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 1
    # sin cambio de precio no se exige el permiso adicional
    with patch("catalog.application.products.has_permission", return_value=False):
        out = products.update_product(
            p["id"],
            actor=base["admin"],
            payload={"expected_version": 1, "name": "Nuevo", "idempotency_key": key()},
        ).body
    assert out["name"] == "Nuevo"


def test_category_with_active_products_cannot_be_deactivated(base: dict[str, Any]) -> None:
    p = new_product(base)
    args = {"active": False, "actor": base["admin"]}
    with pytest.raises(CatalogApplicationError) as exc:
        auxiliaries.set_auxiliary_active(
            "category",
            base["cat"]["id"],
            payload={"expected_version": 1, "idempotency_key": key()},
            **args,
        )
    assert exc.value.code == "category_has_active_products"
    assert ProductCategory.objects.get(pk=base["cat"]["id"]).is_active
    products.set_product_active(
        p["id"],
        active=False,
        actor=base["admin"],
        payload={"expected_version": 1, "idempotency_key": key()},
    )
    off = auxiliaries.set_auxiliary_active(
        "category",
        base["cat"]["id"],
        payload={"expected_version": 1, "idempotency_key": key()},
        **args,
    ).body
    assert off["is_active"] is False
    # reactivar el producto exige categoría activa; nada en cascada
    with pytest.raises(CatalogApplicationError) as exc:
        products.set_product_active(
            p["id"],
            active=True,
            actor=base["admin"],
            payload={"expected_version": 2, "idempotency_key": key()},
        )
    assert exc.value.code == "inactive_reference"
    assert queries.get_product(p["id"])["category"]["is_active"] is False


def test_inactive_unit_kept_when_editing_other_fields_but_not_selectable(
    base: dict[str, Any],
) -> None:
    p = new_product(base)
    auxiliaries.set_auxiliary_active(
        "unit",
        base["unit"]["id"],
        active=False,
        actor=base["admin"],
        payload={"expected_version": 1, "idempotency_key": key()},
    )
    out = products.update_product(
        p["id"],
        actor=base["admin"],
        payload={"expected_version": 1, "name": "Renombrado", "idempotency_key": key()},
    ).body
    assert out["unit"]["is_active"] is False
    assert out["is_active"] is True  # la baja de una unidad no desactiva productos
    other = make_aux(base["admin"], "unit", name="Galón")
    auxiliaries.set_auxiliary_active(
        "unit",
        other["id"],
        active=False,
        actor=base["admin"],
        payload={"expected_version": 1, "idempotency_key": key()},
    )
    with pytest.raises(CatalogApplicationError) as exc:
        products.update_product(
            p["id"],
            actor=base["admin"],
            payload={"expected_version": 2, "unit_id": other["id"], "idempotency_key": key()},
        )
    assert exc.value.code == "inactive_reference"


def test_failed_audit_rolls_back_receipt_and_product(base: dict[str, Any]) -> None:
    payload = product_payload(base["cat"], base["unit"], base["tax"])
    with (
        patch("catalog.application.commands.record_audit_event", side_effect=RuntimeError("audit")),
        pytest.raises(RuntimeError),
    ):
        products.create_product(actor=base["admin"], payload=payload)
    assert Product.objects.count() == 0
    assert not CatalogCommand.objects.filter(action="catalog.product_created").exists()
    assert products.create_product(actor=base["admin"], payload=payload).status == 201


def test_product_queries_filters_and_pagination(base: dict[str, Any]) -> None:
    a = VehicleBrand.objects.create(name="A")
    b = VehicleBrand.objects.create(name="B")
    both = new_product(base, code="P1", name="Zeta", vehicle_brand_ids=[a.pk, b.pk])
    new_product(base, code="P2", name="alfa", vehicle_brand_ids=[a.pk])
    off = new_product(base, code="P3", name="Inactivo")
    products.set_product_active(
        off["id"],
        active=False,
        actor=base["admin"],
        payload={"expected_version": 1, "idempotency_key": key()},
    )
    page = queries.list_products({})
    assert [r["code"] for r in page.results] == ["P2", "P1"]  # activos, por nombre normalizado
    assert queries.list_products({"is_active": "all"}).count == 3
    assert queries.list_products({"is_active": "false"}).results[0]["code"] == "P3"
    assert queries.list_products({"search": "p1"}).count == 1
    assert queries.list_products({"search": "alf"}).count == 1
    assert queries.list_products({"vehicle_brand_id": str(a.pk)}).count == 2  # sin duplicados
    assert queries.list_products({"vehicle_brand_id": str(b.pk)}).results[0]["id"] == both["id"]
    assert queries.list_products({"page_size": "1", "page": "2"}).results[0]["code"] == "P1"
    empty = queries.list_products({"page": "9"})
    assert (empty.results, empty.page, empty.count) == ([], 9, 2)
    assert queries.list_products({"search": "zzz"}).total_pages == 0
    for bad in [{"page": "0"}, {"page_size": "101"}, {"is_active": "maybe"}, {"page": "x"}]:
        with pytest.raises(CatalogApplicationError):
            queries.list_products(bad)


# ---------------- servicios ----------------


def test_service_lifecycle_same_name_and_no_stock(
    role_admin: Any, role_manager: Any, artisanal_tax: TaxDefinition
) -> None:
    payload = {"name": "Alineación", "reference_price": "20", "tax_definition_id": artisanal_tax.pk}
    a = services.create_service(
        actor=role_manager, payload={**payload, "idempotency_key": key()}
    ).body
    b = services.create_service(
        actor=role_admin, payload={**payload, "idempotency_key": key()}
    ).body
    assert a["id"] != b["id"]
    assert a["reference_price"] == "20.00"
    upd = services.update_service(
        a["id"],
        actor=role_manager,
        payload={"expected_version": 1, "reference_price": "25.50", "idempotency_key": key()},
    ).body
    assert upd["reference_price"] == "25.50"
    off = services.set_service_active(
        a["id"],
        active=False,
        actor=role_manager,
        payload={"expected_version": 2, "idempotency_key": key()},
    ).body
    assert off["is_active"] is False
    assert queries.list_services({}).count == 1
    assert queries.list_services({"is_active": "all", "search": "alin"}).count == 2
    assert Service.objects.count() == 2


def test_service_scope_and_permissions(
    role_seller: Any, role_admin: Any, commercial_tax: TaxDefinition
) -> None:
    payload = {
        "name": "S",
        "reference_price": "1",
        "tax_definition_id": commercial_tax.pk,
        "idempotency_key": key(),
    }
    with pytest.raises(BusinessPermissionDeniedError):
        services.create_service(actor=role_seller, payload=payload)
    with pytest.raises(CatalogApplicationError) as exc:
        services.create_service(actor=role_admin, payload=payload)
    assert exc.value.code == "invalid_tax_scope"
    with pytest.raises(CatalogApplicationError):
        services.create_service(actor=role_admin, payload={**payload, "cost": 3})
