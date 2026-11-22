"""Normalización de texto para búsquedas sin distinguir mayúsculas, tildes ni guiones."""

import unicodedata


def fold_text(value: str) -> str:
    """Convierte a minúsculas y retira marcas diacríticas (tildes)."""
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower().strip()


def fold_compact(value: str) -> str:
    """Como ``fold_text``, retirando además espacios y guiones (útil para placas)."""
    return "".join(ch for ch in fold_text(value) if ch not in {" ", "-"})
