"""Pruebas TDD para resolución de configuración en la transacción del consumidor.

Trazabilidad: spec "Configuración obligatoria para operaciones dependientes",
"Vigencias tributarias no ambiguas". Design decisión 4 y 5.
"""

from datetime import date

import pytest

from identity.domain.authorization import Role
from identity.models import User, UserRole
from workshop_configuration.application.configuration_resolver import (
    AmbiguousConfigurationError,
    ConfigurationResolutionResult,
    MissingConfigurationError,
    resolve_configuration,
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
    user = User.objects.create_user(username="res-admin", password="password123")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    return user


@pytest.fixture
def configured(db: None) -> dict[str, object]:
    """Configuración mínima con entidad COMERCIAL y período de IVA activo."""
    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL",
        ruc="0991234567001",
        legal_name="Taller Comercial",
    )
    tax_def = TaxDefinition.objects.create(
        fiscal_entity=entity,
        code="IVA",
        name="IVA",
    )
    period = TaxPeriod.objects.create(
        tax_definition=tax_def,
        rate="15.0000",
        starts_on=date(2024, 1, 1),
        ends_on=None,
    )
    return {
        "entity": entity,
        "tax_def": tax_def,
        "period": period,
    }


# ---------------------------------------------------------------------------
# Resolución exitosa
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_resolve_configuration_returns_result(configured: dict) -> None:
    result = resolve_configuration(
        entity_type="COMERCIAL",
        tax_codes=["IVA"],
        operation_date=date(2025, 6, 1),
    )
    assert isinstance(result, ConfigurationResolutionResult)
    assert result.entity.entity_type == "COMERCIAL"
    assert len(result.tax_periods) == 1
    period_data = result.tax_periods[0]
    assert period_data["code"] == "IVA"
    assert str(period_data["period"].rate) == "15.0000"


@pytest.mark.django_db
def test_resolve_configuration_saves_use_snapshot(configured: dict) -> None:
    """Uso y copia se guardan juntos en la misma transacción."""
    result = resolve_configuration(
        entity_type="COMERCIAL",
        tax_codes=["IVA"],
        operation_date=date(2025, 6, 1),
        consumer_type="sale",
        consumer_id="sale-001",
    )
    assert result is not None
    uses = ConfigurationUse.objects.filter(
        consumer_type="sale",
        consumer_id="sale-001",
    )
    assert uses.count() == 1
    use = uses.first()
    assert use.entity_type_snapshot == "COMERCIAL"
    assert use.ruc_snapshot == "0991234567001"
    assert use.tax_code_snapshot == "IVA"


# ---------------------------------------------------------------------------
# Falta de configuración
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_resolve_configuration_fails_if_entity_not_found(db: None) -> None:
    with pytest.raises(MissingConfigurationError):
        resolve_configuration(
            entity_type="COMERCIAL",
            tax_codes=["IVA"],
            operation_date=date(2025, 6, 1),
        )


@pytest.mark.django_db
def test_resolve_configuration_fails_if_tax_code_not_found(configured: dict) -> None:
    with pytest.raises(MissingConfigurationError):
        resolve_configuration(
            entity_type="COMERCIAL",
            tax_codes=["ICE"],  # no existe
            operation_date=date(2025, 6, 1),
        )


@pytest.mark.django_db
def test_resolve_configuration_fails_if_no_period_for_date(configured: dict) -> None:
    """Antes de la fecha de inicio del período: MissingConfigurationError."""
    with pytest.raises(MissingConfigurationError):
        resolve_configuration(
            entity_type="COMERCIAL",
            tax_codes=["IVA"],
            operation_date=date(2020, 1, 1),  # anterior al período 2024-01-01
        )


@pytest.mark.django_db
def test_resolve_configuration_fails_on_ambiguous_period(configured: dict) -> None:
    """Si por algún bug hubiera dos períodos activos en la misma fecha: ambigüedad."""
    # Crear un segundo período solapado directamente (bypass del servicio)
    period: TaxPeriod = configured["period"]
    TaxPeriod.objects.create(
        tax_definition_id=period.tax_definition_id,
        rate="12.0000",
        starts_on=date(2024, 6, 1),
        ends_on=None,
    )
    # Ambos cubren 2025-01-01: debería detectarse ambigüedad o resolverse al más reciente
    # Según el diseño: falla si no existe UNA ÚNICA vigencia aplicable
    with pytest.raises((MissingConfigurationError, AmbiguousConfigurationError)):
        resolve_configuration(
            entity_type="COMERCIAL",
            tax_codes=["IVA"],
            operation_date=date(2025, 1, 1),
        )


# ---------------------------------------------------------------------------
# Concurrencia: edición no altera la selección ya guardada
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_resolve_configuration_snapshot_unaffected_by_subsequent_edit(
    configured: dict, admin: User
) -> None:
    """Una vez guardada la copia histórica, editar la entidad no la altera."""
    resolve_configuration(
        entity_type="COMERCIAL",
        tax_codes=["IVA"],
        operation_date=date(2025, 6, 1),
        consumer_type="sale",
        consumer_id="sale-002",
    )
    # Editar la razón social de la entidad
    from workshop_configuration.application.entity_warehouse import update_fiscal_entity

    update_fiscal_entity(
        actor=admin,
        entity_id=configured["entity"].pk,
        expected_version=1,
        legal_name="Nombre cambiado",
    )
    # La copia histórica debe conservar el nombre original
    use = ConfigurationUse.objects.get(consumer_type="sale", consumer_id="sale-002")
    assert use.legal_name_snapshot == "Taller Comercial"
