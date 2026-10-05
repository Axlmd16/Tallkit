"""API HTTP del logotipo de entidad fiscal.

Trazabilidad: spec `configuracion-operativa-y-fiscal`: «Entrega privada del logotipo»,
«Validación del archivo del logotipo», «Reemplazo y retiro del logotipo»; diseño D5.
"""

import uuid
from collections.abc import Iterable
from pathlib import Path
from typing import Any, cast

import pytest
from django.http import StreamingHttpResponse
from rest_framework.test import APIClient
from tests.workshop_configuration.logo_helpers import SVG, image_bytes

from identity.models import User, UserRole
from workshop_configuration.models import FiscalEntity, FiscalEntityLogo

BASE = "/api/v1/workshop-configuration"


@pytest.fixture(autouse=True)
def private_media(tmp_path: Path, settings: Any) -> Path:
    root = tmp_path / "private-media"
    settings.PRIVATE_MEDIA_ROOT = root
    return root


def _client(username: str, *roles: str) -> APIClient:
    user = User.objects.create_user(username=username, password="p")
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def admin(db: None) -> APIClient:
    return _client("api-logo-admin", "ADMINISTRADOR")


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


def post_logo(client: APIClient, entity: FiscalEntity, content: bytes, **extra: Any) -> Any:
    from django.core.files.uploadedfile import SimpleUploadedFile

    data = {
        "file": SimpleUploadedFile("logo.png", content, content_type="image/png"),
        "idempotency_key": extra.pop("idempotency_key", f"k-{uuid.uuid4().hex}"),
    }
    return client.post(f"{BASE}/entities/{entity.pk}/logo/", data, format="multipart")


def remove(client: APIClient, entity: FiscalEntity, key: str | None = None) -> Any:
    return client.post(
        f"{BASE}/entities/{entity.pk}/logo/remove/",
        {"idempotency_key": key or f"k-{uuid.uuid4().hex}"},
        format="json",
    )


@pytest.mark.django_db
def test_upload_returns_the_entity_with_its_logo(
    admin: APIClient, entities: dict[str, FiscalEntity]
) -> None:
    entity = entities["COMERCIAL"]
    response = post_logo(admin, entity, image_bytes("PNG", (300, 100)))
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == entity.pk
    assert body["logo"]["width"] == 300
    assert body["logo"]["content_type"] == "image/png"
    assert body["logo"]["url"] == f"{BASE}/entity-logos/COMERCIAL/1/"


@pytest.mark.django_db
def test_rejected_image_returns_field_error(
    admin: APIClient, entities: dict[str, FiscalEntity]
) -> None:
    response = post_logo(admin, entities["COMERCIAL"], SVG)
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "invalid_image"
    assert "PNG, JPEG o WebP" in body["errors"]["file"][0]


@pytest.mark.django_db
def test_missing_file_is_a_validation_error(
    admin: APIClient, entities: dict[str, FiscalEntity]
) -> None:
    response = admin.post(
        f"{BASE}/entities/{entities['COMERCIAL'].pk}/logo/",
        {"idempotency_key": "k-sin-archivo"},
        format="multipart",
    )
    assert response.status_code == 400
    assert "file" in response.json()["errors"]


@pytest.mark.django_db
def test_key_conflict_and_invalid_key(admin: APIClient, entities: dict[str, FiscalEntity]) -> None:
    entity = entities["COMERCIAL"]
    assert (
        post_logo(admin, entity, image_bytes("PNG"), idempotency_key="k-repetida").status_code
        == 200
    )
    conflict = post_logo(admin, entity, image_bytes("JPEG"), idempotency_key="k-repetida")
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "idempotency_conflict"
    invalid = post_logo(admin, entity, image_bytes("PNG"), idempotency_key="x")
    assert invalid.status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize("roles", [("VENDEDOR",), ("ENCARGADO_TALLER",)])
def test_non_admin_cannot_upload_or_remove(
    roles: tuple[str, ...], entities: dict[str, FiscalEntity]
) -> None:
    client = _client("api-logo-other", *roles)
    entity = entities["COMERCIAL"]
    assert post_logo(client, entity, image_bytes()).status_code == 403
    assert remove(client, entity).status_code == 403
    assert not FiscalEntityLogo.objects.exists()


@pytest.mark.django_db
def test_remove_returns_entity_without_logo(
    admin: APIClient, entities: dict[str, FiscalEntity]
) -> None:
    entity = entities["ARTESANAL"]
    post_logo(admin, entity, image_bytes())
    response = remove(admin, entity)
    assert response.status_code == 200
    assert response.json()["logo"] is None
    assert remove(admin, entity).status_code == 200


@pytest.mark.django_db
def test_entity_reads_include_logo_or_null(
    admin: APIClient, entities: dict[str, FiscalEntity]
) -> None:
    post_logo(admin, entities["COMERCIAL"], image_bytes())
    listed = {e["entity_type"]: e for e in admin.get(f"{BASE}/entities/").json()}
    assert listed["COMERCIAL"]["logo"]["revision"] == 1
    assert listed["ARTESANAL"]["logo"] is None
    detail = admin.get(f"{BASE}/entities/{entities['ARTESANAL'].pk}/").json()
    assert detail["logo"] is None


@pytest.mark.django_db
@pytest.mark.parametrize("roles", [("ADMINISTRADOR",), ("VENDEDOR",), ("ENCARGADO_TALLER",)])
def test_every_role_reads_the_logo_summary_and_file(
    roles: tuple[str, ...], admin: APIClient, entities: dict[str, FiscalEntity]
) -> None:
    post_logo(admin, entities["COMERCIAL"], image_bytes("PNG"))
    client = _client("api-logo-reader", *roles)

    summary = client.get(f"{BASE}/entity-logos/")
    assert summary.status_code == 200
    body = summary.json()
    assert body["COMERCIAL"]["legal_name"] == "Repuestos Andinos"
    assert body["COMERCIAL"]["logo"]["url"] == f"{BASE}/entity-logos/COMERCIAL/1/"
    assert body["ARTESANAL"] == {
        "entity_id": entities["ARTESANAL"].pk,
        "legal_name": "Taller Andino",
        "display_name": "Taller Andino",
        "logo": None,
    }

    file = client.get(body["COMERCIAL"]["logo"]["url"])
    assert file.status_code == 200
    assert file["Content-Type"] == "image/png"
    assert file["Cache-Control"] == "private, max-age=31536000, immutable"
    assert file["X-Content-Type-Options"] == "nosniff"
    assert file["Content-Security-Policy"] == "default-src 'none'"
    assert b"".join(
        cast(Iterable[bytes], cast(StreamingHttpResponse, file).streaming_content)
    ).startswith(b"\x89PNG")


@pytest.mark.django_db
def test_logo_summary_resolves_the_current_display_name(
    admin: APIClient, entities: dict[str, FiscalEntity]
) -> None:
    commercial = entities["COMERCIAL"]
    commercial.trade_name = "  Repuestos La Esquina  "
    commercial.save(update_fields=["trade_name"])
    artisan = entities["ARTESANAL"]
    artisan.trade_name = "   "
    artisan.save(update_fields=["trade_name"])

    body = admin.get(f"{BASE}/entity-logos/").json()

    assert body["COMERCIAL"]["display_name"] == "Repuestos La Esquina"
    assert body["COMERCIAL"]["legal_name"] == "Repuestos Andinos"
    assert body["ARTESANAL"]["display_name"] == "Taller Andino"
    assert body["ARTESANAL"]["legal_name"] == "Taller Andino"


@pytest.mark.django_db
def test_anonymous_requests_are_denied_without_revealing(
    admin: APIClient, entities: dict[str, FiscalEntity]
) -> None:
    post_logo(admin, entities["COMERCIAL"], image_bytes())
    anonymous = APIClient()
    assert anonymous.get(f"{BASE}/entity-logos/").status_code == 403
    existing = anonymous.get(f"{BASE}/entity-logos/COMERCIAL/1/")
    missing = anonymous.get(f"{BASE}/entity-logos/ARTESANAL/1/")
    assert existing.status_code == missing.status_code == 403


@pytest.mark.django_db
def test_old_revisions_and_unknown_types_are_not_found(
    admin: APIClient, entities: dict[str, FiscalEntity]
) -> None:
    entity = entities["COMERCIAL"]
    post_logo(admin, entity, image_bytes("PNG"))
    post_logo(admin, entity, image_bytes("JPEG"))
    assert admin.get(f"{BASE}/entity-logos/COMERCIAL/1/").status_code == 404
    assert admin.get(f"{BASE}/entity-logos/COMERCIAL/2/").status_code == 200
    assert admin.get(f"{BASE}/entity-logos/ARTESANAL/1/").status_code == 404
    assert admin.get(f"{BASE}/entity-logos/OTRO/1/").status_code == 404
