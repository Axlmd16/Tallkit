"""Carreras en PostgreSQL con conexiones independientes y barreras (sin sleeps)."""

import threading
from collections.abc import Callable
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.db import connection, connections

from catalog.application import auxiliaries, products
from catalog.application.errors import CatalogApplicationError
from catalog.models import (
    MeasurementUnit,
    Product,
    ProductBrand,
    ProductCategory,
    ProductCompatibility,
)
from customer_registry.application.brands import deactivate_brand
from customer_registry.models import VehicleBrand
from identity.models import AuditEvent, UserRole
from supplier_registry.application import suppliers
from supplier_registry.models import Supplier
from workshop_configuration.models import FiscalEntity, TaxDefinition

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def admin() -> Any:
    user = get_user_model().objects.create_user(username="conc_admin", password="pw123456789")
    UserRole.objects.create(user=user, role="ADMINISTRADOR")
    return user


def run_pair(first: Callable[[], Any], second: Callable[[], Any]) -> tuple[Any, Any]:
    """Lanza ambas tareas a la vez desde una barrera; devuelve resultado o excepción."""
    barrier = threading.Barrier(2, timeout=10)
    out: list[Any] = [None, None]

    def wrap(i: int, fn: Callable[[], Any]) -> None:
        try:
            barrier.wait()
            out[i] = fn()
        except Exception as exc:
            out[i] = exc
        finally:
            connections.close_all()

    threads = [threading.Thread(target=wrap, args=(i, f)) for i, f in enumerate((first, second))]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    connection.close()
    return out[0], out[1]


def test_same_supplier_identification_only_one_wins(admin: Any) -> None:
    def make(n: int) -> Callable[[], Any]:
        return lambda: suppliers.create_supplier(
            actor=admin,
            payload={
                "name": f"S{n}",
                "identification_type": "CI",
                "identification": "0912345678",
                "idempotency_key": f"conc-sup-{n:04d}",
            },
        )

    a, b = run_pair(make(1), make(2))
    results = [a, b]
    assert sum(not isinstance(r, Exception) for r in results) == 1
    loser = next(r for r in results if isinstance(r, Exception))
    assert getattr(loser, "code", None) == "duplicate_identification"
    assert Supplier.objects.count() == 1


def test_same_name_auxiliary_only_one_wins(admin: Any) -> None:
    def make(n: int) -> Callable[[], Any]:
        return lambda: auxiliaries.create_auxiliary(
            "category",
            actor=admin,
            payload={"name": "Frenos", "idempotency_key": f"conc-cat-{n:04d}"},
        )

    a, b = run_pair(make(1), make(2))
    assert sorted(type(r).__name__ for r in (a, b)) == ["CatalogApplicationError", "CommandOutcome"]
    assert ProductCategory.objects.count() == 1


def test_category_deactivation_races_product_creation(admin: Any) -> None:
    """Nunca queda una categoría inactiva con un producto activo, sea cual sea el orden."""
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", legal_name="C", ruc="1790000000001"
    )
    tax = TaxDefinition.objects.create(fiscal_entity=entity, code="IVA", name="IVA")
    category = ProductCategory.objects.create(name="Cat")
    unit = MeasurementUnit.objects.create(name="U")

    def deactivate() -> Any:
        return auxiliaries.set_auxiliary_active(
            "category",
            category.pk,
            active=False,
            actor=admin,
            payload={"expected_version": 1, "idempotency_key": "conc-off-0001"},
        )

    def create() -> Any:
        return products.create_product(
            actor=admin,
            payload={
                "code": "P1",
                "name": "P",
                "category_id": category.pk,
                "unit_id": unit.pk,
                "tax_definition_id": tax.pk,
                "content_quantity": "1",
                "sale_price": "1.00",
                "idempotency_key": "conc-prd-0001",
            },
        )

    off, new = run_pair(deactivate, create)
    category.refresh_from_db()
    active_products = Product.objects.filter(category=category, is_active=True).count()
    assert not (not category.is_active and active_products), (off, new)
    if isinstance(off, Exception):
        assert isinstance(off, CatalogApplicationError)
        assert off.code in {"category_has_active_products", "stale_record"}
        assert active_products == 1
    if isinstance(new, Exception):
        assert isinstance(new, CatalogApplicationError)
        assert new.code == "inactive_reference"
        assert active_products == 0
    # un evento de auditoría de éxito por operación efectiva
    ok = [r for r in (off, new) if not isinstance(r, Exception)]
    success = AuditEvent.objects.filter(
        action__in=["catalog.category_deactivated", "catalog.product_created"], result="SUCCESS"
    ).count()
    assert success == len(ok)


def _product_world(**extra: Any) -> dict[str, Any]:
    entity, _ = FiscalEntity.objects.get_or_create(
        entity_type="COMERCIAL", defaults={"legal_name": "C", "ruc": "1790000000001"}
    )
    tax = TaxDefinition.objects.create(fiscal_entity=entity, code="IVA", name="IVA")
    return {
        "tax": tax,
        "category": ProductCategory.objects.create(name="Cat"),
        "unit": MeasurementUnit.objects.create(name="U"),
        **extra,
    }


def _product_payload(world: dict[str, Any], key: str, **override: Any) -> dict[str, Any]:
    return {
        "code": key.upper(),
        "name": f"Producto {key}",
        "category_id": world["category"].pk,
        "unit_id": world["unit"].pk,
        "tax_definition_id": world["tax"].pk,
        "content_quantity": "1",
        "sale_price": "1.00",
        "idempotency_key": key,
        **override,
    }


def test_category_deactivation_races_product_reclassification(admin: Any) -> None:
    world = _product_world()
    target = world["category"]
    origin = ProductCategory.objects.create(name="Origen")
    product = Product.objects.create(
        code="MOVE",
        name="Mover",
        category=origin,
        unit=world["unit"],
        tax_definition=world["tax"],
        content_quantity=1,
        sale_price=1,
    )

    def deactivate() -> Any:
        return auxiliaries.set_auxiliary_active(
            "category",
            target.pk,
            active=False,
            actor=admin,
            payload={"expected_version": 1, "idempotency_key": "race-recl-off"},
        )

    def reclassify() -> Any:
        return products.update_product(
            product.pk,
            actor=admin,
            payload={
                "expected_version": 1,
                "category_id": target.pk,
                "idempotency_key": "race-recl-mov",
            },
        )

    off, moved = run_pair(deactivate, reclassify)
    target.refresh_from_db()
    product.refresh_from_db()
    assert not (not target.is_active and product.category_id == target.pk)
    if isinstance(off, Exception):
        assert off.code == "category_has_active_products"  # type: ignore[attr-defined]
        assert product.category_id == target.pk
    if isinstance(moved, Exception):
        assert moved.code == "inactive_reference"  # type: ignore[attr-defined]
        assert product.category_id == origin.pk
    success = AuditEvent.objects.filter(
        action__in=["catalog.category_deactivated", "catalog.product_updated"], result="SUCCESS"
    ).count()
    assert success == sum(not isinstance(r, Exception) for r in (off, moved))


def test_category_deactivation_races_product_reactivation(admin: Any) -> None:
    world = _product_world()
    category = world["category"]
    product = Product.objects.create(
        code="REACT",
        name="Reactivar",
        category=category,
        unit=world["unit"],
        tax_definition=world["tax"],
        content_quantity=1,
        sale_price=1,
        is_active=False,
    )

    def deactivate() -> Any:
        return auxiliaries.set_auxiliary_active(
            "category",
            category.pk,
            active=False,
            actor=admin,
            payload={"expected_version": 1, "idempotency_key": "race-react-off"},
        )

    def reactivate() -> Any:
        return products.set_product_active(
            product.pk,
            active=True,
            actor=admin,
            payload={"expected_version": 1, "idempotency_key": "race-react-on"},
        )

    off, on = run_pair(deactivate, reactivate)
    category.refresh_from_db()
    product.refresh_from_db()
    assert not (not category.is_active and product.is_active)
    if isinstance(off, Exception):
        assert off.code == "category_has_active_products"  # type: ignore[attr-defined]
        assert product.is_active
    if isinstance(on, Exception):
        assert on.code == "inactive_reference"  # type: ignore[attr-defined]
        assert not product.is_active


@pytest.mark.parametrize("kind", ["unit", "brand"])
def test_auxiliary_deactivation_races_new_association(admin: Any, kind: str) -> None:
    world = _product_world()
    brand = ProductBrand.objects.create(name="Marca")
    auxiliary = world["unit"] if kind == "unit" else brand
    extra = {} if kind == "unit" else {"product_brand_id": brand.pk}

    def deactivate() -> Any:
        return auxiliaries.set_auxiliary_active(
            kind,
            auxiliary.pk,
            active=False,
            actor=admin,
            payload={"expected_version": 1, "idempotency_key": f"race-{kind}-off"},
        )

    def associate() -> Any:
        return products.create_product(
            actor=admin, payload=_product_payload(world, f"race-{kind}-new", **extra)
        )

    off, created = run_pair(deactivate, associate)
    auxiliary.refresh_from_db()
    assert not isinstance(off, Exception)  # la baja de auxiliares nunca se bloquea
    assert not auxiliary.is_active
    if isinstance(created, Exception):
        assert created.code == "inactive_reference"  # type: ignore[attr-defined]
        assert Product.objects.count() == 0
    else:
        assert Product.objects.count() == 1


def test_vehicle_brand_deactivation_races_product_compatibility(admin: Any) -> None:
    world = _product_world()
    vehicle_brand = VehicleBrand.objects.create(name="Marca vehículo")

    def deactivate() -> Any:
        return deactivate_brand(brand_id=vehicle_brand.pk, expected_version=1, actor=admin)

    def associate() -> Any:
        return products.create_product(
            actor=admin,
            payload=_product_payload(world, "race-veh-new", vehicle_brand_ids=[vehicle_brand.pk]),
        )

    off, created = run_pair(deactivate, associate)
    vehicle_brand.refresh_from_db()
    assert not isinstance(off, Exception)
    assert not vehicle_brand.is_active
    if isinstance(created, Exception):
        assert created.code == "inactive_reference"  # type: ignore[attr-defined]
        assert Product.objects.count() == 0
    else:
        assert ProductCompatibility.objects.filter(vehicle_brand=vehicle_brand).count() == 1


def test_same_product_code_only_one_wins(admin: Any) -> None:
    world = _product_world()

    def make(n: int) -> Callable[[], Any]:
        return lambda: products.create_product(
            actor=admin,
            payload=_product_payload(world, f"race-code-{n:04d}", code=" same-code "),
        )

    first, second = run_pair(make(1), make(2))
    results = [first, second]
    assert sum(not isinstance(r, Exception) for r in results) == 1
    loser = next(r for r in results if isinstance(r, Exception))
    assert getattr(loser, "code", None) == "duplicate_code"
    assert Product.objects.filter(code="SAME-CODE").count() == 1
    assert Product.objects.count() == 1


def test_simultaneous_service_creation_assigns_different_codes(admin: Any) -> None:
    from catalog.application import services as service_commands
    from catalog.models import Service

    entity = FiscalEntity.objects.create(
        entity_type="ARTESANAL", legal_name="A", ruc="1790000000002"
    )
    tax = TaxDefinition.objects.create(fiscal_entity=entity, code="ART", name="Artesanal")

    def make(n: int) -> Callable[[], Any]:
        return lambda: service_commands.create_service(
            actor=admin,
            payload={
                "name": f"Servicio {n}",
                "reference_price": "10",
                "tax_definition_id": tax.pk,
                "idempotency_key": f"conc-svc-{n:04d}",
            },
        )

    a, b = run_pair(make(1), make(2))
    assert not isinstance(a, Exception), a
    assert not isinstance(b, Exception), b
    assert sorted(Service.objects.values_list("code", flat=True)) == ["SRV-000001", "SRV-000002"]
