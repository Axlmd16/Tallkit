"""Coordinación de repuestos desde la orden hacia la venta vinculada."""

from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import AnonymousUser
from tests.workshop.workshop_helpers import create, error_of, key, version

from catalog.models import MeasurementUnit, Product, ProductCategory
from identity.application.authorization import BusinessPermissionDeniedError
from inventory.models import InventoryPosition, InventoryReservation
from sales.models import Sale, SaleLine
from workshop.application import parts
from workshop.models import MaintenanceOrder
from workshop_configuration.models import FiscalEntity, TaxDefinition, Warehouse

pytestmark = pytest.mark.django_db


@pytest.fixture
def product(db: None) -> Product:
    commercial = FiscalEntity.objects.create(
        entity_type="COMERCIAL",
        legal_name="Comercial SA",
        ruc="1790000000001",
    )
    tax = TaxDefinition.objects.create(
        fiscal_entity=commercial,
        code="IVA",
        name="IVA",
    )
    category = ProductCategory.objects.create(name="Repuestos")
    unit = MeasurementUnit.objects.create(name="Unidad", symbol="u")
    return Product.objects.create(
        code="REP-001",
        name="Filtro de aceite",
        category=category,
        unit=unit,
        content_quantity=Decimal("1"),
        sale_price=Decimal("11.50"),
        tax_definition=tax,
    )


@pytest.fixture
def stocked_product(product: Product) -> Product:
    warehouse, _ = Warehouse.objects.get_or_create(id=1, defaults={"name": "Principal"})
    InventoryPosition.objects.create(
        product=product,
        warehouse=warehouse,
        quantity=Decimal("10"),
        value=Decimal("40.000000"),
        average=Decimal("4.000000"),
    )
    return product


@pytest.fixture
def order(manager: Any, artisan: Any, customer: Any, vehicle: Any) -> dict[str, Any]:
    return create(
        manager,
        customer_id=customer.pk,
        vehicle_id=vehicle.pk,
        odometer_km=1000,
    )


def _add(  # type: ignore[no-untyped-def]
    actor: Any,
    order_id: int,
    product_id: int,
    *,
    request_key: str | None = None,
    expected_version: int | None = None,
):
    return parts.add_part(
        actor=actor,
        order_id=order_id,
        payload={
            "product_id": product_id,
            "quantity": "2",
            "expected_version": expected_version or version(order_id),
            "idempotency_key": request_key or key(),
        },
    )


def test_add_change_and_remove_parts_increment_order_version_and_adjust_reservation(
    manager: Any,
    order: dict[str, Any],
    stocked_product: Product,
) -> None:
    added = _add(manager, order["id"], stocked_product.pk)
    line = SaleLine.objects.get(sale__origin_order_id=order["id"])
    assert (added.status, version(order["id"]), line.quantity) == (201, 2, Decimal("2"))
    assert InventoryReservation.objects.get(source_id=line.pk).quantity == 2

    changed = parts.change_part(
        actor=manager,
        order_id=order["id"],
        line_id=line.pk,
        payload={
            "quantity": "4",
            "expected_version": 2,
            "idempotency_key": key(),
        },
    )
    line.refresh_from_db()
    assert (changed.status, version(order["id"]), line.quantity) == (200, 3, Decimal("4"))
    assert InventoryReservation.objects.get(source_id=line.pk).quantity == 4

    removed = parts.remove_part(
        actor=manager,
        order_id=order["id"],
        line_id=line.pk,
        payload={"expected_version": 3, "idempotency_key": key()},
    )
    assert (removed.status, version(order["id"])) == (200, 4)
    assert not SaleLine.objects.filter(pk=line.pk).exists()
    assert InventoryReservation.objects.get(source_id=line.pk).state == "RELEASED"


@pytest.mark.parametrize("state", ["FINALIZED", "REOPENED"])
def test_parts_are_not_allowed_outside_registered_order(
    manager: Any,
    order: dict[str, Any],
    stocked_product: Product,
    state: str,
) -> None:
    MaintenanceOrder.objects.filter(pk=order["id"]).update(state=state)

    error = error_of(lambda: _add(manager, order["id"], stocked_product.pk))

    assert error.code == "parts_not_allowed"
    if state == "FINALIZED":
        assert "finalizada" in error.message
    else:
        assert "correctivo" in error.message
        assert "reposición" in error.message
    assert not Sale.objects.filter(origin_order_id=order["id"]).exists()


def test_part_retry_with_same_key_does_not_duplicate_line_or_reservation(
    manager: Any,
    order: dict[str, Any],
    stocked_product: Product,
) -> None:
    request_key = key()
    first = _add(manager, order["id"], stocked_product.pk, request_key=request_key)
    second = _add(
        manager, order["id"], stocked_product.pk, request_key=request_key, expected_version=1
    )

    assert first.body == second.body
    assert second.replayed is True
    assert SaleLine.objects.filter(sale__origin_order_id=order["id"]).count() == 1
    assert InventoryReservation.objects.filter(state="ACTIVE").count() == 1
    assert version(order["id"]) == 2


def test_seller_and_anonymous_are_denied_without_effects(
    seller: Any,
    order: dict[str, Any],
    stocked_product: Product,
) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        _add(seller, order["id"], stocked_product.pk)
    with pytest.raises(BusinessPermissionDeniedError):
        _add(AnonymousUser(), order["id"], stocked_product.pk)
    assert not Sale.objects.filter(origin_order_id=order["id"]).exists()


def test_accumulated_seller_and_manager_roles_allow_part_changes(
    seller_manager: Any,
    order: dict[str, Any],
    stocked_product: Product,
) -> None:
    outcome = _add(seller_manager, order["id"], stocked_product.pk)
    assert outcome.status == 201
    assert SaleLine.objects.filter(sale__origin_order_id=order["id"]).count() == 1


def test_part_queries_return_linked_sales_and_product_availability_without_costs(
    manager: Any,
    order: dict[str, Any],
    stocked_product: Product,
) -> None:
    _add(manager, order["id"], stocked_product.pk)

    linked = parts.list_parts(actor=manager, order_id=order["id"])
    options = parts.list_part_product_options(
        actor=manager,
        order_id=order["id"],
        search=" rep- ",
        page=1,
    )

    assert linked[0]["origin"]["order_id"] == order["id"]
    assert options["results"][0]["available"] == "8"
    assert "cost" not in repr((linked, options)).lower()
