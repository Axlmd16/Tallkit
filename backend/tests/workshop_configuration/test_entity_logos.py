"""Comandos de carga, reemplazo y retiro del logotipo de una entidad fiscal.

Trazabilidad: spec `configuracion-operativa-y-fiscal`: «Logotipo opcional por entidad fiscal»,
«Reemplazo y retiro del logotipo», «Consistencia del logotipo ante fallos y concurrencia»;
diseño D3 y D4.
"""

import uuid
from pathlib import Path
from typing import Any

import pytest
from django.core.management import call_command
from tests.workshop_configuration.logo_helpers import SVG, image_bytes, upload

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import AuditEvent, AuditResult, User, UserRole
from shared.command_values import InvalidIdempotencyKeyError
from workshop_configuration.application import entity_logos, logo_storage
from workshop_configuration.application.entity_warehouse import FiscalEntityNotFoundError
from workshop_configuration.application.initialization import IdempotencyConflictError
from workshop_configuration.application.logo_storage import LogoImageError
from workshop_configuration.models import FiscalEntity, FiscalEntityLogo


@pytest.fixture(autouse=True)
def private_media(tmp_path: Path, settings: Any) -> Path:
    root = tmp_path / "private-media"
    settings.PRIVATE_MEDIA_ROOT = root
    return root


def _user(username: str, *roles: str) -> User:
    user = User.objects.create_user(username=username, password="password123")
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def admin(db: None) -> User:
    return _user("logo-admin", "ADMINISTRADOR")


@pytest.fixture
def entities(db: None) -> dict[str, FiscalEntity]:
    return {
        "COMERCIAL": FiscalEntity.objects.create(
            entity_type="COMERCIAL", ruc="0991234567001", legal_name="Repuestos Andinos"
        ),
        "ARTESANAL": FiscalEntity.objects.create(
            entity_type="ARTESANAL", ruc="1791234567001", legal_name="Taller Andino"
        ),
    }


def key() -> str:
    return f"logo-{uuid.uuid4().hex}"


def upload_logo(actor: User, entity: FiscalEntity, content: bytes, **kwargs: Any) -> Any:
    return entity_logos.upload_entity_logo(
        actor=actor,
        entity_id=entity.pk,
        file=upload(content),
        idempotency_key=kwargs.pop("idempotency_key", key()),
        **kwargs,
    )


def remove_logo(actor: User, entity: FiscalEntity, **kwargs: Any) -> Any:
    return entity_logos.remove_entity_logo(
        actor=actor,
        entity_id=entity.pk,
        idempotency_key=kwargs.pop("idempotency_key", key()),
        **kwargs,
    )


def stored_files(root: Path) -> list[str]:
    base = root / "fiscal-logos"
    if not base.exists():
        return []
    return sorted(p.relative_to(root).as_posix() for p in base.rglob("*") if p.is_file())


def events(action: str) -> list[AuditEvent]:
    return list(AuditEvent.objects.filter(action=action).order_by("pk"))


# ---------------------------------------------------------------------------
# Permisos
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "roles",
    [("VENDEDOR",), ("ENCARGADO_TALLER",), ("VENDEDOR", "ENCARGADO_TALLER")],
)
def test_only_the_administrator_manages_logos(
    roles: tuple[str, ...], entities: dict[str, FiscalEntity], private_media: Path
) -> None:
    actor = _user("logo-no-admin", *roles)
    entity = entities["COMERCIAL"]
    with pytest.raises(BusinessPermissionDeniedError):
        upload_logo(actor, entity, image_bytes())
    with pytest.raises(BusinessPermissionDeniedError):
        remove_logo(actor, entity)
    assert not FiscalEntityLogo.objects.exists()
    assert stored_files(private_media) == []
    denials = AuditEvent.objects.filter(result=AuditResult.DENIED, target_id=str(entity.pk))
    assert denials.count() == 2


# ---------------------------------------------------------------------------
# Carga y reemplazo
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_upload_sets_the_logo_without_touching_entity_version(
    admin: User, entities: dict[str, FiscalEntity], private_media: Path
) -> None:
    entity = entities["COMERCIAL"]
    version = entity.version
    result = upload_logo(admin, entity, image_bytes("PNG", (1200, 400)))

    logo = FiscalEntityLogo.objects.get(fiscal_entity=entity)
    entity.refresh_from_db()
    assert result.logo is not None
    assert result.logo["revision"] == 1
    assert (logo.width, logo.height, logo.content_type) == (1200, 400, "image/png")
    assert logo.uploaded_by == admin
    assert entity.logo_revision == 1
    assert entity.version == version
    assert stored_files(private_media) == [logo.storage_name]
    [event] = events("workshop_configuration.fiscal_entity_logo_uploaded")
    assert event.result == AuditResult.SUCCESS
    assert event.target_id == str(entity.pk)
    assert "png" not in str(event.metadata).lower()
    assert not FiscalEntityLogo.objects.filter(fiscal_entity=entities["ARTESANAL"]).exists()


@pytest.mark.django_db(transaction=True)
def test_replacing_deletes_the_previous_file_and_keeps_the_other_entity(
    admin: User, entities: dict[str, FiscalEntity], private_media: Path
) -> None:
    other = upload_logo(admin, entities["COMERCIAL"], image_bytes("PNG"))
    entity = entities["ARTESANAL"]
    upload_logo(admin, entity, image_bytes("PNG"))
    first = FiscalEntityLogo.objects.get(fiscal_entity=entity).storage_name

    upload_logo(admin, entity, image_bytes("JPEG"))

    current = FiscalEntityLogo.objects.get(fiscal_entity=entity)
    assert current.revision == 2
    assert current.content_type == "image/jpeg"
    assert not (private_media / first).exists()
    commercial = FiscalEntityLogo.objects.get(fiscal_entity=entities["COMERCIAL"])
    assert commercial.revision == other.logo["revision"] == 1
    assert (private_media / commercial.storage_name).exists()
    assert len(events("workshop_configuration.fiscal_entity_logo_replaced")) == 1


@pytest.mark.django_db
def test_rejected_upload_keeps_current_logo_and_is_audited(
    admin: User, entities: dict[str, FiscalEntity], private_media: Path
) -> None:
    entity = entities["COMERCIAL"]
    upload_logo(admin, entity, image_bytes("PNG"))
    before = stored_files(private_media)

    with pytest.raises(LogoImageError) as error:
        upload_logo(admin, entity, SVG)

    assert error.value.code == "invalid_image"
    assert FiscalEntityLogo.objects.get(fiscal_entity=entity).revision == 1
    assert stored_files(private_media) == before
    [event] = events("workshop_configuration.fiscal_entity_logo_rejected")
    assert event.result == AuditResult.FAILURE
    assert event.reason == "invalid_image"


@pytest.mark.django_db
def test_unknown_entity_is_not_found(admin: User, private_media: Path) -> None:
    ghost = FiscalEntity(pk=999, entity_type="COMERCIAL")
    with pytest.raises(FiscalEntityNotFoundError):
        upload_logo(admin, ghost, image_bytes())
    with pytest.raises(FiscalEntityNotFoundError):
        remove_logo(admin, ghost)
    assert stored_files(private_media) == []


# ---------------------------------------------------------------------------
# Idempotencia
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_retrying_the_same_upload_does_not_repeat_effects(
    admin: User, entities: dict[str, FiscalEntity], private_media: Path
) -> None:
    entity = entities["COMERCIAL"]
    content = image_bytes("PNG")
    same = key()
    first = upload_logo(admin, entity, content, idempotency_key=same)
    second = upload_logo(admin, entity, content, idempotency_key=same)

    assert first == second
    assert FiscalEntityLogo.objects.count() == 1
    assert len(stored_files(private_media)) == 1
    assert len(events("workshop_configuration.fiscal_entity_logo_uploaded")) == 1


@pytest.mark.django_db
def test_reusing_a_key_with_another_file_is_a_conflict(
    admin: User, entities: dict[str, FiscalEntity], private_media: Path
) -> None:
    entity = entities["COMERCIAL"]
    same = key()
    upload_logo(admin, entity, image_bytes("PNG"), idempotency_key=same)
    with pytest.raises(IdempotencyConflictError):
        upload_logo(admin, entity, image_bytes("JPEG"), idempotency_key=same)
    assert FiscalEntityLogo.objects.get(fiscal_entity=entity).content_type == "image/png"
    assert len(stored_files(private_media)) == 1


@pytest.mark.django_db
def test_invalid_key_is_rejected_before_any_effect(
    admin: User, entities: dict[str, FiscalEntity], private_media: Path
) -> None:
    with pytest.raises(InvalidIdempotencyKeyError):
        upload_logo(admin, entities["COMERCIAL"], image_bytes(), idempotency_key="corta")
    assert stored_files(private_media) == []


# ---------------------------------------------------------------------------
# Retiro
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
def test_removal_deletes_row_and_file_and_is_audited(
    admin: User, entities: dict[str, FiscalEntity], private_media: Path
) -> None:
    entity = entities["COMERCIAL"]
    upload_logo(admin, entity, image_bytes())
    name = FiscalEntityLogo.objects.get(fiscal_entity=entity).storage_name

    result = remove_logo(admin, entity)

    assert result.logo is None
    assert not FiscalEntityLogo.objects.filter(fiscal_entity=entity).exists()
    assert not (private_media / name).exists()
    assert len(events("workshop_configuration.fiscal_entity_logo_removed")) == 1


@pytest.mark.django_db
def test_removing_without_logo_is_harmless_and_silent(
    admin: User, entities: dict[str, FiscalEntity]
) -> None:
    entity = entities["ARTESANAL"]
    assert remove_logo(admin, entity).logo is None
    assert remove_logo(admin, entity).logo is None
    assert events("workshop_configuration.fiscal_entity_logo_removed") == []


@pytest.mark.django_db
def test_new_revision_after_removal_is_not_reused(
    admin: User, entities: dict[str, FiscalEntity]
) -> None:
    entity = entities["COMERCIAL"]
    upload_logo(admin, entity, image_bytes())
    remove_logo(admin, entity)
    result = upload_logo(admin, entity, image_bytes())
    assert result.logo["revision"] == 2


# ---------------------------------------------------------------------------
# Fallos y concurrencia
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_storage_failure_keeps_previous_logo(
    admin: User,
    entities: dict[str, FiscalEntity],
    private_media: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    entity = entities["COMERCIAL"]
    upload_logo(admin, entity, image_bytes())
    before = stored_files(private_media)

    def broken(*_: Any) -> str:
        raise OSError("disco lleno")

    monkeypatch.setattr(logo_storage, "store_logo", broken)
    with pytest.raises(OSError, match="disco lleno"):
        upload_logo(admin, entity, image_bytes("JPEG"))

    assert FiscalEntityLogo.objects.get(fiscal_entity=entity).revision == 1
    assert stored_files(private_media) == before


@pytest.mark.django_db
def test_failure_inside_the_transaction_discards_the_new_file(
    admin: User,
    entities: dict[str, FiscalEntity],
    private_media: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    entity = entities["COMERCIAL"]
    upload_logo(admin, entity, image_bytes())
    before = stored_files(private_media)

    def broken(**_: Any) -> None:
        raise RuntimeError("fallo de auditoría")

    monkeypatch.setattr(entity_logos, "record_audit_event", broken)
    with pytest.raises(RuntimeError, match="fallo de auditoría"):
        upload_logo(admin, entity, image_bytes("JPEG"))

    assert FiscalEntityLogo.objects.get(fiscal_entity=entity).content_type == "image/png"
    assert stored_files(private_media) == before


@pytest.mark.django_db(transaction=True)
def test_concurrent_uploads_end_with_a_single_current_logo(
    admin: User, entities: dict[str, FiscalEntity], private_media: Path, run_parallel: Any
) -> None:
    entity = entities["ARTESANAL"]
    results = run_parallel(
        lambda: upload_logo(admin, entity, image_bytes("PNG")),
        lambda: upload_logo(admin, entity, image_bytes("JPEG")),
    )
    assert [status for status, _ in results] == ["ok", "ok"]
    current = FiscalEntityLogo.objects.get(fiscal_entity=entity)
    assert current.revision == 2
    assert (private_media / current.storage_name).exists()
    call_command("purge_entity_logos", "--older-than-minutes", "0")
    assert stored_files(private_media) == [current.storage_name]


# ---------------------------------------------------------------------------
# Limpieza recuperable
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_purge_removes_only_unreferenced_logo_files(
    admin: User, entities: dict[str, FiscalEntity], private_media: Path
) -> None:
    upload_logo(admin, entities["COMERCIAL"], image_bytes())
    current = FiscalEntityLogo.objects.get().storage_name
    orphan = private_media / "fiscal-logos" / "9" / "huerfano.png"
    orphan.parent.mkdir(parents=True)
    orphan.write_bytes(b"x")
    photo = private_media / "maintenance" / "1" / "foto.jpg"
    photo.parent.mkdir(parents=True)
    photo.write_bytes(b"x")

    call_command("purge_entity_logos", "--older-than-minutes", "0")
    call_command("purge_entity_logos", "--older-than-minutes", "0")

    assert stored_files(private_media) == [current]
    assert photo.exists()


@pytest.mark.django_db
def test_purge_respects_the_safety_margin(private_media: Path) -> None:
    recent = private_media / "fiscal-logos" / "1" / "reciente.png"
    recent.parent.mkdir(parents=True)
    recent.write_bytes(b"x")
    call_command("purge_entity_logos")
    assert recent.exists()
