"""Pruebas TDD para servicios de impuestos, calendarios y sucesión prospectiva.

Trazabilidad: spec Requirements "Tarifas tributarias por entidad y vigencia",
"Vigencias tributarias no ambiguas", "Configuración tributaria histórica inmutable".
Design decisiones 4 (vigencias y sucesión prospectiva).
"""

from datetime import date, timedelta

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import Role
from identity.models import User, UserRole
from workshop_configuration.application.taxes import (
    StaleRecordError,
    SuccessionDateError,
    TaxDefinitionNotFoundError,
    TaxPeriodOverlapError,
    TaxPeriodUsedError,
    create_tax_definition,
    create_tax_period,
    get_tax_definition,
    list_tax_definitions,
    schedule_successor,
    update_tax_period,
)
from workshop_configuration.models import (
    ConfigurationUse,
    FiscalEntity,
    TaxDefinition,
    TaxPeriod,
    WorkshopConfiguration,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db: None) -> User:
    user = User.objects.create_user(username="tax-admin", password="password123")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    return user


@pytest.fixture
def seller(db: None) -> User:
    user = User.objects.create_user(username="tax-seller", password="password123")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    return user


@pytest.fixture
def comercial(db: None) -> FiscalEntity:
    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL",
        ruc="0991234567001",
        legal_name="Taller Comercial",
    )


@pytest.fixture
def tax_def(comercial: FiscalEntity, admin: User) -> TaxDefinition:
    return create_tax_definition(
        actor=admin,
        entity_id=comercial.pk,
        code="IVA",
        name="Impuesto al Valor Agregado",
    )


@pytest.fixture
def open_period(tax_def: TaxDefinition, admin: User) -> TaxPeriod:
    return create_tax_period(
        actor=admin,
        tax_definition_id=tax_def.pk,
        rate="15.0000",
        starts_on=date(2025, 1, 1),
        ends_on=None,
    )


# ---------------------------------------------------------------------------
# TaxDefinition
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_tax_definition_requires_permission(comercial: FiscalEntity, seller: User) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        create_tax_definition(
            actor=seller,
            entity_id=comercial.pk,
            code="IVA",
            name="IVA",
        )


@pytest.mark.django_db
def test_create_tax_definition_normalizes_code(admin: User, comercial: FiscalEntity) -> None:
    td = create_tax_definition(
        actor=admin,
        entity_id=comercial.pk,
        code="iva",
        name="IVA",
    )
    assert td.code == "IVA"


@pytest.mark.django_db
def test_create_tax_definition_rejects_duplicate_entity_code(
    admin: User, comercial: FiscalEntity
) -> None:
    create_tax_definition(actor=admin, entity_id=comercial.pk, code="IVA", name="IVA")
    with pytest.raises(Exception):  # IntegrityError o validación propia
        create_tax_definition(actor=admin, entity_id=comercial.pk, code="IVA", name="IVA 2")


@pytest.mark.django_db
def test_list_tax_definitions_requires_permission(seller: User, tax_def: TaxDefinition) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        list_tax_definitions(actor=seller, entity_id=tax_def.fiscal_entity_id)


@pytest.mark.django_db
def test_list_tax_definitions_returns_all_for_entity(
    admin: User, comercial: FiscalEntity, tax_def: TaxDefinition
) -> None:
    create_tax_definition(actor=admin, entity_id=comercial.pk, code="ICE", name="ICE")
    results = list_tax_definitions(actor=admin, entity_id=comercial.pk)
    assert len(results) == 2


@pytest.mark.django_db
def test_get_tax_definition_not_found(admin: User, db: None) -> None:
    with pytest.raises(TaxDefinitionNotFoundError):
        get_tax_definition(actor=admin, tax_definition_id=99999)


# ---------------------------------------------------------------------------
# TaxPeriod - creación y solapamiento
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_tax_period_stores_decimal_as_string(admin: User, tax_def: TaxDefinition) -> None:
    period = create_tax_period(
        actor=admin,
        tax_definition_id=tax_def.pk,
        rate="15.0000",
        starts_on=date(2025, 1, 1),
        ends_on=None,
    )
    assert str(period.rate) == "15.0000"
    assert period.starts_on == date(2025, 1, 1)
    assert period.ends_on is None


@pytest.mark.django_db
def test_create_tax_period_rejects_overlap(admin: User, open_period: TaxPeriod) -> None:
    """Solapamiento: nueva vigencia anterior al fin de la abierta."""
    tax_def_id = open_period.tax_definition_id
    with pytest.raises(TaxPeriodOverlapError):
        create_tax_period(
            actor=admin,
            tax_definition_id=tax_def_id,
            rate="12.0000",
            starts_on=date(2025, 6, 1),
            ends_on=None,
        )


@pytest.mark.django_db
def test_create_tax_period_accepts_adjacent_period(admin: User, tax_def: TaxDefinition) -> None:
    """Dos vigencias adyacentes (fin previo = inicio siguiente - 1 día) son válidas."""
    create_tax_period(
        actor=admin,
        tax_definition_id=tax_def.pk,
        rate="12.0000",
        starts_on=date(2024, 1, 1),
        ends_on=date(2024, 12, 31),
    )
    next_period = create_tax_period(
        actor=admin,
        tax_definition_id=tax_def.pk,
        rate="15.0000",
        starts_on=date(2025, 1, 1),
        ends_on=None,
    )
    assert next_period.starts_on == date(2025, 1, 1)


@pytest.mark.django_db
def test_create_tax_period_rejects_invalid_rate(admin: User, tax_def: TaxDefinition) -> None:
    from workshop_configuration.domain.validation import ConfigurationValidationError

    with pytest.raises(ConfigurationValidationError):
        create_tax_period(
            actor=admin,
            tax_definition_id=tax_def.pk,
            rate="150",  # > 100
            starts_on=date(2025, 1, 1),
        )


@pytest.mark.django_db
def test_create_tax_period_requires_permission(seller: User, tax_def: TaxDefinition) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        create_tax_period(
            actor=seller,
            tax_definition_id=tax_def.pk,
            rate="15.0000",
            starts_on=date(2025, 1, 1),
        )


# ---------------------------------------------------------------------------
# TaxPeriod - actualización (solo no utilizados)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_tax_period_accepts_not_used(admin: User, open_period: TaxPeriod) -> None:
    updated = update_tax_period(
        actor=admin,
        period_id=open_period.pk,
        expected_version=open_period.version,
        rate="12.5000",
    )
    assert str(updated.rate) == "12.5000"
    assert updated.version == open_period.version + 1


@pytest.mark.django_db
def test_update_tax_period_rejects_stale_version(admin: User, open_period: TaxPeriod) -> None:
    with pytest.raises(StaleRecordError):
        update_tax_period(
            actor=admin,
            period_id=open_period.pk,
            expected_version=99,
            rate="12.5000",
        )


@pytest.mark.django_db
def test_update_tax_period_rejects_if_used(admin: User, open_period: TaxPeriod) -> None:
    """Una vigencia utilizada no puede editarse genericamente."""
    ConfigurationUse.objects.create(
        tax_period=open_period,
        consumer_type="test",
        consumer_id="test-001",
        operation_date=date(2025, 3, 1),
        entity_type_snapshot="COMERCIAL",
        ruc_snapshot="0991234567001",
        legal_name_snapshot="Taller Comercial",
        tax_code_snapshot="IVA",
        tax_name_snapshot="IVA",
        rate_snapshot=open_period.rate,
        period_start_snapshot=open_period.starts_on,
        period_end_snapshot=open_period.ends_on,
    )
    with pytest.raises(TaxPeriodUsedError):
        update_tax_period(
            actor=admin,
            period_id=open_period.pk,
            expected_version=open_period.version,
            rate="12.5000",
        )
    reloaded = TaxPeriod.objects.get(pk=open_period.pk)
    assert reloaded.rate == open_period.rate


# ---------------------------------------------------------------------------
# schedule_successor - sucesión prospectiva
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_schedule_successor_creates_successor_and_closes_predecessor(
    admin: User, open_period: TaxPeriod
) -> None:
    """Sucesión válida: cierra la vigencia abierta y crea la sucesora atómicamente."""
    successor_start = date.today() + timedelta(days=30)
    successor = schedule_successor(
        actor=admin,
        period_id=open_period.pk,
        expected_version=open_period.version,
        new_rate="12.0000",
        successor_starts_on=successor_start,
    )
    predecessor = TaxPeriod.objects.get(pk=open_period.pk)
    # El predecesor debe haberse cerrado el día anterior al inicio del sucesor
    assert predecessor.ends_on == successor_start - timedelta(days=1)
    assert successor.starts_on == successor_start
    assert successor.ends_on is None
    assert str(successor.rate) == "12.0000"
    assert TaxPeriod.objects.filter(tax_definition_id=open_period.tax_definition_id).count() == 2


@pytest.mark.django_db
def test_schedule_successor_rejects_past_date(admin: User, open_period: TaxPeriod) -> None:
    """Fecha pasada rechazada."""
    with pytest.raises(SuccessionDateError):
        schedule_successor(
            actor=admin,
            period_id=open_period.pk,
            expected_version=open_period.version,
            new_rate="12.0000",
            successor_starts_on=date.today() - timedelta(days=1),
        )
    # Predecesor sin cambios
    predecessor = TaxPeriod.objects.get(pk=open_period.pk)
    assert predecessor.ends_on is None


@pytest.mark.django_db
def test_schedule_successor_rejects_date_before_last_use(
    admin: User, open_period: TaxPeriod
) -> None:
    """El inicio sucesor debe ser posterior a toda fecha de uso existente."""
    recent_use = date.today() + timedelta(days=10)
    ConfigurationUse.objects.create(
        tax_period=open_period,
        consumer_type="test",
        consumer_id="test-002",
        operation_date=recent_use,
        entity_type_snapshot="COMERCIAL",
        ruc_snapshot="0991234567001",
        legal_name_snapshot="Taller Comercial",
        tax_code_snapshot="IVA",
        tax_name_snapshot="IVA",
        rate_snapshot=open_period.rate,
        period_start_snapshot=open_period.starts_on,
        period_end_snapshot=open_period.ends_on,
    )
    # Intentar con inicio que no supera la fecha de uso
    with pytest.raises(SuccessionDateError):
        schedule_successor(
            actor=admin,
            period_id=open_period.pk,
            expected_version=open_period.version,
            new_rate="12.0000",
            successor_starts_on=recent_use,  # mismo día del uso, no posterior
        )
    predecessor = TaxPeriod.objects.get(pk=open_period.pk)
    assert predecessor.ends_on is None


@pytest.mark.django_db
def test_schedule_successor_rejects_stale_version(admin: User, open_period: TaxPeriod) -> None:
    with pytest.raises(StaleRecordError):
        schedule_successor(
            actor=admin,
            period_id=open_period.pk,
            expected_version=99,
            new_rate="12.0000",
            successor_starts_on=date.today() + timedelta(days=10),
        )


@pytest.mark.django_db
def test_schedule_successor_requires_permission(seller: User, open_period: TaxPeriod) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        schedule_successor(
            actor=seller,
            period_id=open_period.pk,
            expected_version=open_period.version,
            new_rate="12.0000",
            successor_starts_on=date.today() + timedelta(days=30),
        )


@pytest.mark.django_db(transaction=True)
def test_two_concurrent_successions_only_one_succeeds(admin: User, open_period: TaxPeriod) -> None:
    """Dos sucesiones concurrentes serializadas: solo la primera tiene éxito."""
    import threading

    results: list[Exception | TaxPeriod] = []

    def attempt_succession() -> None:
        try:
            result = schedule_successor(
                actor=admin,
                period_id=open_period.pk,
                expected_version=open_period.version,
                new_rate="12.0000",
                successor_starts_on=date.today() + timedelta(days=30),
            )
            results.append(result)
        except Exception as exc:
            results.append(exc)

    t1 = threading.Thread(target=attempt_succession)
    t2 = threading.Thread(target=attempt_succession)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    successes = [r for r in results if isinstance(r, TaxPeriod)]
    failures = [r for r in results if isinstance(r, Exception)]
    assert len(successes) == 1
    assert len(failures) == 1
    # Solo dos vigencias: la original cerrada y la nueva
    assert TaxPeriod.objects.filter(tax_definition_id=open_period.tax_definition_id).count() == 2
