"""Fronteras del taller: colabora mediante interfaces públicas sin mutar persistencia ajena."""

import ast
import re
from pathlib import Path

from django.apps import apps

SRC = Path(__file__).resolve().parents[2] / "src"
PACKAGE = "workshop"
OTHERS = {
    "identity",
    "customer_registry",
    "workshop_configuration",
    "catalog",
    "inventory",
    "purchasing",
    "sales",
    "shared",
    "supplier_registry",
}
ALLOWED_CROSS_MODULE = {
    "customer_registry.application.workshop_references",
    "catalog.application.workshop_references",
    "workshop_configuration.application.workshop_references",
    "sales.application.workshop_links",
    "shared.command_values",
    "shared.money",
    "shared.transactions",
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
    "sales_",
)
LOCKING_INTERFACES = {
    "customer_registry.application.workshop_references": {"lock_customer_and_vehicle"},
    "catalog.application.workshop_references": {"lock_service_reference"},
    "sales.application.workshop_links": {
        "add_linked_line",
        "change_linked_line",
        "lock_open_linked_sale",
        "remove_linked_line",
    },
    "workshop_configuration.application.workshop_references": {
        "allocate_artisan_number",
        "lock_artisan_operation_context",
    },
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


def test_no_other_module_imports_workshop() -> None:
    offenders = []
    for path in SRC.rglob("*.py"):
        relative = path.relative_to(SRC)
        if relative.parts[0] in {PACKAGE, "config"} or "migrations" in path.parts:
            continue
        if any(m.split(".")[0] == PACKAGE for m in imported_modules(path)):
            offenders.append(str(relative))
    assert not offenders, offenders


def test_domain_rules_do_not_depend_on_framework_or_persistence() -> None:
    domain = SRC / PACKAGE / "domain"
    assert domain.is_dir()
    for path in domain.rglob("*.py"):
        modules = imported_modules(path)
        assert not {m.split(".")[0] for m in modules} & {"django", "rest_framework"}, path
        assert not any(m.endswith(".models") or ".application" in m for m in modules), path


def test_http_layer_never_handles_locking_interfaces() -> None:
    offenders = []
    for path in (SRC / PACKAGE / "api").rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.ImportFrom)
                and node.module in LOCKING_INTERFACES
                and {alias.name for alias in node.names} & LOCKING_INTERFACES[node.module]
            ):
                offenders.append(str(path.relative_to(SRC)))
    assert not offenders, offenders
