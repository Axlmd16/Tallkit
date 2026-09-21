from datetime import date
from decimal import Decimal
from itertools import count
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from catalog.models import MeasurementUnit, Product, ProductCategory
from customer_registry.models import Customer
from identity.models import UserRole
from inventory.models import (
    InventoryMovement,
    InventoryOperation,
    InventoryPosition,
)
from workshop_configuration.models import (
    DocumentSeries,
    FiscalEntity,
    NumberingScope,
    TaxDefinition,
    TaxPeriod,
    Warehouse,
    WorkshopConfiguration,
)

_sequence = count(1)
PAST = date(2026, 1, 15)


def _user(username: str, *roles: str):  # type: ignore[no-untyped-def]
    user = get_user_model().objects.create_user(username=username, password="x" * 14)
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def actor(db: None):  # type: ignore[no-untyped-def]
    return _user("sal-actor")


@pytest.fixture
def admin(db: None):  # type: ignore[no-untyped-def]
    return _user("sal-admin", "ADMINISTRADOR")


@pytest.fixture
def seller(db: None):  # type: ignore[no-untyped-def]
    return _user("sal-seller", "VENDEDOR")


@pytest.fixture
def warehouse(db: None) -> Warehouse:
    warehouse, _ = Warehouse.objects.get_or_create(id=1, defaults={"name": "Principal"})
    return warehouse


@pytest.fixture
def customer(db: None) -> Customer:
    return Customer.objects.create(
        person_type="NATURAL",
        name="Cliente Uno",
        identification_type="CI",
        identification="1712345678",
        phone="0999999999",
    )


@pytest.fixture
def commercial(db: None) -> dict[str, Any]:
    """Entidad comercial con tarifa de prueba 15 %, tarifa cero y serie COM-VEN."""
    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    entity, _ = FiscalEntity.objects.get_or_create(
        entity_type="COMERCIAL",
        defaults={"legal_name": "Comercial SA", "ruc": "1790000000001"},
    )
    fifteen, _ = TaxDefinition.objects.get_or_create(
        fiscal_entity=entity, code="IVA", defaults={"name": "IVA"}
    )
    TaxPeriod.objects.create(tax_definition=fifteen, rate=Decimal("15"), starts_on=date(2025, 1, 1))
    zero = TaxDefinition.objects.create(fiscal_entity=entity, code="CERO", name="Tarifa cero")
    TaxPeriod.objects.create(tax_definition=zero, rate=Decimal("0"), starts_on=date(2025, 1, 1))
    scope = NumberingScope.objects.create(fiscal_entity=entity, document_type="VENTA")
    series = DocumentSeries.objects.create(numbering_scope=scope, code="COM-VEN", is_active=True)
    return {"entity": entity, "tax": fifteen, "zero": zero, "scope": scope, "series": series}


@pytest.fixture
def make_product(commercial: dict[str, Any]):  # type: ignore[no-untyped-def]
    category, _ = ProductCategory.objects.get_or_create(name="Aceites")
    unit, _ = MeasurementUnit.objects.get_or_create(name="Unidad")

    def factory(**overrides):  # type: ignore[no-untyped-def]
        number = next(_sequence)
        values = {
            "code": f"SAL-{number}",
            "name": f"Producto {number}",
            "category": category,
            "unit": unit,
            "content_quantity": Decimal("1"),
            "sale_price": Decimal("11.50"),
            "tax_definition": commercial["tax"],
        }
        values.update(overrides)
        return Product.objects.create(**values)

    return factory


@pytest.fixture
def product(make_product):  # type: ignore[no-untyped-def]
    return make_product()


@pytest.fixture
def make_movement(actor: Any, warehouse: Warehouse):  # type: ignore[no-untyped-def]
    """Movimiento de salida agrupado de inventario para asignaciones de costo."""

    def factory(product: Any, quantity: str = "2", value: str = "8.000000") -> InventoryMovement:
        position, _ = InventoryPosition.objects.get_or_create(
            product=product,
            warehouse=warehouse,
            defaults={"quantity": Decimal(10), "value": Decimal("40.000000"), "average": 4},
        )
        operation = InventoryOperation.objects.create(
            kind="PURCHASE_RECEIPT",
            state="PREPARED",
            source_type="SALES_TEST",
            source_id=next(_sequence),
            actor=actor,
            fingerprint="f" * 64,
        )
        return InventoryMovement.objects.create(
            operation=operation,
            position=position,
            product=product,
            warehouse=warehouse,
            ordinal=position.movements.count() + 1,
            movement_type="PURCHASE_RECEIPT",
            effective_at=timezone.now(),
            quantity_in=Decimal(0),
            quantity_out=Decimal(quantity),
            value_delta=-Decimal(value),
            applied_unit_cost=Decimal("4.000000"),
            quantity_before=Decimal(10),
            value_before=Decimal("40.000000"),
            average_before=Decimal("4.000000"),
            quantity_after=Decimal(10) - Decimal(quantity),
            value_after=Decimal("40.000000") - Decimal(value),
            average_after=Decimal("4.000000"),
            product_snapshot={"version": 1, "code": product.code},
            actor=actor,
        )

    return factory


@pytest.fixture
def stock(actor: Any, warehouse: Warehouse):  # type: ignore[no-untyped-def]
    """Existencia inicial mediante la publicación pública de inventario (una compra)."""
    from catalog.application.inventory_references import lock_product_references
    from inventory.application import posting

    counter = count(1000)

    def add(product: Any, quantity: int, value: str) -> None:
        refs = lock_product_references([product.pk])
        operation = posting.prepare_operation(
            kind="PURCHASE_RECEIPT",
            actor=actor,
            source_type="PURCHASE",
            source_id=next(counter),
            entry_lines=[posting.EntryLine(product.pk, Decimal(quantity), Decimal(value))],
        )
        posting.post_operation(
            operation, posting.lock_positions(refs, warehouse_id=warehouse.pk), refs
        )

    return add


@pytest.fixture
def confirmed_sale(seller: Any, customer: Any, make_product: Any, stock: Any):  # type: ignore[no-untyped-def]
    """Fábrica de ventas confirmadas: precio final por unidad, cantidad y condición."""
    from sales.application import reviews, sales

    counter = count(1)

    def build(
        *,
        price: str = "100.00",
        quantity: int = 1,
        condition: str = "CREDITO",
        product: Any = None,
        sale_customer: Any = None,
        stock_units: int = 20,
    ) -> dict[str, Any]:
        if product is None:
            product = make_product(sale_price=Decimal(price))
            stock(product, stock_units, f"{stock_units * 4}.00")
        n = next(counter)
        draft = sales.create_draft(
            actor=seller,
            payload={
                "idempotency_key": f"fx-draft-{id(product)}-{n:04d}",
                "customer_id": (sale_customer or customer).pk,
                "condition": condition,
                "lines": [{"product_id": product.pk, "quantity": str(quantity)}],
            },
        ).body
        review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
        body = sales.confirm_sale(
            actor=seller,
            sale_id=draft["id"],
            payload={
                "idempotency_key": f"fx-conf-{id(product)}-{n:05d}",
                "expected_version": draft["version"],
                "review_token": review["review_token"],
            },
        ).body
        return {"id": draft["id"], "product": product, "body": body}

    return build
