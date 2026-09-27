"""Inspección y almacenamiento privado del logotipo de una entidad fiscal (diseño D2, ADR-0007).

La imagen se valida por contenido antes de decodificarla por completo y se vuelve a codificar
en su mismo formato sin metadatos: se sirve siempre la imagen regenerada, nunca los bytes
recibidos. Los archivos viven en `PRIVATE_MEDIA_ROOT/fiscal-logos/`, con nombres UUID y sin
URL pública; `purge_entity_logos` elimina los que quedan sin registro vigente.
"""

import hashlib
import os
import time
import uuid
import warnings
from collections.abc import Iterator
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import IO, Any, Protocol

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from PIL import Image, ImageOps, UnidentifiedImageError

from workshop_configuration.domain.logo_rules import (
    FORMATS,
    MAX_BYTES,
    exceeds_bytes,
    exceeds_pixels,
)

PREFIX = "fiscal-logos"
INVALID_MESSAGE = "Suba una imagen PNG, JPEG o WebP estática y válida."
SIZE_MESSAGE = "La imagen supera el máximo de 2 MiB."
PIXELS_MESSAGE = "La imagen supera el máximo de 25 megapíxeles."


class LogoImageError(Exception):
    """Imagen rechazada; `code` es estable para la API y `message` se muestra al usuario."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class UploadedImage(Protocol):
    size: int | None
    name: str | None

    def read(self, size: int = -1) -> bytes: ...


@dataclass(frozen=True)
class InspectedLogo:
    content: bytes
    content_type: str
    extension: str
    width: int
    height: int
    sha256: str


def storage() -> FileSystemStorage:
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT, base_url=None)


def read_upload(upload: UploadedImage) -> bytes:
    """Lee como máximo el límite más un byte; rechaza antes lo que declara un tamaño mayor."""
    if upload.size is not None and exceeds_bytes(upload.size):
        raise LogoImageError("image_too_large", SIZE_MESSAGE)
    content = upload.read(MAX_BYTES + 1)
    if exceeds_bytes(len(content)):
        raise LogoImageError("image_too_large", SIZE_MESSAGE)
    return content


def _normalized(image: Image.Image, image_format: str) -> bytes:
    oriented = ImageOps.exif_transpose(image)
    has_alpha = "A" in oriented.getbands() or "transparency" in oriented.info
    options: dict[str, Any] = {}
    icc = image.info.get("icc_profile")
    if icc:
        options["icc_profile"] = icc
    if image_format == "JPEG":
        target = oriented if oriented.mode in {"L", "RGB", "CMYK"} else oriented.convert("RGB")
        options["quality"] = 90
    elif image_format == "WEBP":
        target = oriented.convert("RGBA" if has_alpha else "RGB")
        options["lossless"] = True
    else:
        target = (
            oriented
            if oriented.mode in {"1", "L", "LA", "P", "RGB", "RGBA"}
            else (oriented.convert("RGBA" if has_alpha else "RGB"))
        )
        if target.mode == "P" and "transparency" in oriented.info:
            options["transparency"] = oriented.info["transparency"]
    buffer = BytesIO()
    target.save(buffer, format=image_format, **options)
    return buffer.getvalue()


def inspect_logo(upload: UploadedImage) -> InspectedLogo:
    content = read_upload(upload)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as probe:
                if probe.format not in FORMATS:
                    raise LogoImageError("invalid_image", INVALID_MESSAGE)
                width, height = probe.size
                if exceeds_pixels(width, height):
                    raise LogoImageError("image_too_large", PIXELS_MESSAGE)
                if getattr(probe, "is_animated", False) or getattr(probe, "n_frames", 1) > 1:
                    raise LogoImageError("invalid_image", INVALID_MESSAGE)
                image_format = probe.format
                probe.verify()
            with Image.open(BytesIO(content)) as image:
                image.load()
                normalized = _normalized(image, image_format)
    except LogoImageError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise LogoImageError("invalid_image", INVALID_MESSAGE) from None
    except Image.DecompressionBombWarning:
        raise LogoImageError("image_too_large", PIXELS_MESSAGE) from None
    content_type, extension = FORMATS[image_format]
    return InspectedLogo(
        content=normalized,
        content_type=content_type,
        extension=extension,
        width=width,
        height=height,
        sha256=hashlib.sha256(content).hexdigest(),
    )


def store_logo(entity_id: int, logo: InspectedLogo) -> str:
    name = f"{PREFIX}/{entity_id}/{uuid.uuid4().hex}.{logo.extension}"
    return storage().save(name, ContentFile(logo.content))


def delete_files(*names: str) -> None:
    target = storage()
    for name in names:
        try:
            target.delete(name)
        except OSError:
            continue


def open_file(name: str) -> IO[bytes]:
    return storage().open(name, "rb")


def iter_logo_files(older_than_seconds: float) -> Iterator[str]:
    """Nombres relativos de logotipos con antigüedad mayor al margen indicado."""
    root = Path(settings.PRIVATE_MEDIA_ROOT)
    base = root / PREFIX
    if not base.is_dir():
        return
    limit = time.time() - older_than_seconds
    for directory, _, files in os.walk(base):
        for filename in files:
            path = Path(directory) / filename
            try:
                if path.stat().st_mtime <= limit:
                    yield path.relative_to(root).as_posix()
            except FileNotFoundError:
                continue
