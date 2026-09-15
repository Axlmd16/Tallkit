"""Pruebas de integración de auditoría y autorización en servicios de workshop_configuration.

Verifica que:
- Éxitos dejan AuditEvent con result=SUCCESS dentro de la misma transacción.
- Rechazos dejan AuditEvent con result=DENIED/FAILURE después del rollback.
- Metadatos no contienen RUC ni cuerpos completos.
- Roles acumulados (Administrador con múltiples roles) tienen acceso correcto.
- Denegaciones están documentadas en el registro de auditoría.

Trazabilidad: spec "Auditoría de cambios de configuración", design decisión 6.
"""

import pytest

from identity.domain.authorization import Role
from identity.models import AuditEvent, AuditResult, User, UserRole
from workshop_configuration.application.entity_warehouse import (
    FiscalEntityTypeImmutableError,
    update_fiscal_entity,
    update_warehouse,
)
from workshop_configuration.application.initialization import (
    initialize_workshop,
)
from workshop_configuration.application.taxes import (
    create_tax_definition,
    create_tax_period,
)
from workshop_configuration.models import (
    FiscalEntity,
    Warehouse,
    WorkshopConfiguration,
)

from datetime import date


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db: None) -> User:
    user = User.objects.create_user(username="audit-admin", password="password123")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    return user


@pytest.fixture
def seller(db: None) -> User:
    user = User.objects.create_user(username="audit-seller", password="password123")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    return user


@pytest.fixture
def multi_role_admin(db: None) -> User:
    """Usuario con Administrador + Encargado de taller (roles acumulados)."""
    user = User.objects.create_user(username="multi-admin", password="password123")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    UserRole.objects.create(user=user, role=Role.ENCARGADO_TALLER)
    return user


@pytest.fixture
def initialized(db: None) -> dict[str, object]:
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
# Auditoría en inicialización
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_initialize_workshop_creates_audit_event_on_success(admin: User) -> None:
    initialize_workshop(
        actor=admin,
        commercial_ruc="0991234567001",
        commercial_legal_name="Taller Comercial",
        artisanal_ruc="1791234567001",
        artisanal_legal_name="Taller Artesanal",
        warehouse_name="Bodega principal",
        idempotency_key="audit-init-001",
    )
    events = AuditEvent.objects.filter(
        actor=admin,
        action="workshop_configuration.initialize",
        result=AuditResult.SUCCESS,
    )
    assert events.count() == 1
    # Metadatos no deben contener RUC
    metadata = events.first().metadata
    for value in metadata.values():
        assert "099" not in str(value)
        assert "179" not in str(value)


@pytest.mark.django_db
def test_initialize_workshop_creates_audit_event_on_permission_denial(seller: User) -> None:
    from identity.application.authorization import BusinessPermissionDeniedError

    with pytest.raises(BusinessPermissionDeniedError):
        initialize_workshop(
            actor=seller,
            commercial_ruc="0991234567001",
            commercial_legal_name="Taller Comercial",
            artisanal_ruc="1791234567001",
            artisanal_legal_name="Taller Artesanal",
            warehouse_name="Bodega principal",
            idempotency_key="audit-init-seller-001",
        )
    # Debe existir un evento de denegación
    denial_events = AuditEvent.objects.filter(
        actor=seller,
        result=AuditResult.DENIED,
    )
    assert denial_events.count() >= 1


# ---------------------------------------------------------------------------
# Auditoría en actualización de entidades
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_entity_creates_audit_on_success(admin: User, initialized: dict) -> None:
    update_fiscal_entity(
        actor=admin,
        entity_id=initialized["comercial_id"],
        expected_version=1,
        legal_name="Nombre actualizado",
    )
    events = AuditEvent.objects.filter(
        actor=admin,
        action="workshop_configuration.fiscal_entity_updated",
        result=AuditResult.SUCCESS,
    )
    assert events.count() == 1
    metadata = events.first().metadata
    assert "legal_name" in metadata.get("changed_fields", [])


@pytest.mark.django_db
def test_update_entity_type_creates_failure_audit(admin: User, initialized: dict) -> None:
    with pytest.raises(FiscalEntityTypeImmutableError):
        update_fiscal_entity(
            actor=admin,
            entity_id=initialized["comercial_id"],
            expected_version=1,
            entity_type="ARTESANAL",
        )
    failure_events = AuditEvent.objects.filter(
        actor=admin,
        action="workshop_configuration.fiscal_entity_update_rejected",
        result=AuditResult.FAILURE,
    )
    assert failure_events.count() == 1


# ---------------------------------------------------------------------------
# Roles acumulados (multi_role_admin)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_multi_role_admin_can_update_warehouse(
    multi_role_admin: User, initialized: dict
) -> None:
    """Usuario con roles acumulados tiene permisos administrativos."""
    wh = update_warehouse(
        actor=multi_role_admin,
        expected_version=1,
        name="Bodega actualizada",
    )
    assert wh.name == "Bodega actualizada"
    events = AuditEvent.objects.filter(
        actor=multi_role_admin,
        action="workshop_configuration.warehouse_updated",
        result=AuditResult.SUCCESS,
    )
    assert events.count() == 1


# ---------------------------------------------------------------------------
# Auditoría de impuestos
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_tax_definition_creates_audit(admin: User, initialized: dict) -> None:
    td = create_tax_definition(
        actor=admin,
        entity_id=initialized["comercial_id"],
        code="IVA",
        name="IVA",
    )
    events = AuditEvent.objects.filter(
        actor=admin,
        action="workshop_configuration.tax_definition_created",
        result=AuditResult.SUCCESS,
        target_id=str(td.pk),
    )
    assert events.count() == 1


@pytest.mark.django_db
def test_create_tax_period_permission_denial_audited(
    seller: User, initialized: dict, admin: User
) -> None:
    """Denegación al crear período: auditada correctamente."""
    from identity.application.authorization import BusinessPermissionDeniedError

    td = create_tax_definition(
        actor=admin,
        entity_id=initialized["comercial_id"],
        code="IVA",
        name="IVA",
    )
    with pytest.raises(BusinessPermissionDeniedError):
        create_tax_period(
            actor=seller,
            tax_definition_id=td.pk,
            rate="15.0000",
            starts_on=date(2025, 1, 1),
        )
    denial_events = AuditEvent.objects.filter(
        actor=seller,
        result=AuditResult.DENIED,
    )
    assert denial_events.count() >= 1
