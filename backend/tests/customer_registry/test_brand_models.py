import pytest
from django.db import IntegrityError, transaction

from customer_registry.models import VehicleBrand


@pytest.mark.django_db
def test_create_vehicle_brand_with_defaults() -> None:
    brand = VehicleBrand.objects.create(name="Toyota")

    assert brand.id is not None
    assert brand.name == "Toyota"
    assert brand.is_active is True
    assert brand.version == 1
    assert brand.created_at is not None
    assert brand.updated_at is not None
    assert str(brand) == "Toyota"


@pytest.mark.django_db
def test_vehicle_brand_rejects_empty_or_whitespace_name() -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        VehicleBrand.objects.create(name="")

    with pytest.raises(IntegrityError), transaction.atomic():
        VehicleBrand.objects.create(name="   ")


@pytest.mark.django_db
def test_vehicle_brand_does_not_impose_uniqueness_constraint() -> None:
    # Explicitly allowed: no uniqueness constraint or auto-merge
    b1 = VehicleBrand.objects.create(name="Chevrolet")
    b2 = VehicleBrand.objects.create(name="Chevrolet")

    assert b1.id != b2.id
    assert b1.name == b2.name
