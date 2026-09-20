"""Contexto de operación para compras: consulta de revisión y variante bloqueante."""

import dataclasses
from datetime import date
from decimal import Decimal

import pytest
from django.db import connection, transaction
from django.test.utils import CaptureQueriesContext

from workshop_configuration.application.operation_context import (
    OperationContextError,
    get_operation_context,
    lock_operation_context,
    review_tax_options,
)
from workshop_configuration.models import (
    ConfigurationUse,
    FiscalEntity,
    NumberAllocation,
    TaxDefinition,
    TaxPeriod,
    Warehouse,
)

ON = date(2026, 6, 1)


@pytest.fixture
def commercial(db: None) -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", legal_name="Comercial SA", ruc="1790000000001"
    )


@pytest.fixture
def warehouse(db: None) -> Warehouse:
    return Warehouse.objects.get_or_create(id=1, defaults={"name": "Principal"})[0]


def tax(entity: FiscalEntity, code: str, rate: str | None, starts: date = date(2026, 1, 1)):  # type: ignore[no-untyped-def]
    definition = TaxDefinition.objects.create(fiscal_entity=entity, code=code, name=code)
    if rate is not None:
        TaxPeriod.objects.create(tax_definition=definition, rate=Decimal(rate), starts_on=starts)
    return definition


def test_context_returns_frozen_commercial_entity_and_warehouse(
    commercial: FiscalEntity, warehouse: Warehouse
) -> None:
    context = get_operation_context()
    assert (context.entity_type, context.ruc, context.legal_name) == (
        "COMERCIAL",
        "1790000000001",
        "Comercial SA",
    )
    assert (context.warehouse_id, context.warehouse_name) == (1, "Principal")
    with pytest.raises(dataclasses.FrozenInstanceError):
        context.ruc = "x"  # type: ignore[misc]


def test_context_fails_without_entity_or_warehouse(warehouse: Warehouse) -> None:
    with pytest.raises(OperationContextError) as error:
        get_operation_context()
    assert error.value.code == "missing_entity"


def test_context_fails_without_warehouse(commercial: FiscalEntity) -> None:
    with pytest.raises(OperationContextError) as error:
        get_operation_context()
    assert error.value.code == "missing_warehouse"


def test_review_reports_status_per_definition_without_side_effects(
    commercial: FiscalEntity,
) -> None:
    ok = tax(commercial, "IVA", "15")
    zero = tax(commercial, "CERO", "0")
    none_valid = tax(commercial, "NADA", "5", starts=date(2027, 1, 1))
    art = FiscalEntity.objects.create(
        entity_type="ARTESANAL", legal_name="Art", ruc="1790000000002"
    )
    foreign = tax(art, "ART", "15")
    uses_before = (ConfigurationUse.objects.count(), NumberAllocation.objects.count())
    with CaptureQueriesContext(connection) as queries:
        review = review_tax_options([ok.pk, zero.pk, none_valid.pk, foreign.pk, 9999], on=ON)
    assert review[ok.pk].status == "applicable"
    assert review[ok.pk].rate == Decimal("15")
    # Tarifa cero explícita es aplicable; sin vigencia es "missing", nunca cero.
    assert review[zero.pk].status == "applicable"
    assert review[zero.pk].rate == Decimal("0")
    assert review[none_valid.pk].status == "missing"
    assert review[none_valid.pk].rate is None
    assert review[foreign.pk].status == "invalid_scope"
    assert 9999 not in review
    assert (ConfigurationUse.objects.count(), NumberAllocation.objects.count()) == uses_before
    assert not any("FOR UPDATE" in q["sql"] for q in queries)


def test_lock_returns_frozen_snapshots_for_the_document_date(
    commercial: FiscalEntity, warehouse: Warehouse
) -> None:
    iva = tax(commercial, "IVA", "15")
    with transaction.atomic():
        locked = lock_operation_context(tax_definition_ids=[iva.pk], on=ON)
    assert locked.context.warehouse_id == 1
    snapshot = locked.taxes[iva.pk]
    assert (snapshot.code, snapshot.rate, snapshot.starts_on, snapshot.ends_on) == (
        "IVA",
        Decimal("15"),
        date(2026, 1, 1),
        None,
    )
    with pytest.raises(dataclasses.FrozenInstanceError):
        snapshot.rate = Decimal("0")  # type: ignore[misc]


@pytest.mark.parametrize(
    ("setup", "code"),
    [
        ("missing_rate", "missing_rate"),
        ("ambiguous", "ambiguous_rate"),
        ("foreign", "invalid_tax_scope"),
        ("unknown", "missing_tax"),
    ],
)
def test_lock_rejects_unresolvable_taxes(
    commercial: FiscalEntity, warehouse: Warehouse, setup: str, code: str
) -> None:
    if setup == "missing_rate":
        target = tax(commercial, "NADA", "5", starts=date(2027, 1, 1)).pk
    elif setup == "ambiguous":
        definition = tax(commercial, "AMB", "5")
        TaxPeriod.objects.bulk_create(
            [TaxPeriod(tax_definition=definition, rate=Decimal("6"), starts_on=date(2026, 3, 1))]
        )
        target = definition.pk
    elif setup == "foreign":
        art = FiscalEntity.objects.create(
            entity_type="ARTESANAL", legal_name="Art", ruc="1790000000002"
        )
        target = tax(art, "ART", "15").pk
    else:
        target = 987654
    with transaction.atomic(), pytest.raises(OperationContextError) as error:
        lock_operation_context(tax_definition_ids=[target], on=ON)
    assert error.value.code == code


def test_lock_does_not_create_uses_or_numbers(
    commercial: FiscalEntity, warehouse: Warehouse
) -> None:
    iva = tax(commercial, "IVA", "15")
    with transaction.atomic():
        lock_operation_context(tax_definition_ids=[iva.pk], on=ON)
    assert ConfigurationUse.objects.count() == 0
    assert NumberAllocation.objects.count() == 0


@pytest.mark.django_db(transaction=True)
def test_lock_requires_an_outer_transaction(commercial: FiscalEntity, warehouse: Warehouse) -> None:
    iva = tax(commercial, "IVA", "15")
    with pytest.raises(RuntimeError, match="transacción"):
        lock_operation_context(tax_definition_ids=[iva.pk], on=ON)
