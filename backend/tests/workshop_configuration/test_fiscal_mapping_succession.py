"""El código del SRI de una tarifa puede cambiar a futuro sin tocar lo ya preparado."""

from datetime import date, timedelta
from decimal import Decimal
from types import ModuleType

import pytest
from django.utils import timezone

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import AuditEvent, User
from workshop_configuration.application.fiscal_tax_mapping import (
    create_mapping,
    resolve_mapping,
)
from workshop_configuration.application.taxes import schedule_successor
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import (
    FiscalEntity,
    FiscalTaxMapping,
    TaxDefinition,
    TaxPeriod,
)

START = date(2025, 1, 1)


def entry(code: str) -> int:
    from workshop_configuration.application import official_catalog
    from workshop_configuration.models import OfficialCatalogEntry

    official_catalog.ensure_installed()
    return OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=official_catalog.SELECTABLE_TAX_VERSION, code=code
    ).pk


def api() -> ModuleType:
    from workshop_configuration.application import fiscal_tax_mapping

    return fiscal_tax_mapping


def switch_day() -> date:
    return timezone.localdate() + timedelta(days=30)


@pytest.fixture
def zero_rate(db: None, role_admin: User) -> tuple[TaxDefinition, TaxPeriod, FiscalTaxMapping]:
    """Una definición con tarifa 0 % y su código del SRI abiertos, como un negocio popular."""
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Comercial"
    )
    definition = TaxDefinition.objects.create(fiscal_entity=entity, code="IVA", name="IVA ventas")
    period = TaxPeriod.objects.create(tax_definition=definition, rate=Decimal("0"), starts_on=START)
    mapping = create_mapping(
        actor=role_admin,
        definition_id=definition.pk,
        catalog_entry_id=entry("0"),
        starts_on=START,
        ends_on=None,
        source="Certificado de RUC",
    )
    return definition, period, mapping


def schedule_rate(role_admin: User, period: TaxPeriod, rate: str = "15") -> None:
    schedule_successor(
        actor=role_admin,
        period_id=period.pk,
        expected_version=period.version,
        new_rate=rate,
        successor_starts_on=switch_day(),
    )


def test_the_new_code_is_rejected_until_the_internal_rate_is_scheduled(
    zero_rate: tuple[TaxDefinition, TaxPeriod, FiscalTaxMapping], role_admin: User
) -> None:
    _, _, mapping = zero_rate
    with pytest.raises(ConfigurationValidationError):
        api().schedule_mapping_successor(
            actor=role_admin,
            mapping_id=mapping.pk,
            catalog_entry_id=entry("4"),
            starts_on=switch_day(),
            source="Cambio de régimen",
        )
    mapping.refresh_from_db()
    assert mapping.ends_on is None


def test_scheduled_change_closes_the_current_code_and_opens_the_next(
    zero_rate: tuple[TaxDefinition, TaxPeriod, FiscalTaxMapping], role_admin: User
) -> None:
    definition, period, mapping = zero_rate
    schedule_rate(role_admin, period)
    day = switch_day()

    successor = api().schedule_mapping_successor(
        actor=role_admin,
        mapping_id=mapping.pk,
        catalog_entry_id=entry("4"),
        starts_on=day,
        source="Pasa a RIMPE Emprendedor",
    )

    mapping.refresh_from_db()
    assert mapping.ends_on == day - timedelta(days=1)
    assert (successor.starts_on, successor.ends_on, successor.percentage_code) == (day, None, "4")
    before = resolve_mapping(
        definition_id=definition.pk, on=day - timedelta(days=1), historical_rate=Decimal(0)
    )
    after = resolve_mapping(definition_id=definition.pk, on=day, historical_rate=Decimal(15))
    assert (before.percentage_code, after.percentage_code) == ("0", "4")
    today = resolve_mapping(
        definition_id=definition.pk, on=timezone.localdate(), historical_rate=Decimal(0)
    )
    assert today.percentage_code == "0"
    assert AuditEvent.objects.filter(action="fiscal.tax_mapping_succession").count() == 1


@pytest.mark.parametrize("offset", [0, -5])
def test_the_change_must_start_in_the_future(
    zero_rate: tuple[TaxDefinition, TaxPeriod, FiscalTaxMapping],
    role_admin: User,
    offset: int,
) -> None:
    _, period, mapping = zero_rate
    schedule_rate(role_admin, period)
    with pytest.raises(ConfigurationValidationError):
        api().schedule_mapping_successor(
            actor=role_admin,
            mapping_id=mapping.pk,
            catalog_entry_id=entry("4"),
            starts_on=timezone.localdate() + timedelta(days=offset),
            source="Cambio de régimen",
        )
    mapping.refresh_from_db()
    assert mapping.ends_on is None


def test_only_the_open_code_can_be_succeeded(
    zero_rate: tuple[TaxDefinition, TaxPeriod, FiscalTaxMapping], role_admin: User
) -> None:
    _, period, mapping = zero_rate
    schedule_rate(role_admin, period)
    api().schedule_mapping_successor(
        actor=role_admin,
        mapping_id=mapping.pk,
        catalog_entry_id=entry("4"),
        starts_on=switch_day(),
        source="Cambio de régimen",
    )
    with pytest.raises(ConfigurationValidationError):
        api().schedule_mapping_successor(
            actor=role_admin,
            mapping_id=mapping.pk,
            catalog_entry_id=entry("4"),
            starts_on=switch_day() + timedelta(days=10),
            source="Otro cambio",
        )


def test_an_invalid_code_leaves_the_current_one_untouched(
    zero_rate: tuple[TaxDefinition, TaxPeriod, FiscalTaxMapping], role_admin: User
) -> None:
    _, period, mapping = zero_rate
    schedule_rate(role_admin, period)
    with pytest.raises(ConfigurationValidationError):
        api().schedule_mapping_successor(
            actor=role_admin,
            mapping_id=mapping.pk,
            catalog_entry_id=999_999,
            starts_on=switch_day(),
            source="Cambio de régimen",
        )
    mapping.refresh_from_db()
    assert mapping.ends_on is None
    assert FiscalTaxMapping.objects.count() == 1


def test_only_the_administrator_schedules_the_change(
    zero_rate: tuple[TaxDefinition, TaxPeriod, FiscalTaxMapping], role_seller: User
) -> None:
    _, _, mapping = zero_rate
    with pytest.raises(BusinessPermissionDeniedError):
        api().schedule_mapping_successor(
            actor=role_seller,
            mapping_id=mapping.pk,
            catalog_entry_id=entry("4"),
            starts_on=switch_day(),
            source="Cambio de régimen",
        )
