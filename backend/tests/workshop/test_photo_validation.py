"""Validación del contenido real de imágenes y generación de miniaturas."""

from io import BytesIO

import pytest
from PIL import Image
from tests.workshop.workshop_helpers import animated_bytes, image_bytes, upload

from workshop.application.errors import WorkshopError
from workshop.application.photo_storage import inspect_image
from workshop.domain.photo_rules import MAX_BYTES


@pytest.mark.parametrize(
    ("fmt", "content_type"), [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")]
)
def test_valid_images(fmt: str, content_type: str) -> None:
    inspected = inspect_image(upload(image_bytes(fmt), content_type="application/octet-stream"))
    assert (inspected.content_type, inspected.width, inspected.height) == (content_type, 64, 48)
    assert len(inspected.sha256) == 64
    thumb = Image.open(BytesIO(inspected.thumbnail))
    assert thumb.format == "WEBP"
    assert max(thumb.size) <= 480
    assert not thumb.getexif()


@pytest.mark.parametrize(
    "content",
    [
        pytest.param(image_bytes("GIF"), id="gif"),
        pytest.param(animated_bytes("PNG"), id="png-animado"),
        pytest.param(animated_bytes("WEBP"), id="webp-animado"),
        pytest.param(b"%PDF-1.4 documento", id="pdf"),
        pytest.param(b"MZ\x90\x00ejecutable", id="exe-renombrado"),
        pytest.param(image_bytes("JPEG")[:40], id="truncada"),
    ],
)
def test_invalid_content_is_rejected(content: bytes) -> None:
    with pytest.raises(WorkshopError) as error:
        inspect_image(upload(content, name="foto.jpg"))
    assert error.value.code == "invalid_image"


def test_too_large_file_is_rejected_before_reading() -> None:
    class Huge:
        size = MAX_BYTES + 1
        name = "grande.jpg"

        def read(self, *_: object) -> bytes:
            raise AssertionError("no debe leerse")

    with pytest.raises(WorkshopError) as error:
        inspect_image(Huge())  # type: ignore[arg-type]
    assert error.value.code == "image_too_large"


def test_too_many_pixels_is_rejected() -> None:
    content = image_bytes("PNG", size=(6000, 5000), optimize=True)
    with pytest.raises(WorkshopError) as error:
        inspect_image(upload(content, content_type="image/png"))
    assert error.value.code == "image_too_large"


def test_thumbnail_is_scaled_and_oriented() -> None:
    content = image_bytes("JPEG", size=(1200, 600))
    inspected = inspect_image(upload(content))
    assert Image.open(BytesIO(inspected.thumbnail)).size == (480, 240)
