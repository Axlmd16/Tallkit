from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

import pytest

from fiscal.application.readiness import (
    FiscalReadinessError,
    get_readiness,
    record_policy,
    record_restoration,
    require_productive_archive,
)
from fiscal.application.xml_archive import FiscalArchiveError, archive_xml
from fiscal.infrastructure.xml_parser import ParsedFiscalXml
from fiscal.models import FiscalXmlDossier
from workshop_configuration.models import FiscalEntity

pytestmark = pytest.mark.django_db


def _policy(storage: str = "postgresql:v1") -> dict[str, object]:
    return {
        "responsible": "Responsable fiscal de ensayo",
        "purpose": "Conservación fiscal y atención de derechos",
        "legal_basis": "Obligación tributaria documentada",
        "retention": {
            "fiscal_xml": "mínimo 7 años desde emisión; revisión posterior",
            "operational_contact": "mientras sea necesario para atención",
            "audit": "según política de auditoría",
            "exports": "eliminación controlada tras entrega",
            "backups": "según rotación documentada",
        },
        "rights_channel": "correo administrativo de ensayo",
        "rights_procedure": "Verificar legitimación, alcance y fundamento antes de responder.",
        "end_of_retention_review": (
            "Revisar obligación y decisiones de eliminación antes de actuar."
        ),
        "storage_fingerprint": storage,
        "procedure_version": "archivo-fiscal-v1",
    }


def _restoration(storage: str = "postgresql:v1") -> dict[str, object]:
    return {
        "procedure_version": "archivo-fiscal-v1",
        "storage_fingerprint": storage,
        "responsible": "Operador de ensayo",
        "backup_identifier": "copia-sintetica-001",
        "report_reference": "docs/evidencias/restauracion-fiscal-sintetica.md",
        "destination": "instancia PostgreSQL aislada de ensayo",
        "content_hashes_ok": True,
        "identities_ok": True,
        "permissions_ok": True,
        "links_ok": True,
        "deletion_reviewed": True,
        "notes": "Solo datos sintéticos.",
    }


def test_readiness_requires_policy_and_matching_complete_restoration(role_admin: Any) -> None:
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="9999999999001", legal_name="Sintética"
    )
    initial = get_readiness(actor=role_admin, fiscal_entity_id=entity.id)
    assert initial.pending == ("policy", "restoration")

    after_policy = record_policy(actor=role_admin, fiscal_entity_id=entity.id, data=_policy())
    assert after_policy.policy_ready is True
    assert after_policy.productive_archive_ready is False

    record_restoration(
        actor=role_admin,
        restored_at=datetime(2026, 9, 26, 8, 0, tzinfo=ZoneInfo("America/Guayaquil")),
        data=_restoration(),
    )
    ready = get_readiness(actor=role_admin, fiscal_entity_id=entity.id)
    assert ready.productive_archive_ready is True
    assert ready.pending == ()


def test_new_storage_policy_invalidates_previous_restoration(role_admin: Any) -> None:
    entity = FiscalEntity.objects.create(
        entity_type="ARTESANAL", ruc="9999999999002", legal_name="Sintética artesanal"
    )
    record_policy(actor=role_admin, fiscal_entity_id=entity.id, data=_policy())
    record_restoration(
        actor=role_admin,
        restored_at=datetime(2026, 9, 26, 8, 0, tzinfo=ZoneInfo("America/Guayaquil")),
        data=_restoration(),
    )
    changed = record_policy(
        actor=role_admin,
        fiscal_entity_id=entity.id,
        data=_policy("postgresql:v2"),
    )
    assert changed.policy is not None
    assert changed.policy["version"] == 2
    assert changed.restoration_ready is False
    assert changed.productive_archive_ready is False


def test_incomplete_restoration_does_not_enable_productive_archive(role_admin: Any) -> None:
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="9999999999003", legal_name="Sintética incompleta"
    )
    record_policy(actor=role_admin, fiscal_entity_id=entity.id, data=_policy())
    incomplete = _restoration()
    incomplete["permissions_ok"] = False
    record_restoration(
        actor=role_admin,
        restored_at=datetime(2026, 9, 26, 8, 0, tzinfo=ZoneInfo("America/Guayaquil")),
        data=incomplete,
    )

    status = get_readiness(actor=role_admin, fiscal_entity_id=entity.id)

    assert status.restoration_ready is False
    assert status.productive_archive_ready is False
    assert status.pending == ("restoration",)


def test_readiness_rejects_incomplete_administrative_records(role_admin: Any) -> None:
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="9999999999005", legal_name="Sintética inválida"
    )
    incomplete_policy = _policy()
    incomplete_policy["responsible"] = ""
    with pytest.raises(FiscalReadinessError, match="responsables"):
        record_policy(
            actor=role_admin,
            fiscal_entity_id=entity.id,
            data=incomplete_policy,
        )

    missing_retention = _policy()
    missing_retention["retention"] = {}
    with pytest.raises(FiscalReadinessError, match="plazos separados"):
        record_policy(
            actor=role_admin,
            fiscal_entity_id=entity.id,
            data=missing_retention,
        )

    incomplete_restoration = _restoration()
    incomplete_restoration["destination"] = ""
    with pytest.raises(FiscalReadinessError, match="copia, destino"):
        record_restoration(
            actor=role_admin,
            restored_at=datetime(2026, 9, 26, 8, 0, tzinfo=ZoneInfo("America/Guayaquil")),
            data=incomplete_restoration,
        )


def test_productive_guard_tracks_matching_readiness(role_admin: Any) -> None:
    entity = FiscalEntity.objects.create(
        entity_type="ARTESANAL", ruc="9999999999006", legal_name="Sintética guard"
    )
    with pytest.raises(FiscalReadinessError, match="evidencia aplicable"):
        require_productive_archive(actor=role_admin, fiscal_entity_id=entity.id)

    record_policy(actor=role_admin, fiscal_entity_id=entity.id, data=_policy())
    record_restoration(
        actor=role_admin,
        restored_at=datetime(2026, 9, 26, 8, 0, tzinfo=ZoneInfo("America/Guayaquil")),
        data=_restoration(),
    )

    require_productive_archive(actor=role_admin, fiscal_entity_id=entity.id)


def test_productive_archive_is_blocked_until_matching_readiness(
    monkeypatch: pytest.MonkeyPatch, role_admin: Any
) -> None:
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="9999999999004", legal_name="Sintética productiva"
    )
    document = b"<factura id='comprobante' version='1.1.0'/>"
    parsed = ParsedFiscalXml(
        original_bytes=document,
        document_bytes=document,
        wrapper_bytes=None,
        document_type="01",
        version="1.1.0",
        issuer_ruc=entity.ruc,
        environment="2",
        access_key="0" * 49,
        establishment="001",
        emission_point="001",
        sequential="000000001",
        issue_date="26/09/2026",
        total=Decimal("10.00"),
        tax_total=Decimal("0.00"),
        receiver_identification="9999999999999",
        currency="DOLAR",
        line_count=1,
        line_facts=(),
        declared_authorization_state=None,
    )
    monkeypatch.setattr("fiscal.application.xml_archive.parse_fiscal_xml", lambda _: parsed)

    with pytest.raises(FiscalArchiveError, match="política vigente"):
        archive_xml(
            actor=role_admin,
            fiscal_entity_id=entity.id,
            original_bytes=document,
            source_label="evidencia productiva de prueba",
        )
    assert FiscalXmlDossier.objects.count() == 0

    record_policy(actor=role_admin, fiscal_entity_id=entity.id, data=_policy())
    with pytest.raises(FiscalArchiveError, match="evidencia aplicable"):
        archive_xml(
            actor=role_admin,
            fiscal_entity_id=entity.id,
            original_bytes=document,
            source_label="evidencia productiva de prueba",
        )

    record_restoration(
        actor=role_admin,
        restored_at=datetime(2026, 9, 26, 8, 0, tzinfo=ZoneInfo("America/Guayaquil")),
        data=_restoration(),
    )
    result = archive_xml(
        actor=role_admin,
        fiscal_entity_id=entity.id,
        original_bytes=document,
        source_label="evidencia productiva de prueba",
    )
    assert FiscalXmlDossier.objects.get(pk=result.dossier_id).environment == "2"
