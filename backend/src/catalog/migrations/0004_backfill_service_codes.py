from django.db import migrations


def assign_codes(apps, schema_editor):  # type: ignore[no-untyped-def]
    """Asigna una sola vez los códigos SRV- en orden de creación, sin tocar otros campos."""
    service_model = apps.get_model("catalog", "Service")
    counter_model = apps.get_model("catalog", "ServiceCodeCounter")
    counter, _ = counter_model.objects.get_or_create(pk=1)
    number = counter.last_number
    pending = service_model.objects.filter(code__isnull=True).order_by("created_at", "pk")
    for service in pending:
        number += 1
        service.code = f"SRV-{number:06d}"
        # Solo la columna del código: no cambian la versión ni la fecha de actualización.
        service.save(update_fields=["code"])
    counter.last_number = number
    counter.save(update_fields=["last_number"])


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0003_service_code_and_counter"),
    ]

    operations = [
        migrations.RunPython(assign_codes, migrations.RunPython.noop),
    ]
