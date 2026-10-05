"""Las líneas de servicio existentes reciben el código vigente de su servicio en el catálogo."""

from typing import Any

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from tests.workshop.workshop_helpers import add_line, confirm_services, create

from workshop.models import ServiceLine, ServiceOperationLine

BEFORE = ("workshop", "0004_mark_orders_predating_billing")
AFTER = ("workshop", "0005_service_codes_on_lines")


@pytest.mark.django_db(transaction=True)
def test_backfill_copies_codes_from_the_catalog_and_leaves_dangling_services_empty(
    manager: Any, artisan_billing: Any, customer: Any, vehicle: Any, make_service: Any
) -> None:
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)
    first = make_service(name="Alineación", code="SRV-000042")
    second = make_service(name="Balanceo", code="SRV-000043")
    add_line(manager, order["id"], service_id=first.pk, applied_price="25.00")
    add_line(manager, order["id"], service_id=second.pk, applied_price="30.00")
    confirm_services(manager, order["id"], "CREDITO")
    # Un servicio inexistente solo puede quedar en la copia de la operación (id sin clave foránea).
    ServiceOperationLine.objects.filter(position=2).update(service_id=999_999)

    executor = MigrationExecutor(connection)
    executor.migrate([BEFORE])
    executor = MigrationExecutor(connection)
    executor.migrate([AFTER])
    apps = executor.loader.project_state([AFTER]).apps

    lines = apps.get_model("workshop", "ServiceLine").objects.order_by("position")
    assert [(line.service_id, line.service_code) for line in lines] == [
        (first.pk, "SRV-000042"),
        (second.pk, "SRV-000043"),
    ]
    operation_lines = apps.get_model("workshop", "ServiceOperationLine").objects.order_by(
        "position"
    )
    assert [line.service_code for line in operation_lines] == ["SRV-000042", ""]
    assert ServiceLine.objects.count() == 2
