"""Inspección, normalización y almacenamiento privado del logotipo.

Trazabilidad: spec `configuracion-operativa-y-fiscal`, «Validación del archivo del logotipo»;
diseño D2.
"""

import hashlib
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image
from tests.workshop_configuration.logo_helpers import (
    SVG,
    animated_bytes,
    image_bytes,
    jpeg_with_exif,
    upload,
)

from workshop_configuration.application import logo_storage
from workshop_configuration.application.logo_storage import LogoImageError


@pytest.fixture(autouse=True)
def private_media(tmp_path: Path, settings) -> Path:  # type: ignore[no-untyped-def]
    root = tmp_path / "private-media"
    settings.PRIVATE_MEDIA_ROOT = root
    return root


@pytest.mark.parametrize(
    ("fmt", "content_type", "extension"),
    [("PNG", "image/png", "png"), ("JPEG", "image/jpeg", "jpg"), ("WEBP", "image/webp", "webp")],
)
def test_accepts_static_png_jpeg_and_webp(fmt: str, content_type: str, extension: str) -> None:
    original = image_bytes(fmt, (1200, 400))
    logo = logo_storage.inspect_logo(upload(original))
    assert logo.content_type == content_type
    assert logo.extension == extension
    assert (logo.width, logo.height) == (1200, 400)
    assert logo.sha256 == hashlib.sha256(original).hexdigest()
    with Image.open(BytesIO(logo.content)) as reopened:
        assert reopened.format == fmt


@pytest.mark.parametrize("fmt", ["PNG", "WEBP"])
def test_keeps_transparency(fmt: str) -> None:
    logo = logo_storage.inspect_logo(upload(image_bytes(fmt)))
    with Image.open(BytesIO(logo.content)) as reopened:
        assert "A" in reopened.getbands()


def test_removes_embedded_metadata() -> None:
    original = jpeg_with_exif()
    with Image.open(BytesIO(original)) as source:
        assert len(source.getexif()) > 0
    logo = logo_storage.inspect_logo(upload(original, "logo.jpg", "image/jpeg"))
    with Image.open(BytesIO(logo.content)) as reopened:
        assert len(reopened.getexif()) == 0


@pytest.mark.parametrize(
    ("content", "name"),
    [
        (SVG, "logo.svg"),
        (SVG, "logo.png"),
        (animated_bytes("GIF"), "logo.gif"),
        (animated_bytes("WEBP"), "logo.webp"),
        (b"%PDF-1.7\n1 0 obj<<>>endobj\n", "logo.pdf"),
        (b"MZ\x90\x00" + b"\x00" * 200, "logo.jpg"),
        (image_bytes("PNG")[:40], "logo.png"),
        (image_bytes("GIF"), "logo.gif"),
    ],
)
def test_rejects_non_admitted_content(content: bytes, name: str) -> None:
    with pytest.raises(LogoImageError) as error:
        logo_storage.inspect_logo(upload(content, name))
    assert error.value.code == "invalid_image"
    assert "PNG, JPEG o WebP" in error.value.message


def test_rejects_files_over_two_mebibytes() -> None:
    content = image_bytes("PNG") + b"\x00" * (2 * 1024 * 1024)
    with pytest.raises(LogoImageError) as error:
        logo_storage.inspect_logo(upload(content))
    assert error.value.code == "image_too_large"
    assert "2 MiB" in error.value.message


def test_rejects_images_over_twenty_five_megapixels() -> None:
    buffer = BytesIO()
    Image.new("1", (6000, 5000)).save(buffer, format="PNG")
    with pytest.raises(LogoImageError) as error:
        logo_storage.inspect_logo(upload(buffer.getvalue()))
    assert error.value.code == "image_too_large"
    assert "25 megapíxeles" in error.value.message


def test_stores_privately_under_its_own_prefix(private_media: Path) -> None:
    logo = logo_storage.inspect_logo(upload(image_bytes("PNG")))
    name = logo_storage.store_logo(7, logo)
    assert name.startswith("fiscal-logos/7/")
    assert name.endswith(".png")
    assert (private_media / name).read_bytes() == logo.content
    with logo_storage.open_file(name) as handle:
        assert handle.read() == logo.content
    logo_storage.delete_files(name, "fiscal-logos/7/inexistente.png")
    assert not (private_media / name).exists()


def test_iterates_only_old_logo_files(private_media: Path) -> None:
    logo = logo_storage.inspect_logo(upload(image_bytes("PNG")))
    name = logo_storage.store_logo(1, logo)
    photo = private_media / "maintenance" / "1" / "foto.jpg"
    photo.parent.mkdir(parents=True)
    photo.write_bytes(b"x")
    assert list(logo_storage.iter_logo_files(older_than_seconds=0)) == [name]
    assert list(logo_storage.iter_logo_files(older_than_seconds=3600)) == []
