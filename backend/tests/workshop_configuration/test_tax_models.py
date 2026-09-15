from datetime import date
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from workshop_configuration.domain.validation import FiscalEntityType
from workshop_configuration.models import (
    ConfigurationUse,
    FiscalEntity,
    TaxDefinition,
    TaxPeriod,
)

pytestmark = pytest.mark.django_db


def create_entity(
    entity_type: FiscalEntityType = FiscalEntityType.COMERCIAL,
    ruc: str = "0991234567001",
) -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type=entity_type,
        ruc=ruc,
        legal_name="Taller Comercial",
    )


def create_tax_definition(entity: FiscalEntity | None = None) -> TaxDefinition:
    return TaxDefinition.objects.create(
        fiscal_entity=entity or create_entity(),
        code="IVA",
        name="Impuesto al valor agregado",
    )


def test_tax_definition_code_is_unique_within_each_fiscal_entity() -> None:
    commercial = create_entity()
    artisanal = create_entity(FiscalEntityType.ARTESANAL, "1791234567001")
    create_tax_definition(commercial)

    with pytest.raises(IntegrityError), transaction.atomic():
        create_tax_definition(commercial)

    other = create_tax_definition(artisanal)
    assert other.code == "IVA"


@pytest.mark.parametrize(("code", "name"), [("1IVA", "IVA"), ("IVA", "   ")])
def test_tax_definition_rejects_invalid_code_or_blank_name(code: str, name: str) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        TaxDefinition.objects.create(
            fiscal_entity=create_entity(),
            code=code,
            name=name,
        )


def test_tax_period_persists_decimal_rate_and_ordered_inclusive_interval() -> None:
    tax = create_tax_definition()
    period = TaxPeriod.objects.create(
        tax_definition=tax,
        rate=Decimal("12.3456"),
        starts_on=date(2026, 9, 15),
        ends_on=date(2026, 9, 30),
    )

    assert period.rate == Decimal("12.3456")
    assert period.starts_on == date(2026, 9, 15)
    assert period.ends_on == date(2026, 9, 30)
    assert period.version == 1


@pytest.mark.parametrize(
    ("rate", "starts_on", "ends_on"),
    [
        (Decimal("-0.0001"), date(2026, 9, 15), None),
        (Decimal("100.0001"), date(2026, 9, 15), None),
        (Decimal("12.0000"), date(2026, 9, 15), date(2026, 9, 14)),
    ],
)
def test_tax_period_rejects_invalid_rate_or_interval(
    rate: Decimal, starts_on: date, ends_on: date | None
) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        TaxPeriod.objects.create(
            tax_definition=create_tax_definition(),
            rate=rate,
            starts_on=starts_on,
            ends_on=ends_on,
        )


def test_tax_references_are_protected_after_a_configuration_use() -> None:
    entity = create_entity()
    tax = create_tax_definition(entity)
    period = TaxPeriod.objects.create(
        tax_definition=tax,
        rate=Decimal("15.0000"),
        starts_on=date(2026, 9, 15),
    )
    ConfigurationUse.objects.create(
        tax_period=period,
        consumer_type="sale",
        consumer_id="sale-001",
        operation_date=date(2026, 9, 15),
        entity_type_snapshot=FiscalEntityType.COMERCIAL,
        ruc_snapshot=entity.ruc,
        legal_name_snapshot=entity.legal_name,
        tax_code_snapshot=tax.code,
        tax_name_snapshot=tax.name,
        rate_snapshot=period.rate,
        period_start_snapshot=period.starts_on,
        period_end_snapshot=period.ends_on,
    )

    with pytest.raises(ProtectedError):
        period.delete()
    with pytest.raises(ProtectedError):
        tax.delete()
    with pytest.raises(ProtectedError):
        entity.delete()


def test_configuration_use_keeps_fiscal_copies_when_current_records_change() -> None:
    entity = create_entity()
    tax = create_tax_definition(entity)
    period = TaxPeriod.objects.create(
        tax_definition=tax,
        rate=Decimal("12.0000"),
        starts_on=date(2026, 1, 1),
    )
    use = ConfigurationUse.objects.create(
        tax_period=period,
        consumer_type="service-operation",
        consumer_id="service-001",
        operation_date=date(2026, 9, 15),
        entity_type_snapshot=FiscalEntityType.COMERCIAL,
        ruc_snapshot="0991234567001",
        legal_name_snapshot="Taller Comercial",
        tax_code_snapshot="IVA",
        tax_name_snapshot="Impuesto al valor agregado",
        rate_snapshot=Decimal("12.0000"),
        period_start_snapshot=date(2026, 1, 1),
        period_end_snapshot=None,
    )

    FiscalEntity.objects.filter(pk=entity.pk).update(legal_name="Nueva razón social")
    TaxDefinition.objects.filter(pk=tax.pk).update(name="Nombre actualizado")

    use.refresh_from_db()
    assert use.ruc_snapshot == "0991234567001"
    assert use.legal_name_snapshot == "Taller Comercial"
    assert use.tax_name_snapshot == "Impuesto al valor agregado"
    assert use.rate_snapshot == Decimal("12.0000")


def test_configuration_use_is_unique_per_consumer_and_tax_code() -> None:
    period = TaxPeriod.objects.create(
        tax_definition=create_tax_definition(),
        rate=Decimal("12.0000"),
        starts_on=date(2026, 1, 1),
    )
    values = {
        "tax_period": period,
        "consumer_type": "sale",
        "consumer_id": "sale-001",
        "operation_date": date(2026, 9, 15),
        "entity_type_snapshot": FiscalEntityType.COMERCIAL,
        "ruc_snapshot": "0991234567001",
        "legal_name_snapshot": "Taller Comercial",
        "tax_code_snapshot": "IVA",
        "tax_name_snapshot": "Impuesto al valor agregado",
        "rate_snapshot": Decimal("12.0000"),
        "period_start_snapshot": date(2026, 1, 1),
        "period_end_snapshot": None,
    }
    ConfigurationUse.objects.create(**values)

    with pytest.raises(IntegrityError), transaction.atomic():
        ConfigurationUse.objects.create(**values)
