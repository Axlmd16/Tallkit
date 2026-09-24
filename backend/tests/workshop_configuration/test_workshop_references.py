"""Interfaz pública de configuración para el taller."""

from datetime import date
from decimal import Decimal

import pytest
from django.db import transaction

from workshop_configuration.application.operation_context import OperationContextError
from workshop_configuration.application.workshop_references import (
    ArtisanEntityMissingError,
    allocate_artisan_number,
    artisan_numbering_scope_id,
    get_artisan_entity,
    lock_artisan_operation_context,
)
from workshop_configuration.models import (
    DocumentSeries,
    FiscalEntity,
    NumberAllocation,
    NumberingScope,
    TaxDefinition,
    TaxPeriod,
)

pytestmark = pytest.mark.django_db

ON = date(2026, 6, 1)


def _entity(entity_type: str, *, suffix: str) -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type=entity_type,
        legal_name=f"Entidad {entity_type}",
        ruc=f"17900000000{suffix}",
    )


def _tax(
    entity: FiscalEntity,
    code: str,
    rate: str | None,
    *,
    starts_on: date = date(2026, 1, 1),
) -> TaxDefinition:
    definition = TaxDefinition.objects.create(
        fiscal_entity=entity,
        code=code,
        name=code,
    )
    if rate is not None:
        TaxPeriod.objects.create(
            tax_definition=definition,
            rate=Decimal(rate),
            starts_on=starts_on,
        )
    return definition


def test_returns_artisan_entity() -> None:
    entity = FiscalEntity.objects.create(
        entity_type="ARTESANAL", legal_name="Taller", ruc="1790000000002"
    )
    ref = get_artisan_entity()
    assert (ref.id, ref.ruc, ref.legal_name) == (entity.pk, "1790000000002", "Taller")


def test_missing_configuration_is_an_error() -> None:
    FiscalEntity.objects.filter(entity_type="ARTESANAL").delete()
    with pytest.raises(ArtisanEntityMissingError):
        get_artisan_entity()


def test_lock_artisan_context_returns_entity_and_rates_for_document_date() -> None:
    artisan = _entity("ARTESANAL", suffix="02")
    iva = _tax(artisan, "IVA-ART", "15")
    zero = _tax(artisan, "CERO-ART", "0")

    with transaction.atomic():
        locked = lock_artisan_operation_context(
            tax_definition_ids=[iva.pk, zero.pk],
            on=ON,
        )

    assert (locked.entity.id, locked.entity.ruc, locked.entity.legal_name) == (
        artisan.pk,
        artisan.ruc,
        artisan.legal_name,
    )
    assert locked.taxes[iva.pk].rate == Decimal("15")
    assert locked.taxes[zero.pk].rate == Decimal("0")


@pytest.mark.parametrize(
    ("setup", "expected_code"),
    [
        ("missing_rate", "missing_rate"),
        ("ambiguous_rate", "ambiguous_rate"),
        ("commercial", "invalid_tax_scope"),
        ("unknown", "missing_tax"),
    ],
)
def test_lock_artisan_context_rejects_unresolvable_taxes(
    setup: str,
    expected_code: str,
) -> None:
    artisan = _entity("ARTESANAL", suffix="02")
    if setup == "missing_rate":
        target = _tax(
            artisan,
            "FUTURO",
            "15",
            starts_on=date(2027, 1, 1),
        ).pk
    elif setup == "ambiguous_rate":
        definition = _tax(artisan, "AMBIGUO", "12")
        TaxPeriod.objects.create(
            tax_definition=definition,
            rate=Decimal("15"),
            starts_on=date(2026, 3, 1),
        )
        target = definition.pk
    elif setup == "commercial":
        commercial = _entity("COMERCIAL", suffix="01")
        target = _tax(commercial, "IVA", "15").pk
    else:
        target = 987654

    with transaction.atomic(), pytest.raises(OperationContextError) as error:
        lock_artisan_operation_context(tax_definition_ids=[target], on=ON)

    assert error.value.code == expected_code


@pytest.mark.django_db(transaction=True)
def test_lock_artisan_context_requires_an_outer_transaction() -> None:
    artisan = _entity("ARTESANAL", suffix="02")
    tax = _tax(artisan, "IVA-ART", "15")

    with pytest.raises(RuntimeError, match="transacción"):
        lock_artisan_operation_context(tax_definition_ids=[tax.pk], on=ON)


def test_allocate_artisan_number_uses_art_ser_and_is_idempotent_by_request_key() -> None:
    artisan = _entity("ARTESANAL", suffix="02")
    scope = NumberingScope.objects.create(
        fiscal_entity=artisan,
        document_type="SERVICIO",
    )
    series = DocumentSeries.objects.create(
        numbering_scope=scope,
        code="ART-SER",
    )

    with transaction.atomic():
        first = allocate_artisan_number(request_key="service-operation:order-1:digest")
        second = allocate_artisan_number(request_key="service-operation:order-1:digest")

    assert artisan_numbering_scope_id() == scope.pk
    assert first == second
    assert first.visible_number == "ART-SER-000001"
    series.refresh_from_db()
    assert series.last_number == 1
    assert NumberAllocation.objects.filter(numbering_scope=scope).count() == 1


def test_review_artisan_context_reads_without_transaction_or_locks() -> None:
    from workshop_configuration.application.workshop_references import (
        review_artisan_operation_context,
    )

    artisan = _entity("ARTESANAL", suffix="02")
    iva = _tax(artisan, "IVA-ART", "15")

    # Fuera de una transacción: la lectura de vista previa no bloquea filas.
    context = review_artisan_operation_context(tax_definition_ids=[iva.pk], on=ON)

    assert context.entity.id == artisan.pk
    assert context.taxes[iva.pk].rate == Decimal("15")
