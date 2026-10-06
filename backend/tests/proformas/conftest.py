"""Fixtures sintéticas de proformas: cliente, productos, tarifa, disponibilidad y serie COM-PRO."""

from datetime import date
from decimal import Decimal
from itertools import count
from typing import Any

import pytest
from django.contrib.auth import get_user_model

from catalog.models import MeasurementUnit, Product, ProductCategory
from customer_registry.models import Customer
from identity.models import UserRole
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


def _user(username: str, *roles: str):  # type: ignore[no-untyped-def]
    user = get_user_model().objects.create_user(username=username, password="x" * 14)
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def actor(db: None):  # type: ignore[no-untyped-def]
    return _user("pro-actor")


@pytest.fixture
def admin(db: None):  # type: ignore[no-untyped-def]
    return _user("pro-admin", "ADMINISTRADOR")


@pytest.fixture
def seller(db: None):  # type: ignore[no-untyped-def]
    return _user("pro-seller", "VENDEDOR")


@pytest.fixture
def manager(db: None):  # type: ignore[no-untyped-def]
    return _user("pro-manager", "ENCARGADO_TALLER")


@pytest.fixture
def seller_manager(db: None):  # type: ignore[no-untyped-def]
    return _user("pro-seller-manager", "VENDEDOR", "ENCARGADO_TALLER")


@pytest.fixture
def warehouse(db: None) -> Warehouse:
    warehouse, _ = Warehouse.objects.get_or_create(id=1, defaults={"name": "Principal"})
    return warehouse


@pytest.fixture
def customer(db: None) -> Customer:
    return Customer.objects.create(
        person_type="NATURAL",
        name="Cliente Proforma",
        identification_type="CI",
        identification="1712345678",
        phone="0999999999",
    )


@pytest.fixture
def commercial(warehouse: Warehouse) -> dict[str, Any]:
    """Entidad comercial con tarifa de prueba 15 %, tarifa cero y series COM-PRO y COM-VEN."""
    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    entity, _ = FiscalEntity.objects.get_or_create(
        entity_type="COMERCIAL",
        defaults={"legal_name": "Comercial SA", "ruc": "1790000000001"},
    )
    fifteen, _ = TaxDefinition.objects.get_or_create(
        fiscal_entity=entity, code="IVA", defaults={"name": "IVA"}
    )
    period = TaxPeriod.objects.create(
        tax_definition=fifteen, rate=Decimal("15"), starts_on=date(2025, 1, 1)
    )
    zero = TaxDefinition.objects.create(fiscal_entity=entity, code="CERO", name="Tarifa cero")
    TaxPeriod.objects.create(tax_definition=zero, rate=Decimal("0"), starts_on=date(2025, 1, 1))
    scope = NumberingScope.objects.create(fiscal_entity=entity, document_type="PROFORMA")
    series = DocumentSeries.objects.create(numbering_scope=scope, code="COM-PRO", is_active=True)
    sale_scope = NumberingScope.objects.create(fiscal_entity=entity, document_type="VENTA")
    sale_series = DocumentSeries.objects.create(
        numbering_scope=sale_scope, code="COM-VEN", is_active=True
    )
    return {
        "entity": entity,
        "tax": fifteen,
        "period": period,
        "zero": zero,
        "scope": scope,
        "series": series,
        "sale_scope": sale_scope,
        "sale_series": sale_series,
        "warehouse": warehouse,
    }


@pytest.fixture
def make_product(commercial: dict[str, Any]):  # type: ignore[no-untyped-def]
    category, _ = ProductCategory.objects.get_or_create(name="Repuestos")
    unit, _ = MeasurementUnit.objects.get_or_create(name="Unidad")

    def factory(**overrides):  # type: ignore[no-untyped-def]
        number = next(_sequence)
        values = {
            "code": f"PRO-{number}",
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
def stock(actor: Any, warehouse: Warehouse):  # type: ignore[no-untyped-def]
    """Existencia inicial mediante la publicación pública de inventario."""
    from catalog.application.inventory_references import lock_product_references
    from inventory.application import posting

    counter = count(5000)

    def add(product: Any, quantity: int, value: str = "0") -> None:
        value = value if value != "0" else f"{quantity * 4}.00"
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


@pytest.fixture(autouse=True)
def private_media(tmp_path: Any, settings: Any) -> Any:
    root = tmp_path / "private-media"
    settings.PRIVATE_MEDIA_ROOT = root
    return root


@pytest.fixture
def at(monkeypatch: pytest.MonkeyPatch):  # type: ignore[no-untyped-def]
    """Fija el reloj de la aplicación en un instante local de America/Guayaquil."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from proformas.application import clock

    def freeze(year: int, month: int, day: int, hour: int = 10, minute: int = 0) -> None:
        instant = datetime(year, month, day, hour, minute, tzinfo=ZoneInfo("America/Guayaquil"))
        monkeypatch.setattr(clock, "now", lambda: instant)

    return freeze


_keys = count(1)


def key(prefix: str = "pro") -> str:
    return f"{prefix}-key-{next(_keys):06d}"


@pytest.fixture
def new_draft(seller: Any, customer: Customer):  # type: ignore[no-untyped-def]
    """Crea un borrador con líneas (producto, cantidad) mediante el servicio público."""
    from proformas.application import drafts

    def build(*lines: tuple[Any, int], actor: Any = None, **extra: Any) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "idempotency_key": key("draft"),
            "customer_id": customer.pk,
            "lines": [{"product_id": p.pk, "quantity": str(q)} for p, q in lines],
        }
        payload.update(extra)
        return drafts.create_draft(actor=actor or seller, payload=payload).body

    return build


@pytest.fixture
def issue(seller: Any):  # type: ignore[no-untyped-def]
    """Revisa y emite un borrador; devuelve el cuerpo emitido."""
    from proformas.application import issuing, reviews

    def run(body: dict[str, Any], actor: Any = None) -> dict[str, Any]:
        who = actor or seller
        review = reviews.preview_issue(actor=who, proforma_id=body["id"])
        assert review["can_issue"], review["issues"]
        return issuing.issue_proforma(
            actor=who,
            proforma_id=body["id"],
            payload={
                "idempotency_key": key("issue"),
                "expected_version": review["version"],
                "review_token": review["review_token"],
            },
        ).body

    return run


@pytest.fixture
def issued(new_draft: Any, issue: Any, product: Any, at: Any) -> dict[str, Any]:
    """Oferta emitida el 6 de octubre de 2026 con vigencia hasta el 13."""
    at(2026, 10, 6)
    return issue(new_draft((product, 2)))
