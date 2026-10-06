"""Migración sobre ventas previas: aditiva, sin ofertas retroactivas y reversible sin datos."""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

SALES_BEFORE = ("sales", "0007_commercial_withholding")
PROFORMAS_ZERO = ("proformas", None)


def _restore_latest_schema() -> None:
    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())


def _targets_after(executor: MigrationExecutor) -> list[tuple[str, str]]:
    leaves = executor.loader.graph.leaf_nodes()
    return [node for node in leaves if node[0] in {"sales", "proformas"}]


@pytest.mark.django_db
def test_migration_graph_has_no_cycle_and_sales_depends_on_proformas() -> None:
    loader = MigrationExecutor(connection).loader
    loader.graph.ensure_not_cyclic()
    initial = loader.graph.nodes[("proformas", "0001_initial")]
    assert not [dep for dep in initial.dependencies if dep[0] == "sales"]
    sales_origin = [
        migration
        for (app, _), migration in loader.graph.nodes.items()
        if app == "sales" and ("proformas", "0001_initial") in migration.dependencies
    ]
    assert sales_origin, "la migración de ventas depende de la inicial de proformas"


@pytest.mark.django_db(transaction=True)
def test_existing_direct_and_maintenance_sales_survive_forward_and_backward() -> None:
    from django.contrib.auth import get_user_model

    from customer_registry.models import Customer, Vehicle, VehicleBrand
    from workshop.models import MaintenanceOrder
    from workshop_configuration.models import FiscalEntity, Warehouse

    try:
        executor = MigrationExecutor(connection)
        executor.migrate([SALES_BEFORE, PROFORMAS_ZERO])
        assert "proformas_proforma" not in connection.introspection.table_names()

        user = get_user_model().objects.create_user(username="mig-user", password="x" * 14)
        commercial = FiscalEntity.objects.create(
            entity_type="COMERCIAL", legal_name="Comercial", ruc="1790000000001"
        )
        artisan = FiscalEntity.objects.create(
            entity_type="ARTESANAL", legal_name="Taller", ruc="1790000000002"
        )
        warehouse, _ = Warehouse.objects.get_or_create(id=1, defaults={"name": "Principal"})
        customer = Customer.objects.create(
            person_type="NATURAL",
            name="Cliente previo",
            identification_type="CI",
            identification="1712345678",
            phone="0999999999",
        )
        brand = VehicleBrand.objects.create(name="Toyota")
        vehicle = Vehicle.objects.create(plate="MIG-1234", brand=brand, model="Hilux")

        old = executor.loader.project_state([SALES_BEFORE]).apps
        old_sale = old.get_model("sales", "Sale")
        # El taller no retrocede: su modelo vigente coincide con el esquema.
        order = MaintenanceOrder.objects.create(
            sequence=1,
            number="ART-OT-000001",
            fiscal_entity_id=artisan.pk,
            customer_id=customer.pk,
            vehicle_id=vehicle.pk,
            customer_snapshot={"schema_version": 1},
            vehicle_snapshot={"schema_version": 1},
            opened_on="2026-01-15",
            odometer_km=1,
            created_by_id=user.pk,
            updated_by_id=user.pk,
        )
        common = {
            "customer_id": customer.pk,
            "fiscal_entity_id": commercial.pk,
            "warehouse_id": warehouse.pk,
            "condition": "CONTADO",
            "created_by_id": user.pk,
        }
        direct = old_sale.objects.create(**common)
        linked = old_sale.objects.create(
            **common,
            origin_type="MAINTENANCE",
            origin_order_id=order.pk,
            origin_reference=order.number,
        )

        executor = MigrationExecutor(connection)
        executor.migrate(_targets_after(executor))
        new = executor.loader.project_state(_targets_after(executor)).apps
        new_sale = new.get_model("sales", "Sale")
        assert new.get_model("proformas", "Proforma").objects.count() == 0
        rows = {row.pk: row for row in new_sale.objects.all()}
        assert len(rows) == 2
        assert (rows[direct.pk].origin_type, rows[direct.pk].origin_reference) == ("DIRECT", "")
        assert (rows[linked.pk].origin_type, rows[linked.pk].origin_order_id) == (
            "MAINTENANCE",
            order.pk,
        )
        for row in rows.values():
            assert row.origin_proforma_id is None
            assert row.proforma_snapshot is None
            assert row.internal_number is None

        # Reversión sin datos nuevos: las ventas previas quedan intactas.
        executor = MigrationExecutor(connection)
        executor.migrate([SALES_BEFORE, PROFORMAS_ZERO])
        reverted = executor.loader.project_state([SALES_BEFORE]).apps.get_model("sales", "Sale")
        assert sorted(reverted.objects.values_list("pk", "origin_type")) == sorted(
            [(direct.pk, "DIRECT"), (linked.pk, "MAINTENANCE")]
        )
        assert "proformas_proforma" not in connection.introspection.table_names()
    finally:
        _restore_latest_schema()
