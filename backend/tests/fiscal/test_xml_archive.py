from __future__ import annotations

import hashlib
import json
from typing import Any

import pytest
from tests.fiscal.xml_samples import (
    SYNTHETIC_RUC,
    synthetic_authorization_wrapper,
    synthetic_invoice,
)

from fiscal.application.xml_archive import (
    ArchiveConflictError,
    ArchiveIntegrityError,
    IssuerMismatchError,
    archive_xml,
    download_document,
    iter_export_entries,
    list_archived_documents,
)
from fiscal.models import (
    FiscalArchiveImmutableError,
    FiscalXmlContent,
    FiscalXmlDossier,
    FiscalXmlEvidence,
)
from identity.application.authorization import BusinessPermissionDeniedError
from workshop_configuration.models import FiscalEntity

pytestmark = pytest.mark.django_db


@pytest.fixture
def fiscal_entity() -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc=SYNTHETIC_RUC, legal_name="Entidad sintética"
    )


def test_archive_preserves_exact_bytes_and_metadata_atomically(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    original = synthetic_invoice()

    result = archive_xml(
        actor=role_admin,
        fiscal_entity_id=fiscal_entity.id,
        original_bytes=original,
        source_label="carga de ensayo",
    )

    dossier = FiscalXmlDossier.objects.get(pk=result.dossier_id)
    evidence = FiscalXmlEvidence.objects.get(dossier=dossier, kind="DOCUMENT")
    content = FiscalXmlContent.objects.get(evidence=evidence)
    assert result.replayed is False
    assert dossier.verification_level == "EXTERNAL_UNVERIFIED"
    assert dossier.access_key in original.decode()
    assert content.content == original
    assert content.size_bytes == len(original)
    assert content.sha256 == hashlib.sha256(original).hexdigest()


def test_archive_requires_admin_permission_and_matching_configured_issuer(
    role_seller: Any, role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        archive_xml(
            actor=role_seller,
            fiscal_entity_id=fiscal_entity.id,
            original_bytes=synthetic_invoice(),
            source_label="ensayo",
        )

    fiscal_entity.ruc = "0999999999001"
    fiscal_entity.save(update_fields=["ruc"])
    with pytest.raises(IssuerMismatchError):
        archive_xml(
            actor=role_admin,
            fiscal_entity_id=fiscal_entity.id,
            original_bytes=synthetic_invoice(),
            source_label="ensayo",
        )

    assert FiscalXmlDossier.objects.count() == 0


def test_same_document_replays_and_compatible_wrapper_adds_separate_evidence(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    document = synthetic_invoice()
    first = archive_xml(
        actor=role_admin,
        fiscal_entity_id=fiscal_entity.id,
        original_bytes=document,
        source_label="ensayo",
    )
    replay = archive_xml(
        actor=role_admin,
        fiscal_entity_id=fiscal_entity.id,
        original_bytes=document,
        source_label="reintento",
    )
    wrapped = archive_xml(
        actor=role_admin,
        fiscal_entity_id=fiscal_entity.id,
        original_bytes=synthetic_authorization_wrapper(document),
        source_label="envoltorio de ensayo",
    )

    assert replay == first._replace(replayed=True)
    assert wrapped.dossier_id == first.dossier_id
    assert wrapped.evidence_added is True
    assert FiscalXmlDossier.objects.count() == 1
    assert FiscalXmlEvidence.objects.filter(dossier_id=first.dossier_id).count() == 2


def test_same_identity_with_different_document_bytes_is_a_conflict(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    original = synthetic_invoice()
    archive_xml(
        actor=role_admin,
        fiscal_entity_id=fiscal_entity.id,
        original_bytes=original,
        source_label="ensayo",
    )

    with pytest.raises(ArchiveConflictError):
        archive_xml(
            actor=role_admin,
            fiscal_entity_id=fiscal_entity.id,
            original_bytes=original.replace(b"<factura ", b"<factura  "),
            source_label="contenido diferente",
        )

    assert FiscalXmlDossier.objects.count() == 1
    assert FiscalXmlEvidence.objects.count() == 1


def test_storage_failure_rolls_back_dossier_evidence_and_content(
    monkeypatch: pytest.MonkeyPatch, role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    def fail(*args: object, **kwargs: object) -> None:
        raise RuntimeError("storage failed")

    monkeypatch.setattr(FiscalXmlContent.objects, "create", fail)

    with pytest.raises(RuntimeError, match="storage failed"):
        archive_xml(
            actor=role_admin,
            fiscal_entity_id=fiscal_entity.id,
            original_bytes=synthetic_invoice(),
            source_label="ensayo",
        )

    assert FiscalXmlDossier.objects.count() == 0
    assert FiscalXmlEvidence.objects.count() == 0
    assert FiscalXmlContent.objects.count() == 0


def test_listing_omits_bytes_and_download_checks_integrity(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    original = synthetic_invoice()
    archived = archive_xml(
        actor=role_admin,
        fiscal_entity_id=fiscal_entity.id,
        original_bytes=original,
        source_label="ensayo",
    )

    summaries = list_archived_documents(actor=role_admin, fiscal_entity_id=fiscal_entity.id)
    assert len(summaries) == 1
    assert not hasattr(summaries[0], "content")
    downloaded = download_document(actor=role_admin, dossier_id=archived.dossier_id)
    assert downloaded.content == original
    assert downloaded.private_cache is True

    evidence = FiscalXmlEvidence.objects.get(dossier_id=archived.dossier_id, kind="DOCUMENT")
    FiscalXmlContent.objects.filter(evidence=evidence).update(content=b"tampered")
    with pytest.raises(ArchiveIntegrityError):
        download_document(actor=role_admin, dossier_id=archived.dossier_id)


def test_evidence_and_content_reject_ordinary_edit_or_delete(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    archived = archive_xml(
        actor=role_admin,
        fiscal_entity_id=fiscal_entity.id,
        original_bytes=synthetic_invoice(),
        source_label="ensayo",
    )
    evidence = FiscalXmlEvidence.objects.get(dossier_id=archived.dossier_id)
    content = evidence.stored_content

    evidence.source_label = "reescrito"
    with pytest.raises(FiscalArchiveImmutableError):
        evidence.save()
    with pytest.raises(FiscalArchiveImmutableError):
        evidence.delete()
    content.sha256 = "0" * 64
    with pytest.raises(FiscalArchiveImmutableError):
        content.save()
    with pytest.raises(FiscalArchiveImmutableError):
        content.delete()


@pytest.mark.django_db(transaction=True)
def test_concurrent_identical_uploads_converge_on_one_dossier(
    role_admin: Any, fiscal_entity: FiscalEntity, run_parallel: Any
) -> None:
    original = synthetic_invoice()

    def upload() -> Any:
        return archive_xml(
            actor=role_admin,
            fiscal_entity_id=fiscal_entity.id,
            original_bytes=original,
            source_label="carga concurrente",
        )

    results = run_parallel(upload, upload)

    assert all(kind == "ok" for kind, _ in results), results
    assert len({result.dossier_id for _, result in results}) == 1
    assert FiscalXmlDossier.objects.count() == 1
    assert FiscalXmlEvidence.objects.count() == 1


def test_export_streams_exact_evidence_and_a_manifest(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    document = synthetic_invoice()
    wrapper = synthetic_authorization_wrapper(document)
    archived = archive_xml(
        actor=role_admin,
        fiscal_entity_id=fiscal_entity.id,
        original_bytes=wrapper,
        source_label="ensayo con envoltorio",
    )

    entries = list(
        iter_export_entries(actor=role_admin, dossier_ids=[archived.dossier_id], batch_size=1)
    )

    assert [entry.kind for entry in entries] == ["DOCUMENT", "WRAPPER", "MANIFEST"]
    assert entries[0].content == document
    assert entries[1].content == wrapper
    manifest = json.loads(entries[2].content)
    assert manifest["verification"] == "EXTERNAL_UNVERIFIED"
    assert [item["sha256"] for item in manifest["files"]] == [
        entries[0].sha256,
        entries[1].sha256,
    ]
