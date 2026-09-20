from datetime import date
from decimal import Decimal

import pytest
from django.db import connection, transaction
from django.test.utils import CaptureQueriesContext

from customer_registry.application.catalog_references import (
    VehicleBrandReferenceError,
    get_vehicle_brand_refs,
    list_vehicle_brand_options,
    lock_vehicle_brands_for_association,
)
from customer_registry.models import VehicleBrand
from workshop_configuration.application.catalog_options import (
    CatalogTaxReferenceError,
    list_catalog_tax_options,
    validate_catalog_tax_reference,
)
from workshop_configuration.models import (
    ConfigurationUse,
    FiscalEntity,
    NumberAllocation,
    TaxDefinition,
    TaxPeriod,
)

pytestmark = pytest.mark.django_db
ON = date(2026, 6, 1)


def test_vehicle_brand_options_active_only_and_paginated() -> None:
    for i in range(5):
        VehicleBrand.objects.create(name=f"Marca {i}", is_active=i != 2)
    page = list_vehicle_brand_options(page=1, page_size=2)
    assert page.total_count == 4
    assert [b.name for b in page.items] == ["Marca 0", "Marca 1"]
    assert list_vehicle_brand_options(search="marca 3").total_count == 1
    assert list_vehicle_brand_options(page=9, page_size=2).items == ()


def test_vehicle_brand_refs_include_inactive() -> None:
    inactive = VehicleBrand.objects.create(name="Vieja", is_active=False)
    refs = get_vehicle_brand_refs([inactive.pk])
    assert refs[0].is_active is False


def test_lock_requires_transaction_and_validates_state() -> None:
    active = VehicleBrand.objects.create(name="A")
    inactive = VehicleBrand.objects.create(name="B", is_active=False)
    with transaction.atomic():
        assert set(lock_vehicle_brands_for_association([active.pk])) == {active.pk}
        with pytest.raises(VehicleBrandReferenceError) as exc:
            lock_vehicle_brands_for_association([active.pk, inactive.pk, 9999])
        assert exc.value.missing == (9999,)
        assert exc.value.inactive == (inactive.pk,)
        # conservar una inactiva ya asociada es válido
        locked = lock_vehicle_brands_for_association([active.pk, inactive.pk], new_ids=[active.pk])
        assert set(locked) == {active.pk, inactive.pk}


def _entity(kind: str, ruc: str) -> FiscalEntity:
    return FiscalEntity.objects.get_or_create(
        entity_type=kind, defaults={"legal_name": kind, "ruc": ruc}
    )[0]


def test_tax_options_status_scope_and_no_side_effects() -> None:
    com = _entity("COMERCIAL", "1790000000001")
    art = _entity("ARTESANAL", "1790000000002")
    applicable = TaxDefinition.objects.create(fiscal_entity=com, code="IVA", name="IVA")
    zero = TaxDefinition.objects.create(fiscal_entity=com, code="CERO", name="Tarifa cero")
    missing = TaxDefinition.objects.create(fiscal_entity=com, code="NADA", name="Sin vigencia")
    ambiguous = TaxDefinition.objects.create(fiscal_entity=com, code="AMB", name="Ambigua")
    other = TaxDefinition.objects.create(fiscal_entity=art, code="ART", name="Artesanal")
    TaxPeriod.objects.create(
        tax_definition=applicable, rate=Decimal("15"), starts_on=date(2026, 1, 1)
    )
    TaxPeriod.objects.create(tax_definition=zero, rate=Decimal("0"), starts_on=date(2026, 1, 1))
    TaxPeriod.objects.create(tax_definition=missing, rate=Decimal("5"), starts_on=date(2027, 1, 1))
    for _ in range(2):
        TaxPeriod.objects.create(
            tax_definition=ambiguous, rate=Decimal("1"), starts_on=date(2026, 1, 1)
        )

    with CaptureQueriesContext(connection) as ctx:
        page = list_catalog_tax_options(entity_type="COMERCIAL", on=ON)
    assert len(ctx) <= 4  # count + página + prefetch, sin N+1
    by_code = {o.code: o for o in page.items}
    assert set(by_code) == {"IVA", "CERO", "NADA", "AMB"}
    assert by_code["IVA"].rate == Decimal("15")
    assert by_code["CERO"].tax_status == "applicable"
    assert by_code["CERO"].rate == Decimal("0")
    assert by_code["NADA"].tax_status == "missing"
    assert by_code["NADA"].rate is None
    assert by_code["AMB"].tax_status == "ambiguous"
    assert list_catalog_tax_options(entity_type="ARTESANAL", on=ON).items[0].id == other.pk
    assert list_catalog_tax_options(entity_type="COMERCIAL", search="cero", on=ON).total_count == 1

    assert validate_catalog_tax_reference(missing.pk, "COMERCIAL").tax_status in {
        "applicable",
        "missing",
    }
    with pytest.raises(CatalogTaxReferenceError) as exc:
        validate_catalog_tax_reference(other.pk, "COMERCIAL")
    assert exc.value.code == "invalid_tax_scope"
    with pytest.raises(CatalogTaxReferenceError) as exc2:
        validate_catalog_tax_reference(999999, "COMERCIAL")
    assert exc2.value.code == "not_found"

    assert ConfigurationUse.objects.count() == 0
    assert NumberAllocation.objects.count() == 0
