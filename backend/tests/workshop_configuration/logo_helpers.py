"""Imágenes de prueba para el logotipo de entidad fiscal."""

from io import BytesIO
from typing import Any

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image


def image_bytes(fmt: str = "PNG", size: tuple[int, int] = (120, 40), **save: Any) -> bytes:
    buffer = BytesIO()
    mode = "RGBA" if fmt in {"PNG", "WEBP"} else "RGB"
    color = (20, 90, 160, 128) if mode == "RGBA" else (20, 90, 160)
    Image.new(mode, size, color).save(buffer, format=fmt, **save)
    return buffer.getvalue()


def animated_bytes(fmt: str) -> bytes:
    buffer = BytesIO()
    frames = [Image.new("RGB", (16, 16), color) for color in ((255, 0, 0), (0, 255, 0))]
    frames[0].save(buffer, format=fmt, save_all=True, append_images=frames[1:], duration=100)
    return buffer.getvalue()


def jpeg_with_exif() -> bytes:
    image = Image.new("RGB", (64, 32), (10, 20, 30))
    exif = Image.Exif()
    exif[0x010F] = "Camara de prueba"  # Make
    exif[0x0131] = "Editor de prueba"  # Software
    buffer = BytesIO()
    image.save(buffer, format="JPEG", exif=exif.tobytes())
    return buffer.getvalue()


SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'


def upload(content: bytes, name: str = "logo.png", content_type: str = "image/png") -> Any:
    return SimpleUploadedFile(name, content, content_type=content_type)
