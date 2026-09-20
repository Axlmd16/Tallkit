"""Fronteras del monolito modular y ausencia de efectos de stock, costos y numeración."""

import ast
from pathlib import Path
from typing import Any

import pytest
from django.apps import apps
from django.contrib.auth import get_user_model

from catalog.application import auxiliaries, products, services
from catalog.models import MeasurementUnit, ProductBrand, ProductCategory
from customer_registry.models import VehicleBrand
from identity.models import UserRole
from supplier_registry.application import suppliers
from workshop_configuration import models as configuration

SRC = Path(__file__).resolve().parents[2] / "src"
FORBIDDEN_FIELD_WORDS = ("stock", "cost", "balance", "saldo", "warehouse", "bodega", "series")

# Interfaces públicas que otros módulos publican para el catálogo.
ALLOWED_CROSS_MODULE = {
    "catalog": {
        "customer_registry.application.catalog_references",
        "workshop_configuration.application.catalog_options",
        "customer_registry.domain.identification",
        "identity.api.permissions",
        "identity.api.request_context",
        "identity.application.audit",
        "identity.application.authorization",
        "identity.models",
    },
    "supplier_registry": {
        "customer_registry.domain.identification",
        "identity.api.permissions",
        "identity.api.request_context",
        "identity.application.audit",
        "identity.application.authorization",
        "identity.models",
    },
}


# Interfaces públicas de aplicación que otros módulos pueden consumir de cada propietario.
PUBLISHED_APPLICATION_INTERFACES = {
    "catalog.application.inventory_references",
    "supplier_registry.application.purchase_references",
}


def imported_modules(path: Path) -> set[str]:
    """Módulos importados en tiempo de ejecución (ignora bloques ``TYPE_CHECKING``)."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found: set[str] = set()

    def visit(node: ast.AST) -> None:
        if isinstance(node, ast.If) and getattr(node.test, "id", None) == "TYPE_CHECKING":
            return
        if isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            found.add(node.module)
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        for child in ast.iter_child_nodes(node):
            visit(child)

    visit(tree)
    return found


@pytest.mark.parametrize("package", ["catalog", "supplier_registry"])
def test_modules_only_use_published_interfaces_of_other_modules(package: str) -> None:
    others = {"customer_registry", "workshop_configuration", "identity", "purchasing", "inventory"}
    others |= {"catalog", "supplier_registry"} - {package}
    violations: list[str] = []
    for path in (SRC / package).rglob("*.py"):
        if "migrations" in path.parts:
            continue
        for module in imported_modules(path):
            if module.split(".")[0] in others and module not in ALLOWED_CROSS_MODULE[package]:
                violations.append(f"{path.relative_to(SRC)} importa {module}")
    assert not violations, violations


def test_supplier_registry_does_not_depend_on_catalog_nor_the_reverse() -> None:
    for package, other in (("supplier_registry", "catalog"), ("catalog", "supplier_registry")):
        for path in (SRC / package).rglob("*.py"):
            assert not any(m.split(".")[0] == other for m in imported_modules(path)), path


def test_no_consumer_writes_catalog_or_supplier_persistence() -> None:
    """Solo los módulos propietarios (y la composición de rutas) importan sus modelos."""
    offenders: list[str] = []
    for path in SRC.rglob("*.py"):
        relative = path.relative_to(SRC)
        if relative.parts[0] in {"catalog", "supplier_registry"} or "migrations" in path.parts:
            continue
        for module in imported_modules(path):
            if module in {"catalog.models", "supplier_registry.models"} or (
                module.startswith(("catalog.application", "supplier_registry.application"))
                and module not in PUBLISHED_APPLICATION_INTERFACES
            ):
                offenders.append(f"{relative} importa {module}")
    assert not offenders, offenders


def test_domain_rules_do_not_depend_on_framework_or_persistence() -> None:
    banned = {"django", "rest_framework", "drf_spectacular"}
    for package in ("catalog", "supplier_registry"):
        for path in (SRC / package / "domain").rglob("*.py"):
            modules = {m.split(".")[0] for m in imported_modules(path)}
            assert not modules & banned, path
            assert not any(
                m.endswith(".models") or ".application" in m or ".api" in m
                for m in imported_modules(path)
            ), path


@pytest.mark.parametrize("app_label", ["catalog", "supplier_registry"])
def test_models_have_no_stock_cost_balance_or_warehouse_fields(app_label: str) -> None:
    for model in apps.get_app_config(app_label).get_models():
        names = [field.name for field in model._meta.get_fields()]
        bad = [n for n in names if any(word in n.lower() for word in FORBIDDEN_FIELD_WORDS)]
        assert not bad, (model.__name__, bad)


CONFIGURATION_TABLES = (
    configuration.ConfigurationUse,
    configuration.NumberAllocation,
    configuration.DocumentSeries,
    configuration.Warehouse,
    configuration.FiscalEntity,
    configuration.TaxDefinition,
    configuration.TaxPeriod,
)


@pytest.mark.django_db
def test_using_catalogs_writes_no_configuration_numbering_or_foreign_state(
    commercial_tax: configuration.TaxDefinition,
    artisanal_tax: configuration.TaxDefinition,
) -> None:
    admin: Any = get_user_model().objects.create_user(username="boundary", password="pw123456789")
    UserRole.objects.create(user=admin, role="ADMINISTRADOR")
    vehicle_brand = VehicleBrand.objects.create(name="Toyota")

    def snapshot() -> dict[str, Any]:
        state: dict[str, Any] = {
            model.__name__: model.objects.count() for model in CONFIGURATION_TABLES
        }
        state["configuration_rows"] = list(
            configuration.TaxPeriod.objects.values_list("pk", "rate", "starts_on", "ends_on")
        )
        state["vehicle_brand"] = list(
            VehicleBrand.objects.values_list("pk", "version", "is_active")
        )
        return state

    before = snapshot()
    category = auxiliaries.create_auxiliary(
        "category", actor=admin, payload={"name": "Aceites", "idempotency_key": "bnd-cat-0001"}
    ).body
    unit = auxiliaries.create_auxiliary(
        "unit", actor=admin, payload={"name": "Galón", "idempotency_key": "bnd-uni-0001"}
    ).body
    brand = auxiliaries.create_auxiliary(
        "brand", actor=admin, payload={"name": "Castrol", "idempotency_key": "bnd-brd-0001"}
    ).body
    product = products.create_product(
        actor=admin,
        payload={
            "code": "BND-1",
            "name": "Aceite",
            "category_id": category["id"],
            "unit_id": unit["id"],
            "product_brand_id": brand["id"],
            "vehicle_brand_ids": [vehicle_brand.pk],
            "tax_definition_id": commercial_tax.pk,
            "content_quantity": "1",
            "sale_price": "10.50",
            "idempotency_key": "bnd-prd-0001",
        },
    ).body
    products.set_product_active(
        product["id"],
        active=False,
        actor=admin,
        payload={"expected_version": 1, "idempotency_key": "bnd-prd-0002"},
    )
    services.create_service(
        actor=admin,
        payload={
            "name": "Alineación",
            "reference_price": "25.00",
            "tax_definition_id": artisanal_tax.pk,
            "idempotency_key": "bnd-srv-0001",
        },
    )
    suppliers.create_supplier(
        actor=admin, payload={"name": "Ocasional", "idempotency_key": "bnd-sup-0001"}
    )

    assert snapshot() == before
    assert ProductCategory.objects.count() == 1
    assert MeasurementUnit.objects.count() == 1
    assert ProductBrand.objects.count() == 1
