"""Origen PROFORMA en la venta: referencia única, copia histórica y coherencia de orígenes."""

from typing import Any

import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from proformas.models import Proforma
from sales.models import Sale

from .factories import issued_values, make_proforma

pytestmark = pytest.mark.django_db
SNAPSHOT = {"schema_version": 1, "lines": []}


@pytest.fixture
def issued(customer: Any, commercial: Any, actor: Any) -> Proforma:
    proforma = make_proforma(customer, commercial, actor)
    Proforma.objects.filter(pk=proforma.pk).update(**issued_values(actor))
    proforma.refresh_from_db()
    return proforma


def make_sale(customer: Any, commercial: Any, actor: Any, **values: Any) -> Sale:
    return Sale.objects.create(
        customer=customer,
        fiscal_entity=commercial["entity"],
        warehouse=commercial["warehouse"],
        condition="CONTADO",
        created_by=actor,
        **values,
    )


def from_proforma(proforma: Proforma, **overrides: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "origin_type": "PROFORMA",
        "origin_proforma_id": proforma.pk,
        "origin_reference": proforma.internal_number,
        "proforma_snapshot": SNAPSHOT,
    }
    values.update(overrides)
    return values


def test_sale_from_proforma_keeps_reference_number_and_snapshot(
    customer: Any, commercial: Any, actor: Any, issued: Proforma
) -> None:
    sale = make_sale(customer, commercial, actor, **from_proforma(issued))
    assert sale.origin_type == "PROFORMA"
    assert sale.origin_proforma_id == issued.pk
    assert sale.origin_reference == "COM-PRO-000001"
    assert sale.origin_order_id is None
    assert sale.state == "DRAFT"
    assert sale.internal_number is None


def test_direct_sale_stays_without_proforma(customer: Any, commercial: Any, actor: Any) -> None:
    sale = make_sale(customer, commercial, actor)
    assert (sale.origin_type, sale.origin_proforma_id, sale.proforma_snapshot) == (
        "DIRECT",
        None,
        None,
    )


@pytest.mark.parametrize(
    "overrides",
    [
        {"origin_proforma_id": None},
        {"origin_reference": ""},
        {"proforma_snapshot": None},
        {"proforma_snapshot": {"sin": "version"}},
        {"origin_type": "DIRECT"},
        {"origin_type": "DIRECT", "origin_reference": ""},
        {"origin_type": "DIRECT", "origin_reference": "", "proforma_snapshot": None},
    ],
)
def test_incoherent_proforma_origin_is_rejected(
    customer: Any, commercial: Any, actor: Any, issued: Proforma, overrides: dict[str, Any]
) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        make_sale(customer, commercial, actor, **from_proforma(issued, **overrides))


def test_proforma_origin_never_mixes_with_a_maintenance_order(
    customer: Any, commercial: Any, actor: Any, issued: Proforma
) -> None:
    from customer_registry.models import Vehicle, VehicleBrand
    from workshop.models import MaintenanceOrder
    from workshop_configuration.models import FiscalEntity

    artisan = FiscalEntity.objects.create(
        entity_type="ARTESANAL", legal_name="Taller", ruc="1790000000002"
    )
    brand = VehicleBrand.objects.create(name="Toyota")
    vehicle = Vehicle.objects.create(plate="PRO-1234", brand=brand, model="Hilux")
    order = MaintenanceOrder.objects.create(
        sequence=1,
        number="ART-OT-000001",
        fiscal_entity=artisan,
        customer=customer,
        vehicle=vehicle,
        customer_snapshot={"schema_version": 1},
        vehicle_snapshot={"schema_version": 1},
        opened_on="2026-10-06",
        odometer_km=1,
        created_by=actor,
        updated_by=actor,
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        make_sale(customer, commercial, actor, **from_proforma(issued, origin_order=order))
    with pytest.raises(IntegrityError), transaction.atomic():
        make_sale(
            customer,
            commercial,
            actor,
            origin_type="MAINTENANCE",
            origin_order=order,
            origin_reference=order.number,
            origin_proforma_id=issued.pk,
        )
    linked = make_sale(
        customer,
        commercial,
        actor,
        origin_type="MAINTENANCE",
        origin_order=order,
        origin_reference=order.number,
    )
    assert linked.origin_proforma_id is None


def test_a_proforma_originates_at_most_one_sale(
    customer: Any, commercial: Any, actor: Any, issued: Proforma
) -> None:
    make_sale(customer, commercial, actor, **from_proforma(issued))
    with pytest.raises(IntegrityError), transaction.atomic():
        make_sale(customer, commercial, actor, **from_proforma(issued))


def test_linked_proforma_cannot_be_deleted(customer: Any, commercial: Any, actor: Any) -> None:
    draft = make_proforma(customer, commercial, actor)
    Proforma.objects.filter(pk=draft.pk).update(**issued_values(actor))
    draft.refresh_from_db()
    make_sale(customer, commercial, actor, **from_proforma(draft))
    with pytest.raises((ProtectedError, IntegrityError)), transaction.atomic():
        draft.delete()
