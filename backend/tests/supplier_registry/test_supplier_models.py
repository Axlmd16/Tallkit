import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from supplier_registry.models import Supplier, SupplierCommand

pytestmark = pytest.mark.django_db


def test_supplier_minimal_and_multiple_unidentified() -> None:
    Supplier.objects.create(name="Repuestos")
    Supplier.objects.create(name="Repuestos")
    s = Supplier.objects.first()
    assert s is not None
    assert (s.identification_type, s.identification, s.phone) == (None, None, "")
    assert s.is_active is True
    assert s.version == 1


def test_pair_unique_including_inactive() -> None:
    Supplier.objects.create(
        name="A", identification_type="CI", identification="0912345678", is_active=False
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        Supplier.objects.create(name="B", identification_type="CI", identification="0912345678")
    Supplier.objects.create(name="C", identification_type="RUC", identification="0912345678001")


@pytest.mark.parametrize(
    "kwargs",
    [
        {"identification_type": "CI"},
        {"identification": "0912345678"},
        {"identification_type": "CI", "identification": "123"},
        {"identification_type": "RUC", "identification": "0912345678"},
        {"identification_type": "PAS", "identification": "0912345678"},
        {"name": "  "},
    ],
)
def test_supplier_checks(kwargs: dict[str, str]) -> None:
    data = {"name": "A", **kwargs}
    with pytest.raises(IntegrityError), transaction.atomic():
        Supplier.objects.create(**data)


def test_supplier_command_receipt() -> None:
    user = get_user_model().objects.create_user(username="sup-actor", password="x" * 14)
    SupplierCommand.objects.create(
        actor=user,
        action="suppliers.supplier_created",
        idempotency_key="key-12345",
        input_fingerprint="b" * 64,
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        SupplierCommand.objects.create(
            actor=user,
            action="suppliers.supplier_created",
            idempotency_key="key-12345",
            input_fingerprint="b" * 64,
        )
