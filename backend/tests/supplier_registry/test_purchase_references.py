"""Interfaz pública de proveedores para compras."""

import dataclasses
from typing import Any

import pytest
from django.db import transaction

from supplier_registry.application.purchase_references import (
    SupplierReference,
    SupplierReferenceError,
    get_supplier_reference,
    list_supplier_references,
    lock_supplier_reference,
)
from supplier_registry.models import Supplier

pytestmark = pytest.mark.django_db


def test_reference_carries_identity_state_and_version_without_contacts() -> None:
    supplier = Supplier.objects.create(
        name="Repuestos SA",
        identification_type="RUC",
        identification="1790012345001",
        phone="099",
        email="a@b.c",
        address="Calle 1",
    )
    ref = get_supplier_reference(supplier.pk)
    assert isinstance(ref, SupplierReference)
    assert (ref.id, ref.name, ref.identification_type, ref.identification) == (
        supplier.pk,
        "Repuestos SA",
        "RUC",
        "1790012345001",
    )
    assert (ref.is_active, ref.version) == (True, 1)
    names = {f.name for f in dataclasses.fields(ref)}
    assert not names & {"phone", "email", "address"}
    with pytest.raises(dataclasses.FrozenInstanceError):
        ref.name = "x"  # type: ignore[misc]


def test_unidentified_supplier_and_missing_supplier() -> None:
    supplier = Supplier.objects.create(name="Ocasional")
    assert get_supplier_reference(supplier.pk).identification is None  # type: ignore[union-attr]
    assert get_supplier_reference(999999) is None


def test_search_is_paginated_and_active_only_by_default() -> None:
    for i in range(4):
        Supplier.objects.create(name=f"Proveedor {i}", is_active=i != 1)
    page = list_supplier_references(search="proveedor", page=1, page_size=2)
    assert page.total_count == 3
    assert [r.name for r in page.items] == ["Proveedor 0", "Proveedor 2"]
    assert list_supplier_references(search="proveedor", include_inactive=True).total_count == 4


def test_lock_returns_current_reference_and_rejects_missing_or_inactive() -> None:
    active = Supplier.objects.create(name="A")
    inactive = Supplier.objects.create(name="B", is_active=False)
    with transaction.atomic():
        assert lock_supplier_reference(active.pk).id == active.pk
        with pytest.raises(SupplierReferenceError) as missing:
            lock_supplier_reference(424242)
        assert missing.value.code == "not_found"
        with pytest.raises(SupplierReferenceError) as inactive_error:
            lock_supplier_reference(inactive.pk)
        assert inactive_error.value.code == "inactive"
        assert lock_supplier_reference(inactive.pk, require_active=False).is_active is False


@pytest.mark.django_db(transaction=True)
def test_lock_requires_an_outer_transaction() -> None:
    supplier: Any = Supplier.objects.create(name="A")
    with pytest.raises(RuntimeError, match="transacción"):
        lock_supplier_reference(supplier.pk)
