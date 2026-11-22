"""Fronteras del orquestador checkout: solo importa servicios públicos, sin modelos ajenos."""

import ast
from pathlib import Path

from django.apps import apps

SRC = Path(__file__).resolve().parents[2] / "src"
PACKAGE = "checkout"
OTHERS = {
    "catalog",
    "customer_registry",
    "fiscal",
    "home",
    "identity",
    "inventory",
    "proformas",
    "purchasing",
    "sales",
    "supplier_registry",
    "workshop",
    "workshop_configuration",
}
ALLOWED_CROSS_MODULE = {
    "customer_registry.application.workshop_references",
    "fiscal.application.preparations",
    "identity.application.authorization",
    "identity.models",
    "sales.application",
    "sales.application.errors",
    "sales.application.payments",
    "sales.application.reviews",
    "sales.application.sales",
    "workshop.application",
    "workshop.application.artisan_payments",
    "workshop.application.economic_summary",
    "workshop.application.errors",
    "workshop.application.queries",
    "workshop.application.service_operations",
    "workshop.application.transitions",
    "workshop_configuration.application.brand",
    "workshop_configuration.application.electronic_status",
    "workshop_configuration.application.withholding_settings",
}


def package_files() -> list[Path]:
    return [p for p in (SRC / PACKAGE).rglob("*.py") if "migrations" not in p.parts]


def imported_modules(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            found.add(node.module)
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
    return found


def test_checkout_application_is_registered() -> None:
    assert apps.get_app_config(PACKAGE).name == PACKAGE


def test_checkout_imports_only_published_application_services() -> None:
    violations = [
        f"{path.relative_to(SRC)} importa {module}"
        for path in package_files()
        for module in imported_modules(path)
        if module.split(".")[0] in OTHERS and module not in ALLOWED_CROSS_MODULE
    ]
    assert not violations, violations


def test_no_other_module_imports_checkout() -> None:
    offenders = [
        str(path.relative_to(SRC))
        for path in SRC.rglob("*.py")
        if path.relative_to(SRC).parts[0] not in {PACKAGE, "config"}
        and any(module.split(".")[0] == PACKAGE for module in imported_modules(path))
    ]
    assert not offenders, offenders
