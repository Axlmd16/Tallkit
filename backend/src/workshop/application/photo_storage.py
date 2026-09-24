"""Almacenamiento privado de fotografías (ADR-0007).

Las imágenes se validan por contenido con Pillow antes de decodificarlas por completo y se
guardan en una raíz privada con nombres UUID. No existe URL pública: solo la API autorizada
entrega los archivos. Los fallos borran los archivos escritos; los huérfanos restantes los
elimina ``purge_workshop_files``.
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
from typing import IO, Protocol

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from PIL import Image, ImageOps, UnidentifiedImageError

from workshop.application.errors import WorkshopError
from workshop.domain.photo_rules import FORMATS, MAX_BYTES, THUMBNAIL_SIZE, exceeds_pixels

PREFIX = "maintenance"


class UploadedImage(Protocol):
    size: int | None
    name: str | None

    def read(self, size: int = -1) -> bytes: ...


@dataclass(frozen=True)
class InspectedImage:
    content: bytes
    thumbnail: bytes
    content_type: str
    extension: str
    width: int
    height: int
    sha256: str


@dataclass(frozen=True)
class StoredFiles:
    storage_name: str
    thumbnail_name: str


def storage() -> FileSystemStorage:
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT, base_url=None)


def _invalid() -> WorkshopError:
    message = "Adjunte una imagen JPEG, PNG o WebP estática y válida."
    return WorkshopError("invalid_image", message, {"file": [message]})


def _too_large(message: str) -> WorkshopError:
    return WorkshopError("image_too_large", message, {"file": [message]})


def inspect_image(upload: UploadedImage) -> InspectedImage:
    if upload.size is not None and upload.size > MAX_BYTES:
        raise _too_large("La imagen supera el máximo de 10 MiB.")
    content = upload.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise _too_large("La imagen supera el máximo de 10 MiB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as probe:
                if probe.format not in FORMATS:
                    raise _invalid()
                width, height = probe.size
                if exceeds_pixels(width, height):
                    raise _too_large("La imagen supera el máximo de 25 megapíxeles.")
                if getattr(probe, "is_animated", False) or getattr(probe, "n_frames", 1) > 1:
                    raise _invalid()
                image_format = probe.format
                probe.verify()
            with Image.open(BytesIO(content)) as image:
                image.load()
                oriented = ImageOps.exif_transpose(image)
                thumb = oriented.convert("RGBA" if "A" in oriented.getbands() else "RGB")
                thumb.thumbnail((THUMBNAIL_SIZE, THUMBNAIL_SIZE))
                buffer = BytesIO()
                thumb.save(buffer, format="WEBP", quality=80)
    except WorkshopError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise _invalid() from None
    except Image.DecompressionBombWarning:
        raise _too_large("La imagen supera el máximo de 25 megapíxeles.") from None
    content_type, extension = FORMATS[image_format]
    return InspectedImage(
        content=content,
        thumbnail=buffer.getvalue(),
        content_type=content_type,
        extension=extension,
        width=width,
        height=height,
        sha256=hashlib.sha256(content).hexdigest(),
    )


def store(order_id: int, image: InspectedImage) -> StoredFiles:
    """Escribe original y miniatura; si la segunda escritura falla, borra la primera."""
    target = storage()
    stem = f"{PREFIX}/{order_id}/{uuid.uuid4().hex}"
    original = target.save(f"{stem}.{image.extension}", ContentFile(image.content))
    try:
        thumbnail = target.save(f"{stem}_thumb.webp", ContentFile(image.thumbnail))
    except BaseException:
        delete_files(original)
        raise
    return StoredFiles(original, thumbnail)


def delete_files(*names: str) -> None:
    target = storage()
    for name in names:
        try:
            target.delete(name)
        except OSError:
            continue


def open_file(name: str) -> IO[bytes]:
    return storage().open(name, "rb")


def iter_stored_files(older_than_seconds: float) -> Iterator[str]:
    """Nombres relativos de archivos del taller con antigüedad mayor al margen indicado."""
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
