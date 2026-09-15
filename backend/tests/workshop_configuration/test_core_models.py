import pytest
from django.db import IntegrityError, transaction

from workshop_configuration.domain.validation import FiscalEntityType
from workshop_configuration.models import FiscalEntity, Warehouse, WorkshopConfiguration

pytestmark = pytest.mark.django_db


def test_migration_creates_only_the_uninitialized_installation_singleton() -> None:
    installation = WorkshopConfiguration.objects.get()

    assert installation.pk == 1
    assert installation.is_initialized is False
    assert installation.initialized_at is None
    assert installation.version == 1
    assert FiscalEntity.objects.count() == 0
    assert Warehouse.objects.count() == 0


def test_installation_rejects_a_second_singleton_row() -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        WorkshopConfiguration.objects.create(pk=2)


def test_fiscal_entity_persists_textual_ruc_and_absent_optional_identification() -> None:
    entity = FiscalEntity.objects.create(
        entity_type=FiscalEntityType.COMERCIAL,
        ruc="0991234567001",
        legal_name="Taller Comercial",
    )

    assert entity.ruc == "0991234567001"
    assert entity.trade_name is None
    assert entity.address is None
    assert entity.phone is None
    assert entity.email is None
    assert entity.version == 1


def test_fiscal_entity_rejects_duplicate_type_or_ruc() -> None:
    FiscalEntity.objects.create(
        entity_type=FiscalEntityType.COMERCIAL,
        ruc="0991234567001",
        legal_name="Taller Comercial",
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        FiscalEntity.objects.create(
            entity_type=FiscalEntityType.COMERCIAL,
            ruc="1791234567001",
            legal_name="Otro comercial",
        )

    with pytest.raises(IntegrityError), transaction.atomic():
        FiscalEntity.objects.create(
            entity_type=FiscalEntityType.ARTESANAL,
            ruc="0991234567001",
            legal_name="Taller Artesanal",
        )


@pytest.mark.parametrize(
    ("entity_type", "ruc", "legal_name"),
    [
        ("SUCURSAL", "1791234567001", "Sucursal"),
        (FiscalEntityType.ARTESANAL, "179123456700A", "Taller Artesanal"),
        (FiscalEntityType.ARTESANAL, "179123456700", "Taller Artesanal"),
        (FiscalEntityType.ARTESANAL, "1791234567001", "   "),
    ],
)
def test_fiscal_entity_rejects_invalid_types_ruc_and_blank_name(
    entity_type: object, ruc: str, legal_name: str
) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        FiscalEntity.objects.create(
            entity_type=entity_type,
            ruc=ruc,
            legal_name=legal_name,
        )


def test_warehouse_is_a_single_active_non_blank_record() -> None:
    warehouse = Warehouse.objects.create(name="Bodega principal")

    assert warehouse.pk == 1
    assert warehouse.is_active is True
    assert warehouse.version == 1

    with pytest.raises(IntegrityError), transaction.atomic():
        Warehouse.objects.create(pk=2, name="Segunda bodega")
    with pytest.raises(IntegrityError), transaction.atomic():
        Warehouse.objects.filter(pk=1).update(is_active=False)


def test_warehouse_rejects_blank_name() -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Warehouse.objects.create(name="   ")
