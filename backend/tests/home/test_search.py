"""Búsqueda global: permisos por rol, separación fiscal, exclusión de costos y tolerancia."""

from decimal import Decimal
from typing import Any

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import MeasurementUnit, Product, ProductBrand, ProductCategory
from customer_registry.models import Customer, OwnershipPeriod, Vehicle, VehicleBrand
from fiscal.models import FiscalDocumentIdentity, FiscalNumberingScope, FiscalPreparation
from identity.models import AuditEvent
from inventory.models import InventoryPosition
from sales.models import Sale
from workshop.models import MaintenanceOrder, ServiceOperation
from workshop_configuration.models import FiscalEntity, TaxDefinition, Warehouse

pytestmark = pytest.mark.django_db
URL = "/api/v1/home/search/"

_FORBIDDEN_COST_KEYS = {
    "cost",
    "average_cost",
    "unit_cost",
    "valuation",
    "total_cost",
    "margin",
    "gross_margin",
}
_FORBIDDEN_SRI_WORDS = ("SOLICITADA", "AUTORIZADA", "RECHAZADA", "AUTHORIZED")


@pytest.fixture
def search_world(db: None, admin: Any, seller: Any, manager: Any) -> dict[str, Any]:
    commercial, _ = FiscalEntity.objects.get_or_create(
        entity_type="COMERCIAL",
        defaults={
            "ruc": "1790000000001",
            "legal_name": "Repuestos Automotrices SA",
            "trade_name": "Repuestos Jiménez",
            "address": "Av. Central",
        },
    )
    artisan, _ = FiscalEntity.objects.get_or_create(
        entity_type="ARTESANAL",
        defaults={
            "ruc": "0991234567001",
            "legal_name": "Taller Mecánico Jiménez",
            "trade_name": "Taller Jiménez",
            "address": "Av. Central",
        },
    )
    warehouse, _ = Warehouse.objects.get_or_create(id=1, defaults={"name": "Principal"})
    tax = TaxDefinition.objects.create(
        fiscal_entity=commercial,
        code="IVA15",
        name="IVA 15 %",
    )
    category = ProductCategory.objects.create(name="Encendido")
    unit = MeasurementUnit.objects.create(name="Unidad", symbol="u")
    pbrand = ProductBrand.objects.create(name="NGK")

    product = Product.objects.create(
        code="BUJ-001",
        manufacturer_code="MFR-9988",
        name="Bujía estándar",
        category=category,
        unit=unit,
        product_brand=pbrand,
        content_quantity=Decimal("1.000000"),
        sale_price=Decimal("12.50"),
        tax_definition=tax,
    )
    InventoryPosition.objects.create(
        product=product,
        warehouse=warehouse,
        quantity=Decimal("7.000000"),
        value=Decimal("43.750000"),
        average=Decimal("6.250000"),
    )

    customer = Customer.objects.create(
        person_type="NATURAL",
        name="José Mendoza",
        identification_type="CI",
        identification="0912345678",
        phone="0991112222",
        email="jose@example.com",
    )
    vbrand = VehicleBrand.objects.create(name="Chevrolet")
    now = timezone.now()
    vehicle_open = Vehicle.objects.create(plate="GBA-1234", brand=vbrand, model="Aveo", year=2018)
    OwnershipPeriod.objects.create(vehicle=vehicle_open, customer=customer, started_at=now)

    vehicle_closed = Vehicle.objects.create(
        plate="PCQ-0571", brand=vbrand, model="Spark", year=2020
    )
    OwnershipPeriod.objects.create(vehicle=vehicle_closed, customer=customer, started_at=now)

    today = timezone.localdate()
    open_order = MaintenanceOrder.objects.create(
        sequence=1,
        number="ART-OT-000001",
        fiscal_entity=artisan,
        customer=customer,
        vehicle=vehicle_open,
        customer_snapshot={"id": customer.pk, "name": customer.name},
        vehicle_snapshot={"id": vehicle_open.pk, "plate": vehicle_open.plate},
        opened_on=today,
        odometer_km=45000,
        state="REGISTERED",
        created_by=manager,
        updated_by=manager,
    )
    closed_order = MaintenanceOrder.objects.create(
        sequence=2,
        number="ART-OT-000002",
        fiscal_entity=artisan,
        customer=customer,
        vehicle=vehicle_closed,
        customer_snapshot={"id": customer.pk, "name": customer.name},
        vehicle_snapshot={"id": vehicle_closed.pk, "plate": vehicle_closed.plate},
        opened_on=today,
        odometer_km=12000,
        state="FINALIZED",
        created_by=manager,
        updated_by=manager,
    )

    sale = Sale.objects.create(
        customer=customer,
        fiscal_entity=commercial,
        warehouse=warehouse,
        condition="CONTADO",
        state="CONFIRMED",
        internal_number="COM-VEN-000001",
        operational_date=today,
        base_total=Decimal("25.00"),
        tax_total=Decimal("0.00"),
        grand_total=Decimal("25.00"),
        created_by=seller,
    )
    commercial_prep = FiscalPreparation.objects.create(
        fiscal_entity=commercial,
        commercial_sale=sale,
        state="DRAFT",
        source_version=1,
        created_by=seller,
    )

    service_op = ServiceOperation.objects.create(
        order=open_order,
        fiscal_entity=artisan,
        customer=customer,
        customer_snapshot={"schema_version": 1, "id": customer.pk, "name": customer.name},
        vehicle_snapshot={"schema_version": 1, "id": vehicle_open.pk, "plate": vehicle_open.plate},
        fiscal_snapshot={"schema_version": 1, "entity_type": "ARTESANAL"},
        internal_number="ART-SER-000001",
        condition="CONTADO",
        state="CONFIRMED",
        operational_date=today,
        base_total=Decimal("40.00"),
        tax_total=Decimal("0.00"),
        grand_total=Decimal("40.00"),
        created_by=manager,
    )
    artisan_prep = FiscalPreparation.objects.create(
        fiscal_entity=artisan,
        artisan_operation=service_op,
        state="PREPARED",
        source_version=1,
        prepared_at=timezone.now(),
        prepared_by=manager,
        snapshot={"schema_version": "factura-2.1.0"},
        created_by=manager,
    )

    return {
        "commercial": commercial,
        "artisan": artisan,
        "tax": tax,
        "category": category,
        "unit": unit,
        "product": product,
        "customer": customer,
        "vehicle_open": vehicle_open,
        "vehicle_closed": vehicle_closed,
        "open_order": open_order,
        "closed_order": closed_order,
        "commercial_prep": commercial_prep,
        "artisan_prep": artisan_prep,
    }


# --- Autenticación y solo lectura ------------------------------------------------------------


def test_anonymous_request_is_rejected() -> None:
    assert APIClient().get(URL, {"q": "mendoza"}).status_code in {401, 403}


def test_user_with_temporary_password_is_rejected(client_for: Any, seller: Any) -> None:
    seller.must_change_password = True
    seller.save(update_fields=["must_change_password"])
    assert client_for(seller).get(URL, {"q": "mendoza"}).status_code == 403


def test_endpoint_is_read_only(client_for: Any, admin: Any) -> None:
    assert client_for(admin).post(URL, {"q": "mendoza"}, format="json").status_code == 405


def test_short_query_returns_empty_groups_without_db_queries(client_for: Any, admin: Any) -> None:
    api = client_for(admin)
    for term in ("", " ", "a"):
        body = api.get(URL, {"q": term}).json()
        assert body["vehicles"] == {"total": 0, "items": []}
        assert body["customers"] == {"total": 0, "items": []}
        assert body["invoices"] == {"total": 0, "items": []}
        assert body["products"] == {"total": 0, "items": []}


def test_search_never_writes_nor_audits(
    client_for: Any, admin: Any, search_world: dict[str, Any]
) -> None:
    before_audit = AuditEvent.objects.count()
    api = client_for(admin)
    with CaptureQueriesContext(connection) as queries:
        response = api.get(URL, {"q": "mendoza"})
    assert response.status_code == 200
    assert AuditEvent.objects.count() == before_audit
    for sql in (q["sql"].lstrip().upper() for q in queries):
        assert not sql.startswith(("INSERT", "UPDATE", "DELETE")), sql


# --- Tolerancia de formato y límite por grupo ------------------------------------------------


def test_plate_without_hyphen_and_diacritics_match(
    client_for: Any, admin: Any, search_world: dict[str, Any]
) -> None:
    api = client_for(admin)

    plate_res = api.get(URL, {"q": "gba1234"}).json()
    assert plate_res["vehicles"]["total"] == 1
    assert plate_res["vehicles"]["items"][0]["plate"] == "GBA-1234"
    assert plate_res["vehicles"]["items"][0]["open_order"]["id"] == search_world["open_order"].pk

    customer_res = api.get(URL, {"q": "jose"}).json()
    assert customer_res["customers"]["total"] == 1
    assert customer_res["customers"]["items"][0]["full_name"] == "José Mendoza"

    id_res = api.get(URL, {"q": "0912345678"}).json()
    assert id_res["customers"]["total"] == 1

    product_res = api.get(URL, {"q": "bujia"}).json()
    assert product_res["products"]["total"] == 1
    assert product_res["products"]["items"][0]["code"] == "BUJ-001"
    assert product_res["products"]["items"][0]["stock"] == "7"

    mfr_res = api.get(URL, {"q": "mfr-9988"}).json()
    assert mfr_res["products"]["total"] == 1

    inv_res = api.get(URL, {"q": "COM-VEN-000001"}).json()
    assert inv_res["invoices"]["total"] == 1
    assert inv_res["invoices"]["items"][0]["id"] == str(search_world["commercial_prep"].pk)


def test_group_limit_caps_items_at_five_with_real_total(
    client_for: Any, admin: Any, search_world: dict[str, Any]
) -> None:
    for idx in range(7):
        Product.objects.create(
            code=f"FIL-{idx:03d}",
            name=f"Filtro de aceite {idx}",
            category=search_world["category"],
            unit=search_world["unit"],
            content_quantity=Decimal("1.000000"),
            sale_price=Decimal("10.00"),
            tax_definition=search_world["tax"],
        )
    body = client_for(admin).get(URL, {"q": "filtro"}).json()
    assert body["products"]["total"] == 7
    assert len(body["products"]["items"]) == 5


# --- Autorización por rol, separación fiscal y exclusión de costos ---------------------------


def test_seller_sees_only_commercial_invoices_and_no_open_order(
    client_for: Any, seller: Any, search_world: dict[str, Any]
) -> None:
    body = client_for(seller).get(URL, {"q": "mendoza"}).json()
    assert body["customers"]["total"] == 1
    assert body["vehicles"]["total"] == 2
    assert all(v["open_order"] is None for v in body["vehicles"]["items"])

    invoices = body["invoices"]
    assert invoices["total"] == 1
    assert [i["entity"] for i in invoices["items"]] == ["COMERCIAL"]
    assert invoices["items"][0]["state"] == "DRAFT"
    assert "total_amount" not in invoices
    assert "grand_total" not in invoices


def test_manager_sees_open_order_and_only_artisan_invoices(
    client_for: Any, manager: Any, search_world: dict[str, Any]
) -> None:
    body = client_for(manager).get(URL, {"q": "mendoza"}).json()
    by_plate = {v["plate"]: v for v in body["vehicles"]["items"]}
    assert by_plate["GBA-1234"]["open_order"] == {
        "id": search_world["open_order"].pk,
        "number": "ART-OT-000001",
        "status": "REGISTERED",
    }
    assert by_plate["PCQ-0571"]["open_order"] is None

    invoices = body["invoices"]
    assert invoices["total"] == 1
    assert [i["entity"] for i in invoices["items"]] == ["ARTESANAL"]
    assert invoices["items"][0]["state"] == "PREPARED"


@pytest.mark.parametrize("fixture_name", ["seller_manager", "admin"])
def test_accumulated_roles_see_both_businesses_without_joint_total_or_sri_marks(
    fixture_name: str,
    client_for: Any,
    request: pytest.FixtureRequest,
    search_world: dict[str, Any],
) -> None:
    user = request.getfixturevalue(fixture_name)
    body = client_for(user).get(URL, {"q": "mendoza"}).json()
    invoices = body["invoices"]
    assert invoices["total"] == 2
    assert {i["entity"] for i in invoices["items"]} == {"COMERCIAL", "ARTESANAL"}
    assert set(invoices) == {"total", "items"}
    for row in invoices["items"]:
        assert row["state"] in {"DRAFT", "PREPARED", "CANCELLED"}
        assert row["state"].upper() not in _FORBIDDEN_SRI_WORDS


def test_nobody_receives_null_for_all_groups(
    client_for: Any, nobody: Any, search_world: dict[str, Any]
) -> None:
    body = client_for(nobody).get(URL, {"q": "mendoza"}).json()
    assert body["vehicles"] is None
    assert body["customers"] is None
    assert body["invoices"] is None
    assert body["products"] is None


@pytest.mark.parametrize("fixture_name", ["admin", "seller", "manager"])
def test_products_never_expose_cost_or_valuation_to_any_role(
    fixture_name: str,
    client_for: Any,
    request: pytest.FixtureRequest,
    search_world: dict[str, Any],
) -> None:
    user = request.getfixturevalue(fixture_name)
    body = client_for(user).get(URL, {"q": "bujia"}).json()
    assert body["products"]["total"] == 1
    item = body["products"]["items"][0]
    assert not (_FORBIDDEN_COST_KEYS & set(item))
    assert item["sale_price"] == "12.50"
    assert item["stock"] == "7"


def test_product_stock_is_omitted_without_inventory_permission(
    client_for: Any,
    seller: Any,
    search_world: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import inventory.application.home_summary as inv_summary

    monkeypatch.setattr(inv_summary, "has_permission", lambda _actor, _perm: False)
    body = client_for(seller).get(URL, {"q": "bujia"}).json()
    assert body["products"]["total"] == 1
    assert body["products"]["items"][0]["stock"] is None


def test_invoice_matches_trial_fiscal_identity_number(
    client_for: Any, manager: Any, search_world: dict[str, Any]
) -> None:
    scope = FiscalNumberingScope.objects.create(
        fiscal_entity=search_world["artisan"],
        document_type="01",
        establishment_code="001",
        emission_point_code="002",
        environment="1",
        last_sequential=42,
    )
    FiscalDocumentIdentity.objects.create(
        preparation=search_world["artisan_prep"],
        numbering_scope=scope,
        document_type="01",
        environment="1",
        ruc=search_world["artisan"].ruc,
        sequential=42,
        numeric_code="12345678",
        emission_date=timezone.localdate(),
        access_key="0" * 49,
        created_by=manager,
    )
    api = client_for(manager)
    for term in ("001-002-000000042", "001002000000042"):
        body = api.get(URL, {"q": term}).json()
        assert body["invoices"]["total"] == 1
        assert body["invoices"]["items"][0]["number"] == "001-002-000000042"
        assert body["invoices"]["items"][0]["state"] == "PREPARED"
