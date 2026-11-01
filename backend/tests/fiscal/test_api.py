from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from fiscal.application.corrections import (
    CorrectionCommandResult,
    CorrectionDetail,
    CorrectionSummary,
)
from fiscal.application.identity import IdentityResult
from fiscal.application.preparations import (
    FiscalDiscrepancy,
    PreparationCommandResult,
    PreparationDetail,
    PreparationVersionConflictError,
    ReviewResult,
)
from fiscal.application.readiness import ArchiveReadiness
from fiscal.application.xml_archive import (
    ArchivedDocumentPage,
    ArchivedDocumentSummary,
    ArchiveResult,
    DownloadedXml,
    ExportEntry,
    LinkResult,
)
from identity.models import UserRole
from workshop_configuration.models import ElectronicProfileRevision, FiscalEntity

pytestmark = pytest.mark.django_db
BASE = "/api/v1/fiscal"


def _client(user: Any) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_create_preparation_uses_owned_command_and_rejects_official_fields(
    role_seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    preparation_id = uuid4()
    called: dict[str, object] = {}

    def fake_create(**kwargs: object) -> object:
        called.update(kwargs)
        return SimpleNamespace(preparation_id=preparation_id, replayed=False)

    monkeypatch.setattr("fiscal.api.views.preparations.create_draft", fake_create)
    client = _client(role_seller)
    response = client.post(
        f"{BASE}/preparations/",
        {"source_kind": "COMMERCIAL", "source_id": 7},
        format="json",
        HTTP_IDEMPOTENCY_KEY="prep-api-01",
    )

    assert response.status_code == 201
    assert response.data == {"preparation_id": str(preparation_id), "replayed": False}
    assert called["actor"] == role_seller
    assert called["idempotency_key"] == "prep-api-01"

    rejected = client.post(
        f"{BASE}/preparations/",
        {"source_kind": "COMMERCIAL", "source_id": 7, "official_state": "AUTORIZADO"},
        format="json",
        HTTP_IDEMPOTENCY_KEY="prep-api-02",
    )
    assert rejected.status_code == 400
    assert rejected.data["code"] == "validation_error"
    assert "official_state" in rejected.data["errors"]


def test_stale_preparation_version_has_stable_conflict(
    role_seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    preparation_id = uuid4()

    def stale(**_: object) -> object:
        raise PreparationVersionConflictError("La preparación cambió.")

    monkeypatch.setattr("fiscal.api.views.preparations.update_draft", stale)
    response = _client(role_seller).patch(
        f"{BASE}/preparations/{preparation_id}/",
        {"expected_version": 1, "receiver": {}, "payments": {}},
        format="json",
    )

    assert response.status_code == 409
    assert response.data["code"] == "stale_record"


def test_archive_upload_is_admin_only_and_size_limit_is_published_as_413(
    role_admin: Any, role_seller: Any
) -> None:
    payload = b"x" * (2 * 1024 * 1024 + 1)
    denied = _client(role_seller).post(
        f"{BASE}/archive/",
        {
            "fiscal_entity_id": 1,
            "source_label": "carga",
            "xml": SimpleUploadedFile("evidence.xml", payload),
        },
        format="multipart",
    )
    assert denied.status_code == 403

    oversized = _client(role_admin).post(
        f"{BASE}/archive/",
        {
            "fiscal_entity_id": 1,
            "source_label": "carga",
            "xml": SimpleUploadedFile("evidence.xml", payload),
        },
        format="multipart",
    )
    assert oversized.status_code == 413
    assert oversized.data["code"] == "xml_too_large"


def test_correction_api_rejects_non_admin_before_calling_service(
    role_seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    called = False

    def forbidden_call(**_: object) -> object:
        nonlocal called
        called = True
        raise AssertionError("El adaptador no debe invocar el servicio.")

    monkeypatch.setattr("fiscal.api.views.corrections.create_correction_request", forbidden_call)
    response = _client(role_seller).post(
        f"{BASE}/corrections/",
        {
            "original_dossier_id": str(uuid4()),
            "action": "CREDIT_NOTE",
            "reason": "Corrección",
            "reference_date": "2026-09-26",
            "facts": {},
            "lines": [],
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="correction-api-01",
    )

    assert response.status_code == 403
    assert called is False


def test_anonymous_access_is_rejected() -> None:
    response = APIClient().get(f"{BASE}/archive/")
    assert response.status_code == 403


def test_electronic_profile_api_rejects_private_signing_material(role_admin: Any) -> None:
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0999999999001", legal_name="Emisor API"
    )
    response = _client(role_admin).put(
        f"{BASE}/configuration/entities/{entity.id}/electronic-profile/",
        {
            "expected_revision": 0,
            "conditions": {},
            "certificate": None,
            "private_key": "DEBE RECHAZARSE",
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="profile-api-01",
    )

    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert "private_key" in response.data["errors"]
    assert ElectronicProfileRevision.objects.count() == 0


def test_configuration_endpoints_create_establishment_and_report_stale_version(
    role_admin: Any,
) -> None:
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0999999999001", legal_name="Emisor API"
    )
    client = _client(role_admin)
    created = client.post(
        f"{BASE}/configuration/entities/{entity.id}/establishments/",
        {"code": "001", "address": "Dirección principal"},
        format="json",
    )
    assert created.status_code == 201
    establishment_id = created.data["id"]

    changed = client.patch(
        f"{BASE}/configuration/establishments/{establishment_id}/",
        {"expected_version": 1, "active": False},
        format="json",
    )
    assert changed.status_code == 200
    stale = client.patch(
        f"{BASE}/configuration/establishments/{establishment_id}/",
        {"expected_version": 1, "active": True},
        format="json",
    )
    assert stale.status_code == 409
    assert stale.data["code"] == "stale_record"


def test_preparation_endpoints_translate_local_results(
    role_seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    preparation_id = uuid4()
    draft = SimpleNamespace(pk=preparation_id, state="DRAFT", version=2, draft={"point_id": 1})
    monkeypatch.setattr("fiscal.api.views.preparations.update_draft", lambda **_: draft)
    monkeypatch.setattr(
        "fiscal.api.views.preparations.review",
        lambda **_: ReviewResult((), "signed-review"),
    )
    monkeypatch.setattr(
        "fiscal.api.views.preparations.prepare",
        lambda **_: PreparationCommandResult(preparation_id, False),
    )
    monkeypatch.setattr("fiscal.api.views.preparations.cancel", lambda **_: draft)
    monkeypatch.setattr(
        "fiscal.api.views.assign_test_identity",
        lambda **_: IdentityResult(4, "1" * 49, "000000001", False),
    )
    client = _client(role_seller)

    updated = client.patch(
        f"{BASE}/preparations/{preparation_id}/",
        {"expected_version": 1, "receiver": {}, "payments": {}},
        format="json",
    )
    reviewed = client.post(f"{BASE}/preparations/{preparation_id}/review/", {}, format="json")
    prepared = client.post(
        f"{BASE}/preparations/{preparation_id}/prepare/",
        {"review_token": "signed-review"},
        format="json",
        HTTP_IDEMPOTENCY_KEY="prepare-api-01",
    )
    cancelled = client.post(
        f"{BASE}/preparations/{preparation_id}/cancel/",
        {"expected_version": 2, "reason": "Se reemplazará"},
        format="json",
    )
    identity = client.post(
        f"{BASE}/preparations/{preparation_id}/test-identity/", {}, format="json"
    )

    assert [r.status_code for r in (updated, reviewed, prepared, cancelled, identity)] == [
        200,
        200,
        200,
        200,
        200,
    ]
    assert reviewed.data["review_token"] == "signed-review"
    assert identity.data["official_status"] is None


def test_preparation_detail_exposes_history_and_discrepancy_without_official_state(
    role_seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    preparation_id = uuid4()
    monkeypatch.setattr(
        "fiscal.api.views.preparations.get_preparation",
        lambda **_: PreparationDetail(
            preparation_id=preparation_id,
            fiscal_entity_id=3,
            source_kind="COMMERCIAL",
            source_id=8,
            state="PREPARED",
            version=4,
            source_version=2,
            draft={"environment": "1", "receiver": {"name": "Cliente"}},
            snapshot={"schema_version": "1", "total": "11.50"},
            discrepancy=FiscalDiscrepancy(
                source_changed=True,
                state_changed=False,
                corrections_changed=True,
                original_state="CONFIRMED",
                current_state="CONFIRMED",
                original_source_version=2,
                current_source_version=3,
                current_correction_ids=(6,),
            ),
            cancellation_reason="",
            created_at="2026-09-26T10:00:00-05:00",
            prepared_at="2026-09-26T10:05:00-05:00",
        ),
    )

    response = _client(role_seller).get(f"{BASE}/preparations/{preparation_id}/")

    assert response.status_code == 200
    assert response.data["source"] == {"kind": "COMMERCIAL", "id": 8, "version": 2}
    assert response.data["snapshot"]["total"] == "11.50"
    assert response.data["discrepancy"]["current_correction_ids"] == [6]
    assert response.data["official_status"] is None
    assert response.data["official_submission"] == "NOT_PERFORMED"


def test_correction_queries_expose_local_evaluation_and_never_official_execution(
    role_admin: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    request_id = uuid4()
    summary = CorrectionSummary(
        request_id,
        "ONLINE_CANCELLATION",
        "DRAFT",
        1,
        "Evaluar anulación",
        "2026-09-26",
        "10.00",
        "PENDING",
        False,
        True,
        False,
    )
    detail = CorrectionDetail(
        request_id,
        {"kind": "DOSSIER", "id": str(uuid4())},
        "ONLINE_CANCELLATION",
        "Evaluar anulación",
        "2026-09-26",
        "norma-v1",
        {"holidays_complete": False},
        {"outcome": "PENDING", "pending_facts": ["holidays"]},
        "DRAFT",
        1,
        "10.00",
        "0.00",
        "10.00",
        (),
        None,
        True,
        "",
        None,
        False,
    )
    monkeypatch.setattr(
        "fiscal.api.views.corrections.list_correction_requests", lambda **_: (summary,)
    )
    monkeypatch.setattr("fiscal.api.views.corrections.get_correction_request", lambda **_: detail)
    client = _client(role_admin)
    listed = client.get(f"{BASE}/corrections/")
    retrieved = client.get(f"{BASE}/corrections/{request_id}/")
    assert listed.status_code == retrieved.status_code == 200
    assert listed.data[0]["officially_executed"] is False
    assert retrieved.data["evaluation"]["pending_facts"] == ["holidays"]
    assert retrieved.data["reconciliation_pending"] is True


def test_readiness_api_keeps_declarations_administrative(
    role_admin: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    result = ArchiveReadiness(1, None, None, False, False, False, ("policy", "restoration"))
    monkeypatch.setattr("fiscal.api.views.readiness.get_readiness", lambda **_: result)
    response = _client(role_admin).get(f"{BASE}/readiness/?fiscal_entity_id=1")
    assert response.status_code == 200
    assert response.data["productive_archive_ready"] is False
    assert response.data["pending"] == ("policy", "restoration")

    invalid = _client(role_admin).get(f"{BASE}/readiness/?fiscal_entity_id=invalid")
    assert invalid.status_code == 400
    assert invalid.data["code"] == "fiscal_invalid_request"


def test_archive_endpoints_preserve_original_bytes_and_unverified_origin(
    role_admin: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    dossier_id = uuid4()
    summary = ArchivedDocumentSummary(
        dossier_id, 1, "01", "1", "1" * 49, "2026-09-26", "10.00", "EXTERNAL_UNVERIFIED", None
    )
    monkeypatch.setattr(
        "fiscal.api.views.xml_archive.list_archived_documents",
        lambda **_: ArchivedDocumentPage(1, 1, 20, 1, (summary,)),
    )
    monkeypatch.setattr(
        "fiscal.api.views.xml_archive.archive_xml",
        lambda **_: ArchiveResult(dossier_id, False, False),
    )
    monkeypatch.setattr(
        "fiscal.api.views.xml_archive.download_document",
        lambda **_: DownloadedXml(b"<factura/>", "a" * 64, 10, "factura.xml", True),
    )
    monkeypatch.setattr(
        "fiscal.api.views.xml_archive.iter_export_entries",
        lambda **_: iter((ExportEntry("factura.xml", b"<factura/>", "a" * 64, "DOCUMENT"),)),
    )
    monkeypatch.setattr(
        "fiscal.api.views.xml_archive.link_dossier",
        lambda **_: LinkResult(dossier_id, "COMMERCIAL", 2, ()),
    )
    client = _client(role_admin)

    listed = client.get(f"{BASE}/archive/?fiscal_entity_id=1")
    uploaded = client.post(
        f"{BASE}/archive/",
        {
            "fiscal_entity_id": 1,
            "source_label": "Carga manual",
            "xml": SimpleUploadedFile("factura.xml", b"<factura/>"),
        },
        format="multipart",
    )
    downloaded = client.get(f"{BASE}/archive/{dossier_id}/download/")
    exported = client.post(
        f"{BASE}/archive/export/", {"dossier_ids": [str(dossier_id)]}, format="json"
    )
    linked = client.post(
        f"{BASE}/archive/{dossier_id}/link/",
        {"source_kind": "COMMERCIAL", "source_id": 2, "reason": "Conciliación"},
        format="json",
    )

    assert [r.status_code for r in (listed, uploaded, downloaded, exported, linked)] == [
        200,
        201,
        200,
        200,
        200,
    ]
    assert uploaded.data["verification"] == "EXTERNAL_UNVERIFIED"
    assert downloaded.content == b"<factura/>"


def test_correction_endpoints_never_report_official_execution(
    role_admin: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    request_id = uuid4()
    result = CorrectionCommandResult(request_id, "DRAFT", 1, False)
    monkeypatch.setattr(
        "fiscal.api.views.corrections.create_correction_request", lambda **_: result
    )
    monkeypatch.setattr(
        "fiscal.api.views.corrections.prepare_correction_request",
        lambda **_: result._replace(state="PREPARED", version=2),
    )
    monkeypatch.setattr(
        "fiscal.api.views.corrections.cancel_correction_request",
        lambda **_: result._replace(state="CANCELLED", version=3),
    )
    monkeypatch.setattr(
        "fiscal.api.views.corrections.replace_correction_request", lambda **_: result
    )
    monkeypatch.setattr("fiscal.api.views.corrections.link_correction_evidence", lambda **_: None)
    client = _client(role_admin)
    create_payload = {
        "original_dossier_id": str(uuid4()),
        "action": "CREDIT_NOTE",
        "reason": "Corrección parcial",
        "reference_date": "2026-09-26",
        "facts": {
            "consumer_final_transmitted": False,
            "supports_tax_refund": False,
            "negotiable_traded": False,
            "external_history_complete": True,
            "holidays_complete": True,
            "calendar_source": "Calendario",
            "calendar_version": "2026",
        },
        "lines": [
            {
                "position": 1,
                "quantity": "1",
                "base_amount": "10.00",
                "tax_amount": "0.00",
                "total_amount": "10.00",
            }
        ],
    }
    created = client.post(
        f"{BASE}/corrections/",
        create_payload,
        format="json",
        HTTP_IDEMPOTENCY_KEY="correction-create-api-01",
    )
    prepared = client.post(
        f"{BASE}/corrections/{request_id}/prepare/",
        {"expected_version": 1},
        format="json",
    )
    cancelled = client.post(
        f"{BASE}/corrections/{request_id}/cancel/",
        {"expected_version": 2, "reason": "Cancelación local"},
        format="json",
    )
    replaced = client.post(
        f"{BASE}/corrections/{request_id}/replace/",
        {**create_payload, "expected_version": 1},
        format="json",
        HTTP_IDEMPOTENCY_KEY="correction-replace-api-01",
    )
    evidence = client.post(
        f"{BASE}/corrections/{request_id}/evidence/",
        {"evidence_dossier_id": str(uuid4())},
        format="json",
    )

    assert [r.status_code for r in (created, prepared, cancelled, replaced, evidence)] == [
        201,
        200,
        200,
        201,
        204,
    ]
    assert all(
        response.data["officially_executed"] is False
        for response in (created, prepared, cancelled, replaced)
    )

    UserRole.objects.filter(user=role_admin).delete()
    denied_recovery = client.post(
        f"{BASE}/corrections/",
        create_payload,
        format="json",
        HTTP_IDEMPOTENCY_KEY="correction-create-api-01",
    )
    assert denied_recovery.status_code == 403


@pytest.mark.parametrize("field", ["environment", "point_id", "reference_date", "fiscal_entity_id"])
def test_draft_patch_rejects_technical_fields_without_calling_service(
    role_seller: Any, monkeypatch: pytest.MonkeyPatch, field: str
) -> None:
    called: list[object] = []
    monkeypatch.setattr(
        "fiscal.api.views.preparations.update_draft", lambda **kwargs: called.append(kwargs)
    )
    response = _client(role_seller).patch(
        f"{BASE}/preparations/{uuid4()}/",
        {"expected_version": 1, "receiver": {}, "payments": {}, field: "2"},
        format="json",
    )
    assert response.status_code == 400
    assert field in response.json()["errors"]
    assert called == []


def test_stale_review_has_its_own_problem_code(
    role_seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    from fiscal.application.preparations import StaleReviewError

    def stale(**_: object) -> object:
        raise StaleReviewError("La revisión ya no corresponde a los datos actuales.")

    monkeypatch.setattr("fiscal.api.views.preparations.prepare", stale)
    response = _client(role_seller).post(
        f"{BASE}/preparations/{uuid4()}/prepare/",
        {"review_token": "x"},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert response.status_code == 409
    assert response.json()["code"] == "review_stale"


def test_active_preparation_lookup_reports_state_without_emission(
    role_seller: Any, role_manager: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    from fiscal.application.preparations import ActivePreparationSummary

    preparation_id = uuid4()
    monkeypatch.setattr(
        "fiscal.api.views.preparations.find_active_preparation",
        lambda **_: ActivePreparationSummary(preparation_id, "PREPARED"),
    )
    response = _client(role_seller).get(f"{BASE}/preparations/?source_kind=COMMERCIAL&source_id=7")
    assert response.status_code == 200
    assert response.json() == {"preparation_id": str(preparation_id), "state": "PREPARED"}
    assert (
        _client(role_seller).get(f"{BASE}/preparations/?source_kind=OTRO&source_id=7").status_code
        == 400
    )


# --- Datos del comprobante (DP-035): errores por campo y nuevos campos del borrador -----------


def test_draft_patch_translates_a_validation_error_into_field_errors(
    role_seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    from fiscal.application.preparations import DraftValidationError

    def invalid(**_: object) -> object:
        raise DraftValidationError(
            {"payments.term_days": ["El plazo debe estar entre 1 y 9999 días."]}
        )

    monkeypatch.setattr("fiscal.api.views.preparations.update_draft", invalid)
    response = _client(role_seller).patch(
        f"{BASE}/preparations/{uuid4()}/",
        {"expected_version": 1, "receiver": {}, "payments": {"term_days": 0}},
        format="json",
    )
    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"
    assert response.json()["errors"] == {
        "payments.term_days": ["El plazo debe estar entre 1 y 9999 días."]
    }


def test_draft_patch_translates_a_disallowed_field_into_a_stable_problem(
    role_seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    from fiscal.application.preparations import DraftFieldNotAllowedError

    def refuse(**_: object) -> object:
        raise DraftFieldNotAllowedError("field_not_allowed: el plazo no corresponde.")

    monkeypatch.setattr("fiscal.api.views.preparations.update_draft", refuse)
    response = _client(role_seller).patch(
        f"{BASE}/preparations/{uuid4()}/",
        {"expected_version": 1, "receiver": {}, "payments": {"term_days": 30}},
        format="json",
    )
    assert response.status_code == 400
    assert response.json()["code"] == "fiscal_invalid_request"


def test_draft_patch_passes_additional_info_and_service_details_to_the_command(
    role_seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    received: dict[str, object] = {}

    def capture(**kwargs: object) -> object:
        received.update(kwargs)
        return SimpleNamespace(pk=uuid4(), state="DRAFT", version=2, draft={})

    monkeypatch.setattr("fiscal.api.views.preparations.update_draft", capture)
    pairs = [{"name": f"Dato {n}", "value": "x"} for n in range(13)]
    details = [{"position": 1, "detail": "frenos"}]
    response = _client(role_seller).patch(
        f"{BASE}/preparations/{uuid4()}/",
        {
            "expected_version": 1,
            "receiver": {},
            "payments": {"term_days": 30},
            "additional_info": pairs,
            "service_details": details,
        },
        format="json",
    )
    assert response.status_code == 200
    # El límite de 12 lo decide el dominio con su propio mensaje, no el serializador.
    assert received["additional_info"] == pairs
    assert received["service_details"] == details
    assert received["payments"] == {"term_days": 30}


def test_draft_patch_without_the_optional_fields_does_not_send_them(
    role_seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    received: dict[str, object] = {}

    def capture(**kwargs: object) -> object:
        received.update(kwargs)
        return SimpleNamespace(pk=uuid4(), state="DRAFT", version=2, draft={})

    monkeypatch.setattr("fiscal.api.views.preparations.update_draft", capture)
    _client(role_seller).patch(
        f"{BASE}/preparations/{uuid4()}/",
        {"expected_version": 1, "receiver": {}, "payments": {}},
        format="json",
    )
    assert "additional_info" not in received
    assert "service_details" not in received
