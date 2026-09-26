"""El catálogo oficial proviene de la ficha del SRI y conserva su procedencia."""

import copy
import json
from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from django.db import IntegrityError, transaction

from workshop_configuration.application import official_catalog
from workshop_configuration.models import OfficialCatalogEntry


def manifest() -> dict[str, Any]:
    return copy.deepcopy(official_catalog.read_manifest())


def test_manifest_declares_source_and_integrity() -> None:
    data = manifest()
    source = data["source"]
    assert source["version"] == "2.34"
    assert source["downloaded_on"] == "2026-09-26"
    assert len(source["file_sha256"]) == 64
    assert source["url"].startswith("https://www.sri.gob.ec/")
    official_catalog.verify_manifest(data)


def test_manifest_contains_the_eight_payment_forms() -> None:
    codes = {entry["code"] for entry in manifest()["entries"] if entry["kind"] == "PAYMENT_FORM"}
    assert codes == {"01", "15", "16", "17", "18", "19", "20", "21"}


def test_altered_manifest_is_rejected() -> None:
    data = manifest()
    data["entries"][0]["display_name"] = "Otro nombre"
    with pytest.raises(official_catalog.CatalogManifestError):
        official_catalog.verify_manifest(data)


def test_entry_without_source_is_rejected() -> None:
    data = manifest()
    data["source"]["downloaded_on"] = ""
    with pytest.raises(official_catalog.CatalogManifestError):
        official_catalog.verify_manifest(data)


@pytest.mark.django_db
def test_install_is_idempotent_and_keeps_provenance() -> None:
    OfficialCatalogEntry.objects.all().delete()
    official_catalog.install_manifest(OfficialCatalogEntry, manifest())
    official_catalog.install_manifest(OfficialCatalogEntry, manifest())
    entries = OfficialCatalogEntry.objects.all()
    assert entries.count() == len(manifest()["entries"])
    card = entries.get(kind="PAYMENT_FORM", code="19")
    assert card.description == "TARJETA DE CRÉDITO"
    assert card.source_version == "2.34"
    assert card.downloaded_on == date(2026, 9, 26)
    assert card.valid_from == date(2016, 6, 1)
    assert card.is_active
    assert card.is_selectable


@pytest.mark.django_db
def test_rates_without_published_validity_keep_an_explicit_note() -> None:
    official_catalog.ensure_installed()
    rate = OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=official_catalog.SELECTABLE_TAX_VERSION, code="4"
    )
    assert rate.rate == Decimal("15")
    assert rate.treatment == "RATE"
    assert rate.valid_from is None
    assert "no publica" in rate.validity_note


@pytest.mark.django_db
def test_legacy_entries_resolve_but_are_not_selectable() -> None:
    official_catalog.ensure_installed()
    legacy = OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=official_catalog.LEGACY_TAX_VERSION, code="0"
    )
    assert legacy.is_active
    assert not legacy.is_selectable
    selectable = official_catalog.list_entries(kind="TAX_RATE", selectable_only=True)
    assert all(
        entry.catalog_version == official_catalog.SELECTABLE_TAX_VERSION for entry in selectable
    )


@pytest.mark.django_db
def test_duplicate_code_within_version_is_rejected() -> None:
    official_catalog.ensure_installed()
    original = OfficialCatalogEntry.objects.get(kind="PAYMENT_FORM", code="01")
    original.pk = None
    with pytest.raises(IntegrityError), transaction.atomic():
        original.save()


@pytest.mark.django_db
def test_rate_only_allowed_for_tax_entries() -> None:
    official_catalog.ensure_installed()
    form = OfficialCatalogEntry.objects.get(kind="PAYMENT_FORM", code="20")
    form.rate = Decimal("0")
    with pytest.raises(IntegrityError), transaction.atomic():
        form.save()


def test_manifest_file_is_valid_json() -> None:
    raw = official_catalog.MANIFEST_PATH.read_text(encoding="utf-8")
    assert json.loads(raw)["manifest_version"] == 1
