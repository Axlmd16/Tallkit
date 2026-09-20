"""Normalización de la referencia externa de un documento de compra."""


def normalize_reference(value: str) -> str:
    """``strip().upper()``: conserva ceros iniciales y puntuación significativa."""
    return value.strip().upper()
