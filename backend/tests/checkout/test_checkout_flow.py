"""Pruebas TDD de «Cobrar y facturar» (flujo, permisos, fallos parciales, idempotencia, stock)."""

from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from tests.workshop_configuration.profile_helpers import (
    applicable,
    profile_conditions,
    qualification,
)

from catalog.models import MeasurementUnit, Product, ProductCategory, Service
from customer_registry.models import Customer, OwnershipPeriod, Vehicle, VehicleBrand
from fiscal.models import FiscalPreparation
from identity.domain.authorization import Role
from identity.models import User, UserRole
from inventory.models import InventoryPosition
from sales.models import CommercialPayment, Sale
from workshop.application import orders, parts, service_lines
from workshop.models import ArtisanPayment, MaintenanceOrder, ServiceOperation
from workshop_configuration.application import official_catalog
from workshop_configuration.application.electronic_profiles import save_profile
from workshop_configuration.application.fiscal_tax_mapping import create_mapping
from workshop_configuration.models import (
    DocumentSeries,
    FiscalEmissionPoint,
    FiscalEntity,
    FiscalEstablishment,
    NumberingScope,
    OfficialCatalogEntry,
    TaxDefinition,
    TaxPeriod,
    Warehouse,
    WorkshopConfiguration,
)


def _ensure_base_entities() -> tuple[
    FiscalEntity, FiscalEntity, Warehouse, TaxDefinition, TaxDefinition
]:
    WorkshopConfiguration.objects.update_or_create(pk=1, defaults={"is_initialized": True})
    wh, _ = Warehouse.objects.get_or_create(id=1, defaults={"name": "Principal"})
    com, _ = FiscalEntity.objects.get_or_create(
        entity_type="COMERCIAL",
        defaults={
            "legal_name": "Comercial SA",
            "trade_name": "Repuestos Automotrices",
            "ruc": "1790000000001",
            "address": "Av. Matriz 100",
        },
    )
    art, _ = FiscalEntity.objects.get_or_create(
        entity_type="ARTESANAL",
        defaults={
            "legal_name": "Taller Artesanal",
            "trade_name": "Transmisiones Jimenez",
            "ruc": "1790000000002",
            "address": "Av. Taller 200",
        },
    )
    tax_com, _ = TaxDefinition.objects.get_or_create(
        fiscal_entity=com, code="IVA", defaults={"name": "IVA"}
    )
    if not TaxPeriod.objects.filter(tax_definition=tax_com).exists():
        TaxPeriod.objects.create(
            tax_definition=tax_com, rate=Decimal("15"), starts_on=date(2025, 1, 1)
        )
    tax_art, _ = TaxDefinition.objects.get_or_create(
        fiscal_entity=art, code="ART0", defaults={"name": "Artesanal 0%"}
    )
    if not TaxPeriod.objects.filter(tax_definition=tax_art).exists():
        TaxPeriod.objects.create(
            tax_definition=tax_art, rate=Decimal("0"), starts_on=date(2025, 1, 1)
        )
    scope_v, _ = NumberingScope.objects.get_or_create(fiscal_entity=com, document_type="VENTA")
    DocumentSeries.objects.get_or_create(
        numbering_scope=scope_v, code="COM-VEN", defaults={"is_active": True}
    )
    scope_s, _ = NumberingScope.objects.get_or_create(fiscal_entity=art, document_type="SERVICIO")
    DocumentSeries.objects.get_or_create(
        numbering_scope=scope_s, code="ART-SER", defaults={"is_active": True}
    )
    return com, art, wh, tax_com, tax_art


def _user(username: str, *roles: Role) -> User:
    user = User.objects.create_user(username=username, password="x" * 14)
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    return user


def _client(user: User) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _setup_fiscal_ready(admin: User) -> None:
    com, art, _wh, iva_com, art_tax = _ensure_base_entities()
    official_catalog.ensure_installed()
    iva15 = OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=official_catalog.SELECTABLE_TAX_VERSION, code="4"
    ).pk
    iva0 = OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=official_catalog.SELECTABLE_TAX_VERSION, code="0"
    ).pk

    est_c = FiscalEstablishment.objects.create(fiscal_entity=com, code="001", address="Sucursal 1")
    FiscalEmissionPoint.objects.create(establishment=est_c, code="001")
    save_profile(
        actor=admin,
        entity_id=com.pk,
        expected_revision=0,
        idempotency_key="co-prof-com-1",
        payload={"conditions": profile_conditions()},
    )
    create_mapping(
        actor=admin,
        definition_id=iva_com.pk,
        catalog_entry_id=iva15,
        starts_on=date(2025, 1, 1),
        ends_on=None,
        source="Resolución vigente",
    )

    est_a = FiscalEstablishment.objects.create(fiscal_entity=art, code="001", address="Taller 1")
    FiscalEmissionPoint.objects.create(establishment=est_a, code="001")
    save_profile(
        actor=admin,
        entity_id=art.pk,
        expected_revision=0,
        idempotency_key="co-prof-art-1",
        payload={
            "conditions": profile_conditions(
                artisan_qualification=qualification(
                    ends_on="2030-12-31", number="CAL-001", starts_on="2025-01-01"
                )
            )
        },
    )
    create_mapping(
        actor=admin,
        definition_id=art_tax.pk,
        catalog_entry_id=iva0,
        starts_on=date(2025, 1, 1),
        ends_on=None,
        source="Calificación artesanal",
    )


def _setup_catalog_and_order(
    admin: User, *, stock: int = 5, email: str = "cli@example.com"
) -> dict[str, Any]:
    _com, _art, wh, tax_com, tax_art = _ensure_base_entities()
    cat = ProductCategory.objects.create(name="Frenos")
    unit = MeasurementUnit.objects.create(name="Unidad", symbol="u")

    product = Product.objects.create(
        code="PAST-001",
        name="Pastillas de freno",
        category=cat,
        content_quantity=Decimal("1"),
        unit=unit,
        sale_price=Decimal("23.00"),
        tax_definition=tax_com,
    )
    InventoryPosition.objects.create(
        product=product,
        warehouse=wh,
        quantity=Decimal(stock),
        value=Decimal(stock) * Decimal("10.000000"),
        average=Decimal("10.000000"),
    )
    service = Service.objects.create(
        code="SRV-0001",
        name="Cambio de pastillas",
        reference_price=Decimal("20.00"),
        tax_definition=tax_art,
    )
    customer = Customer.objects.create(
        person_type="NATURAL",
        name="Carlos Mendoza",
        identification_type="CI",
        identification="0912345678",
        phone="0991234567",
        email=email,
        address="Av. Cliente 1",
    )
    brand = VehicleBrand.objects.create(name="Chevrolet")
    vehicle = Vehicle.objects.create(
        plate="GBA-1234",
        brand=brand,
        model="Sail",
    )
    OwnershipPeriod.objects.create(vehicle=vehicle, customer=customer, started_at=timezone.now())
    created = orders.create_order(
        actor=admin,
        payload={
            "customer_id": customer.pk,
            "vehicle_id": vehicle.pk,
            "opened_on": "2026-11-22",
            "odometer_km": 50000,
            "diagnosis": "Desgaste de pastillas delanteras",
            "notes": "Frenos",
            "idempotency_key": "co-order-create-01",
        },
    )
    order_id = int(created.body["id"])
    service_lines.add_line(
        actor=admin,
        order_id=order_id,
        payload={
            "service_id": service.pk,
            "quantity": "1",
            "applied_price": "20.00",
            "expected_version": 1,
            "idempotency_key": "co-srv-line-01",
        },
    )
    parts.add_part(
        actor=admin,
        order_id=order_id,
        payload={
            "product_id": product.pk,
            "quantity": 1,
            "expected_version": 2,
            "idempotency_key": "co-part-line-01",
        },
    )
    return {
        "order_id": order_id,
        "customer": customer,
        "product": product,
        "service": service,
    }


@pytest.mark.django_db
def test_maintenance_checkout_full_cash_closes_order_and_prepares_two_invoices() -> None:
    daily = _user("daily_u6", Role.ADMINISTRADOR, Role.VENDEDOR, Role.ENCARGADO_TALLER)
    _setup_fiscal_ready(daily)
    data = _setup_catalog_and_order(daily, email="")
    client = _client(daily)

    prev = client.get(f"/api/v1/checkout/maintenance/{data['order_id']}/")
    assert prev.status_code == 200
    body = prev.json()
    assert body["artisan"]["visible"] is True
    assert body["artisan"]["total"] == "20.00"
    assert body["commercial"]["visible"] is True
    assert body["commercial"]["total"] == "23.00"
    assert body["closure"]["can_close"] is True
    assert body["closure"]["default_checked"] is True

    res = client.post(
        "/api/v1/checkout/execute/",
        {
            "origin_kind": "MAINTENANCE",
            "order_id": data["order_id"],
            "payment_mode": "CASH",
            "include_invoices": True,
            "receiver_email": "cmendoza@example.com",
            "save_email_to_customer": True,
            "close_order": True,
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="u6-full-maint-01",
    )
    assert res.status_code == 200, res.json()
    out = res.json()
    assert out["overall_status"] == "completed", (
        out["commercial"].get("fiscal_error"),
        out["artisan"].get("fiscal_error"),
    )
    assert out["replayed"] is False
    assert out["commercial"]["confirmed"] is True
    assert out["commercial"]["paid"] is True
    assert out["commercial"]["paid_amount"] == "23.00"
    assert out["commercial"]["fiscal_state"] == "PREPARED"
    assert out["artisan"]["confirmed"] is True
    assert out["artisan"]["paid"] is True
    assert out["artisan"]["paid_amount"] == "20.00"
    assert out["artisan"]["fiscal_state"] == "PREPARED"
    assert out["customer_email_updated"] is True
    assert out["order_closure"]["closed"] is True

    # Separación estricta: dos pagos, dos preparaciones, correo guardado y orden finalizada.
    assert CommercialPayment.objects.count() == 1
    assert ArtisanPayment.objects.count() == 1
    assert FiscalPreparation.objects.filter(state="PREPARED").count() == 2
    data["customer"].refresh_from_db()
    assert data["customer"].email == "cmendoza@example.com"
    assert MaintenanceOrder.objects.get(pk=data["order_id"]).state == "FINALIZED"

    # Idempotencia: repetir con la misma clave devuelve replay sin duplicar
    replay = client.post(
        "/api/v1/checkout/execute/",
        {
            "origin_kind": "MAINTENANCE",
            "order_id": data["order_id"],
            "payment_mode": "CASH",
            "include_invoices": True,
            "receiver_email": "cmendoza@example.com",
            "save_email_to_customer": True,
            "close_order": True,
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="u6-full-maint-01",
    )
    assert replay.status_code == 200
    assert replay.json()["replayed"] is True
    assert CommercialPayment.objects.count() == 1
    assert ArtisanPayment.objects.count() == 1

    # Conflicto 409 con misma clave y distinto payload
    conflict = client.post(
        "/api/v1/checkout/execute/",
        {
            "origin_kind": "MAINTENANCE",
            "order_id": data["order_id"],
            "payment_mode": "TRANSFER",
            "include_invoices": True,
            "receiver_email": "cmendoza@example.com",
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="u6-full-maint-01",
    )
    assert conflict.status_code == 409


@pytest.mark.django_db
def test_partial_fiscal_failure_keeps_payments_intact_dp034_rule5() -> None:
    daily = _user("daily_partial", Role.ADMINISTRADOR, Role.VENDEDOR, Role.ENCARGADO_TALLER)
    # Sin perfil fiscal la preparación fallará, pero los cobros quedan en firme.
    data = _setup_catalog_and_order(daily, email="cli@example.com")
    client = _client(daily)

    res = client.post(
        "/api/v1/checkout/execute/",
        {
            "origin_kind": "MAINTENANCE",
            "order_id": data["order_id"],
            "payment_mode": "CASH",
            "include_invoices": True,
            "receiver_email": "cli@example.com",
            "close_order": False,
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="u6-partial-fail-01",
    )
    assert res.status_code == 200, res.json()
    out = res.json()
    assert out["overall_status"] == "partial"
    assert out["commercial"]["paid"] is True
    assert out["artisan"]["paid"] is True
    assert out["commercial"]["fiscal_state"] == "FAILED"
    assert out["artisan"]["fiscal_state"] == "FAILED"
    assert CommercialPayment.objects.count() == 1
    assert ArtisanPayment.objects.count() == 1
    assert MaintenanceOrder.objects.get(pk=data["order_id"]).state == "REGISTERED"


@pytest.mark.django_db
def test_quick_sale_one_step_and_solo_cobrar_without_email() -> None:
    admin = _user("admin_qs", Role.ADMINISTRADOR)
    seller = _user("seller_qs", Role.VENDEDOR)
    _setup_fiscal_ready(admin)
    data = _setup_catalog_and_order(admin, email="")
    client = _client(seller)

    # Solo cobrar sin correo (include_invoices=False) funciona
    res = client.post(
        "/api/v1/checkout/execute/",
        {
            "origin_kind": "QUICK_SALE",
            "customer_id": data["customer"].pk,
            "lines": [{"product_id": data["product"].pk, "quantity": 1}],
            "payment_mode": "TRANSFER",
            "include_invoices": False,
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="u6-qs-nocorreo-01",
    )
    assert res.status_code == 200, res.json()
    out = res.json()
    assert out["overall_status"] == "completed", (
        out["commercial"].get("fiscal_error"),
        out["artisan"].get("fiscal_error"),
    )
    assert out["commercial"]["confirmed"] is True
    assert out["commercial"]["paid"] is True
    assert out["commercial"]["fiscal_state"] == "SKIPPED"
    assert Sale.objects.filter(state="CONFIRMED").count() == 1


@pytest.mark.django_db
def test_manager_cannot_confirm_or_pay_commercial_parts() -> None:
    admin = _user("admin_perm", Role.ADMINISTRADOR)
    manager = _user("mgr_only", Role.ENCARGADO_TALLER)
    _setup_fiscal_ready(admin)
    data = _setup_catalog_and_order(admin, email="cli@example.com")
    client = _client(manager)

    prev = client.get(f"/api/v1/checkout/maintenance/{data['order_id']}/")
    assert prev.status_code == 200
    assert prev.json()["artisan"]["visible"] is True
    assert prev.json()["commercial"]["visible"] is False
    # No puede cerrar la orden mientras haya repuestos abiertos sin confirmar (DP-021)
    assert prev.json()["closure"]["can_close"] is False

    # Si intenta pasar commercial_payment explícito -> 403
    denied = client.post(
        "/api/v1/checkout/execute/",
        {
            "origin_kind": "MAINTENANCE",
            "order_id": data["order_id"],
            "payment_mode": "CASH",
            "commercial_payment": {"parts": [{"method": "EFECTIVO", "amount": "23.00"}]},
            "include_invoices": False,
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="u6-mgr-denied-01",
    )
    assert denied.status_code == 403

    # Si ejecuta normal, solo opera servicios y deja la venta vinculada en borrador
    ok = client.post(
        "/api/v1/checkout/execute/",
        {
            "origin_kind": "MAINTENANCE",
            "order_id": data["order_id"],
            "payment_mode": "CASH",
            "include_invoices": True,
            "receiver_email": "cli@example.com",
            "close_order": True,
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="u6-mgr-artisan-01",
    )
    assert ok.status_code == 200
    assert ok.json()["artisan"]["paid"] is True
    assert ok.json()["commercial"]["executed"] is False
    assert ok.json()["order_closure"]["closed"] is False
    assert ServiceOperation.objects.filter(state="CONFIRMED").count() == 1
    assert Sale.objects.filter(state="CONFIRMED").count() == 0
    assert applicable is not None



@pytest.mark.django_db
def test_checkout_blocks_when_stock_is_insufficient_without_mutating() -> None:
    daily = _user("daily_stock", Role.ADMINISTRADOR, Role.VENDEDOR, Role.ENCARGADO_TALLER)
    _setup_fiscal_ready(daily)
    data = _setup_catalog_and_order(daily, stock=1, email="cli@example.com")
    client = _client(daily)

    # Venta rápida pide 2 unidades cuando solo hay 1 (y además está reservada): debe bloquear 409
    res = client.post(
        "/api/v1/checkout/execute/",
        {
            "origin_kind": "QUICK_SALE",
            "customer_id": data["customer"].pk,
            "lines": [{"product_id": data["product"].pk, "quantity": 2}],
            "payment_mode": "CASH",
            "include_invoices": True,
            "receiver_email": "cli@example.com",
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="u6-stock-block-01",
    )
    assert res.status_code == 409
    assert CommercialPayment.objects.count() == 0
    assert Sale.objects.filter(state="CONFIRMED").count() == 0


@pytest.mark.django_db
def test_checkout_partial_payment_per_business_and_credit_term() -> None:
    daily = _user("daily_part", Role.ADMINISTRADOR, Role.VENDEDOR, Role.ENCARGADO_TALLER)
    _setup_fiscal_ready(daily)
    data = _setup_catalog_and_order(daily, stock=5, email="cli@example.com")
    client = _client(daily)

    # Pago parcial sin montos por negocio -> 400 (nunca reparte en silencio)
    bad = client.post(
        "/api/v1/checkout/execute/",
        {
            "origin_kind": "MAINTENANCE",
            "order_id": data["order_id"],
            "payment_mode": "CASH",
            "partial": True,
            "include_invoices": True,
            "receiver_email": "cli@example.com",
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="u6-partial-bad-01",
    )
    assert bad.status_code == 400

    # Pago parcial explícito por negocio + plazo en días para el saldo restante
    ok = client.post(
        "/api/v1/checkout/execute/",
        {
            "origin_kind": "MAINTENANCE",
            "order_id": data["order_id"],
            "payment_mode": "CASH",
            "partial": True,
            "artisan_payment": {"parts": [{"method": "EFECTIVO", "amount": "20.00"}]},
            "commercial_payment": {"parts": [{"method": "EFECTIVO", "amount": "10.00"}]},
            "credit_term_days": 30,
            "include_invoices": True,
            "receiver_email": "cli@example.com",
            "close_order": True,
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="u6-partial-ok-01",
    )
    assert ok.status_code == 200, ok.json()
    out = ok.json()
    assert out["overall_status"] == "completed"
    assert out["artisan"]["paid_amount"] == "20.00"
    assert out["commercial"]["paid_amount"] == "10.00"
    assert out["order_closure"]["closed"] is True
    assert FiscalPreparation.objects.filter(state="PREPARED").count() == 2
