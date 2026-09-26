from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from django.utils import timezone
from tests.fiscal.xml_samples import (
    SYNTHETIC_RUC,
    synthetic_credit_note,
    synthetic_invoice,
)

from customer_registry.models import Customer
from fiscal.application.corrections import (
    CorrectionApplicationError,
    CorrectionConflictError,
    CorrectionImpedimentError,
    CorrectionRemainderError,
    cancel_correction_request,
    create_correction_request,
    flag_unreconciled_evidence,
    link_correction_evidence,
    prepare_correction_request,
    replace_correction_request,
)
from fiscal.application.xml_archive import archive_xml
from fiscal.domain.access_key import build_access_key
from fiscal.domain.corrections import CorrectionAction, CorrectionFacts
from fiscal.models import (
    FiscalCorrectionLine,
    FiscalCorrectionRequest,
    FiscalDocumentIdentity,
    FiscalNumberingScope,
    FiscalPreparation,
    FiscalXmlDossier,
)
from identity.application.authorization import BusinessPermissionDeniedError
from sales.models import Sale
from workshop_configuration.models import FiscalEntity, Warehouse

pytestmark = pytest.mark.django_db


@pytest.fixture
def fiscal_entity() -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc=SYNTHETIC_RUC, legal_name="Entidad sintética"
    )


def _facts(**overrides: object) -> CorrectionFacts:
    values = {
        "consumer_final_transmitted": False,
        "supports_tax_refund": False,
        "negotiable_traded": False,
        "external_history_complete": True,
        "holidays_complete": True,
        "holidays": (),
        "calendar_source": "Calendario administrativo de ensayo",
        "calendar_version": "2026-09-26",
    }
    values.update(overrides)
    return CorrectionFacts(**values)  # type: ignore[arg-type]


def _original(role_admin: Any, entity: FiscalEntity) -> Any:
    return archive_xml(
        actor=role_admin,
        fiscal_entity_id=entity.id,
        original_bytes=synthetic_invoice(),
        source_label="factura sintética",
    )


def _line(total: str = "10.00", quantity: str = "1.00") -> list[dict[str, str | int]]:
    return [
        {
            "position": 1,
            "quantity": quantity,
            "base_amount": total,
            "tax_amount": "0.00",
            "total_amount": total,
        }
    ]


def test_admin_creates_and_prepares_local_credit_note_request_without_official_effect(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    original = _original(role_admin, fiscal_entity)

    created = create_correction_request(
        actor=role_admin,
        original_dossier_id=original.dossier_id,
        action=CorrectionAction.CREDIT_NOTE,
        reason="Corrección parcial de ensayo",
        reference_date=date(2026, 9, 26),
        facts=_facts(),
        requested_lines=_line("6.00", "0.60"),
        idempotency_key="credit-note-0001",
    )
    prepared = prepare_correction_request(
        actor=role_admin, request_id=created.request_id, expected_version=1
    )

    request = FiscalCorrectionRequest.objects.get(pk=created.request_id)
    assert prepared.state == "PREPARED"
    assert request.state == "PREPARED"
    assert request.officially_executed is False
    assert request.normative_version == "NAC-DGERCGC25-00000014+00000017"
    assert request.affection_id is not None
    line = FiscalCorrectionLine.objects.get(request=request)
    assert line.total_amount == Decimal("6.00")
    assert line.tax_treatments[0]["percentage_code"] == "0"


def test_seller_cannot_create_a_fiscal_correction(
    role_admin: Any, role_seller: Any, fiscal_entity: FiscalEntity
) -> None:
    original = _original(role_admin, fiscal_entity)

    with pytest.raises(BusinessPermissionDeniedError):
        create_correction_request(
            actor=role_seller,
            original_dossier_id=original.dossier_id,
            action=CorrectionAction.ONLINE_CANCELLATION,
            reason="No autorizado",
            reference_date=date(2026, 9, 26),
            facts=_facts(),
            requested_lines=[],
            idempotency_key="seller-denied-01",
        )
    assert FiscalCorrectionRequest.objects.count() == 0


def test_pending_or_blocked_evaluation_keeps_request_as_draft(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    original = _original(role_admin, fiscal_entity)
    created = create_correction_request(
        actor=role_admin,
        original_dossier_id=original.dossier_id,
        action=CorrectionAction.ONLINE_CANCELLATION,
        reason="Evaluar anulación",
        reference_date=date(2026, 10, 8),
        facts=_facts(holidays_complete=False),
        requested_lines=[],
        idempotency_key="cancel-blocked-01",
    )

    with pytest.raises(CorrectionImpedimentError):
        prepare_correction_request(
            actor=role_admin, request_id=created.request_id, expected_version=1
        )

    request = FiscalCorrectionRequest.objects.get(pk=created.request_id)
    assert request.state == "DRAFT"
    assert request.evaluation["outcome"] == "BLOCKED"


def test_idempotent_replay_returns_same_request_and_changed_input_conflicts(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    original = _original(role_admin, fiscal_entity)
    kwargs = {
        "actor": role_admin,
        "original_dossier_id": original.dossier_id,
        "action": CorrectionAction.CREDIT_NOTE,
        "reason": "Reintento",
        "reference_date": date(2026, 9, 26),
        "facts": _facts(),
        "requested_lines": _line("5.00", "0.50"),
        "idempotency_key": "credit-replay-01",
    }
    first = create_correction_request(**kwargs)
    replay = create_correction_request(**kwargs)

    assert replay.request_id == first.request_id
    assert replay.replayed is True
    with pytest.raises(CorrectionConflictError):
        create_correction_request(**{**kwargs, "reason": "Otro contenido"})
    assert FiscalCorrectionRequest.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_credit_notes_cannot_exceed_original_remainder(
    role_admin: Any, fiscal_entity: FiscalEntity, run_parallel: Any
) -> None:
    original = _original(role_admin, fiscal_entity)
    requests = [
        create_correction_request(
            actor=role_admin,
            original_dossier_id=original.dossier_id,
            action=CorrectionAction.CREDIT_NOTE,
            reason=f"Parcial {number}",
            reference_date=date(2026, 9, 26),
            facts=_facts(),
            requested_lines=_line("6.00", "0.60"),
            idempotency_key=f"concurrent-credit-{number}",
        )
        for number in (1, 2)
    ]

    results = run_parallel(
        *(
            lambda request=request: prepare_correction_request(
                actor=role_admin, request_id=request.request_id, expected_version=1
            )
            for request in requests
        )
    )

    assert [kind for kind, _ in results].count("ok") == 1, results
    assert any(
        isinstance(value, CorrectionRemainderError) for kind, value in results if kind == "error"
    )
    assert FiscalCorrectionRequest.objects.filter(state="PREPARED").count() == 1


def test_partial_affectations_consume_the_exact_remaining_amount(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    original = _original(role_admin, fiscal_entity)
    for number, amount, quantity in ((1, "6.00", "0.60"), (2, "4.00", "0.40")):
        request = create_correction_request(
            actor=role_admin,
            original_dossier_id=original.dossier_id,
            action=CorrectionAction.CREDIT_NOTE,
            reason=f"Parcial {number}",
            reference_date=date(2026, 9, 26),
            facts=_facts(),
            requested_lines=_line(amount, quantity),
            idempotency_key=f"exact-remainder-{number}",
        )
        prepare_correction_request(
            actor=role_admin, request_id=request.request_id, expected_version=1
        )

    excess = create_correction_request(
        actor=role_admin,
        original_dossier_id=original.dossier_id,
        action=CorrectionAction.CREDIT_NOTE,
        reason="Exceso posterior",
        reference_date=date(2026, 9, 26),
        facts=_facts(),
        requested_lines=_line("1.00", "0.10"),
        idempotency_key="exact-remainder-excess",
    )
    with pytest.raises(CorrectionRemainderError):
        prepare_correction_request(
            actor=role_admin, request_id=excess.request_id, expected_version=1
        )


def test_incomplete_external_line_history_is_rejected_as_insufficient(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    original = _original(role_admin, fiscal_entity)
    original_dossier = FiscalXmlDossier.objects.get(pk=original.dossier_id)
    original_dossier.line_facts = []
    original_dossier.save(update_fields=["line_facts"])

    with pytest.raises(CorrectionApplicationError, match="no pertenece"):
        create_correction_request(
            actor=role_admin,
            original_dossier_id=original.dossier_id,
            action=CorrectionAction.CREDIT_NOTE,
            reason="Historial incompleto",
            reference_date=date(2026, 9, 26),
            facts=_facts(),
            requested_lines=_line("1.00", "0.10"),
            idempotency_key="incomplete-external-lines-01",
        )


def test_linked_external_credit_note_counts_once_and_survives_local_cancellation(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    original = _original(role_admin, fiscal_entity)
    created = create_correction_request(
        actor=role_admin,
        original_dossier_id=original.dossier_id,
        action=CorrectionAction.CREDIT_NOTE,
        reason="Afectación completa",
        reference_date=date(2026, 9, 26),
        facts=_facts(),
        requested_lines=_line(),
        idempotency_key="credit-evidence-01",
    )
    prepare_correction_request(actor=role_admin, request_id=created.request_id, expected_version=1)
    evidence = archive_xml(
        actor=role_admin,
        fiscal_entity_id=fiscal_entity.id,
        original_bytes=synthetic_credit_note(),
        source_label="nota de crédito sintética",
    )

    link_correction_evidence(
        actor=role_admin,
        request_id=created.request_id,
        evidence_dossier_id=evidence.dossier_id,
    )
    cancelled = cancel_correction_request(
        actor=role_admin,
        request_id=created.request_id,
        expected_version=2,
        reason="Se cancela la gestión local; se conserva la evidencia.",
    )

    request = FiscalCorrectionRequest.objects.get(pk=created.request_id)
    assert cancelled.state == "CANCELLED"
    assert request.evidence_dossier_id == evidence.dossier_id
    assert request.reservation_retained is True
    assert request.officially_executed is False


def test_request_can_reference_an_invoice_identity_from_the_test_exercise(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    customer = Customer.objects.create(
        person_type="JURIDICA",
        name="Cliente sintético",
        identification_type="RUC",
        identification="0999999999001",
        phone="0999999999",
    )
    warehouse = Warehouse.objects.create(id=1, name="Principal")
    sale = Sale.objects.create(
        customer=customer,
        fiscal_entity=fiscal_entity,
        warehouse=warehouse,
        origin_type="DIRECT",
        condition="CONTADO",
        state="CONFIRMED",
        operational_date=date(2026, 9, 25),
        base_total=Decimal("10.00"),
        tax_total=Decimal("0.00"),
        grand_total=Decimal("10.00"),
        customer_snapshot={"schema_version": 1},
        fiscal_snapshot={"schema_version": 1},
        internal_number="COM-VEN-TEST-1",
        created_by=role_admin,
    )
    snapshot = {
        "schema_version": "factura-2.1.0",
        "totals": {"base": "10.00", "tax": "0.00", "grand": "10.00"},
        "lines": [
            {
                "position": 1,
                "quantity": "1",
                "base_amount": "10.00",
                "tax_amount": "0.00",
            }
        ],
    }
    preparation = FiscalPreparation.objects.create(
        fiscal_entity=fiscal_entity,
        commercial_sale=sale,
        state="PREPARED",
        source_version=1,
        snapshot=snapshot,
        prepared_at=timezone.now(),
        prepared_by=role_admin,
        created_by=role_admin,
    )
    scope = FiscalNumberingScope.objects.create(
        fiscal_entity=fiscal_entity,
        document_type="01",
        establishment_code="001",
        emission_point_code="001",
        environment="1",
        last_sequential=1,
    )
    access_key = build_access_key(
        emission_date=date(2026, 9, 25),
        doc_type="01",
        ruc=SYNTHETIC_RUC,
        environment="1",
        establishment="001",
        emission_point="001",
        sequential="000000001",
        numeric_code="87654321",
    )
    identity = FiscalDocumentIdentity.objects.create(
        preparation=preparation,
        numbering_scope=scope,
        document_type="01",
        environment="1",
        ruc=SYNTHETIC_RUC,
        sequential=1,
        numeric_code="87654321",
        emission_date=date(2026, 9, 25),
        access_key=access_key,
        created_by=role_admin,
    )

    created = create_correction_request(
        actor=role_admin,
        original_dossier_id=None,
        original_identity_id=identity.id,
        action=CorrectionAction.CREDIT_NOTE,
        reason="Corrección sobre ejercicio de prueba",
        reference_date=date(2026, 9, 26),
        facts=_facts(),
        requested_lines=_line(),
        idempotency_key="test-identity-credit-01",
    )

    request = FiscalCorrectionRequest.objects.get(pk=created.request_id)
    assert request.original_identity_id == identity.id
    assert request.original_dossier_id is None


def test_replacement_cancels_the_old_local_request_and_keeps_the_chain(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    original = _original(role_admin, fiscal_entity)
    first = create_correction_request(
        actor=role_admin,
        original_dossier_id=original.dossier_id,
        action=CorrectionAction.CREDIT_NOTE,
        reason="Primera solicitud",
        reference_date=date(2026, 9, 26),
        facts=_facts(),
        requested_lines=_line("4.00", "0.40"),
        idempotency_key="replace-source-01",
    )

    replacement = replace_correction_request(
        actor=role_admin,
        request_id=first.request_id,
        expected_version=1,
        action=CorrectionAction.CREDIT_NOTE,
        reason="Se corrige el importe solicitado",
        reference_date=date(2026, 9, 26),
        facts=_facts(),
        requested_lines=_line("5.00", "0.50"),
        idempotency_key="replace-target-01",
    )

    old = FiscalCorrectionRequest.objects.get(pk=first.request_id)
    new = FiscalCorrectionRequest.objects.get(pk=replacement.request_id)
    assert old.state == "CANCELLED"
    assert new.replaces_id == old.id
    assert new.requested_total == Decimal("5.00")


def test_unreconciled_credit_note_evidence_blocks_new_reservations_but_remains_archived(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    original = _original(role_admin, fiscal_entity)
    evidence = archive_xml(
        actor=role_admin,
        fiscal_entity_id=fiscal_entity.id,
        original_bytes=synthetic_credit_note(),
        source_label="evidencia pendiente de conciliación",
    )
    flag_unreconciled_evidence(
        actor=role_admin,
        original_dossier_id=original.dossier_id,
        evidence_dossier_id=evidence.dossier_id,
        reason="No se conoce a qué afectación previa corresponde.",
    )
    created = create_correction_request(
        actor=role_admin,
        original_dossier_id=original.dossier_id,
        action=CorrectionAction.CREDIT_NOTE,
        reason="Nueva afectación",
        reference_date=date(2026, 9, 26),
        facts=_facts(),
        requested_lines=_line("1.00", "0.10"),
        idempotency_key="blocked-by-hold-01",
    )

    with pytest.raises(CorrectionImpedimentError):
        prepare_correction_request(
            actor=role_admin, request_id=created.request_id, expected_version=1
        )
    assert FiscalCorrectionRequest.objects.get(pk=created.request_id).state == "DRAFT"


@pytest.mark.parametrize(
    ("reason", "dossier", "identity", "lines", "message"),
    [
        ("   ", "original", None, [], "motivo"),
        ("Ambiguo", None, None, [], "exactamente un original"),
        ("Anulación total", "original", None, _line("1.00", "0.10"), "líneas parciales"),
    ],
)
def test_creation_rejects_ambiguous_or_incoherent_requests(
    role_admin: Any,
    fiscal_entity: FiscalEntity,
    reason: str,
    dossier: str | None,
    identity: int | None,
    lines: list[dict[str, str | int]],
    message: str,
) -> None:
    original = _original(role_admin, fiscal_entity)

    with pytest.raises(CorrectionApplicationError, match=message):
        create_correction_request(
            actor=role_admin,
            original_dossier_id=original.dossier_id if dossier else None,
            original_identity_id=identity,
            action=CorrectionAction.ONLINE_CANCELLATION,
            reason=reason,
            reference_date=date(2026, 9, 26),
            facts=_facts(),
            requested_lines=lines,
            idempotency_key="invalid-correction-01",
        )


@pytest.mark.parametrize(
    "lines",
    [
        [],
        _line("11.00", "1.10"),
        [
            {
                "position": 1,
                "quantity": "1.00",
                "base_amount": "5.00",
                "tax_amount": "0.00",
                "total_amount": "4.00",
            }
        ],
    ],
)
def test_credit_note_rejects_missing_excessive_or_incoherent_lines(
    role_admin: Any,
    fiscal_entity: FiscalEntity,
    lines: list[dict[str, str | int]],
) -> None:
    original = _original(role_admin, fiscal_entity)

    with pytest.raises(CorrectionApplicationError):
        create_correction_request(
            actor=role_admin,
            original_dossier_id=original.dossier_id,
            action=CorrectionAction.CREDIT_NOTE,
            reason="Afectación inválida",
            reference_date=date(2026, 9, 26),
            facts=_facts(),
            requested_lines=lines,
            idempotency_key="invalid-credit-lines-01",
        )


def test_prepare_and_cancel_are_idempotent_and_reject_stale_versions(
    role_admin: Any, fiscal_entity: FiscalEntity
) -> None:
    original = _original(role_admin, fiscal_entity)
    created = create_correction_request(
        actor=role_admin,
        original_dossier_id=original.dossier_id,
        action=CorrectionAction.ONLINE_CANCELLATION,
        reason="Anulación total",
        reference_date=date(2026, 9, 26),
        facts=_facts(),
        requested_lines=[],
        idempotency_key="cancel-lifecycle-01",
    )

    prepared = prepare_correction_request(
        actor=role_admin, request_id=created.request_id, expected_version=1
    )
    replayed = prepare_correction_request(
        actor=role_admin, request_id=created.request_id, expected_version=1
    )
    assert prepared.version == 2
    assert replayed.replayed is True

    with pytest.raises(CorrectionConflictError):
        cancel_correction_request(
            actor=role_admin,
            request_id=created.request_id,
            expected_version=1,
            reason="Versión obsoleta",
        )

    cancelled = cancel_correction_request(
        actor=role_admin,
        request_id=created.request_id,
        expected_version=2,
        reason="Gestión local terminada",
    )
    replayed_cancel = cancel_correction_request(
        actor=role_admin,
        request_id=created.request_id,
        expected_version=2,
        reason="Gestión local terminada",
    )
    assert cancelled.version == 3
    assert replayed_cancel.replayed is True
