"""Contrato público de marca: identidad, versión/hash y bytes normalizados o ausencia.

Trazabilidad: diseño D4 y ADR-0012 de `gestionar-proformas-comerciales`.
"""

import ast
import hashlib
import uuid
from pathlib import Path
from typing import Any

import pytest
from django.db import transaction
from django.test.utils import CaptureQueriesContext
from tests.workshop_configuration.logo_helpers import image_bytes, jpeg_with_exif, upload

from identity.models import User, UserRole
from workshop_configuration.application import brand, entity_logos, logo_storage
from workshop_configuration.models import FiscalEntity, FiscalEntityLogo

pytestmark = pytest.mark.django_db
SRC = Path(__file__).resolve().parents[2] / "src"


@pytest.fixture(autouse=True)
def private_media(tmp_path: Path, settings: Any) -> Path:
    root = tmp_path / "private-media"
    settings.PRIVATE_MEDIA_ROOT = root
    return root


@pytest.fixture
def admin(db: None) -> User:
    user = User.objects.create_user(username="brand-admin", password="password123")
    UserRole.objects.create(user=user, role="ADMINISTRADOR")
    return user


@pytest.fixture
def entity(db: None) -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL",
        ruc="0991234567001",
        legal_name="Repuestos Andinos",
        trade_name="Andinos",
        address="Av. Principal 1",
        phone="042000000",
    )


def _upload(admin: User, entity: FiscalEntity, content: bytes | None = None) -> None:
    entity_logos.upload_entity_logo(
        actor=admin,
        entity_id=entity.pk,
        file=upload(content or image_bytes()),
        idempotency_key=f"logo-{uuid.uuid4().hex}",
    )


def test_entity_without_logo_reports_explicit_absence(entity: FiscalEntity) -> None:
    result = brand.read_entity_brand("COMERCIAL")
    assert result.asset is None
    assert result.identity.logo_sha256 is None
    assert (result.identity.ruc, result.identity.legal_name, result.identity.trade_name) == (
        "0991234567001",
        "Repuestos Andinos",
        "Andinos",
    )
    assert result.identity.entity_type == "COMERCIAL"


def test_logo_is_returned_as_normalized_bytes_with_its_hash(
    admin: User, entity: FiscalEntity
) -> None:
    _upload(admin, entity)
    result = brand.read_entity_brand("COMERCIAL")
    assert result.asset is not None
    assert hashlib.sha256(result.asset.content).hexdigest() == result.asset.sha256
    assert result.identity.logo_sha256 == FiscalEntityLogo.objects.get().sha256
    assert result.asset.content_type == "image/png"
    assert result.asset.size == len(result.asset.content) <= 2 * 1024 * 1024
    assert result.identity.logo_revision == 1


def test_logo_whose_normalization_changes_the_bytes_is_still_readable(
    admin: User, entity: FiscalEntity
) -> None:
    """Regresión: el hash registrado es el de la carga, no el del archivo normalizado."""
    original = jpeg_with_exif()
    entity_logos.upload_entity_logo(
        actor=admin,
        entity_id=entity.pk,
        file=upload(original, "logo.jpg", "image/jpeg"),
        idempotency_key=f"logo-{uuid.uuid4().hex}",
    )
    stored = FiscalEntityLogo.objects.get()
    result = brand.read_entity_brand("COMERCIAL")
    assert result.asset is not None
    assert result.asset.content != original
    assert stored.sha256 == hashlib.sha256(original).hexdigest() != result.asset.sha256
    assert result.asset.size == stored.size_bytes
    assert result.asset.content_type == "image/jpeg"
    assert brand.lock_brand_identity("COMERCIAL") == result.identity


def test_truncated_image_of_the_registered_size_is_unreadable(
    admin: User, entity: FiscalEntity, private_media: Path
) -> None:
    _upload(admin, entity)
    stored = FiscalEntityLogo.objects.get()
    (private_media / stored.storage_name).write_bytes(b"x" * stored.size_bytes)
    with pytest.raises(brand.BrandUnavailableError) as error:
        brand.read_entity_brand("COMERCIAL")
    assert error.value.code == "logo_unreadable"


def test_dto_never_exposes_storage_paths(admin: User, entity: FiscalEntity) -> None:
    _upload(admin, entity)
    result = brand.read_entity_brand("COMERCIAL")
    stored = FiscalEntityLogo.objects.get().storage_name
    assert stored not in repr(result.identity)
    assert not {"storage_name", "path", "url"} & set(vars(result.asset))
    assert not {"storage_name", "path", "url"} & set(vars(result.identity))


def test_consumer_needs_no_administrative_permission(admin: User, entity: FiscalEntity) -> None:
    """El contrato no recibe actor: el consumidor ya autorizó su propia acción."""
    _upload(admin, entity)
    assert brand.read_entity_brand("COMERCIAL").asset is not None
    tree = ast.parse((SRC / "workshop_configuration/application/brand.py").read_text("utf-8"))
    imported = {n.module for n in ast.walk(tree) if isinstance(n, ast.ImportFrom) and n.module}
    assert not {m for m in imported if m.startswith("identity")}


def test_configured_but_missing_file_is_an_error_not_an_omission(
    admin: User, entity: FiscalEntity
) -> None:
    _upload(admin, entity)
    logo_storage.delete_files(FiscalEntityLogo.objects.get().storage_name)
    with pytest.raises(brand.BrandUnavailableError) as error:
        brand.read_entity_brand("COMERCIAL")
    assert error.value.code == "logo_unreadable"


def test_corrupted_file_is_an_error(admin: User, entity: FiscalEntity, private_media: Path) -> None:
    _upload(admin, entity)
    path = private_media / FiscalEntityLogo.objects.get().storage_name
    path.write_bytes(b"contenido alterado")
    with pytest.raises(brand.BrandUnavailableError) as error:
        brand.read_entity_brand("COMERCIAL")
    assert error.value.code == "logo_unreadable"


def test_oversized_file_is_rejected_without_loading_it(
    admin: User, entity: FiscalEntity, private_media: Path
) -> None:
    _upload(admin, entity)
    path = private_media / FiscalEntityLogo.objects.get().storage_name
    path.write_bytes(b"0" * (2 * 1024 * 1024 + 1))
    with pytest.raises(brand.BrandUnavailableError):
        brand.read_entity_brand("COMERCIAL")


def test_missing_entity_is_reported(db: None) -> None:
    with pytest.raises(brand.BrandUnavailableError) as error:
        brand.read_entity_brand("COMERCIAL")
    assert error.value.code == "missing_entity"


def test_locked_identity_requires_an_outer_transaction(entity: FiscalEntity) -> None:
    # pytest-django envuelve la prueba en una transacción: se comprueba la guarda directamente.
    assert transaction.get_connection().in_atomic_block
    identity = brand.lock_brand_identity("COMERCIAL")
    assert identity.logo_sha256 is None


def test_locked_identity_does_not_read_or_decode_the_file(
    admin: User, entity: FiscalEntity, monkeypatch: pytest.MonkeyPatch
) -> None:
    _upload(admin, entity)
    reviewed = brand.read_entity_brand("COMERCIAL")

    def forbidden(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("no se lee el archivo bajo bloqueo")

    monkeypatch.setattr(logo_storage, "open_file", forbidden)
    monkeypatch.setattr(logo_storage, "inspect_logo", forbidden)
    from django.db import connection

    with CaptureQueriesContext(connection) as queries:
        identity = brand.lock_brand_identity("COMERCIAL")
    assert identity == reviewed.identity
    assert any("FOR UPDATE" in q["sql"] for q in queries)


def test_replacement_or_removal_invalidates_the_reviewed_identity(
    admin: User, entity: FiscalEntity
) -> None:
    _upload(admin, entity)
    reviewed = brand.read_entity_brand("COMERCIAL")
    _upload(admin, entity, image_bytes(size=(60, 60)))
    replaced = brand.lock_brand_identity("COMERCIAL")
    assert replaced != reviewed.identity
    assert replaced.logo_sha256 != reviewed.identity.logo_sha256
    entity_logos.remove_entity_logo(
        actor=admin, entity_id=entity.pk, idempotency_key=f"logo-{uuid.uuid4().hex}"
    )
    removed = brand.lock_brand_identity("COMERCIAL")
    assert removed.logo_sha256 is None
    assert removed != replaced


def test_reviewed_bytes_survive_the_purge_of_the_current_file(
    admin: User, entity: FiscalEntity
) -> None:
    """Los bytes ya leídos no dependen del archivo vigente ni de su limpieza posterior."""
    _upload(admin, entity)
    reviewed = brand.read_entity_brand("COMERCIAL")
    assert reviewed.asset is not None
    logo_storage.delete_files(FiscalEntityLogo.objects.get().storage_name)
    assert hashlib.sha256(reviewed.asset.content).hexdigest() == reviewed.asset.sha256
    assert brand.lock_brand_identity("COMERCIAL") == reviewed.identity


def test_identity_changes_with_issuer_data(entity: FiscalEntity) -> None:
    before = brand.read_entity_brand("COMERCIAL").identity
    FiscalEntity.objects.filter(pk=entity.pk).update(legal_name="Otro nombre")
    assert brand.lock_brand_identity("COMERCIAL") != before
