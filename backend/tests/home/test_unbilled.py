"""Pruebas TDD de la lista «Falta facturar» en Inicio (GET /api/v1/home/unbilled/)."""

from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from customer_registry.models import Customer
from fiscal.models import FiscalPreparation
from identity.models import User
from sales.models import Sale
from workshop_configuration.models import FiscalEntity, Warehouse


@pytest.mark.django_db
def test_unbilled_separates_entities_and_excludes_prepared_and_voided(
    admin: User, seller: User, manager: User, nobody: User, client_for: Any
) -> None:
    com, _ = FiscalEntity.objects.get_or_create(
        entity_type="COMERCIAL",
        defaults={"legal_name": "Comercial SA", "ruc": "1790000000001"},
    )
    art, _ = FiscalEntity.objects.get_or_create(
        entity_type="ARTESANAL",
        defaults={"legal_name": "Taller Artesanal", "ruc": "1790000000002"},
    )
    customer = Customer.objects.create(
        person_type="NATURAL",
        name="Cliente Pendiente",
        identification_type="CI",
        identification="0912345678",
        phone="0991112222",
    )
    wh, _ = Warehouse.objects.get_or_create(id=1, defaults={"name": "Principal"})
    snap = {"schema_version": 1, "name": "Cliente Pendiente"}
    fsnap = {"schema_version": 1}
    sale_unbilled = Sale.objects.create(
        fiscal_entity=com,
        warehouse=wh,
        customer=customer,
        condition="CONTADO",
        state="CONFIRMED",
        internal_number="COM-VEN-000101",
        operational_date=date(2026, 11, 20),
        grand_total=Decimal("23.00"),
        base_total=Decimal("20.00"),
        tax_total=Decimal("3.00"),
        customer_snapshot=snap,
        fiscal_snapshot=fsnap,
        created_by=admin,
    )
    sale_prepared = Sale.objects.create(
        fiscal_entity=com,
        warehouse=wh,
        customer=customer,
        condition="CONTADO",
        state="CONFIRMED",
        internal_number="COM-VEN-000102",
        operational_date=date(2026, 11, 20),
        grand_total=Decimal("10.00"),
        base_total=Decimal("10.00"),
        tax_total=Decimal("0.00"),
        customer_snapshot=snap,
        fiscal_snapshot=fsnap,
        created_by=admin,
    )
    Sale.objects.create(
        fiscal_entity=com,
        warehouse=wh,
        customer=customer,
        condition="CONTADO",
        state="VOIDED",
        internal_number="COM-VEN-000103",
        operational_date=date(2026, 11, 20),
        grand_total=Decimal("15.00"),
        base_total=Decimal("15.00"),
        tax_total=Decimal("0.00"),
        customer_snapshot=snap,
        fiscal_snapshot=fsnap,
        created_by=admin,
    )
    FiscalPreparation.objects.create(
        fiscal_entity=com,
        commercial_sale=sale_prepared,
        state="PREPARED",
        source_version=1,
        snapshot={"schema_version": 4},
        prepared_at=timezone.now(),
        prepared_by=admin,
        created_by=admin,
    )

    # Administrador ve ambos negocios por separado, sin total conjunto y sin términos SRI
    res_admin = client_for(admin).get("/api/v1/home/unbilled/")
    assert res_admin.status_code == 200
    body = res_admin.json()
    assert body["commercial"]["count"] == 1
    assert [i["number"] for i in body["commercial"]["items"]] == [sale_unbilled.internal_number]
    assert body["artisan"]["count"] == 0
    assert "autorizad" not in str(body).lower()
    assert "emitida" not in str(body).lower()

    # Vendedor solo ve comercial; artesanal es None
    res_seller = client_for(seller).get("/api/v1/home/unbilled/")
    assert res_seller.status_code == 200
    assert res_seller.json()["commercial"]["count"] == 1
    assert res_seller.json()["artisan"] is None

    # Encargado solo ve artesanal; comercial es None
    res_manager = client_for(manager).get("/api/v1/home/unbilled/")
    assert res_manager.status_code == 200
    assert res_manager.json()["commercial"] is None
    assert res_manager.json()["artisan"]["count"] == 0

    # Usuario sin roles recibe ambos en None
    res_nobody = client_for(nobody).get("/api/v1/home/unbilled/")
    assert res_nobody.status_code == 200
    assert res_nobody.json() == {"commercial": None, "artisan": None}

    # Sin autenticar -> 403
    assert APIClient().get("/api/v1/home/unbilled/").status_code in (401, 403)
    assert art.pk is not None
