"""Carreras en PostgreSQL con conexiones independientes y barreras (sin sleeps)."""

import threading
from collections.abc import Callable
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.db import connection, connections

from catalog.application import auxiliaries, products
from catalog.application.errors import CatalogApplicationError
from catalog.models import MeasurementUnit, Product, ProductCategory
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
