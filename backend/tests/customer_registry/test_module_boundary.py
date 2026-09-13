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
