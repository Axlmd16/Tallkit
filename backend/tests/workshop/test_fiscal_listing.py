"""Lista local de preparaciones de factura: ámbito por entidad, solo lectura y orden estable."""

from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from tests.workshop.workshop_helpers import add_line, confirm_services, create

from customer_registry.models import Customer
from fiscal.application.preparations import create_draft
from fiscal.models import FiscalPreparation, FiscalPreparationHistory
from sales.models import Sale
from workshop_configuration.models import FiscalEntity, Warehouse

pytestmark = pytest.mark.django_db
URL = "/api/v1/fiscal/preparations/list/"


def client_for(user: Any) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def nobody(db: None) -> Any:
    return get_user_model().objects.create_user(username="sin-fiscal", password="x" * 14)


@pytest.fixture
def artisan_preparation(
    manager: Any, artisan_billing: Any, customer: Any, vehicle: Any, make_service: Any
) -> FiscalPreparation:
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="25.00")
    operation_id = confirm_services(manager, order["id"], "CREDITO")["id"]
    result = create_draft(
        actor=manager,
        source_kind="ARTISAN",
        source_id=operation_id,
        idempotency_key="fiscal:listing:artisan",
    )
    return FiscalPreparation.objects.get(pk=result.preparation_id)


@pytest.fixture
def commercial_preparations(seller: Any) -> list[FiscalPreparation]:
    """Un borrador y una preparada del negocio comercial, creadas sin pasar por el flujo."""
    entity, _ = FiscalEntity.objects.get_or_create(
        entity_type="COMERCIAL",
        defaults={"legal_name": "Repuestos SA", "ruc": "1790000000001"},
    )
    warehouse, _ = Warehouse.objects.get_or_create(id=1, defaults={"name": "Principal"})
    buyer = Customer.objects.create(
        person_type="NATURAL",
        name="Luis Mora",
        identification_type="CI",
        identification="0922222222",
        phone="0999999999",
        email="luis@example.com",
    )
    rows: list[FiscalPreparation] = []
    for state in ("DRAFT", "PREPARED"):
        sale = Sale.objects.create(
            customer=buyer,
            fiscal_entity=entity,
            warehouse=warehouse,
            condition="CONTADO",
            created_by=seller,
        )
        extra: dict[str, Any] = {}
        if state == "PREPARED":
            extra = {
                "prepared_at": timezone.now(),
                "prepared_by": seller,
                "snapshot": {"schema_version": "factura-2.1.0"},
            }
        rows.append(
            FiscalPreparation.objects.create(
                fiscal_entity=entity,
                commercial_sale=sale,
                state=state,
                source_version=1,
                created_by=seller,
                **extra,
            )
        )
    return rows


def entities_of(response: Any) -> list[str]:
    return [row["entity"] for row in response.json()["results"]]


def test_user_with_both_permissions_sees_both_businesses(
    admin: Any, artisan_preparation: Any, commercial_preparations: Any
) -> None:
    response = client_for(admin).get(URL)
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 3
    assert sorted(entities_of(response)) == ["ARTESANAL", "COMERCIAL", "COMERCIAL"]
    row = next(item for item in body["results"] if item["entity"] == "ARTESANAL")
    assert row["number"].startswith("ART-SER-")
    assert row["customer_name"] == "Ana Pérez"
    assert row["total"] == "25.00"
    assert row["state"] == "DRAFT"
    assert row["id"] == str(artisan_preparation.pk)


def test_each_user_sees_only_their_permitted_businesses(
    seller: Any, manager: Any, artisan_preparation: Any, commercial_preparations: Any
) -> None:
    assert set(entities_of(client_for(seller).get(URL))) == {"COMERCIAL"}
    assert set(entities_of(client_for(manager).get(URL))) == {"ARTESANAL"}
    # Aun sin filtrar, la respuesta del otro negocio nunca se cuela en el total.
    assert client_for(seller).get(URL).json()["count"] == 2
    assert client_for(manager).get(URL).json()["count"] == 1


def test_filtering_by_a_forbidden_entity_is_rejected_without_revealing_rows(
    seller: Any, manager: Any, artisan_preparation: Any, commercial_preparations: Any
) -> None:
    denied = client_for(seller).get(URL, {"entity": "ARTESANAL"})
    assert denied.status_code == 403
    assert "results" not in denied.json()
    assert client_for(manager).get(URL, {"entity": "COMERCIAL"}).status_code == 403
    # Una entidad permitida sin filas responde vacío, no 403.
    empty = client_for(manager).get(URL, {"entity": "ARTESANAL", "state": "PREPARED"})
    assert (empty.status_code, empty.json()["count"]) == (200, 0)


def test_without_any_fiscal_permission_the_list_is_forbidden(
    nobody: Any, artisan_preparation: Any
) -> None:
    assert client_for(nobody).get(URL).status_code == 403
    assert client_for(nobody).get(URL, {"entity": "COMERCIAL"}).status_code == 403


def test_filters_by_entity_and_state(
    admin: Any, artisan_preparation: Any, commercial_preparations: Any
) -> None:
    api = client_for(admin)
    assert set(entities_of(api.get(URL, {"entity": "COMERCIAL"}))) == {"COMERCIAL"}
    assert api.get(URL, {"entity": "COMERCIAL", "state": "PREPARED"}).json()["count"] == 1
    assert api.get(URL, {"state": "DRAFT"}).json()["count"] == 2
    for query in ({"entity": "OTRA"}, {"state": "EMITIDA"}, {"page": "0"}, {"page_size": "500"}):
        assert api.get(URL, query).status_code == 400


def test_pagination_total_and_stable_order(
    admin: Any, artisan_preparation: Any, commercial_preparations: Any
) -> None:
    api = client_for(admin)
    first = api.get(URL, {"page_size": 2}).json()
    second = api.get(URL, {"page_size": 2, "page": 2}).json()
    assert (first["count"], first["total_pages"]) == (3, 2)
    ordered = [*first["results"], *second["results"]]
    assert [row["created_at"] for row in ordered] == sorted(
        (row["created_at"] for row in ordered), reverse=True
    )
    assert len({row["id"] for row in ordered}) == 3
    assert api.get(URL, {"page_size": 2}).json()["results"] == first["results"]


def test_listing_changes_nothing(
    admin: Any, artisan_preparation: Any, commercial_preparations: Any
) -> None:
    from inventory.models import InventoryMovement
    from workshop_configuration.models import NumberAllocation

    def snapshot() -> tuple[Any, ...]:
        return (
            list(FiscalPreparation.objects.values_list("pk", "state", "version").order_by("pk")),
            FiscalPreparationHistory.objects.count(),
            NumberAllocation.objects.count(),
            InventoryMovement.objects.count(),
        )

    before = snapshot()
    api = client_for(admin)
    api.get(URL)
    api.get(URL, {"entity": "COMERCIAL"})
    assert snapshot() == before


def test_rows_never_carry_an_official_issuance_state(
    admin: Any, artisan_preparation: Any, commercial_preparations: Any
) -> None:
    text = client_for(admin).get(URL).content.decode().lower()
    for forbidden in ("autorizad", "authorized", "emitida", "issued", "access_key", "clave_acceso"):
        assert forbidden not in text
    states = {row["state"] for row in client_for(admin).get(URL).json()["results"]}
    assert states <= {
        "DRAFT",
        "PREPARED",
        "CANCELLED",
    }
