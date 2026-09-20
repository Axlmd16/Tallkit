from decimal import Decimal

import pytest
from django.apps import apps
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from catalog.models import (
    CatalogCommand,
    MeasurementUnit,
    Product,
    ProductBrand,
    ProductCategory,
    ProductCompatibility,
    Service,
)
from customer_registry.models import VehicleBrand
from workshop_configuration.models import TaxDefinition

pytestmark = pytest.mark.django_db


def test_apps_registered_with_expected_names() -> None:
    assert apps.get_app_config("catalog").name == "catalog"
    assert apps.get_app_config("supplier_registry").name == "supplier_registry"


def test_catalog_models_have_no_stock_or_cost_fields() -> None:
    forbidden = {"stock", "cost", "balance", "supplier", "warehouse", "parent", "quantity"}
    for model in (Product, Service, ProductCategory, MeasurementUnit, ProductBrand):
        names = {f.name for f in model._meta.get_fields()}
        assert not names & forbidden, model


@pytest.mark.parametrize("model", [ProductCategory, MeasurementUnit, ProductBrand])
def test_auxiliary_name_unique_normalized_including_inactive(model: type) -> None:
    model.objects.create(name="Aceites", is_active=False)
    with pytest.raises(IntegrityError), transaction.atomic():
        model.objects.create(name="  aceites ")
    model.objects.create(name="Aceítes")  # los acentos distinguen
    model.objects.create(name="Ac  eites")


def test_auxiliary_defaults() -> None:
    cat = ProductCategory.objects.create(name="A")
    assert cat.is_active is True
    assert cat.version == 1
    assert cat.created_at is not None
    assert cat.updated_at is not None


def test_blank_name_rejected() -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        ProductBrand.objects.create(name="   ")


def _product(tax: TaxDefinition, **kw: object) -> Product:
    cat = ProductCategory.objects.get_or_create(name="Lubricantes")[0]
    unit = MeasurementUnit.objects.get_or_create(name="Litro")[0]
    data: dict[str, object] = {
        "code": "ACE-1",
        "name": "Aceite",
        "category": cat,
        "unit": unit,
        "content_quantity": Decimal("1"),
        "sale_price": Decimal("10.00"),
        "tax_definition": tax,
    }
    data.update(kw)
    return Product.objects.create(**data)


def test_product_code_unique_including_inactive(commercial_tax: TaxDefinition) -> None:
    _product(commercial_tax, is_active=False)
    with pytest.raises(IntegrityError), transaction.atomic():
        _product(commercial_tax, name="Otro", code="ace-1")


@pytest.mark.parametrize(
    "override",
    [{"content_quantity": Decimal("0")}, {"sale_price": Decimal("-0.01")}, {"code": "  "}],
)
def test_product_local_checks(commercial_tax: TaxDefinition, override: dict[str, object]) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        _product(commercial_tax, **override)


def test_product_zero_price_allowed(commercial_tax: TaxDefinition) -> None:
    assert _product(commercial_tax, sale_price=Decimal("0")).sale_price == 0


def test_protect_relations(commercial_tax: TaxDefinition) -> None:
    product = _product(commercial_tax)
    for ref in (product.category, product.unit, commercial_tax):
        with pytest.raises(ProtectedError):
            ref.delete()


def test_compatibility_unique_and_protected(
    commercial_tax: TaxDefinition, vehicle_brand: VehicleBrand
) -> None:
    product = _product(commercial_tax)
    ProductCompatibility.objects.create(product=product, vehicle_brand=vehicle_brand)
    with pytest.raises(IntegrityError), transaction.atomic():
        ProductCompatibility.objects.create(product=product, vehicle_brand=vehicle_brand)
    with pytest.raises(ProtectedError):
        vehicle_brand.delete()
    assert VehicleBrand.objects.count() == 1


def test_services_may_share_names_and_have_no_code(commercial_tax: TaxDefinition) -> None:
    Service.objects.create(
        name="Alineación", reference_price=Decimal("5"), tax_definition=commercial_tax
    )
    Service.objects.create(
        name="Alineación", reference_price=Decimal("0"), tax_definition=commercial_tax
    )
    assert Service.objects.count() == 2
    with pytest.raises(IntegrityError), transaction.atomic():
        Service.objects.create(
            name="x", reference_price=Decimal("-1"), tax_definition=commercial_tax
        )


def test_command_receipt_constraints(actor: object) -> None:
    fp = "a" * 64
    CatalogCommand.objects.create(
        actor=actor,
        action="catalog.product_created",
        idempotency_key="key-12345",
        input_fingerprint=fp,
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        CatalogCommand.objects.create(
            actor=actor,
            action="catalog.product_created",
            idempotency_key="key-12345",
            input_fingerprint=fp,
        )
    with pytest.raises(IntegrityError), transaction.atomic():
        CatalogCommand.objects.create(
            actor=actor, action="x", idempotency_key="short", input_fingerprint=fp
        )
    with pytest.raises(IntegrityError), transaction.atomic():
        CatalogCommand.objects.create(
            actor=actor, action="x", idempotency_key="key-67890", input_fingerprint="zz"
        )
