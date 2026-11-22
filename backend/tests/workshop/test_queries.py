"""Listado, búsqueda, filtros e historial por cliente y vehículo."""

from datetime import timedelta
from typing import Any

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    create,
    error_of,
    finalize,
    key,
    transfer,
    version,
)

from catalog.models import Service
from customer_registry.models import Customer, Vehicle
from identity.application.authorization import BusinessPermissionDeniedError
from workshop.application import orders, queries
from workshop.models import MaintenanceOrder

pytestmark = pytest.mark.django_db


def listing(actor: Any, **filters: Any) -> dict[str, Any]:
    return queries.list_orders(actor=actor, **filters)


def finalize_with(manager, order_id: int, service: Service, price: str = "10.00") -> None:  # type: ignore[no-untyped-def]
    add_line(manager, order_id, service_id=service.pk, applied_price=price)
    orders.update_order(
        actor=manager,
        order_id=order_id,
        payload={
            "diagnosis": "Revisión",
            "expected_version": version(order_id),
            "idempotency_key": key(),
        },
    )
    finalize(manager, order_id)


@pytest.fixture
def scenario(manager, artisan, make_customer, make_vehicle, make_service, today):  # type: ignore[no-untyped-def]
    ana = make_customer(name="Ana Pérez", identification="1711111111")
    luis = make_customer(name="Luis Mora", identification="0922222222")
    car = make_vehicle(ana, plate="ABC-1234")
    truck = make_vehicle(luis, plate="PQR-9876")
    service = make_service(name="Alineación")
    first = create(
        manager,
        customer_id=ana.pk,
        vehicle_id=car.pk,
        odometer_km=1000,
        opened_on=(today - timedelta(days=10)).isoformat(),
    )
    finalize_with(manager, first["id"], service, "25.00")
    transfer(car, luis)
    second = create(manager, customer_id=luis.pk, vehicle_id=car.pk, odometer_km=2000)
    third = create(
        manager,
        customer_id=luis.pk,
        vehicle_id=truck.pk,
        odometer_km=500,
        opened_on=(today - timedelta(days=3)).isoformat(),
    )
    return {
        "ana": ana,
        "luis": luis,
        "car": car,
        "truck": truck,
        "service": service,
        "first": first,
        "second": second,
        "third": third,
    }


def numbers(page: dict[str, Any]) -> list[str]:
    return [item["number"] for item in page["items"]]


def test_list_is_paginated_and_stably_ordered(manager, scenario) -> None:  # type: ignore[no-untyped-def]
    page = listing(manager, page=1, page_size=2)
    assert page["total_count"] == 3
    assert numbers(page) == ["ART-OT-000002", "ART-OT-000003"]
    assert numbers(listing(manager, page=2, page_size=2)) == ["ART-OT-000001"]


@pytest.mark.parametrize(
    ("search", "expected"),
    [
        ("art-ot-000003", ["ART-OT-000003"]),
        ("  ana ", ["ART-OT-000001"]),
        ("0922", ["ART-OT-000002", "ART-OT-000003"]),
        ("abc-12", ["ART-OT-000002", "ART-OT-000001"]),
    ],
)
def test_search(manager, scenario, search, expected) -> None:  # type: ignore[no-untyped-def]
    assert numbers(listing(manager, search=search)) == expected


def test_filters(manager, scenario, today) -> None:  # type: ignore[no-untyped-def]
    assert numbers(listing(manager, state="FINALIZED")) == ["ART-OT-000001"]
    recent = listing(manager, date_from=today - timedelta(days=5), date_to=today)
    assert numbers(recent) == ["ART-OT-000002", "ART-OT-000003"]
    assert error_of(
        lambda: listing(manager, date_from=today, date_to=today - timedelta(days=1))
    ).code == ("validation_error")
    assert error_of(lambda: listing(manager, state="CANCELLED")).code == "validation_error"


def test_item_summary(manager, scenario) -> None:  # type: ignore[no-untyped-def]
    [item] = listing(manager, search="ART-OT-000001")["items"]
    assert item["services_total"] == "25.00"
    assert item["service_summary"] == {"names": ["Alineación"], "line_count": 1}
    assert (item["customer"]["name"], item["vehicle"]["plate"], item["state"]) == (
        "Ana Pérez",
        "ABC-1234",
        "FINALIZED",
    )
    assert "balance" not in item
    assert "payments" not in item


def test_vehicle_history_includes_both_owners(manager, scenario) -> None:  # type: ignore[no-untyped-def]
    page = listing(manager, vehicle_id=scenario["car"].pk)
    assert [(i["number"], i["customer"]["name"]) for i in page["items"]] == [
        ("ART-OT-000002", "Luis Mora"),
        ("ART-OT-000001", "Ana Pérez"),
    ]


def test_customer_history_follows_order_customer(manager, scenario) -> None:  # type: ignore[no-untyped-def]
    assert numbers(listing(manager, customer_id=scenario["ana"].pk)) == ["ART-OT-000001"]
    assert numbers(listing(manager, customer_id=scenario["luis"].pk)) == [
        "ART-OT-000002",
        "ART-OT-000003",
    ]


def test_history_survives_deactivation(manager, scenario) -> None:  # type: ignore[no-untyped-def]
    Customer.objects.filter(pk=scenario["ana"].pk).update(is_active=False)
    Vehicle.objects.filter(pk=scenario["car"].pk).update(is_active=False)
    Service.objects.filter(pk=scenario["service"].pk).update(is_active=False, name="Otro")
    [item] = listing(manager, customer_id=scenario["ana"].pk)["items"]
    assert (item["customer"]["is_active"], item["vehicle"]["is_active"]) == (False, False)
    assert item["service_summary"]["names"] == ["Alineación"]
    from workshop.application.projection import order_detail

    detail = order_detail(scenario["first"]["id"], manager)
    line = detail["interventions"][0]["lines"][0]
    assert (line["service_name"], line["service_is_active"]) == ("Alineación", False)


def test_seller_cannot_list(seller, scenario) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(BusinessPermissionDeniedError):
        listing(seller)
    with pytest.raises(BusinessPermissionDeniedError):
        queries.get_order(actor=seller, order_id=scenario["first"]["id"])


def test_no_n_plus_one(manager, scenario, django_assert_max_num_queries) -> None:  # type: ignore[no-untyped-def]
    with django_assert_max_num_queries(12):
        listing(manager, page_size=50)


def test_options(manager, scenario) -> None:  # type: ignore[no-untyped-def]
    vehicles = queries.vehicle_options(actor=manager, customer_id=scenario["luis"].pk)
    assert [(v["plate"], v["open_order"]) for v in vehicles["items"]] == [
        ("ABC-1234", {"id": scenario["second"]["id"], "number": "ART-OT-000002"}),
        ("PQR-9876", {"id": scenario["third"]["id"], "number": "ART-OT-000003"}),
    ]
    customers = queries.customer_options(actor=manager, search="ana")
    assert [c["name"] for c in customers["items"]] == ["Ana Pérez"]
    services = queries.service_options(actor=manager, search="alin")
    assert services["items"][0]["reference_price"] == "25.00"
    assert MaintenanceOrder.objects.count() == 3


def test_master_data_edits_do_not_rewrite_order_snapshots(manager, scenario) -> None:  # type: ignore[no-untyped-def]
    Vehicle.objects.filter(pk=scenario["car"].pk).update(model="Fortuner")
    Customer.objects.filter(pk=scenario["ana"].pk).update(name="Ana María Pérez")
    from workshop.application.projection import order_detail

    detail = order_detail(scenario["first"]["id"], manager)
    assert detail["vehicle"]["model"] == "Hilux"
    assert detail["customer"]["name"] == "Ana Pérez"
