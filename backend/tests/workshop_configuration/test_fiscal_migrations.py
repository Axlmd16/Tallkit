"""Las migraciones fiscales agregan estructuras vacías sin inferir datos previos."""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_fiscal_configuration_migrations_preserve_old_data_without_backfill() -> None:
    before = ("workshop_configuration", "0005_alter_configurationcommand_options_and_more")
    after = ("workshop_configuration", "0008_fiscaltaxmapping")
    executor = MigrationExecutor(connection)
    executor.migrate([before])
    old_apps = executor.loader.project_state([before]).apps
    entity_model = old_apps.get_model("workshop_configuration", "FiscalEntity")
    tax_model = old_apps.get_model("workshop_configuration", "TaxDefinition")
    entity = entity_model.objects.create(
        entity_type="COMERCIAL",
        ruc="0991234567001",
        legal_name="Dato existente",
        address=None,
    )
    tax = tax_model.objects.create(fiscal_entity=entity, code="IVA", name="IVA existente")

    executor = MigrationExecutor(connection)
    executor.migrate([after])
    apps = executor.loader.project_state([after]).apps

    migrated = apps.get_model("workshop_configuration", "FiscalEntity").objects.get(pk=entity.pk)
    migrated_tax = apps.get_model("workshop_configuration", "TaxDefinition").objects.get(pk=tax.pk)
    assert (migrated.ruc, migrated.legal_name, migrated.address, migrated.version) == (
        "0991234567001",
        "Dato existente",
        None,
        1,
    )
    assert (migrated_tax.code, migrated_tax.name, migrated_tax.version) == (
        "IVA",
        "IVA existente",
        1,
    )
    assert (
        apps.get_model("workshop_configuration", "ElectronicProfileRevision").objects.count() == 0
    )
    assert apps.get_model("workshop_configuration", "FiscalEstablishment").objects.count() == 0
    assert apps.get_model("workshop_configuration", "FiscalEmissionPoint").objects.count() == 0
    assert apps.get_model("workshop_configuration", "FiscalTaxMapping").objects.count() == 0
