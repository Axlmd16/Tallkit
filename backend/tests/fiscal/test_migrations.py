"""Las migraciones de readiness no reinterpretan ni eliminan datos fiscales previos."""

from datetime import date
from decimal import Decimal

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


def _restore_latest_schema() -> None:
    """Deja la base con todas las migraciones aplicadas para las pruebas siguientes."""
    executor = MigrationExecutor(connection)
    executor.migrate(list(executor.loader.graph.leaf_nodes()))


@pytest.mark.django_db(transaction=True)
def test_readiness_migration_preserves_existing_archive_and_internal_series() -> None:
    try:
        _readiness_migration_preserves_existing_archive_and_internal_series()
    finally:
        _restore_latest_schema()


def _readiness_migration_preserves_existing_archive_and_internal_series() -> None:
    before = ("fiscal", "0008_fiscal_correction_historical_tax")
    after = ("fiscal", "0009_fiscal_archive_readiness")
    executor = MigrationExecutor(connection)
    executor.migrate([before])
    old_apps = executor.loader.project_state([before]).apps
    # Solo fiscal retrocede: la configuración sigue en su última versión, con columnas posteriores
    # a 0008 que el estado antiguo no conoce; esos datos previos se crean con el esquema actual.
    current = MigrationExecutor(connection)
    current_apps = current.loader.project_state(list(current.loader.graph.leaf_nodes())).apps

    user = current_apps.get_model("identity", "User").objects.create(username="migration-admin")
    entity = current_apps.get_model("workshop_configuration", "FiscalEntity").objects.create(
        entity_type="COMERCIAL",
        ruc="9999999999010",
        legal_name="Entidad previa",
    )
    scope = current_apps.get_model("workshop_configuration", "NumberingScope").objects.create(
        fiscal_entity=entity,
        document_type="VENTA",
    )
    series = current_apps.get_model("workshop_configuration", "DocumentSeries").objects.create(
        numbering_scope=scope,
        code="COM-VEN",
        last_number=37,
    )
    dossier = old_apps.get_model("fiscal", "FiscalXmlDossier").objects.create(
        fiscal_entity_id=entity.pk,
        document_type="01",
        schema_version="1.1.0",
        environment="1",
        issuer_ruc=entity.ruc,
        access_key="1" * 49,
        establishment_code="001",
        emission_point_code="001",
        sequential="000000001",
        issue_date=date(2026, 9, 25),
        total=Decimal("10.00"),
        tax_total=Decimal("0.00"),
        receiver_identification="9999999999999",
        currency="DOLAR",
        line_count=1,
        line_facts=[],
        created_by_id=user.pk,
    )

    executor = MigrationExecutor(connection)
    executor.migrate([after])
    apps = executor.loader.project_state([after]).apps

    assert apps.get_model("fiscal", "FiscalPreparation").objects.count() == 0
    migrated_series = apps.get_model("workshop_configuration", "DocumentSeries").objects.get(
        pk=series.pk
    )
    assert (migrated_series.code, migrated_series.last_number) == ("COM-VEN", 37)
    assert apps.get_model("fiscal", "FiscalXmlDossier").objects.filter(pk=dossier.pk).exists()
    assert apps.get_model("fiscal", "FiscalArchivePolicy").objects.count() == 0
    assert apps.get_model("fiscal", "FiscalRestorationEvidence").objects.count() == 0

    # El rollback de readiness elimina solo sus tablas; el archivo y la numeración sobreviven.
    executor = MigrationExecutor(connection)
    executor.migrate([before])
    rolled_back = executor.loader.project_state([before]).apps
    assert (
        rolled_back.get_model("fiscal", "FiscalXmlDossier").objects.filter(pk=dossier.pk).exists()
    )
    restored_series = rolled_back.get_model("workshop_configuration", "DocumentSeries").objects.get(
        pk=series.pk
    )
    assert (restored_series.code, restored_series.last_number) == ("COM-VEN", 37)

    # Dejar la base de prueba en la cabeza para el teardown y confirmar re-aplicación segura.
    executor = MigrationExecutor(connection)
    executor.migrate([after])
    final_apps = executor.loader.project_state([after]).apps
    assert final_apps.get_model("fiscal", "FiscalXmlDossier").objects.filter(pk=dossier.pk).exists()
