"""Flujo de preparación comercial: revisión con token, preparar, cancelar y reemplazar."""

from datetime import date
from typing import Any

import pytest

from workshop_configuration.application.electronic_profiles import CONDITIONS, save_profile
from workshop_configuration.application.fiscal_tax_mapping import create_mapping
from workshop_configuration.models import (
    FiscalEmissionPoint,
    FiscalEntity,
    FiscalEstablishment,
    TaxDefinition,
)


def _setup_commercial_config(admin: Any) -> int:
    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    entity.address = "Av. Matriz 100"
    entity.save(update_fields=["address"])
    establishment = FiscalEstablishment.objects.create(
        fiscal_entity=entity, code="001", address="Sucursal Centro"
    )
    point = FiscalEmissionPoint.objects.create(establishment=establishment, code="001")
    save_profile(
        actor=admin,
        entity_id=entity.pk,
        expected_revision=0,
        idempotency_key="profile:comercial:1",
        payload={
            "conditions": {
                key: {"status": "NOT_APPLICABLE", "source": "Ley", "starts_on": "2025-01-01"}
                for key in CONDITIONS
            }
        },
    )
    iva = TaxDefinition.objects.get(fiscal_entity=entity, code="IVA")
    create_mapping(
        actor=admin,
        definition_id=iva.pk,
        catalog_entry_id=_iva_15_entry(),
        starts_on=date(2025, 1, 1),
        ends_on=None,
        source="Resolución vigente",
    )
    return point.pk


def _iva_15_entry() -> int:
    from workshop_configuration.application import official_catalog
    from workshop_configuration.models import OfficialCatalogEntry

    official_catalog.ensure_installed()
    return OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=official_catalog.SELECTABLE_TAX_VERSION, code="4"
    ).pk


def _fill_draft(seller: Any, preparation_id: Any, point_id: int, **overrides: Any) -> Any:
    from fiscal.application.preparations import update_draft

    payload = {
        "point_id": point_id,
        "receiver": {
            "identification_type": "04",
            "identification": "0999999999001",
            "legal_name": "Cliente Fiscal S.A.",
            "address": "Calle 10",
        },
        "payments": {"forms": [{"payment_code": "01", "amount": "100.00"}]},
    }
    payload.update(overrides)
    return update_draft(
        actor=seller,
        preparation_id=preparation_id,
        expected_version=1,
        **payload,
    )


@pytest.fixture
def prepared_context(confirmed_sale: Any, seller: Any, admin: Any) -> dict[str, Any]:
    from fiscal.application.preparations import create_draft

    point_id = _setup_commercial_config(admin)
    sale = confirmed_sale(price="100.00", condition="CONTADO")
    draft = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=sale["id"],
        idempotency_key="fiscal:create:flow1",
    )
    return {"preparation_id": draft.preparation_id, "point_id": point_id, "sale": sale}


def test_review_without_config_returns_impediments(
    confirmed_sale: Any, seller: Any, admin: Any
) -> None:
    from fiscal.application.preparations import create_draft, review, update_draft

    sale = confirmed_sale(price="100.00", condition="CONTADO")
    draft = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=sale["id"],
        idempotency_key="fiscal:create:noconf",
    )
    # Punto inexistente y sin perfil: la revisión reporta impedimentos, sin token.
    update_draft(
        actor=seller,
        preparation_id=draft.preparation_id,
        expected_version=1,
        point_id=999999,
        receiver={
            "identification_type": "04",
            "identification": "0999999999001",
            "legal_name": "Cliente",
        },
        payments={"forms": [{"payment_code": "01", "amount": "100.00"}]},
    )
    result = review(actor=seller, preparation_id=draft.preparation_id)
    assert result.token is None
    assert result.impediments


def test_review_and_prepare_stores_immutable_snapshot(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import prepare, review
    from fiscal.domain.states import PreparationState
    from fiscal.models import FiscalPreparation, FiscalPreparationHistory

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    result = review(actor=seller, preparation_id=prep_id)
    assert result.impediments == ()
    assert result.token is not None

    outcome = prepare(
        actor=seller,
        preparation_id=prep_id,
        review_token=result.token,
        idempotency_key="fiscal:prepare:1",
    )
    assert not outcome.replayed

    preparation = FiscalPreparation.objects.get(pk=prep_id)
    assert preparation.state == PreparationState.PREPARED
    assert preparation.snapshot["schema_version"] == "factura-2.1.0"
    assert preparation.snapshot["totals"]["grand"] == "100.00"
    assert preparation.snapshot["receiver"]["identification"] == "0999999999001"
    assert FiscalPreparationHistory.objects.filter(
        preparation=preparation, event="PREPARED"
    ).exists()


def test_prepare_is_idempotent_on_replay(prepared_context: dict[str, Any], seller: Any) -> None:
    from fiscal.application.preparations import prepare, review
    from fiscal.models import FiscalPreparationHistory

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    token = review(actor=seller, preparation_id=prep_id).token

    first = prepare(
        actor=seller,
        preparation_id=prep_id,
        review_token=token,
        idempotency_key="fiscal:prepare:rep",
    )
    replay = prepare(
        actor=seller,
        preparation_id=prep_id,
        review_token=token,
        idempotency_key="fiscal:prepare:rep",
    )
    assert first.preparation_id == replay.preparation_id
    assert replay.replayed
    assert (
        FiscalPreparationHistory.objects.filter(preparation_id=prep_id, event="PREPARED").count()
        == 1
    )


def test_concurrent_draft_edit_invalidates_review(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import (
        StaleReviewError,
        prepare,
        review,
        update_draft,
    )

    prep_id = prepared_context["preparation_id"]
    point_id = prepared_context["point_id"]
    _fill_draft(seller, prep_id, point_id)
    token = review(actor=seller, preparation_id=prep_id).token

    # Edición del borrador después de revisar (versión pasa de 2 a 3).
    update_draft(
        actor=seller,
        preparation_id=prep_id,
        expected_version=2,
        point_id=point_id,
        receiver={
            "identification_type": "04",
            "identification": "0999999999001",
            "legal_name": "Otro Cliente",
        },
        payments={"forms": [{"payment_code": "20", "amount": "100.00"}]},
    )
    with pytest.raises(StaleReviewError):
        prepare(
            actor=seller,
            preparation_id=prep_id,
            review_token=token,
            idempotency_key="fiscal:prepare:stale",
        )


def test_master_data_change_after_prepared_keeps_snapshot(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import prepare, review
    from fiscal.models import FiscalPreparation

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    token = review(actor=seller, preparation_id=prep_id).token
    prepare(
        actor=seller,
        preparation_id=prep_id,
        review_token=token,
        idempotency_key="fiscal:prepare:master",
    )
    original_name = FiscalPreparation.objects.get(pk=prep_id).snapshot["issuer"]["legal_name"]

    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    entity.legal_name = "Comercial Renombrada S.A."
    entity.save(update_fields=["legal_name"])

    assert (
        FiscalPreparation.objects.get(pk=prep_id).snapshot["issuer"]["legal_name"] == original_name
    )


def test_cancel_prepared_keeps_snapshot_and_history(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import cancel, prepare, review
    from fiscal.domain.states import PreparationState
    from fiscal.models import FiscalPreparation

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    token = review(actor=seller, preparation_id=prep_id).token
    prepare(
        actor=seller,
        preparation_id=prep_id,
        review_token=token,
        idempotency_key="fiscal:prepare:cancel",
    )
    prepared = FiscalPreparation.objects.get(pk=prep_id)

    cancel(
        actor=seller,
        preparation_id=prep_id,
        expected_version=prepared.version,
        reason="Dato incorrecto detectado",
    )
    cancelled = FiscalPreparation.objects.get(pk=prep_id)
    assert cancelled.state == PreparationState.CANCELLED
    assert cancelled.snapshot is not None  # conserva la instantánea
    assert cancelled.cancellation_reason == "Dato incorrecto detectado"


def test_replace_links_new_draft_and_preserves_original(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import prepare, replace, review
    from fiscal.domain.states import PreparationState
    from fiscal.models import FiscalPreparation

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    token = review(actor=seller, preparation_id=prep_id).token
    prepare(
        actor=seller,
        preparation_id=prep_id,
        review_token=token,
        idempotency_key="fiscal:prepare:replace",
    )

    outcome = replace(
        actor=seller,
        preparation_id=prep_id,
        reason="Corrección del receptor",
        idempotency_key="fiscal:replace:1",
    )
    old = FiscalPreparation.objects.get(pk=prep_id)
    new = FiscalPreparation.objects.get(pk=outcome.preparation_id)
    assert old.state == PreparationState.CANCELLED
    assert old.snapshot is not None
    assert new.state == PreparationState.DRAFT
    assert new.replaces_id == old.pk
    assert new.pk != old.pk


def test_profile_change_between_review_and_prepare_requires_revalidation(
    prepared_context: dict[str, Any], seller: Any, admin: Any
) -> None:
    """Carrera de la tarea 2.3/4.6: cambiar el perfil invalida la revisión previa."""
    from fiscal.application.preparations import StaleReviewError, prepare, review

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    token = review(actor=seller, preparation_id=prep_id).token

    # El Administrador registra una nueva revisión del perfil (cambia una leyenda).
    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    conditions = {
        key: {"status": "NOT_APPLICABLE", "source": "Ley", "starts_on": "2025-01-01"}
        for key in CONDITIONS
    }
    conditions["special_taxpayer"] = {
        "status": "APPLICABLE",
        "value": "12345",
        "source": "Resolución",
        "starts_on": "2025-01-01",
    }
    save_profile(
        actor=admin,
        entity_id=entity.pk,
        expected_revision=1,
        idempotency_key="profile:comercial:2",
        payload={"conditions": conditions},
    )

    with pytest.raises(StaleReviewError):
        prepare(
            actor=seller,
            preparation_id=prep_id,
            review_token=token,
            idempotency_key="fiscal:prepare:profilechange",
        )


def test_consumer_final_over_limit_blocks_review(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import review

    prep_id = prepared_context["preparation_id"]
    # Venta de 100.00 con consumidor final: supera el tope de USD 50.
    _fill_draft(
        seller,
        prep_id,
        prepared_context["point_id"],
        receiver={
            "identification_type": "07",
            "identification": "9999999999999",
            "legal_name": "CONSUMIDOR FINAL",
        },
    )
    result = review(actor=seller, preparation_id=prep_id)
    assert result.token is None
    assert any("identification_type" in imp["field"] for imp in result.impediments)


def test_payments_not_covering_total_block_review(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import review

    prep_id = prepared_context["preparation_id"]
    _fill_draft(
        seller,
        prep_id,
        prepared_context["point_id"],
        payments={"forms": [{"payment_code": "01", "amount": "50.00"}]},
    )
    result = review(actor=seller, preparation_id=prep_id)
    assert result.token is None
    assert any("payments" in imp["field"] for imp in result.impediments)


def test_update_draft_errors(prepared_context: dict[str, Any], seller: Any) -> None:
    import uuid

    from fiscal.application.preparations import (
        FiscalPreparationNotFoundError,
        PreparationVersionConflictError,
        update_draft,
    )

    prep_id = prepared_context["preparation_id"]
    point_id = prepared_context["point_id"]
    with pytest.raises(FiscalPreparationNotFoundError):
        update_draft(
            actor=seller,
            preparation_id=uuid.uuid4(),
            expected_version=1,
            point_id=point_id,
            receiver={
                "identification_type": "05",
                "identification": "0102030405",
                "legal_name": "X",
            },
            payments={"forms": [{"payment_code": "01", "amount": "100.00"}]},
        )
    with pytest.raises(PreparationVersionConflictError):
        update_draft(
            actor=seller,
            preparation_id=prep_id,
            expected_version=99,
            point_id=point_id,
            receiver={
                "identification_type": "05",
                "identification": "0102030405",
                "legal_name": "X",
            },
            payments={"forms": [{"payment_code": "01", "amount": "100.00"}]},
        )


def test_review_not_found(seller: Any, admin: Any, db: None) -> None:
    import uuid

    from fiscal.application.preparations import FiscalPreparationNotFoundError, review

    with pytest.raises(FiscalPreparationNotFoundError):
        review(actor=seller, preparation_id=uuid.uuid4())


def test_review_without_draft_reports_impediment(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import review

    result = review(actor=seller, preparation_id=prepared_context["preparation_id"])
    assert result.token is None
    assert any(imp["field"] == "draft" for imp in result.impediments)


def test_prepare_without_draft_raises_impediment(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import PreparationImpedimentError, prepare

    with pytest.raises(PreparationImpedimentError):
        prepare(
            actor=seller,
            preparation_id=prepared_context["preparation_id"],
            review_token="cualquier-cosa",
            idempotency_key="fiscal:prepare:nodraft",
        )


def test_prepare_with_invalid_token_is_stale(prepared_context: dict[str, Any], seller: Any) -> None:
    from fiscal.application.preparations import StaleReviewError, prepare

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    with pytest.raises(StaleReviewError):
        prepare(
            actor=seller,
            preparation_id=prep_id,
            review_token="token-invalido",
            idempotency_key="fiscal:prepare:badtoken",
        )


def test_prepare_expired_token_is_stale(
    prepared_context: dict[str, Any], seller: Any, monkeypatch: Any
) -> None:
    from django.core import signing

    from fiscal.application import preparations
    from fiscal.application.preparations import StaleReviewError, prepare, review

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    token = review(actor=seller, preparation_id=prep_id).token

    def _expired(*args: Any, **kwargs: Any) -> None:
        raise signing.SignatureExpired("expired")

    monkeypatch.setattr(preparations.signing, "loads", _expired)
    with pytest.raises(StaleReviewError):
        prepare(
            actor=seller,
            preparation_id=prep_id,
            review_token=token,
            idempotency_key="fiscal:prepare:expired",
        )


def test_prepare_same_key_different_preparation_conflicts(
    confirmed_sale: Any, seller: Any, admin: Any
) -> None:
    from fiscal.application.preparations import (
        IdempotencyConflictError,
        create_draft,
        prepare,
        review,
    )

    point_id = _setup_commercial_config(admin)
    first_sale = confirmed_sale(price="100.00", condition="CONTADO")
    second_sale = confirmed_sale(price="100.00", condition="CONTADO")
    first = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=first_sale["id"],
        idempotency_key="fiscal:create:c1",
    )
    second = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=second_sale["id"],
        idempotency_key="fiscal:create:c2",
    )
    _fill_draft(seller, first.preparation_id, point_id)
    _fill_draft(seller, second.preparation_id, point_id)
    token = review(actor=seller, preparation_id=first.preparation_id).token
    prepare(
        actor=seller,
        preparation_id=first.preparation_id,
        review_token=token,
        idempotency_key="fiscal:prepare:shared",
    )
    second_token = review(actor=seller, preparation_id=second.preparation_id).token
    with pytest.raises(IdempotencyConflictError):
        prepare(
            actor=seller,
            preparation_id=second.preparation_id,
            review_token=second_token,
            idempotency_key="fiscal:prepare:shared",
        )


def test_cancel_errors(prepared_context: dict[str, Any], seller: Any) -> None:
    import uuid

    from fiscal.application.preparations import (
        FiscalPreparationNotFoundError,
        PreparationImpedimentError,
        PreparationStateError,
        cancel,
    )

    prep_id = prepared_context["preparation_id"]
    with pytest.raises(PreparationImpedimentError):
        cancel(actor=seller, preparation_id=prep_id, expected_version=1, reason="   ")
    with pytest.raises(FiscalPreparationNotFoundError):
        cancel(actor=seller, preparation_id=uuid.uuid4(), expected_version=1, reason="motivo")
    cancel(actor=seller, preparation_id=prep_id, expected_version=1, reason="Anulado")
    with pytest.raises(PreparationStateError):
        cancel(actor=seller, preparation_id=prep_id, expected_version=2, reason="otra vez")


def test_replace_rejects_a_draft(prepared_context: dict[str, Any], seller: Any) -> None:
    from fiscal.application.preparations import PreparationStateError, replace

    with pytest.raises(PreparationStateError):
        replace(
            actor=seller,
            preparation_id=prepared_context["preparation_id"],
            reason="no aplica",
            idempotency_key="fiscal:replace:draft",
        )
