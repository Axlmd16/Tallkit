"""Archivo transaccional de XML externo; no consulta ni representa al SRI."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterator, Sequence
from datetime import datetime
from decimal import Decimal
from typing import NamedTuple
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import Q

from fiscal.infrastructure.xml_parser import ParsedFiscalXml, parse_fiscal_xml
from fiscal.models import (
    FiscalPreparation,
    FiscalXmlContent,
    FiscalXmlDossier,
    FiscalXmlEvidence,
    FiscalXmlLinkHistory,
)
from identity.application.audit import record_audit_event
from identity.application.authorization import has_permission, require_permission
from identity.models import AuditResult, User
from sales.application.fiscal_source import lock_fiscal_source as lock_commercial_source
from workshop.application.fiscal_source import lock_fiscal_source as lock_artisan_source
from workshop_configuration.application.fiscal_resolver import read_issuer_ruc


class FiscalArchiveError(Exception):
    pass


class IssuerMismatchError(FiscalArchiveError):
    pass


class ArchiveConflictError(FiscalArchiveError):
    pass


class ArchiveIntegrityError(FiscalArchiveError):
    pass


class ArchiveLinkConflictError(FiscalArchiveError):
    pass


class LinkReasonRequiredError(FiscalArchiveError):
    pass


class ArchiveResult(NamedTuple):
    dossier_id: UUID
    replayed: bool
    evidence_added: bool


class ArchivedDocumentSummary(NamedTuple):
    dossier_id: UUID
    fiscal_entity_id: int
    document_type: str
    environment: str
    access_key: str
    issue_date: str
    total: str
    verification_level: str
    linked_source: str | None


class DownloadedXml(NamedTuple):
    content: bytes
    sha256: str
    size_bytes: int
    filename: str
    private_cache: bool


class LinkResult(NamedTuple):
    dossier_id: UUID
    source_kind: str
    source_id: int
    discrepancies: tuple[str, ...]


class ExportEntry(NamedTuple):
    filename: str
    content: bytes
    sha256: str
    kind: str


MAX_EXPORT_DOCUMENTS = 100


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _identity_filter(parsed: ParsedFiscalXml, fiscal_entity_id: int) -> dict[str, object]:
    return {
        "fiscal_entity_id": fiscal_entity_id,
        "document_type": parsed.document_type,
        "environment": parsed.environment,
        "establishment_code": parsed.establishment,
        "emission_point_code": parsed.emission_point,
        "sequential": parsed.sequential,
    }


def _create_content(
    *,
    dossier: FiscalXmlDossier,
    kind: str,
    content: bytes,
    source_label: str,
    authorization_state: str | None,
    actor: User,
) -> FiscalXmlEvidence:
    evidence = FiscalXmlEvidence.objects.create(
        dossier=dossier,
        kind=kind,
        source_label=source_label,
        declared_authorization_state=authorization_state,
        incorporated_by=actor,
    )
    FiscalXmlContent.objects.create(
        evidence=evidence,
        content=content,
        size_bytes=len(content),
        sha256=_sha256(content),
    )
    return evidence


def _document_content(dossier: FiscalXmlDossier) -> FiscalXmlContent:
    try:
        evidence = dossier.evidences.get(kind="DOCUMENT")
        return evidence.stored_content
    except (FiscalXmlEvidence.DoesNotExist, FiscalXmlContent.DoesNotExist):
        raise ArchiveIntegrityError("El expediente no contiene el documento original.") from None


def archive_xml(
    *,
    actor: User,
    fiscal_entity_id: int,
    original_bytes: bytes,
    source_label: str,
) -> ArchiveResult:
    require_permission(actor=actor, permission="fiscal.archivo.gestionar")
    source_label = source_label.strip()
    if not source_label or len(source_label) > 500:
        raise FiscalArchiveError("La procedencia de la carga es obligatoria.")
    issuer_ruc = read_issuer_ruc(fiscal_entity_id)
    parsed = parse_fiscal_xml(original_bytes)
    if parsed.issuer_ruc != issuer_ruc:
        raise IssuerMismatchError("El emisor no corresponde a la entidad fiscal seleccionada.")
    if parsed.environment == "2":
        from fiscal.application.readiness import get_readiness

        if not get_readiness(
            actor=actor, fiscal_entity_id=fiscal_entity_id
        ).productive_archive_ready:
            raise FiscalArchiveError(
                "La incorporación productiva requiere política vigente y evidencia "
                "aplicable de restauración."
            )

    with transaction.atomic():
        dossier = (
            FiscalXmlDossier.objects.select_for_update()
            .filter(**_identity_filter(parsed, fiscal_entity_id))
            .first()
        )
        created = dossier is None
        if dossier is None:
            try:
                with transaction.atomic():
                    dossier = FiscalXmlDossier.objects.create(
                        fiscal_entity_id=fiscal_entity_id,
                        document_type=parsed.document_type,
                        schema_version=parsed.version,
                        environment=parsed.environment,
                        issuer_ruc=parsed.issuer_ruc,
                        access_key=parsed.access_key,
                        establishment_code=parsed.establishment,
                        emission_point_code=parsed.emission_point,
                        sequential=parsed.sequential,
                        issue_date=datetime.strptime(parsed.issue_date, "%d/%m/%Y").date(),
                        total=parsed.total,
                        tax_total=parsed.tax_total,
                        receiver_identification=parsed.receiver_identification,
                        currency=parsed.currency,
                        line_count=parsed.line_count,
                        line_facts=list(parsed.line_facts),
                        created_by=actor,
                    )
            except IntegrityError:
                dossier = FiscalXmlDossier.objects.select_for_update().get(
                    **_identity_filter(parsed, fiscal_entity_id)
                )
                created = False

        assert dossier is not None
        if created:
            _create_content(
                dossier=dossier,
                kind="DOCUMENT",
                content=parsed.document_bytes,
                source_label=source_label,
                authorization_state=None,
                actor=actor,
            )
        else:
            stored = _document_content(dossier)
            if (
                dossier.access_key != parsed.access_key
                or stored.sha256 != _sha256(parsed.document_bytes)
                or bytes(stored.content) != parsed.document_bytes
            ):
                raise ArchiveConflictError("La identidad fiscal ya existe con contenido diferente.")

        evidence_added = False
        if parsed.wrapper_bytes is not None:
            wrapper_hash = _sha256(parsed.wrapper_bytes)
            existing_wrapper = FiscalXmlContent.objects.filter(
                evidence__dossier=dossier,
                evidence__kind="WRAPPER",
                sha256=wrapper_hash,
            ).first()
            if existing_wrapper is None or bytes(existing_wrapper.content) != parsed.wrapper_bytes:
                _create_content(
                    dossier=dossier,
                    kind="WRAPPER",
                    content=parsed.wrapper_bytes,
                    source_label=source_label,
                    authorization_state=parsed.declared_authorization_state,
                    actor=actor,
                )
                evidence_added = True

        record_audit_event(
            actor=actor,
            action="fiscal.xml_archived",
            target_type="fiscal_xml_dossier",
            target_id=str(dossier.pk),
            result=AuditResult.SUCCESS,
        )
        return ArchiveResult(
            dossier_id=dossier.pk,
            replayed=not created and not evidence_added,
            evidence_added=evidence_added,
        )


def list_archived_documents(
    *, actor: User, fiscal_entity_id: int | None = None
) -> tuple[ArchivedDocumentSummary, ...]:
    query = FiscalXmlDossier.objects.all()
    if not has_permission(actor, "fiscal.archivo.gestionar"):
        scope = Q(pk__in=[])
        if has_permission(actor, "fiscal.comercial.ver"):
            scope |= Q(commercial_sale__isnull=False)
        if has_permission(actor, "fiscal.artesanal.ver"):
            scope |= Q(artisan_operation__isnull=False)
        if scope == Q(pk__in=[]):
            require_permission(actor=actor, permission="fiscal.archivo.gestionar")
        query = query.filter(scope)
    if fiscal_entity_id is not None:
        query = query.filter(fiscal_entity_id=fiscal_entity_id)
    return tuple(
        ArchivedDocumentSummary(
            dossier_id=row.id,
            fiscal_entity_id=row.fiscal_entity_id,
            document_type=row.document_type,
            environment=row.environment,
            access_key=row.access_key,
            issue_date=row.issue_date.isoformat(),
            total=str(row.total),
            verification_level=row.verification_level,
            linked_source=(
                f"COMMERCIAL:{row.commercial_sale_id}"
                if row.commercial_sale_id is not None
                else (
                    f"ARTISAN:{row.artisan_operation_id}"
                    if row.artisan_operation_id is not None
                    else None
                )
            ),
        )
        for row in query.iterator(chunk_size=200)
    )


def _require_dossier_read(actor: User, dossier: FiscalXmlDossier) -> None:
    if has_permission(actor, "fiscal.archivo.gestionar"):
        return
    if dossier.commercial_sale_id is not None and has_permission(actor, "fiscal.comercial.ver"):
        return
    if dossier.artisan_operation_id is not None and has_permission(actor, "fiscal.artesanal.ver"):
        return
    require_permission(actor=actor, permission="fiscal.archivo.gestionar")


def download_document(*, actor: User, dossier_id: UUID) -> DownloadedXml:
    dossier = FiscalXmlDossier.objects.get(pk=dossier_id)
    _require_dossier_read(actor, dossier)
    stored = _document_content(dossier)
    content = bytes(stored.content)
    if len(content) != stored.size_bytes or _sha256(content) != stored.sha256:
        raise ArchiveIntegrityError("La integridad del documento archivado no coincide.")
    return DownloadedXml(
        content=content,
        sha256=stored.sha256,
        size_bytes=stored.size_bytes,
        filename=f"{dossier.access_key}.xml",
        private_cache=True,
    )


def iter_export_entries(
    *, actor: User, dossier_ids: Sequence[UUID], batch_size: int = 20
) -> Iterator[ExportEntry]:
    ids = tuple(dict.fromkeys(dossier_ids))
    if not ids or len(ids) > MAX_EXPORT_DOCUMENTS:
        raise FiscalArchiveError("La exportación debe seleccionar entre 1 y 100 expedientes.")
    if not 1 <= batch_size <= 100:
        raise FiscalArchiveError("El tamaño de lote de exportación no es válido.")

    manifest_files: list[dict[str, object]] = []
    verification_levels: set[str] = set()
    for dossier_id in ids:
        dossier = FiscalXmlDossier.objects.get(pk=dossier_id)
        _require_dossier_read(actor, dossier)
        verification_levels.add(dossier.verification_level)
        counters: dict[str, int] = {}
        evidences = (
            FiscalXmlEvidence.objects.filter(dossier=dossier)
            .select_related("stored_content")
            .order_by("incorporated_at", "id")
            .iterator(chunk_size=batch_size)
        )
        for evidence in evidences:
            stored = evidence.stored_content
            content = bytes(stored.content)
            if len(content) != stored.size_bytes or _sha256(content) != stored.sha256:
                raise ArchiveIntegrityError("La integridad de una evidencia no coincide.")
            counters[evidence.kind] = counters.get(evidence.kind, 0) + 1
            suffix = "document" if evidence.kind == "DOCUMENT" else "wrapper"
            filename = f"{dossier.access_key}-{suffix}-{counters[evidence.kind]}.xml"
            manifest_files.append(
                {
                    "filename": filename,
                    "sha256": stored.sha256,
                    "size_bytes": stored.size_bytes,
                    "kind": evidence.kind,
                    "access_key": dossier.access_key,
                    "source_label": evidence.source_label,
                }
            )
            yield ExportEntry(filename, content, stored.sha256, evidence.kind)

    verification = (
        next(iter(verification_levels)) if len(verification_levels) == 1 else "MIXED_LOCAL_LEVELS"
    )
    manifest = json.dumps(
        {"verification": verification, "files": manifest_files},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
    yield ExportEntry("manifest.json", manifest, _sha256(manifest), "MANIFEST")


def link_dossier(
    *,
    actor: User,
    dossier_id: UUID,
    source_kind: str,
    source_id: int,
    reason: str,
) -> LinkResult:
    require_permission(actor=actor, permission="fiscal.archivo.gestionar")
    if source_kind not in {"COMMERCIAL", "ARTISAN"}:
        raise FiscalArchiveError("El tipo de operación no está admitido.")

    with transaction.atomic():
        source = (
            lock_commercial_source(source_id)
            if source_kind == "COMMERCIAL"
            else lock_artisan_source(source_id)
        )
        dossier = FiscalXmlDossier.objects.select_for_update().get(pk=dossier_id)
        preparation_filter = (
            {"commercial_sale_id": source_id}
            if source_kind == "COMMERCIAL"
            else {"artisan_operation_id": source_id}
        )
        if FiscalPreparation.objects.filter(
            **preparation_filter, state__in=["DRAFT", "PREPARED"]
        ).exists():
            raise ArchiveLinkConflictError("La operación ya tiene una preparación fiscal activa.")
        if source.fiscal_entity_id != dossier.fiscal_entity_id:
            raise ArchiveLinkConflictError("La operación pertenece a otro emisor.")
        if Decimal(str(source.grand_total)) != dossier.total:
            raise ArchiveLinkConflictError("El total de la operación no coincide con el XML.")
        if Decimal(str(source.tax_total)) != dossier.tax_total:
            raise ArchiveLinkConflictError("Los tributos de la operación no coinciden con el XML.")
        if dossier.currency not in {"DOLAR", "USD"}:
            raise ArchiveLinkConflictError("La moneda del XML no coincide con la operación.")

        discrepancies: list[str] = []
        if source.customer_snapshot.get("identification") != dossier.receiver_identification:
            discrepancies.append("receiver_identification")
        if len(source.lines) != dossier.line_count:
            discrepancies.append("line_count")
        elif [
            {
                "position": line.position,
                "quantity": str(line.quantity),
                "base_amount": str(line.base_amount),
                "tax_amount": str(line.tax_amount),
            }
            for line in source.lines
        ] != dossier.line_facts:
            discrepancies.append("lines")

        current_id = (
            dossier.commercial_sale_id
            if source_kind == "COMMERCIAL"
            else dossier.artisan_operation_id
        )
        current_kind = (
            "COMMERCIAL"
            if dossier.commercial_sale_id is not None
            else "ARTISAN"
            if dossier.artisan_operation_id is not None
            else None
        )
        changing = current_kind is not None and (
            current_kind != source_kind or current_id != source_id
        )
        reason = reason.strip()
        if (changing or discrepancies) and not reason:
            raise LinkReasonRequiredError(
                "La corrección o discrepancia del vínculo requiere un motivo."
            )
        if current_kind == source_kind and current_id == source_id:
            return LinkResult(dossier.id, source_kind, source_id, tuple(discrepancies))

        sequence = dossier.link_history.count() + 1
        previous_sale_id = dossier.commercial_sale_id
        previous_artisan_id = dossier.artisan_operation_id
        if source_kind == "COMMERCIAL":
            dossier.commercial_sale_id = source_id
            dossier.artisan_operation_id = None
        else:
            dossier.commercial_sale_id = None
            dossier.artisan_operation_id = source_id
        dossier.save(update_fields=["commercial_sale", "artisan_operation"])
        FiscalXmlLinkHistory.objects.create(
            dossier=dossier,
            sequence=sequence,
            previous_commercial_sale_id=previous_sale_id,
            previous_artisan_operation_id=previous_artisan_id,
            commercial_sale_id=source_id if source_kind == "COMMERCIAL" else None,
            artisan_operation_id=source_id if source_kind == "ARTISAN" else None,
            reason=reason or "Vínculo inicial sin discrepancias.",
            discrepancies=discrepancies,
            changed_by=actor,
        )
        record_audit_event(
            actor=actor,
            action="fiscal.xml_linked",
            target_type="fiscal_xml_dossier",
            target_id=str(dossier.id),
            result=AuditResult.SUCCESS,
        )
        return LinkResult(dossier.id, source_kind, source_id, tuple(discrepancies))
