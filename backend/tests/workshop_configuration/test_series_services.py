"""Pruebas TDD para servicios de series de numeración.

Trazabilidad: spec Requirements "Ciclo de vida controlado de las series",
"Series internas iniciales de V1", "Formato visible del número interno".
Design decisión 5 (numeración y transacción del consumidor).
"""

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import Role
from identity.models import User, UserRole
from workshop_configuration.application.series import (
    DocumentSeriesNotFoundError,
    SeriesAlreadyUsedError,
    SeriesScopeConflictError,
    StaleRecordError,
    get_document_series,
    list_document_series,
    replace_series,
    update_series_code,
)
from workshop_configuration.models import (
    DocumentSeries,
    FiscalEntity,
    NumberAllocation,
    NumberingScope,
    WorkshopConfiguration,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db: None) -> User:
    user = User.objects.create_user(username="series-admin", password="password123")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    return user


@pytest.fixture
def seller(db: None) -> User:
    user = User.objects.create_user(username="series-seller", password="password123")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    return user


@pytest.fixture
def scope_and_series(db: None) -> dict[str, object]:
    """Crea un ámbito y una serie activa sin uso."""
    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL",
        ruc="0991234567001",
        legal_name="Taller Comercial",
    )
    scope = NumberingScope.objects.create(
        fiscal_entity=entity,
        document_type="VENTA",
    )
    series = DocumentSeries.objects.create(
        numbering_scope=scope,
        code="COM-VEN",
        is_active=True,
        last_number=0,
    )
    return {"scope": scope, "series": series, "entity": entity}


@pytest.fixture
def used_series(scope_and_series: dict) -> DocumentSeries:
    """Serie con un número ya asignado (last_number > 0)."""
    series: DocumentSeries = scope_and_series["series"]
    series.last_number = 1
    series.save()
    # Crear también una asignación real
    NumberAllocation.objects.create(
        numbering_scope=scope_and_series["scope"],
        series=series,
        number=1,
        consumer_type="test",
        consumer_id="test-001",
        request_key="rk-001",
        request_fingerprint="a" * 64,
        visible_number="COM-VEN-000001",
    )
    return series


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_series_requires_permission(seller: User, scope_and_series: dict) -> None:
    scope: NumberingScope = scope_and_series["scope"]
    with pytest.raises(BusinessPermissionDeniedError):
        list_document_series(actor=seller, scope_id=scope.pk)


@pytest.mark.django_db
def test_list_series_returns_active(admin: User, scope_and_series: dict) -> None:
    scope: NumberingScope = scope_and_series["scope"]
    results = list_document_series(actor=admin, scope_id=scope.pk)
    assert len(results) == 1
    assert results[0].code == "COM-VEN"


@pytest.mark.django_db
def test_get_series_not_found(admin: User, db: None) -> None:
    with pytest.raises(DocumentSeriesNotFoundError):
        get_document_series(actor=admin, series_id=99999)


# ---------------------------------------------------------------------------
# Edición previa al uso
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_code_before_use(admin: User, scope_and_series: dict) -> None:
    """Código editable mientras last_number == 0."""
    series: DocumentSeries = scope_and_series["series"]
    updated = update_series_code(
        actor=admin,
        series_id=series.pk,
        expected_version=series.version,
        code="COM-NEW",
    )
    assert updated.code == "COM-NEW"
    assert updated.version == series.version + 1


@pytest.mark.django_db
def test_update_code_rejects_after_first_use(admin: User, used_series: DocumentSeries) -> None:
    """Código bloqueado después del primer uso."""
    with pytest.raises(SeriesAlreadyUsedError):
        update_series_code(
            actor=admin,
            series_id=used_series.pk,
            expected_version=used_series.version,
            code="COM-NEW",
        )
    reloaded = DocumentSeries.objects.get(pk=used_series.pk)
    assert reloaded.code == "COM-VEN"


@pytest.mark.django_db
def test_update_code_rejects_stale_version(admin: User, scope_and_series: dict) -> None:
    series: DocumentSeries = scope_and_series["series"]
    with pytest.raises(StaleRecordError):
        update_series_code(
            actor=admin,
            series_id=series.pk,
            expected_version=99,
            code="COM-NEW",
        )


@pytest.mark.django_db
def test_update_code_rejects_duplicate_code(admin: User, scope_and_series: dict) -> None:
    """El código de serie es global único."""
    scope: NumberingScope = scope_and_series["scope"]
    entity: FiscalEntity = scope_and_series["entity"]
    # Crear otra serie con el código que queremos usar
    scope2 = NumberingScope.objects.create(
        fiscal_entity=entity,
        document_type="PROFORMA",
    )
    DocumentSeries.objects.create(
        numbering_scope=scope2,
        code="COM-PRO",
        is_active=True,
        last_number=0,
    )
    series: DocumentSeries = scope_and_series["series"]
    with pytest.raises(Exception):  # IntegrityError o SeriesScopeConflictError
        update_series_code(
            actor=admin,
            series_id=series.pk,
            expected_version=series.version,
            code="COM-PRO",  # ya existe
        )


@pytest.mark.django_db
def test_update_code_requires_permission(seller: User, scope_and_series: dict) -> None:
    series: DocumentSeries = scope_and_series["series"]
    with pytest.raises(BusinessPermissionDeniedError):
        update_series_code(
            actor=seller,
            series_id=series.pk,
            expected_version=series.version,
            code="COM-NEW",
        )


# ---------------------------------------------------------------------------
# Sustitución atómica
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_replace_series_creates_successor_and_deactivates_predecessor(
    admin: User, used_series: DocumentSeries
) -> None:
    """Sustitución: predecesor desactivado, sucesora activa, solo una activa por ámbito."""
    successor = replace_series(
        actor=admin,
        series_id=used_series.pk,
        expected_version=used_series.version,
        new_code="COM-VEN-2",
    )
    predecessor = DocumentSeries.objects.get(pk=used_series.pk)
    assert predecessor.is_active is False
    assert successor.is_active is True
    assert successor.code == "COM-VEN-2"
    assert successor.last_number == 0
    # Solo una activa por ámbito
    active_count = DocumentSeries.objects.filter(
        numbering_scope=used_series.numbering_scope, is_active=True
    ).count()
    assert active_count == 1


@pytest.mark.django_db
def test_replace_series_rejects_reused_prefix(admin: User, used_series: DocumentSeries) -> None:
    """Un prefijo retirado no puede reutilizarse."""
    replace_series(
        actor=admin,
        series_id=used_series.pk,
        expected_version=used_series.version,
        new_code="COM-VEN-2",
    )
    # El código COM-VEN ya está retirado; intentar usarlo de nuevo debe fallar
    successor = DocumentSeries.objects.get(
        is_active=True, numbering_scope=used_series.numbering_scope
    )
    with pytest.raises(SeriesScopeConflictError):
        replace_series(
            actor=admin,
            series_id=successor.pk,
            expected_version=successor.version,
            new_code="COM-VEN",  # código retirado
        )


@pytest.mark.django_db
def test_replace_series_rejects_stale_version(admin: User, used_series: DocumentSeries) -> None:
    with pytest.raises(StaleRecordError):
        replace_series(
            actor=admin,
            series_id=used_series.pk,
            expected_version=99,
            new_code="COM-VEN-2",
        )


@pytest.mark.django_db
def test_replace_series_requires_permission(seller: User, used_series: DocumentSeries) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        replace_series(
            actor=seller,
            series_id=used_series.pk,
            expected_version=used_series.version,
            new_code="COM-VEN-2",
        )
