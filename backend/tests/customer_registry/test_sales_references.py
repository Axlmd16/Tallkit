"""Interfaz pública de clientes para ventas comerciales."""

import dataclasses

import pytest
from django.db import transaction

from customer_registry.application.sales_references import (
    CustomerReferenceError,
    get_customer_reference,
    list_customer_options,
    lock_customer_reference,
)
from customer_registry.models import Customer

pytestmark = pytest.mark.django_db


def make_customer(n: int = 1, **overrides: object) -> Customer:
    values: dict[str, object] = {
        "person_type": "NATURAL",
        "name": f"Cliente {n}",
        "identification_type": "CI",
        "identification": f"17123456{n:02d}",
        "phone": "0999999999",
    }
    values.update(overrides)
    return Customer.objects.create(**values)


def test_reference_is_an_immutable_dto_of_identity_contact_and_state() -> None:
    customer = make_customer(email="a@b.com", address="Calle 1")
    ref = get_customer_reference(customer.pk)
    assert ref is not None
    assert (ref.id, ref.name, ref.identification_type, ref.identification) == (
        customer.pk,
        "Cliente 1",
        "CI",
        customer.identification,
    )
    assert (ref.phone, ref.email, ref.address, ref.is_active) == (
        "0999999999",
        "a@b.com",
        "Calle 1",
        True,
    )
    with pytest.raises(dataclasses.FrozenInstanceError):
        ref.name = "otro"  # type: ignore[misc]
    assert not any("vehicle" in f.name for f in dataclasses.fields(ref))


def test_missing_customer_yields_none() -> None:
    assert get_customer_reference(999999) is None


def test_search_is_paginated_active_only_by_name_or_identification() -> None:
    for n in range(1, 6):
        make_customer(n, name=f"Ana {n}", is_active=n != 3)
    make_customer(6, name="Luis")
    page = list_customer_options(search="ana", page=1, page_size=2)
    assert page.total_count == 4
    assert [c.name for c in page.items] == ["Ana 1", "Ana 2"]
    assert list_customer_options(search="1712345606").total_count == 1
    assert list_customer_options(page=99, page_size=2).items == ()


def test_lock_returns_reference_inside_a_transaction() -> None:
    customer = make_customer()
    with transaction.atomic():
        ref = lock_customer_reference(customer.pk)
    assert ref.id == customer.pk


def test_lock_reports_missing_and_inactive_for_new_sales() -> None:
    inactive = make_customer(2, is_active=False)
    with transaction.atomic():
        with pytest.raises(CustomerReferenceError) as missing:
            lock_customer_reference(999999)
        assert missing.value.missing is True
        with pytest.raises(CustomerReferenceError) as error:
            lock_customer_reference(inactive.pk)
        assert error.value.inactive is True


def test_inactive_customer_can_be_read_and_locked_for_history_corrections() -> None:
    inactive = make_customer(2, is_active=False)
    assert get_customer_reference(inactive.pk) is not None
    with transaction.atomic():
        ref = lock_customer_reference(inactive.pk, require_active=False)
    assert ref.is_active is False


@pytest.mark.django_db(transaction=True)
def test_lock_requires_an_outer_transaction() -> None:
    customer = make_customer()
    with pytest.raises(RuntimeError, match="transacción"):
        lock_customer_reference(customer.pk)
