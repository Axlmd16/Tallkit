"""Fronteras del módulo de inventario: propietario único de posiciones y movimientos."""

import ast
import re
from pathlib import Path

import pytest
from django.apps import apps

SRC = Path(__file__).resolve().parents[2] / "src"
PACKAGE = "inventory"
OTHERS = {
    "identity",
    "customer_registry",
    "workshop_configuration",
    "catalog",
    "supplier_registry",
    "purchasing",
}
ALLOWED_CROSS_MODULE = {
    "catalog.application.inventory_references",
    "workshop_configuration.application.operation_context",
    "identity.api.permissions",
    "identity.api.request_context",
    "identity.application.audit",
    "identity.application.authorization",
    "identity.models",
}
SQL_MARKERS = ("purchasing_", "catalog_", "supplier_registry_", "workshop_configuration_")


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


def test_inventory_never_depends_on_purchasing() -> None:
    for path in package_files(PACKAGE):
        assert not any(m.split(".")[0] == "purchasing" for m in imported_modules(path)), path


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


@pytest.mark.parametrize("foreign", ["catalog", "supplier_registry", "workshop_configuration"])
def test_foreign_models_are_never_imported(foreign: str) -> None:
    for path in package_files(PACKAGE):
        assert f"{foreign}.models" not in imported_modules(path), path


def test_only_inventory_writes_its_persistence() -> None:
    offenders = []
    for path in SRC.rglob("*.py"):
        relative = path.relative_to(SRC)
        if relative.parts[0] == PACKAGE or "migrations" in path.parts:
            continue
        if "inventory.models" in imported_modules(path):
            offenders.append(str(relative))
    assert not offenders, offenders


def test_domain_rules_do_not_depend_on_framework_or_persistence() -> None:
    domain = SRC / PACKAGE / "domain"
    for path in domain.rglob("*.py") if domain.exists() else []:
        modules = imported_modules(path)
        assert not {m.split(".")[0] for m in modules} & {"django", "rest_framework"}, path
        assert not any(m.endswith(".models") or ".application" in m for m in modules), path
