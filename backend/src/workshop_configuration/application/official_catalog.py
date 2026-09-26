"""Catálogos oficiales del SRI incorporados desde un manifiesto con procedencia.

El manifiesto versionado en ``catalogs/`` se construye desde la ficha técnica del SRI;
la carga comprueba su integridad y no completa datos ausentes. El mismo cargador lo
usan la migración de datos y las pruebas, porque las pruebas transaccionales vacían
las tablas.
"""

import hashlib
import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

from workshop_configuration.models import OfficialCatalogEntry

MANIFEST_PATH = Path(__file__).resolve().parent.parent / "catalogs" / "sri-2.34.json"
SELECTABLE_TAX_VERSION = "SRI-2.34-TABLA17"
SELECTABLE_PAYMENT_VERSION = "SRI-2.34-TABLA24"
LEGACY_TAX_VERSION = "SRI-2.34-IVA-subset-v1"
_SOURCE_FIELDS = ("document", "version", "url", "downloaded_on", "file_sha256")
_ENTRY_FIELDS = ("kind", "catalog_version", "code", "description", "display_name")


class CatalogManifestError(ValueError):
    """El manifiesto carece de procedencia o no coincide con su huella."""


def read_manifest(path: Path = MANIFEST_PATH) -> dict[str, Any]:
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return data


def _entries_digest(entries: list[dict[str, Any]]) -> str:
    canonical = json.dumps(entries, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def verify_manifest(data: dict[str, Any]) -> None:
    source = data.get("source") or {}
    for field in _SOURCE_FIELDS:
        if not str(source.get(field) or "").strip():
            raise CatalogManifestError(f"El manifiesto no declara la procedencia: {field}.")
    entries = data.get("entries")
    if not isinstance(entries, list) or not entries:
        raise CatalogManifestError("El manifiesto no contiene entradas.")
    for entry in entries:
        for field in _ENTRY_FIELDS:
            if not str(entry.get(field) or "").strip():
                raise CatalogManifestError(f"Entrada sin {field}.")
    if _entries_digest(entries) != data.get("entries_sha256"):
        raise CatalogManifestError("Las entradas no coinciden con la huella declarada.")


def _optional_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def install_manifest(model: Any, data: dict[str, Any]) -> int:
    """Incorpora las entradas ausentes; nunca modifica las ya incorporadas."""
    verify_manifest(data)
    source = data["source"]
    selectable = data.get("selectable_versions") or {}
    created = 0
    for entry in data["entries"]:
        _, was_created = model.objects.get_or_create(
            kind=entry["kind"],
            catalog_version=entry["catalog_version"],
            code=entry["code"],
            defaults={
                "description": entry["description"],
                "display_name": entry["display_name"],
                "tax_code": entry.get("tax_code"),
                "rate": Decimal(entry["rate"]) if entry.get("rate") is not None else None,
                "treatment": entry.get("treatment"),
                "source_document": source["document"],
                "source_version": source["version"],
                "source_reference": entry.get("source_reference") or "",
                "source_url": source["url"],
                "downloaded_on": date.fromisoformat(source["downloaded_on"]),
                "source_file_sha256": source["file_sha256"],
                "valid_from": _optional_date(entry.get("valid_from")),
                "valid_to": _optional_date(entry.get("valid_to")),
                "validity_note": entry.get("validity_note") or "",
                "is_active": True,
                "is_selectable": selectable.get(entry["kind"]) == entry["catalog_version"],
            },
        )
        created += int(was_created)
    return created


def ensure_installed() -> None:
    install_manifest(OfficialCatalogEntry, read_manifest())


def list_entries(
    *, kind: str, selectable_only: bool = False, version: str | None = None
) -> tuple[OfficialCatalogEntry, ...]:
    query = OfficialCatalogEntry.objects.filter(kind=kind)
    if selectable_only:
        query = query.filter(is_selectable=True, is_active=True)
    if version is not None:
        query = query.filter(catalog_version=version)
    return tuple(query.order_by("catalog_version", "code"))


def is_current(entry: OfficialCatalogEntry, on: date) -> bool:
    """Una entrada sin vigencia publicada se considera vigente mientras esté activa."""
    if not entry.is_active:
        return False
    if entry.valid_from is not None and on < entry.valid_from:
        return False
    return not (entry.valid_to is not None and on > entry.valid_to)


def link_mappings(mapping_model: Any, entry_model: Any) -> int:
    """Enlaza cada correspondencia con su entrada; una ausencia es un error, no un valor."""
    linked = 0
    for mapping in mapping_model.objects.filter(catalog_entry__isnull=True).order_by("pk"):
        entry = entry_model.objects.filter(
            kind="TAX_RATE",
            catalog_version=mapping.catalog_version,
            code=mapping.percentage_code,
        ).first()
        if entry is None:
            raise CatalogManifestError(
                "La correspondencia "
                f"{mapping.pk} ({mapping.catalog_version}/{mapping.percentage_code}) "
                "no tiene entrada en el catálogo oficial."
            )
        mapping.catalog_entry = entry
        mapping.save(update_fields=["catalog_entry"])
        linked += 1
    return linked
