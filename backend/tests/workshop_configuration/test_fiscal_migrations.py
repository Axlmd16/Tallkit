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


@pytest.mark.django_db(transaction=True)
def test_existing_tax_mappings_are_linked_to_their_catalog_entry() -> None:
    before = ("workshop_configuration", "0008_fiscaltaxmapping")
    after = ("workshop_configuration", "0011_fiscaltaxmapping_catalog_entry")
    executor = MigrationExecutor(connection)
    executor.migrate([before])
    old_apps = executor.loader.project_state([before]).apps
    user = old_apps.get_model("identity", "User").objects.create(
        username="migrador", email="migrador@example.com"
    )
    entity = old_apps.get_model("workshop_configuration", "FiscalEntity").objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Dato existente"
    )
    tax = old_apps.get_model("workshop_configuration", "TaxDefinition").objects.create(
        fiscal_entity=entity, code="IVA", name="IVA existente"
    )
    mapping = old_apps.get_model("workshop_configuration", "FiscalTaxMapping").objects.create(
        tax_definition=tax,
        catalog_version="SRI-2.34-IVA-subset-v1",
        percentage_code="4",
        starts_on="2026-01-01",
        source="Revisión documentada",
        created_by=user,
    )

    executor = MigrationExecutor(connection)
    executor.migrate([after])
    apps = executor.loader.project_state([after]).apps
    migrated = apps.get_model("workshop_configuration", "FiscalTaxMapping").objects.get(
        pk=mapping.pk
    )
    entry = migrated.catalog_entry
    assert (entry.catalog_version, entry.code, entry.kind) == (
        "SRI-2.34-IVA-subset-v1",
        "4",
        "TAX_RATE",
    )
    assert (migrated.catalog_version, migrated.percentage_code) == ("SRI-2.34-IVA-subset-v1", "4")

    executor = MigrationExecutor(connection)
    executor.migrate([before])
    reverted = (
        executor.loader.project_state([before])
        .apps.get_model("workshop_configuration", "FiscalTaxMapping")
        .objects.get(pk=mapping.pk)
    )
    assert reverted.percentage_code == "4"
    MigrationExecutor(connection).migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())


@pytest.mark.django_db
def test_mapping_without_catalog_entry_fails_the_link() -> None:
    from identity.models import User
    from workshop_configuration.application.official_catalog import (
        CatalogManifestError,
        link_mappings,
    )
    from workshop_configuration.models import (
        FiscalEntity,
        FiscalTaxMapping,
        OfficialCatalogEntry,
        TaxDefinition,
    )

    user = User.objects.create(username="huérfano", email="h@example.com")
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Prueba"
    )
    tax = TaxDefinition.objects.create(fiscal_entity=entity, code="IVA", name="IVA")
    FiscalTaxMapping.objects.create(
        tax_definition=tax,
        catalog_version="VERSION-INEXISTENTE",
        percentage_code="4",
        starts_on="2026-01-01",
        source="Dato previo",
        created_by=user,
    )
    with pytest.raises(CatalogManifestError, match="VERSION-INEXISTENTE"):
        link_mappings(FiscalTaxMapping, OfficialCatalogEntry)


@pytest.mark.django_db(transaction=True)
def test_existing_profile_revisions_stay_in_format_one_without_rewriting_their_json() -> None:
    before = ("workshop_configuration", "0013_fiscal_entity_logo")
    after = ("workshop_configuration", "0014_electronicprofilerevision_conditions_format")
    try:
        executor = MigrationExecutor(connection)
        executor.migrate([before])
        old_apps = executor.loader.project_state([before]).apps
        user = old_apps.get_model("identity", "User").objects.create(
            username="migrador-perfil", email="migrador-perfil@example.com"
        )
        entity = old_apps.get_model("workshop_configuration", "FiscalEntity").objects.create(
            entity_type="ARTESANAL", ruc="0991234567001", legal_name="Taller existente"
        )
        legacy_json = {
            "accounting_obligation": {
                "status": "APPLICABLE",
                "value": "no obligado",
                "source": "Certificado",
                "starts_on": "2026-01-01",
            },
            "rimpe": {"status": "UNKNOWN"},
        }
        revision = old_apps.get_model(
            "workshop_configuration", "ElectronicProfileRevision"
        ).objects.create(fiscal_entity=entity, revision=1, conditions=legacy_json, created_by=user)

        executor = MigrationExecutor(connection)
        executor.migrate([after])
        apps = executor.loader.project_state([after]).apps
        migrated = apps.get_model(
            "workshop_configuration", "ElectronicProfileRevision"
        ).objects.get(pk=revision.pk)
        assert migrated.conditions_format == 1
        assert migrated.conditions == legacy_json
        assert migrated.revision == 1
    finally:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())


@pytest.mark.django_db
def test_profile_revision_format_is_restricted_to_known_formats() -> None:
    from django.db import IntegrityError, transaction

    from identity.models import User
    from workshop_configuration.models import ElectronicProfileRevision, FiscalEntity

    user = User.objects.create(username="formato", email="formato@example.com")
    entity = FiscalEntity.objects.create(
        entity_type="ARTESANAL", ruc="0991234567001", legal_name="Taller"
    )
    created = ElectronicProfileRevision.objects.create(
        fiscal_entity=entity, revision=1, conditions={}, created_by=user
    )
    assert created.conditions_format == 1
    with pytest.raises(IntegrityError), transaction.atomic():
        ElectronicProfileRevision.objects.create(
            fiscal_entity=entity, revision=2, conditions={}, conditions_format=3, created_by=user
        )
