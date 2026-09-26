"""Fronteras del núcleo fiscal independiente de HTTP, Django y proveedores."""

import ast
from pathlib import Path

from django.apps import apps

SRC = Path(__file__).resolve().parents[2] / "src"
PACKAGE = "fiscal"
OTHER_MODULES = {"identity", "sales", "shared", "workshop", "workshop_configuration"}
ALLOWED_CROSS_MODULES = {
    "identity.application.audit",
    "identity.application.authorization",
    "identity.models",
    "sales.application.fiscal_source",
    "shared.command_values",
    "shared.transactions",
    "workshop.application.fiscal_source",
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


def test_fiscal_application_is_registered() -> None:
    assert apps.get_app_config(PACKAGE).name == PACKAGE


def test_fiscal_domain_has_no_framework_http_or_provider_dependency() -> None:
    domain = SRC / PACKAGE / "domain"
    assert domain.is_dir()
    forbidden = {"django", "rest_framework", "requests", "httpx"}
    for path in domain.rglob("*.py"):
        modules = imported_modules(path)
        assert not {module.split(".")[0] for module in modules} & forbidden, path
        assert not any("provider" in module or "autorizador" in module for module in modules), path


def test_fiscal_domain_does_not_import_application_or_persistence() -> None:
    domain = SRC / PACKAGE / "domain"
    for path in domain.rglob("*.py"):
        modules = imported_modules(path)
        assert not any(
            module.endswith(".models")
            or ".application" in module
            or ".infrastructure" in module
            or ".api" in module
            for module in modules
        ), path


def test_fiscal_uses_only_published_cross_module_interfaces() -> None:
    violations = [
        f"{path.relative_to(SRC)} importa {module}"
        for path in (SRC / PACKAGE).rglob("*.py")
        if "migrations" not in path.parts
        for module in imported_modules(path)
        if module.split(".")[0] in OTHER_MODULES and module not in ALLOWED_CROSS_MODULES
    ]
    assert not violations, violations
