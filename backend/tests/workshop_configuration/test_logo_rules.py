"""Reglas puras del logotipo de entidad fiscal.

Trazabilidad: spec `configuracion-operativa-y-fiscal`, «Validación del archivo del logotipo».
"""

from workshop_configuration.domain.logo_rules import (
    FORMATS,
    MAX_BYTES,
    MAX_PIXELS,
    exceeds_bytes,
    exceeds_pixels,
)


def test_admitted_formats_are_png_jpeg_and_webp_only() -> None:
    assert set(FORMATS) == {"PNG", "JPEG", "WEBP"}
    assert FORMATS["PNG"] == ("image/png", "png")
    assert FORMATS["JPEG"] == ("image/jpeg", "jpg")
    assert FORMATS["WEBP"] == ("image/webp", "webp")


def test_size_limit_is_two_mebibytes() -> None:
    assert MAX_BYTES == 2 * 1024 * 1024
    assert not exceeds_bytes(MAX_BYTES)
    assert exceeds_bytes(MAX_BYTES + 1)


def test_resolution_limit_is_twenty_five_megapixels() -> None:
    assert MAX_PIXELS == 25_000_000
    assert not exceeds_pixels(5000, 5000)
    assert exceeds_pixels(6000, 5000)
