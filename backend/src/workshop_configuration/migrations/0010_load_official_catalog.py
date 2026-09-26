"""Incorpora el catálogo oficial desde la ficha 2.34 del SRI con su procedencia."""

from typing import Any

from django.db import migrations


def load(apps: Any, schema_editor: Any) -> None:
    from workshop_configuration.application.official_catalog import (
        install_manifest,
        read_manifest,
    )

    install_manifest(
        apps.get_model("workshop_configuration", "OfficialCatalogEntry"), read_manifest()
    )


def unload(apps: Any, schema_editor: Any) -> None:
    entry = apps.get_model("workshop_configuration", "OfficialCatalogEntry")
    entry.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("workshop_configuration", "0009_officialcatalogentry")]

    operations = [migrations.RunPython(load, unload)]
