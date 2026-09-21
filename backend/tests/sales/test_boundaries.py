"""Fronteras del módulo comercial: coordina ventas sin mutar persistencia ajena."""

import ast
import re
from pathlib import Path

import pytest
from django.apps import apps

SRC = Path(__file__).resolve().parents[2] / "src"
PACKAGE = "sales"
OTHERS = {
    "identity",
    "customer_registry",
    "workshop_configuration",
    "catalog",
    "inventory",
}
ALLOWED_CROSS_MODULE = {
    "inventory.application.posting",
    "inventory.application.queries",
    "catalog.application.sales_references",
    "customer_registry.application.sales_references",
    "workshop_configuration.application.operation_context",
    "workshop_configuration.application.numbering",
    "workshop_configuration.application.configuration_resolver",
    "identity.api.permissions",
    "identity.api.request_context",
    "identity.application.audit",
    "identity.application.authorization",
    "identity.models",
}
SQL_MARKERS = (
    "inventory_",
    "catalog_",
    "customer_registry_",
    "workshop_configuration_",
    "identity_",
)
NOT_ALLOWED_TO_IMPORT_SALES = {
    "inventory",
    "purchasing",
    "catalog",
    "customer_registry",
    "workshop_configuration",
}


def imported_modules(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            found.add(node.module)
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
    return found


def package_files(package: str) -> list[Path]:
    return [p for p in (SRC / package).rglob("*.py") if "migrations" not in p.parts]


def test_application_is_installed() -> None:
    assert apps.get_app_config(PACKAGE).name == PACKAGE


def test_only_published_interfaces_of_other_modules_are_imported() -> None:
    violations = [
        f"{path.relative_to(SRC)} importa {module}"
        for path in package_files(PACKAGE)
        for module in imported_modules(path)
        if module.split(".")[0] in OTHERS and module not in ALLOWED_CROSS_MODULE
    ]
    assert not violations, violations


@pytest.mark.parametrize(
    "foreign",
    ["catalog", "customer_registry", "inventory", "workshop_configuration", "identity"],
)
def test_foreign_models_are_never_imported(foreign: str) -> None:
    allowed = {"identity.models"}
    for path in package_files(PACKAGE):
        forbidden = f"{foreign}.models"
        if forbidden in allowed:
            continue
        assert forbidden not in imported_modules(path), path


def test_no_foreign_sql_is_executed() -> None:
    offenders = []
    for path in package_files(PACKAGE):
        text = path.read_text(encoding="utf-8")
        touches_foreign_table = any(
            re.search(rf"(?i)\b(from|join|into|update)\s+\"?{marker}", text)
            for marker in SQL_MARKERS
        )
        if ("cursor(" in text or ".raw(" in text or "RunSQL" in text) and touches_foreign_table:
            offenders.append(str(path.relative_to(SRC)))
    assert not offenders, offenders


def test_only_sales_writes_its_persistence() -> None:
    offenders = []
    for path in SRC.rglob("*.py"):
        relative = path.relative_to(SRC)
        if relative.parts[0] == PACKAGE or "migrations" in path.parts:
            continue
        if f"{PACKAGE}.models" in imported_modules(path):
            offenders.append(str(relative))
    assert not offenders, offenders


def test_other_modules_never_import_sales() -> None:
    offenders = []
    for package in NOT_ALLOWED_TO_IMPORT_SALES:
        for path in package_files(package):
            if any(m.split(".")[0] == PACKAGE for m in imported_modules(path)):
                offenders.append(str(path.relative_to(SRC)))
    assert not offenders, offenders


def test_domain_rules_do_not_depend_on_framework_or_persistence() -> None:
    domain = SRC / PACKAGE / "domain"
    assert domain.is_dir()
    for path in domain.rglob("*.py"):
        modules = imported_modules(path)
        assert not {m.split(".")[0] for m in modules} & {"django", "rest_framework"}, path
        assert not any(m.endswith(".models") or ".application" in m for m in modules), path


LOCKING_INTERFACES = {
    "catalog.application.sales_references": {"lock_product_references"},
    "customer_registry.application.sales_references": {"lock_customer_reference"},
    "workshop_configuration.application.operation_context": {
        "lock_operation_context",
        "LockedOperationContext",
    },
}


def test_http_layer_never_handles_locking_interfaces_or_their_dtos() -> None:
    """Las variantes bloqueantes son internas al proceso; la capa HTTP no las importa."""
    offenders = []
    for path in SRC.rglob("*.py"):
        if "api" not in path.relative_to(SRC).parts:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module in LOCKING_INTERFACES:
                names = {alias.name for alias in node.names}
                if names & LOCKING_INTERFACES[node.module]:
                    offenders.append(str(path.relative_to(SRC)))
    assert not offenders, offenders
