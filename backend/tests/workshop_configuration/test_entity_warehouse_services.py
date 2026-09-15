"""Pruebas de servicios de consulta y actualización de entidades y bodega.

Trazabilidad: spec Requirement "Dos entidades fiscales obligatorias y diferenciadas",
"Historia de los datos fiscales", "Bodega única de V1".
"""

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import Role
from identity.models import User, UserRole
from workshop_configuration.application.entity_warehouse import (
    FiscalEntityNotFoundError,
    FiscalEntityTypeImmutableError,
    StaleRecordError,
    WarehouseNotFoundError,
    get_fiscal_entity,
    get_warehouse,
    list_fiscal_entities,
    update_fiscal_entity,
    update_warehouse,
)
from workshop_configuration.models import (
    FiscalEntity,
    Warehouse,
    WorkshopConfiguration,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db: None) -> User:
    user = User.objects.create_user(username="ew-admin", password="password123")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    return user


@pytest.fixture
def seller(db: None) -> User:
    user = User.objects.create_user(username="ew-seller", password="password123")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    return user


@pytest.fixture
def initialized(db: None) -> dict[str, object]:
    """Crea la configuración mínima inicializada (sin usar el servicio de app)."""
    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    comercial = FiscalEntity.objects.create(
        entity_type="COMERCIAL",
        ruc="0991234567001",
        legal_name="Taller Comercial",
    )
    artesanal = FiscalEntity.objects.create(
        entity_type="ARTESANAL",
        ruc="1791234567001",
        legal_name="Taller Artesanal",
    )
    warehouse = Warehouse.objects.create(pk=1, name="Bodega principal")
    return {
        "comercial_id": comercial.pk,
        "artesanal_id": artesanal.pk,
        "warehouse_id": warehouse.pk,
    }


# ---------------------------------------------------------------------------
# Consultas de entidades fiscales
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_fiscal_entities_requires_permission(seller: User, initialized: dict) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        list_fiscal_entities(actor=seller)


@pytest.mark.django_db
def test_list_fiscal_entities_returns_both(admin: User, initialized: dict) -> None:
    entities = list_fiscal_entities(actor=admin)
    assert len(entities) == 2
    types = {e.entity_type for e in entities}
    assert types == {"COMERCIAL", "ARTESANAL"}


@pytest.mark.django_db
def test_get_fiscal_entity_requires_permission(seller: User, initialized: dict) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        get_fiscal_entity(actor=seller, entity_id=initialized["comercial_id"])


@pytest.mark.django_db
def test_get_fiscal_entity_returns_correct_record(admin: User, initialized: dict) -> None:
    entity = get_fiscal_entity(actor=admin, entity_id=initialized["comercial_id"])
    assert entity.entity_type == "COMERCIAL"
    assert entity.ruc == "0991234567001"


@pytest.mark.django_db
def test_get_fiscal_entity_raises_not_found(admin: User, db: None) -> None:
    with pytest.raises(FiscalEntityNotFoundError):
        get_fiscal_entity(actor=admin, entity_id=99999)


# ---------------------------------------------------------------------------
# Actualización de entidades fiscales
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_fiscal_entity_requires_edit_permission(
    seller: User, initialized: dict
) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        update_fiscal_entity(
            actor=seller,
            entity_id=initialized["comercial_id"],
            expected_version=1,
            legal_name="Nuevo nombre",
        )


@pytest.mark.django_db
def test_update_fiscal_entity_changes_legal_name(admin: User, initialized: dict) -> None:
    entity = update_fiscal_entity(
        actor=admin,
        entity_id=initialized["comercial_id"],
        expected_version=1,
        legal_name="Nombre actualizado",
    )
    assert entity.legal_name == "Nombre actualizado"
    assert entity.version == 2
    # Releer para confirmar persistencia
    reloaded = FiscalEntity.objects.get(pk=initialized["comercial_id"])
    assert reloaded.legal_name == "Nombre actualizado"


@pytest.mark.django_db
def test_update_fiscal_entity_rejects_stale_version(admin: User, initialized: dict) -> None:
    with pytest.raises(StaleRecordError):
        update_fiscal_entity(
            actor=admin,
            entity_id=initialized["comercial_id"],
            expected_version=99,
            legal_name="Nombre actualizado",
        )
    # El dato no debió cambiar
    entity = FiscalEntity.objects.get(pk=initialized["comercial_id"])
    assert entity.legal_name == "Taller Comercial"


@pytest.mark.django_db
def test_update_fiscal_entity_rejects_type_change(admin: User, initialized: dict) -> None:
    """El tipo fiscal es inmutable (Scenario: Intento de cambiar el tipo fiscal)."""
    with pytest.raises(FiscalEntityTypeImmutableError):
        update_fiscal_entity(
            actor=admin,
            entity_id=initialized["comercial_id"],
            expected_version=1,
            entity_type="ARTESANAL",
        )
    entity = FiscalEntity.objects.get(pk=initialized["comercial_id"])
    assert entity.entity_type == "COMERCIAL"


@pytest.mark.django_db
def test_update_fiscal_entity_rejects_duplicate_ruc(admin: User, initialized: dict) -> None:
    """El RUC actualizado no puede ser igual al de la otra entidad."""
    from workshop_configuration.domain.validation import ConfigurationValidationError

    with pytest.raises(ConfigurationValidationError):
        update_fiscal_entity(
            actor=admin,
            entity_id=initialized["comercial_id"],
            expected_version=1,
            ruc="1791234567001",  # ya pertenece a la artesanal
        )
    entity = FiscalEntity.objects.get(pk=initialized["comercial_id"])
    assert entity.ruc == "0991234567001"


@pytest.mark.django_db
def test_update_fiscal_entity_no_deletion(admin: User, initialized: dict) -> None:
    """No debe existir operación de borrado de entidades fiscales."""
    # Simplemente verificamos que la función no existe en el módulo de aplicación
    from workshop_configuration import application as app_pkg
    import pkgutil

    app_files = [
        name
        for _, name, _ in pkgutil.iter_modules(app_pkg.__path__)
    ]
    # El módulo no debe exponer ninguna función de borrado en entity_warehouse
    from workshop_configuration.application import entity_warehouse as ew

    assert not hasattr(ew, "delete_fiscal_entity")
    assert not hasattr(ew, "deactivate_fiscal_entity")


# ---------------------------------------------------------------------------
# Consulta y actualización de bodega
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_warehouse_requires_permission(seller: User, initialized: dict) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        get_warehouse(actor=seller)


@pytest.mark.django_db
def test_get_warehouse_returns_correct_record(admin: User, initialized: dict) -> None:
    wh = get_warehouse(actor=admin)
    assert wh.name == "Bodega principal"
    assert wh.is_active is True


@pytest.mark.django_db
def test_get_warehouse_raises_not_found_when_no_data(admin: User, db: None) -> None:
    with pytest.raises(WarehouseNotFoundError):
        get_warehouse(actor=admin)


@pytest.mark.django_db
def test_update_warehouse_changes_name(admin: User, initialized: dict) -> None:
    wh = update_warehouse(
        actor=admin,
        expected_version=1,
        name="Depósito central",
    )
    assert wh.name == "Depósito central"
    assert wh.version == 2
    reloaded = Warehouse.objects.get(pk=1)
    assert reloaded.name == "Depósito central"


@pytest.mark.django_db
def test_update_warehouse_requires_permission(seller: User, initialized: dict) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        update_warehouse(actor=seller, expected_version=1, name="Depósito central")


@pytest.mark.django_db
def test_update_warehouse_rejects_stale_version(admin: User, initialized: dict) -> None:
    with pytest.raises(StaleRecordError):
        update_warehouse(actor=admin, expected_version=99, name="Depósito central")
    wh = Warehouse.objects.get(pk=1)
    assert wh.name == "Bodega principal"


@pytest.mark.django_db
def test_update_warehouse_rejects_blank_name(admin: User, initialized: dict) -> None:
    from workshop_configuration.domain.validation import ConfigurationValidationError

    with pytest.raises(ConfigurationValidationError):
        update_warehouse(actor=admin, expected_version=1, name="   ")
    wh = Warehouse.objects.get(pk=1)
    assert wh.name == "Bodega principal"


@pytest.mark.django_db
def test_warehouse_no_deactivation(admin: User, initialized: dict) -> None:
    """No debe existir operación de desactivación de bodega."""
    from workshop_configuration.application import entity_warehouse as ew

    assert not hasattr(ew, "deactivate_warehouse")
    assert not hasattr(ew, "delete_warehouse")
