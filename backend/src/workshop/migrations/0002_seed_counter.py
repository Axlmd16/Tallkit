from django.db import migrations


def seed(apps, schema_editor):  # type: ignore[no-untyped-def]
    counter = apps.get_model("workshop", "MaintenanceCounter")
    counter.objects.get_or_create(id=1, defaults={"last_number": 0})


def unseed(apps, schema_editor):  # type: ignore[no-untyped-def]
    counter = apps.get_model("workshop", "MaintenanceCounter")
    counter.objects.filter(id=1, last_number=0).delete()


class Migration(migrations.Migration):
    dependencies = [("workshop", "0001_initial")]

    operations = [migrations.RunPython(seed, unseed)]
