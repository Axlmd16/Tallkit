"""La clasificación oficial es explícita; cero, exento y no objeto no se confunden."""

from datetime import date
from decimal import Decimal
from types import ModuleType

import pytest

from identity.models import User
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import FiscalEntity, TaxDefinition


def api() -> ModuleType:
    from workshop_configuration.application import fiscal_tax_mapping

    return fiscal_tax_mapping


@pytest.fixture
def definition(db: None) -> TaxDefinition:
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Prueba"
    )
    return TaxDefinition.objects.create(fiscal_entity=entity, code="IVA", name="IVA declarado")


def test_unmapped_zero_is_not_implicitly_exempt(definition: TaxDefinition) -> None:
    with pytest.raises(ConfigurationValidationError):
        api().resolve_mapping(
            definition_id=definition.pk, on=date(2026, 9, 25), historical_rate=Decimal(0)
        )


@pytest.mark.parametrize(
    ("code", "treatment"), [("0", "ZERO"), ("6", "NOT_SUBJECT"), ("7", "EXEMPT")]
)
def test_zero_treatments_keep_their_own_codes(
    definition: TaxDefinition, role_admin: User, code: str, treatment: str
) -> None:
    api().create_mapping(
        actor=role_admin,
        definition_id=definition.pk,
        percentage_code=code,
        starts_on=date(2026, 1, 1),
        ends_on=date(2026, 12, 31),
        source="Revisión documentada",
    )
    mapped = api().resolve_mapping(
        definition_id=definition.pk, on=date(2026, 9, 25), historical_rate=Decimal(0)
    )
    assert mapped.percentage_code == code
    assert mapped.treatment == treatment
    assert mapped.tax_code == "2"


def test_overlapping_mapping_is_rejected(definition: TaxDefinition, role_admin: User) -> None:
    api().create_mapping(
        actor=role_admin,
        definition_id=definition.pk,
        percentage_code="0",
        starts_on=date(2026, 1, 1),
        ends_on=None,
        source="Revisión documentada",
    )
    with pytest.raises(ConfigurationValidationError):
        api().create_mapping(
            actor=role_admin,
            definition_id=definition.pk,
            percentage_code="7",
            starts_on=date(2026, 9, 25),
            ends_on=None,
            source="Otra revisión",
        )


def test_mapping_cannot_change_historical_rate(definition: TaxDefinition, role_admin: User) -> None:
    api().create_mapping(
        actor=role_admin,
        definition_id=definition.pk,
        percentage_code="4",
        starts_on=date(2026, 1, 1),
        ends_on=None,
        source="Revisión documentada",
    )
    with pytest.raises(ConfigurationValidationError):
        api().resolve_mapping(
            definition_id=definition.pk, on=date(2026, 9, 25), historical_rate=Decimal(0)
        )


def test_mapping_outside_validity_is_missing(definition: TaxDefinition, role_admin: User) -> None:
    api().create_mapping(
        actor=role_admin,
        definition_id=definition.pk,
        percentage_code="0",
        starts_on=date(2026, 1, 1),
        ends_on=date(2026, 6, 30),
        source="Revisión documentada",
    )
    with pytest.raises(ConfigurationValidationError):
        api().resolve_mapping(
            definition_id=definition.pk, on=date(2026, 9, 25), historical_rate=Decimal(0)
        )


def test_mapping_rejects_known_incompatible_period_before_creation(
    definition: TaxDefinition, role_admin: User
) -> None:
    from workshop_configuration.models import FiscalTaxMapping, TaxPeriod

    TaxPeriod.objects.create(
        tax_definition=definition, rate=Decimal("15"), starts_on=date(2026, 1, 1)
    )
    with pytest.raises(ConfigurationValidationError):
        api().create_mapping(
            actor=role_admin,
            definition_id=definition.pk,
            percentage_code="0",
            starts_on=date(2026, 1, 1),
            ends_on=None,
            source="Revisión documentada",
        )
    assert not FiscalTaxMapping.objects.filter(tax_definition=definition).exists()


def test_prospective_mapping_does_not_reinterpret_the_previous_period(
    definition: TaxDefinition, role_admin: User
) -> None:
    api().create_mapping(
        actor=role_admin,
        definition_id=definition.pk,
        percentage_code="0",
        starts_on=date(2025, 1, 1),
        ends_on=date(2025, 12, 31),
        source="Catálogo aplicado en 2025",
    )
    previous = api().resolve_mapping(
        definition_id=definition.pk,
        on=date(2025, 6, 1),
        historical_rate=Decimal(0),
    )
    api().create_mapping(
        actor=role_admin,
        definition_id=definition.pk,
        percentage_code="7",
        starts_on=date(2026, 1, 1),
        ends_on=None,
        source="Correspondencia prospectiva",
    )

    assert previous.percentage_code == "0"
    assert previous.treatment == "ZERO"
    assert previous.source == "Catálogo aplicado en 2025"
    current = api().resolve_mapping(
        definition_id=definition.pk,
        on=date(2026, 6, 1),
        historical_rate=Decimal(0),
    )
    assert current.percentage_code == "7"
    assert current.treatment == "EXEMPT"
