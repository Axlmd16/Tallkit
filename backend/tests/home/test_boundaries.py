"""Fronteras del inicio: compone lecturas publicadas y no tiene datos propios."""

import ast
from pathlib import Path

from django.apps import apps

SRC = Path(__file__).resolve().parents[2] / "src"
PACKAGE = "home"
OTHERS = {
    "catalog",
    "customer_registry",
    "fiscal",
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
    "customer_registry.application.home_summary",
    "identity.models",
    "proformas.application.home_summary",
    "sales.application.home_summary",
    "workshop.application.home_summary",
    "workshop_configuration.application.home_summary",
}


def package_files() -> list[Path]:
    return list((SRC / PACKAGE).rglob("*.py"))


def imported_modules(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            found.add(node.module)
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
    return found


def test_application_is_installed() -> None:
    assert apps.get_app_config(PACKAGE).name == PACKAGE


def test_home_has_no_models_nor_migrations() -> None:
    assert list(apps.get_app_config(PACKAGE).get_models()) == []
    assert not (SRC / PACKAGE / "migrations").exists()
    assert not (SRC / PACKAGE / "models.py").exists()


def test_only_published_summaries_of_other_modules_are_imported() -> None:
    violations = [
        f"{path.relative_to(SRC)} importa {module}"
        for path in package_files()
        for module in imported_modules(path)
        if module.split(".")[0] in OTHERS and module not in ALLOWED_CROSS_MODULE
    ]
    assert not violations, violations


def test_no_other_module_imports_home() -> None:
    offenders = []
    for path in SRC.rglob("*.py"):
        relative = path.relative_to(SRC)
        if relative.parts[0] in {PACKAGE, "config"}:
            continue
        if any(module.split(".")[0] == PACKAGE for module in imported_modules(path)):
            offenders.append(str(relative))
    assert not offenders, offenders


def test_home_never_writes_nor_runs_sql_on_business_tables() -> None:
    for path in package_files():
        text = path.read_text(encoding="utf-8")
        for marker in (".save(", ".create(", ".update(", ".delete(", "bulk_", ".raw("):
            assert marker not in text, f"{path.relative_to(SRC)} usa {marker}"
