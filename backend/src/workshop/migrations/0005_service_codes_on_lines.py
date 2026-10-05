"""Copia el código de servicio a las líneas existentes leyendo el catálogo.

La única escritura es la columna nueva de las propias líneas del taller: no se modifica
ninguna tabla ajena. Una línea de operación cuyo servicio ya no existe conserva el código
vacío en lugar de inventarlo.
"""

from typing import Any

from django.db import migrations, models


def copy_codes(apps: Any, schema_editor: Any) -> None:
    codes = dict(apps.get_model("catalog", "Service").objects.values_list("id", "code"))
    for model_name in ("ServiceLine", "ServiceOperationLine"):
        model = apps.get_model("workshop", model_name)
        for service_id in set(model.objects.values_list("service_id", flat=True)):
            code = codes.get(service_id)
            if code:
                model.objects.filter(service_id=service_id).update(service_code=code)


class Migration(migrations.Migration):
    dependencies = [
        ("workshop", "0004_mark_orders_predating_billing"),
        ("catalog", "0005_service_code_required_unique"),
    ]

    operations = [
        migrations.AddField(
            model_name="serviceline",
            name="service_code",
            field=models.CharField(blank=True, default="", max_length=25),
        ),
        migrations.AddField(
            model_name="serviceoperationline",
            name="service_code",
            field=models.CharField(blank=True, default="", max_length=25),
        ),
        migrations.RunPython(copy_codes, migrations.RunPython.noop),
    ]
