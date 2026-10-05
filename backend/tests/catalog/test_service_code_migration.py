"""Los servicios existentes reciben un código único, en orden de creación, sin otros cambios."""

from datetime import timedelta

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone

BEFORE = ("catalog", "0002_product_manufacturer_code")
AFTER = ("catalog", "0005_service_code_required_unique")


@pytest.mark.django_db(transaction=True)
def test_existing_services_receive_codes_in_creation_order_without_other_changes() -> None:
    from workshop_configuration.models import FiscalEntity, TaxDefinition

    entity = FiscalEntity.objects.create(
        entity_type="ARTESANAL", ruc="0991234567001", legal_name="Taller existente"
    )
    tax = TaxDefinition.objects.create(fiscal_entity=entity, code="ART", name="Artesanal")

    executor = MigrationExecutor(connection)
    executor.migrate([BEFORE])
    old_apps = executor.loader.project_state([BEFORE]).apps
    old_service = old_apps.get_model("catalog", "Service")
    now = timezone.now()
    created = []
    for index, (name, price, active) in enumerate(
        [("Alineación", "20.00", True), ("Balanceo", "15.50", False), ("Diagnóstico", "0.00", True)]
    ):
        service = old_service.objects.create(
            name=name,
            description=f"Descripción {index}",
            reference_price=price,
            tax_definition_id=tax.pk,
            is_active=active,
        )
        old_service.objects.filter(pk=service.pk).update(created_at=now + timedelta(minutes=index))
        created.append((service.pk, name, price, active, service.version))

    executor = MigrationExecutor(connection)
    executor.migrate([AFTER])
    apps = executor.loader.project_state([AFTER]).apps
    migrated = apps.get_model("catalog", "Service")
    counter = apps.get_model("catalog", "ServiceCodeCounter")
    for position, (pk, name, price, active, version) in enumerate(created, start=1):
        row = migrated.objects.get(pk=pk)
        assert row.code == f"SRV-{position:06d}"
        assert (row.name, f"{row.reference_price:.2f}", row.is_active, row.version) == (
            name,
            price,
            active,
            version,
        )
    assert counter.objects.get(pk=1).last_number == 3
    assert len({row.code for row in migrated.objects.all()}) == 3
