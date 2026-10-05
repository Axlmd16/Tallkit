"""Interfaz pública de servicios del catálogo para el taller."""

import itertools
from decimal import Decimal

import pytest
from django.db import transaction

from catalog.application.workshop_references import (
    ServiceReferenceError,
    list_service_options,
    lock_service_reference,
)
from catalog.models import Service
from workshop_configuration.models import TaxDefinition

pytestmark = pytest.mark.django_db


_codes = itertools.count(1)


def make(tax: TaxDefinition, name: str, **overrides: object) -> Service:
    values: dict[str, object] = {
        "code": f"SRV-9{next(_codes):05d}",
        "name": name,
        "reference_price": Decimal("25.00"),
        "tax_definition": tax,
    }
    values.update(overrides)
    return Service.objects.create(**values)


@pytest.mark.django_db(transaction=True)
def test_lock_requires_transaction(artisanal_tax: TaxDefinition) -> None:
    service = make(artisanal_tax, "Alineación")
    with pytest.raises(RuntimeError):
        lock_service_reference(service.pk)


def test_lock_returns_copyable_data(artisanal_tax: TaxDefinition) -> None:
    service = make(artisanal_tax, "Alineación", reference_price=Decimal("30.50"))
    with transaction.atomic():
        ref = lock_service_reference(service.pk)
    assert (ref.id, ref.name, ref.reference_price) == (service.pk, "Alineación", Decimal("30.50"))
    assert (ref.tax_definition_id, ref.tax_name) == (artisanal_tax.pk, "Artesanal")


def test_lock_rejects_missing_or_inactive(artisanal_tax: TaxDefinition) -> None:
    inactive = make(artisanal_tax, "Viejo", is_active=False)
    with transaction.atomic(), pytest.raises(ServiceReferenceError) as missing:
        lock_service_reference(999999)
    assert missing.value.reason == "missing"
    with transaction.atomic(), pytest.raises(ServiceReferenceError) as off:
        lock_service_reference(inactive.pk)
    assert off.value.reason == "inactive"


def test_options_are_active_searchable_and_paginated(artisanal_tax: TaxDefinition) -> None:
    for n in range(5):
        make(artisanal_tax, f"Cambio {n}")
    make(artisanal_tax, "Cambio inactivo", is_active=False)
    make(artisanal_tax, "Lavado")
    page = list_service_options(search="  cambio ", page=2, page_size=2)
    assert page.total_count == 5
    assert [s.name for s in page.items] == ["Cambio 2", "Cambio 3"]
    assert all(s.reference_price == Decimal("25.00") for s in page.items)


def test_lock_returns_the_service_code(artisanal_tax: TaxDefinition) -> None:
    service = make(artisanal_tax, "Alineación", code="SRV-000042")
    with transaction.atomic():
        ref = lock_service_reference(service.pk)
    assert ref.code == "SRV-000042"


def test_options_expose_the_code_and_search_matches_it(artisanal_tax: TaxDefinition) -> None:
    make(artisanal_tax, "Alineación", code="SRV-000101")
    make(artisanal_tax, "Balanceo", code="SRV-000102")
    by_code = list_service_options(search=" srv-000102 ")
    assert [(s.name, s.code) for s in by_code.items] == [("Balanceo", "SRV-000102")]
    assert list_service_options(search="alinea").items[0].code == "SRV-000101"
