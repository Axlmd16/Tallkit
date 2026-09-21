import inspect
import sys

from django.apps import apps


def test_customer_registry_app_is_registered() -> None:
    app_config = apps.get_app_config("customer_registry")
    assert app_config.name == "customer_registry"


def test_customer_registry_does_not_mutate_identity_persistence_directly() -> None:
    """Verifica que el módulo de clientes y vehículos no contenga escrituras directas

    sobre modelos de persistencia de identity (debe usar servicios públicos de auditoría).
    """
    import customer_registry

    module_files = []
    prefix = customer_registry.__name__
    for mod_name, mod in list(sys.modules.items()):
        if mod_name.startswith(prefix) and mod and hasattr(mod, "__file__") and mod.__file__:
            module_files.append(mod)

    for mod in module_files:
        source = inspect.getsource(mod)
        assert "User.objects.create" not in source
        assert "AuditEvent.objects.create" not in source
        assert "RoleAssignment.objects.create" not in source


def test_only_published_customer_interfaces_are_imported_by_other_modules() -> None:
    """Otros módulos consumen clientes solo mediante sus interfaces públicas de referencia."""
    import ast
    from pathlib import Path

    src = Path(__file__).resolve().parents[2] / "src"
    published = {
        "customer_registry.application.catalog_references",
        "customer_registry.application.sales_references",
        "customer_registry.domain.identification",
    }
    # Dependencia previa al módulo comercial: la FK de marcas del catálogo.
    existing = {("catalog/models.py", "customer_registry.models")}
    offenders: list[str] = []
    for path in src.rglob("*.py"):
        relative = path.relative_to(src)
        if relative.parts[0] == "customer_registry" or "migrations" in path.parts:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            module = getattr(node, "module", None) if isinstance(node, ast.ImportFrom) else None
            if (
                module
                and module.startswith("customer_registry")
                and module not in published
                and (str(relative), module) not in existing
            ):
                offenders.append(f"{relative} importa {module}")
    assert not offenders, offenders


def test_sales_references_interface_never_writes_customer_persistence() -> None:
    from pathlib import Path

    import customer_registry.application.sales_references as interface

    source = Path(interface.__file__).read_text(encoding="utf-8")
    for write in (".save(", ".create(", ".update(", ".delete(", "bulk_", "get_or_create"):
        assert write not in source, write
