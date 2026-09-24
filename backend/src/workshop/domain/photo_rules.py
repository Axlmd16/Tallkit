"""Límites aprobados para fotografías de mantenimiento (P4 / DA-002 en esta entrega)."""

MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 25_000_000
MAX_PHOTOS_PER_ORDER = 20
THUMBNAIL_SIZE = 480
FORMATS = {
    "JPEG": ("image/jpeg", "jpg"),
    "PNG": ("image/png", "png"),
    "WEBP": ("image/webp", "webp"),
}


def exceeds_pixels(width: int, height: int) -> bool:
    return width * height > MAX_PIXELS
