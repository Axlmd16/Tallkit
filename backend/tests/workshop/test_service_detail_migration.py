"""Las líneas y operaciones existentes quedan con el detalle de servicio vacío (migración 0007)."""

from typing import Any

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from tests.workshop.workshop_helpers import add_line, confirm_services, create

from workshop.models import ServiceLine, ServiceOperationLine

BEFORE = ("workshop", "0006_artisan_withholding")
AFTER = ("workshop", "0007_service_line_detail")


def _restore_latest_schema() -> None:
    """Deja todas las migraciones aplicadas; retroceder una app desaplica las dependientes."""
    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())


@pytest.mark.django_db(transaction=True)
def test_existing_lines_and_operations_keep_their_data_with_an_empty_detail(
    manager: Any, artisan_billing: Any, customer: Any, vehicle: Any, make_service: Any
) -> None:
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)
    add_line(manager, order["id"], service_id=make_service(name="Alineación").pk)
    confirm_services(manager, order["id"])
    stored = list(ServiceLine.objects.values_list("service_name", "applied_price"))

    try:
        executor = MigrationExecutor(connection)
        executor.migrate([BEFORE])
        executor = MigrationExecutor(connection)
        executor.migrate([AFTER])
        apps = executor.loader.project_state([AFTER]).apps

        lines = apps.get_model("workshop", "ServiceLine").objects.all()
        assert [(line.service_name, line.applied_price) for line in lines] == stored
        assert [line.detail for line in lines] == [""]
        operation_lines = apps.get_model("workshop", "ServiceOperationLine").objects.all()
        assert [line.detail for line in operation_lines] == [""]
        assert ServiceOperationLine.objects.count() == 1
    finally:
        _restore_latest_schema()


@pytest.mark.django_db(transaction=True)
def test_the_migration_is_reversible_and_drops_only_the_new_columns() -> None:
    try:
        executor = MigrationExecutor(connection)
        executor.migrate([BEFORE])
        columns = {
            column.name
            for column in connection.introspection.get_table_description(
                connection.cursor(), "workshop_serviceline"
            )
        }
        assert "detail" not in columns
        assert {"service_code", "service_name", "applied_price"} <= columns
    finally:
        _restore_latest_schema()
