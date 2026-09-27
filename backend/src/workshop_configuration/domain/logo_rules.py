"""Límites aprobados para el logotipo de una entidad fiscal (cambio `logotipos-por-ruc`)."""

MAX_BYTES = 2 * 1024 * 1024
MAX_PIXELS = 25_000_000
FORMATS = {
    "JPEG": ("image/jpeg", "jpg"),
    "PNG": ("image/png", "png"),
    "WEBP": ("image/webp", "webp"),
}


def exceeds_bytes(size: int) -> bool:
    return size > MAX_BYTES


def exceeds_pixels(width: int, height: int) -> bool:
    return width * height > MAX_PIXELS
