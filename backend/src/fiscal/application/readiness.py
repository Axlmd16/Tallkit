"""Preparación administrativa del archivo fiscal; no certifica el respaldo externo."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.db import transaction

from fiscal.models import FiscalArchivePolicy, FiscalRestorationEvidence
from identity.application.authorization import require_permission
from identity.models import User
from workshop_configuration.application.fiscal_resolver import read_issuer_ruc


class FiscalReadinessError(Exception):
    pass


@dataclass(frozen=True)
class ArchiveReadiness:
    fiscal_entity_id: int
    policy: dict[str, Any] | None
    restoration: dict[str, Any] | None
    policy_ready: bool
    restoration_ready: bool
    productive_archive_ready: bool
    pending: tuple[str, ...]


def _policy_payload(policy: FiscalArchivePolicy) -> dict[str, Any]:
    return {
        "version": policy.version,
        "responsible": policy.responsible,
        "purpose": policy.purpose,
        "legal_basis": policy.legal_basis,
        "retention": policy.retention,
        "rights_channel": policy.rights_channel,
        "rights_procedure": policy.rights_procedure,
        "end_of_retention_review": policy.end_of_retention_review,
        "storage_fingerprint": policy.storage_fingerprint,
        "procedure_version": policy.procedure_version,
        "recorded_at": policy.recorded_at.isoformat(),
    }


def _restoration_payload(evidence: FiscalRestorationEvidence) -> dict[str, Any]:
    return {
        "id": evidence.id,
        "procedure_version": evidence.procedure_version,
        "storage_fingerprint": evidence.storage_fingerprint,
        "restored_at": evidence.restored_at.isoformat(),
        "responsible": evidence.responsible,
        "backup_identifier": evidence.backup_identifier,
        "report_reference": evidence.report_reference,
        "destination": evidence.destination,
        "content_hashes_ok": evidence.content_hashes_ok,
        "identities_ok": evidence.identities_ok,
        "permissions_ok": evidence.permissions_ok,
        "links_ok": evidence.links_ok,
        "deletion_reviewed": evidence.deletion_reviewed,
        "notes": evidence.notes,
        "recorded_at": evidence.recorded_at.isoformat(),
    }


def get_readiness(*, actor: User, fiscal_entity_id: int) -> ArchiveReadiness:
    require_permission(actor=actor, permission="fiscal.archivo.gestionar")
    read_issuer_ruc(fiscal_entity_id)
    policy = FiscalArchivePolicy.objects.filter(fiscal_entity_id=fiscal_entity_id).first()
    restoration = None
    if policy is not None:
        restoration = FiscalRestorationEvidence.objects.filter(
            procedure_version=policy.procedure_version,
            storage_fingerprint=policy.storage_fingerprint,
        ).first()
    checks = (
        restoration is not None
        and restoration.content_hashes_ok
        and restoration.identities_ok
        and restoration.permissions_ok
        and restoration.links_ok
        and restoration.deletion_reviewed
    )
    pending: list[str] = []
    if policy is None:
        pending.append("policy")
    if not checks:
        pending.append("restoration")
    return ArchiveReadiness(
        fiscal_entity_id=fiscal_entity_id,
        policy=_policy_payload(policy) if policy else None,
        restoration=_restoration_payload(restoration) if restoration else None,
        policy_ready=policy is not None,
        restoration_ready=bool(checks),
        productive_archive_ready=policy is not None and bool(checks),
        pending=tuple(pending),
    )


def record_policy(*, actor: User, fiscal_entity_id: int, data: dict[str, Any]) -> ArchiveReadiness:
    require_permission(actor=actor, permission="fiscal.archivo.gestionar")
    read_issuer_ruc(fiscal_entity_id)
    required = (
        "responsible",
        "purpose",
        "legal_basis",
        "rights_channel",
        "rights_procedure",
        "end_of_retention_review",
        "storage_fingerprint",
        "procedure_version",
    )
    if any(not str(data.get(field, "")).strip() for field in required):
        raise FiscalReadinessError("La política requiere todos sus responsables y procedimientos.")
    retention = data.get("retention")
    if not isinstance(retention, dict) or not retention:
        raise FiscalReadinessError("La política requiere plazos separados por categoría.")
    with transaction.atomic():
        current = (
            FiscalArchivePolicy.objects.select_for_update()
            .filter(fiscal_entity_id=fiscal_entity_id)
            .first()
        )
        FiscalArchivePolicy.objects.create(
            fiscal_entity_id=fiscal_entity_id,
            version=(current.version + 1) if current else 1,
            retention=retention,
            recorded_by=actor,
            **{field: str(data[field]).strip() for field in required},
        )
    return get_readiness(actor=actor, fiscal_entity_id=fiscal_entity_id)


def record_restoration(
    *, actor: User, restored_at: datetime, data: dict[str, Any]
) -> FiscalRestorationEvidence:
    require_permission(actor=actor, permission="fiscal.archivo.gestionar")
    required = (
        "procedure_version",
        "storage_fingerprint",
        "responsible",
        "backup_identifier",
        "report_reference",
        "destination",
    )
    if any(not str(data.get(field, "")).strip() for field in required):
        raise FiscalReadinessError("La evidencia requiere copia, destino, informe y responsable.")
    return FiscalRestorationEvidence.objects.create(
        restored_at=restored_at,
        recorded_by=actor,
        **{field: str(data[field]).strip() for field in required},
        **{
            field: bool(data.get(field))
            for field in (
                "content_hashes_ok",
                "identities_ok",
                "permissions_ok",
                "links_ok",
                "deletion_reviewed",
            )
        },
        notes=str(data.get("notes", "")).strip(),
    )


def require_productive_archive(*, actor: User, fiscal_entity_id: int) -> None:
    status = get_readiness(actor=actor, fiscal_entity_id=fiscal_entity_id)
    if not status.productive_archive_ready:
        raise FiscalReadinessError(
            "La incorporación productiva requiere política vigente y evidencia "
            "aplicable de restauración."
        )
