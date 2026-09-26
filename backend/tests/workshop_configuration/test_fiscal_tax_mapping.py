"""La clasificación oficial es explícita; cero, exento y no objeto no se confunden."""

from datetime import date
from decimal import Decimal
from types import ModuleType

import pytest

from identity.models import User
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import FiscalEntity, TaxDefinition


def entry(code: str, kind: str = "TAX_RATE") -> int:
    from workshop_configuration.application import official_catalog
    from workshop_configuration.models import OfficialCatalogEntry

    official_catalog.ensure_installed()
    version = (
        official_catalog.SELECTABLE_TAX_VERSION
        if kind == "TAX_RATE"
        else official_catalog.SELECTABLE_PAYMENT_VERSION
    )
    return OfficialCatalogEntry.objects.get(kind=kind, catalog_version=version, code=code).pk


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
        catalog_entry_id=entry(code),
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
        catalog_entry_id=entry("0"),
        starts_on=date(2026, 1, 1),
        ends_on=None,
        source="Revisión documentada",
    )
    with pytest.raises(ConfigurationValidationError):
        api().create_mapping(
            actor=role_admin,
            definition_id=definition.pk,
            catalog_entry_id=entry("7"),
            starts_on=date(2026, 9, 25),
            ends_on=None,
            source="Otra revisión",
        )


def test_mapping_cannot_change_historical_rate(definition: TaxDefinition, role_admin: User) -> None:
    api().create_mapping(
        actor=role_admin,
        definition_id=definition.pk,
        catalog_entry_id=entry("4"),
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
        catalog_entry_id=entry("0"),
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
            catalog_entry_id=entry("0"),
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
        catalog_entry_id=entry("0"),
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
        catalog_entry_id=entry("7"),
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


def test_mapping_derives_code_and_version_from_the_entry(
    definition: TaxDefinition, role_admin: User
) -> None:
    from workshop_configuration.application.official_catalog import SELECTABLE_TAX_VERSION

    created = api().create_mapping(
        actor=role_admin,
        definition_id=definition.pk,
        catalog_entry_id=entry("6"),
        starts_on=date(2026, 1, 1),
        ends_on=None,
        source="Revisión documentada",
    )
    assert (created.percentage_code, created.catalog_version) == ("6", SELECTABLE_TAX_VERSION)
    resolved = api().resolve_mapping(
        definition_id=definition.pk, on=date(2026, 9, 25), historical_rate=Decimal(0)
    )
    assert (resolved.display_name, resolved.catalog_entry_id) == (
        "No objeto de IVA",
        created.catalog_entry_id,
    )


def test_legacy_or_payment_entries_are_not_selectable_for_new_mappings(
    definition: TaxDefinition, role_admin: User
) -> None:
    from workshop_configuration.application.official_catalog import LEGACY_TAX_VERSION
    from workshop_configuration.models import OfficialCatalogEntry

    legacy = OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=LEGACY_TAX_VERSION, code="0"
    )
    for candidate in (legacy.pk, entry("01", kind="PAYMENT_FORM")):
        with pytest.raises(ConfigurationValidationError):
            api().create_mapping(
                actor=role_admin,
                definition_id=definition.pk,
                catalog_entry_id=candidate,
                starts_on=date(2026, 1, 1),
                ends_on=None,
                source="Revisión documentada",
            )


def test_legacy_mapping_still_resolves(definition: TaxDefinition, role_admin: User) -> None:
    from workshop_configuration.application.official_catalog import LEGACY_TAX_VERSION
    from workshop_configuration.models import FiscalTaxMapping, OfficialCatalogEntry

    entry("0")
    legacy = OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=LEGACY_TAX_VERSION, code="4"
    )
    FiscalTaxMapping.objects.create(
        tax_definition=definition,
        catalog_version=LEGACY_TAX_VERSION,
        percentage_code="4",
        catalog_entry=legacy,
        starts_on=date(2026, 1, 1),
        source="Correspondencia anterior",
        created_by=role_admin,
    )
    resolved = api().resolve_mapping(
        definition_id=definition.pk, on=date(2026, 9, 25), historical_rate=Decimal("15")
    )
    assert (resolved.catalog_version, resolved.rate) == (LEGACY_TAX_VERSION, Decimal("15"))


def test_inactive_entry_blocks_resolution(definition: TaxDefinition, role_admin: User) -> None:
    from workshop_configuration.models import OfficialCatalogEntry

    created = api().create_mapping(
        actor=role_admin,
        definition_id=definition.pk,
        catalog_entry_id=entry("0"),
        starts_on=date(2026, 1, 1),
        ends_on=None,
        source="Revisión documentada",
    )
    OfficialCatalogEntry.objects.filter(pk=created.catalog_entry_id).update(is_active=False)
    with pytest.raises(ConfigurationValidationError):
        api().resolve_mapping(
            definition_id=definition.pk, on=date(2026, 9, 25), historical_rate=Decimal(0)
        )
