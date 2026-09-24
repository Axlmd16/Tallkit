"""Marca las órdenes existentes como anteriores a la documentación económica.

Es la única escritura sobre datos de esta entrega: no crea operaciones, deudas, cobros,
reservas ni movimientos. La marca solo activa una advertencia al documentar sus servicios.
"""

from typing import Any

from django.db import migrations


def mark_existing(apps: Any, schema_editor: Any) -> None:
    order_model = apps.get_model("workshop", "MaintenanceOrder")
    order_model.objects.update(predates_billing=True)


class Migration(migrations.Migration):
    dependencies = [("workshop", "0003_service_operations_and_artisan_payments")]

    operations = [migrations.RunPython(mark_existing, migrations.RunPython.noop)]
