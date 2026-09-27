"""Modelo y migración del logotipo de entidad fiscal.

Trazabilidad: spec `configuracion-operativa-y-fiscal`, «Logotipo opcional por entidad fiscal»
(escenario «Entidades sin logotipo al desplegar»); diseño D1.
"""

import pytest
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor

from identity.models import User
from workshop_configuration.models import FiscalEntity, FiscalEntityLogo


@pytest.fixture
def uploader(db: None) -> User:
    return User.objects.create_user(username="logo-model", password="password123")


def _entity(entity_type: str = "COMERCIAL", ruc: str = "0991234567001") -> FiscalEntity:
    return FiscalEntity.objects.create(entity_type=entity_type, ruc=ruc, legal_name="Entidad")


def _logo(entity: FiscalEntity, user: User, name: str) -> FiscalEntityLogo:
    return FiscalEntityLogo.objects.create(
        fiscal_entity=entity,
        storage_name=name,
        content_type="image/png",
        extension="png",
        size_bytes=10,
        width=4,
        height=2,
        sha256="a" * 64,
        revision=1,
        uploaded_by=user,
    )


@pytest.mark.django_db
def test_new_entity_starts_without_logo_and_revision_zero() -> None:
    entity = _entity()
    assert entity.logo_revision == 0
    assert not FiscalEntityLogo.objects.filter(fiscal_entity=entity).exists()


@pytest.mark.django_db
def test_an_entity_has_at_most_one_logo(uploader: User) -> None:
    entity = _entity()
    _logo(entity, uploader, "fiscal-logos/1/a.png")
    with pytest.raises(IntegrityError), transaction.atomic():
        _logo(entity, uploader, "fiscal-logos/1/b.png")


@pytest.mark.django_db
def test_storage_names_are_unique(uploader: User) -> None:
    first = _entity()
    second = _entity("ARTESANAL", "1791234567001")
    _logo(first, uploader, "fiscal-logos/x.png")
    with pytest.raises(IntegrityError), transaction.atomic():
        _logo(second, uploader, "fiscal-logos/x.png")


@pytest.mark.django_db(transaction=True)
def test_logo_migration_keeps_entities_without_logo_and_same_version() -> None:
    before = ("workshop_configuration", "0012_payment_form_settings_and_preparation_defaults")
    after = ("workshop_configuration", "0013_fiscal_entity_logo")
    executor = MigrationExecutor(connection)
    executor.migrate([before])
    old_apps = executor.loader.project_state([before]).apps
    entity = old_apps.get_model("workshop_configuration", "FiscalEntity").objects.create(
        entity_type="ARTESANAL", ruc="1791234567001", legal_name="Existente", version=7
    )

    executor = MigrationExecutor(connection)
    executor.migrate([after])
    apps = executor.loader.project_state([after]).apps

    migrated = apps.get_model("workshop_configuration", "FiscalEntity").objects.get(pk=entity.pk)
    assert migrated.version == 7
    assert migrated.logo_revision == 0
    logos = apps.get_model("workshop_configuration", "FiscalEntityLogo")
    assert not logos.objects.exists()

    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())
