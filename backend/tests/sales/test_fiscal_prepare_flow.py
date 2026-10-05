"""Flujo de preparación comercial: revisión con token, preparar, cancelar y reemplazar."""

from datetime import date
from typing import Any

import pytest
from tests.workshop_configuration.profile_helpers import (
    applicable,
    profile_conditions,
    qualification,
)

from workshop_configuration.application.electronic_profiles import save_profile
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
        payload={"conditions": profile_conditions()},
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
    zero = TaxDefinition.objects.filter(fiscal_entity=entity, code="CERO").first()
    if zero is not None:
        create_mapping(
            actor=admin,
            definition_id=zero.pk,
            catalog_entry_id=_iva_15_entry("0"),
            starts_on=date(2025, 1, 1),
            ends_on=None,
            source="Resolución vigente",
        )
    return point.pk


def _iva_15_entry(code: str = "4") -> int:
    from workshop_configuration.application import official_catalog
    from workshop_configuration.models import OfficialCatalogEntry

    official_catalog.ensure_installed()
    return OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=official_catalog.SELECTABLE_TAX_VERSION, code=code
    ).pk


def _snapshot(preparation_id: Any) -> dict[str, Any]:
    from fiscal.models import FiscalPreparation

    snapshot = FiscalPreparation.objects.get(pk=preparation_id).snapshot
    assert snapshot is not None
    return dict(snapshot)


def _draft(preparation_id: Any) -> dict[str, Any]:
    from fiscal.models import FiscalPreparation

    draft = FiscalPreparation.objects.get(pk=preparation_id).draft
    assert draft is not None
    return dict(draft)


def _fill_draft(seller: Any, preparation_id: Any, point_id: int, **overrides: Any) -> Any:
    from fiscal.application.preparations import update_draft

    payload: dict[str, Any] = {
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
    # Sin perfil ni punto: la revisión reporta impedimentos administrativos, sin token.
    update_draft(
        actor=seller,
        preparation_id=draft.preparation_id,
        expected_version=1,
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
    assert {imp["audience"] for imp in result.impediments} == {"ADMINISTRATOR"}
    assert all("Administrador" in imp["message"] for imp in result.impediments)


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
    assert _snapshot(prep_id)["schema_version"] == "factura-2.1.0"
    assert _snapshot(prep_id)["totals"]["grand"] == "100.00"
    assert _snapshot(prep_id)["receiver"]["identification"] == "0999999999001"
    assert FiscalPreparationHistory.objects.filter(
        preparation=preparation, event="PREPARED"
    ).exists()


def test_prepare_is_idempotent_on_replay(prepared_context: dict[str, Any], seller: Any) -> None:
    from fiscal.application.preparations import prepare, review
    from fiscal.models import FiscalPreparationHistory

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    token = review(actor=seller, preparation_id=prep_id).token
    assert token is not None

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
    assert token is not None

    # Edición del borrador después de revisar (versión pasa de 2 a 3).
    update_draft(
        actor=seller,
        preparation_id=prep_id,
        expected_version=2,
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

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    token = review(actor=seller, preparation_id=prep_id).token
    assert token is not None
    prepare(
        actor=seller,
        preparation_id=prep_id,
        review_token=token,
        idempotency_key="fiscal:prepare:master",
    )
    original_name = _snapshot(prep_id)["issuer"]["legal_name"]

    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    entity.legal_name = "Comercial Renombrada S.A."
    entity.save(update_fields=["legal_name"])

    assert _snapshot(prep_id)["issuer"]["legal_name"] == original_name


def test_cancel_prepared_keeps_snapshot_and_history(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import cancel, prepare, review
    from fiscal.domain.states import PreparationState
    from fiscal.models import FiscalPreparation

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    token = review(actor=seller, preparation_id=prep_id).token
    assert token is not None
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
    assert token is not None
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
    assert token is not None

    # El Administrador registra una nueva revisión del perfil (cambia una leyenda).
    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    conditions = profile_conditions(special_taxpayer=applicable("12345"))
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
    with pytest.raises(FiscalPreparationNotFoundError):
        update_draft(
            actor=seller,
            preparation_id=uuid.uuid4(),
            expected_version=1,
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


def test_created_draft_is_prefilled_from_sale_and_configuration(
    prepared_context: dict[str, Any], seller: Any
) -> None:

    draft = _draft(prepared_context["preparation_id"])
    assert draft["draft_format"] == 2
    assert draft["receiver"]["identification_type"] in {"04", "05"}
    assert draft["receiver"]["legal_name"]
    assert draft["payments"]["forms"] == [{"payment_code": "01", "amount": "100.00"}]
    assert draft["payments"]["suggested"] is True
    assert "point_id" not in draft
    assert "environment" not in draft
    assert "reference_date" not in draft


def test_prefilled_draft_is_reviewable_without_user_input(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import prepare, review

    prep_id = prepared_context["preparation_id"]
    result = review(actor=seller, preparation_id=prep_id)
    assert result.impediments == ()
    assert result.token is not None
    prepare(
        actor=seller,
        preparation_id=prep_id,
        review_token=result.token,
        idempotency_key="fiscal:prepare:prefilled",
    )
    snapshot = _snapshot(prep_id)
    assert snapshot["issuer"]["environment"] == "1"
    assert snapshot["configuration"]["point"]["id"] == prepared_context["point_id"]
    assert snapshot["configuration"]["profile_revision"] == 1
    assert snapshot["payments"][0]["display_name"] == "Efectivo o sin sistema financiero"


def test_update_draft_rejects_technical_fields(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import DraftFieldNotAllowedError, update_draft
    from fiscal.models import FiscalPreparation

    prep_id = prepared_context["preparation_id"]
    with pytest.raises(DraftFieldNotAllowedError):
        update_draft(
            actor=seller,
            preparation_id=prep_id,
            expected_version=1,
            receiver={
                "identification_type": "04",
                "identification": "0999999999001",
                "legal_name": "Cliente",
            },
            payments={
                "forms": [
                    {"payment_code": "20", "amount": "100.00", "term_days": 30, "time_unit": "dias"}
                ]
            },
        )
    assert FiscalPreparation.objects.get(pk=prep_id).version == 1


def test_default_point_change_after_prepare_keeps_snapshot(
    prepared_context: dict[str, Any], seller: Any, admin: Any
) -> None:
    from uuid import uuid4

    from fiscal.application.preparations import prepare, review
    from workshop_configuration.application.preparation_settings import set_preparation_defaults

    prep_id = prepared_context["preparation_id"]
    token = review(actor=seller, preparation_id=prep_id).token
    assert token is not None
    prepare(
        actor=seller,
        preparation_id=prep_id,
        review_token=token,
        idempotency_key="fiscal:prepare:point",
    )
    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    establishment = FiscalEstablishment.objects.get(fiscal_entity=entity, code="001")
    second = FiscalEmissionPoint.objects.create(establishment=establishment, code="002")
    set_preparation_defaults(
        actor=admin,
        entity_id=entity.pk,
        expected_version=0,
        idempotency_key=str(uuid4()),
        default_point_id=second.pk,
    )
    snapshot = _snapshot(prep_id)
    assert snapshot["issuer"]["emission_point_code"] == "001"
    assert snapshot["configuration"]["point"]["code"] == "001"


def test_configuration_change_between_review_and_prepare_is_stale(
    prepared_context: dict[str, Any], seller: Any, admin: Any
) -> None:
    from uuid import uuid4

    from fiscal.application.preparations import StaleReviewError, prepare, review
    from workshop_configuration.application.preparation_settings import set_preparation_defaults

    prep_id = prepared_context["preparation_id"]
    token = review(actor=seller, preparation_id=prep_id).token
    assert token is not None
    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    set_preparation_defaults(
        actor=admin,
        entity_id=entity.pk,
        expected_version=0,
        idempotency_key=str(uuid4()),
        default_payment_code="20",
    )
    with pytest.raises(StaleReviewError):
        prepare(
            actor=seller,
            preparation_id=prep_id,
            review_token=token,
            idempotency_key="fiscal:prepare:configstale",
        )


def test_day_change_between_review_and_prepare_is_stale(
    prepared_context: dict[str, Any], seller: Any, monkeypatch: Any
) -> None:
    from fiscal.application import preparations
    from fiscal.application.preparations import StaleReviewError, prepare, review

    prep_id = prepared_context["preparation_id"]
    monkeypatch.setattr(preparations, "_today_guayaquil", lambda: "2026-09-26")
    token = review(actor=seller, preparation_id=prep_id).token
    assert token is not None
    monkeypatch.setattr(preparations, "_today_guayaquil", lambda: "2026-09-27")
    with pytest.raises(StaleReviewError):
        prepare(
            actor=seller,
            preparation_id=prep_id,
            review_token=token,
            idempotency_key="fiscal:prepare:daychange",
        )


def test_reference_date_uses_guayaquil_calendar(monkeypatch: Any) -> None:
    from datetime import UTC, datetime

    from fiscal.application import preparations

    monkeypatch.setattr(
        "fiscal.application.preparations.timezone.now",
        lambda: datetime(2026, 9, 27, 3, 30, tzinfo=UTC),
    )
    assert preparations._today_guayaquil() == "2026-09-26"


def test_legacy_draft_ignores_technical_fields(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import get_preparation, review
    from fiscal.models import FiscalPreparation

    prep_id = prepared_context["preparation_id"]
    FiscalPreparation.objects.filter(pk=prep_id).update(
        draft={
            "point_id": 999999,
            "environment": "2",
            "reference_date": "2020-01-01",
            "receiver": {
                "identification_type": "04",
                "identification": "0999999999001",
                "legal_name": "Cliente legado",
            },
            "payments": {
                "forms": [
                    {"payment_code": "20", "amount": "100.00", "term_days": 30, "time_unit": "dias"}
                ]
            },
        }
    )
    detail = get_preparation(actor=seller, preparation_id=prep_id)
    assert detail.working is not None
    assert detail.working["payments"]["forms"] == [{"payment_code": "20", "amount": "100.00"}]
    result = review(actor=seller, preparation_id=prep_id)
    assert result.impediments == ()


def test_detail_hides_technical_block_from_seller(
    prepared_context: dict[str, Any], seller: Any, admin: Any
) -> None:
    from fiscal.application.preparations import get_preparation, prepare, review

    prep_id = prepared_context["preparation_id"]
    detail = get_preparation(actor=seller, preparation_id=prep_id)
    assert detail.summary is not None
    assert detail.summary["grand_total"] == "100.00"
    assert [option["code"] for option in detail.payment_options] == ["01", "20"]
    token = review(actor=seller, preparation_id=prep_id).token
    assert token is not None
    prepare(
        actor=seller,
        preparation_id=prep_id,
        review_token=token,
        idempotency_key="fiscal:prepare:technical",
    )
    assert get_preparation(actor=seller, preparation_id=prep_id).technical is None
    assert get_preparation(actor=admin, preparation_id=prep_id).technical is not None


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

    from fiscal.application.preparations import StaleReviewError, prepare, review

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    token = review(actor=seller, preparation_id=prep_id).token
    assert token is not None

    def _expired(*args: Any, **kwargs: Any) -> None:
        raise signing.SignatureExpired("expired")

    monkeypatch.setattr("fiscal.application.preparations.signing.loads", _expired)
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
    assert token is not None
    prepare(
        actor=seller,
        preparation_id=first.preparation_id,
        review_token=token,
        idempotency_key="fiscal:prepare:shared",
    )
    second_token = review(actor=seller, preparation_id=second.preparation_id).token
    assert second_token is not None
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


def test_find_active_preparation_respects_scope(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from fiscal.application.preparations import find_active_preparation

    sale_id = prepared_context["sale"]["id"]
    found = find_active_preparation(actor=seller, source_kind="COMMERCIAL", source_id=sale_id)
    assert found is not None
    assert found.preparation_id == prepared_context["preparation_id"]
    assert found.state == "DRAFT"
    assert find_active_preparation(actor=seller, source_kind="COMMERCIAL", source_id=0) is None


def _prepare(seller: Any, prep_id: Any, key: str) -> Any:
    from fiscal.application.preparations import prepare, review
    from fiscal.models import FiscalPreparation

    result = review(actor=seller, preparation_id=prep_id)
    assert result.impediments == ()
    assert result.token is not None
    prepare(actor=seller, preparation_id=prep_id, review_token=result.token, idempotency_key=key)
    return FiscalPreparation.objects.get(pk=prep_id)


def test_customer_change_after_prepare_keeps_frozen_receiver(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from customer_registry.models import Customer
    from sales.models import Sale

    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    prepared = _prepare(seller, prep_id, "fiscal:prepare:customer")
    frozen = dict(prepared.snapshot["receiver"])

    customer_id = Sale.objects.get(pk=prepared_context["sale"]["id"]).customer_id
    Customer.objects.filter(pk=customer_id).update(
        address="Nueva dirección 999", name="Nombre cambiado"
    )

    assert _snapshot(prep_id)["receiver"] == frozen
    assert frozen["address"] == "Calle 10"


def test_catalog_update_after_prepare_keeps_codes_and_version(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    from workshop_configuration.application import official_catalog
    from workshop_configuration.models import OfficialCatalogEntry

    prep_id = prepared_context["preparation_id"]
    prepared = _prepare(seller, prep_id, "fiscal:prepare:catalog")
    before = _snapshot(prep_id)
    assert before["payments"][0]["catalog_version"] == official_catalog.SELECTABLE_PAYMENT_VERSION
    assert before["catalog_versions"]["iva"] == official_catalog.SELECTABLE_TAX_VERSION

    OfficialCatalogEntry.objects.filter(kind="PAYMENT_FORM", code="01").update(
        is_active=False, description="DESCRIPCIÓN SUSTITUIDA", display_name="Otro nombre"
    )
    OfficialCatalogEntry.objects.create(
        **{
            **{
                field.name: getattr(
                    OfficialCatalogEntry.objects.get(
                        kind="TAX_RATE",
                        catalog_version=official_catalog.SELECTABLE_TAX_VERSION,
                        code="4",
                    ),
                    field.name,
                )
                for field in OfficialCatalogEntry._meta.concrete_fields
                if field.name not in ("id", "incorporated_at")
            },
            "catalog_version": "SRI-2.35-TABLA17",
            "display_name": "IVA 15 % (nueva versión)",
        }
    )

    after = _snapshot(prep_id)
    assert after == before
    assert after["payments"][0]["description"] == "SIN UTILIZACION DEL SISTEMA FINANCIERO"
    assert prepared.snapshot["lines"][0]["display_name"] == "IVA 15 %"


def test_format_1_snapshot_is_returned_without_added_references(
    prepared_context: dict[str, Any], seller: Any, admin: Any
) -> None:
    from django.utils import timezone

    from fiscal.application.preparations import get_preparation
    from fiscal.models import FiscalPreparation

    prep_id = prepared_context["preparation_id"]
    legacy_snapshot = {
        "schema_version": "factura-2.1.0",
        "issuer": {"ruc": "0991234567001", "emission_point_code": "001", "environment": "1"},
        "receiver": {"legal_name": "Cliente antiguo", "identification": "0999999999001"},
        "totals": {"grand": "100.00"},
        "lines": [],
        "payments": [{"payment_code": "01", "amount": "100.00", "term_days": None}],
    }
    FiscalPreparation.objects.filter(pk=prep_id).update(
        state="PREPARED",
        snapshot=legacy_snapshot,
        prepared_at=timezone.now(),
        prepared_by=seller,
        version=2,
    )

    for actor in (seller, admin):
        detail = get_preparation(actor=actor, preparation_id=prep_id)
        assert detail.snapshot == legacy_snapshot
        assert detail.working is None
    technical = get_preparation(actor=admin, preparation_id=prep_id).technical
    assert technical is not None
    assert technical["configuration"] is None


# --- estructurar-perfil-del-emisor-y-codigos-fiscales -------------------------------------


def _prepared_snapshot(seller: Any, context: dict[str, Any], key: str) -> dict[str, Any]:
    from fiscal.application.preparations import prepare, review

    prep_id = context["preparation_id"]
    _fill_draft(seller, prep_id, context["point_id"])
    result = review(actor=seller, preparation_id=prep_id)
    assert result.impediments == ()
    assert result.token is not None
    prepare(actor=seller, preparation_id=prep_id, review_token=result.token, idempotency_key=key)
    snapshot = _snapshot(prep_id)
    assert snapshot is not None
    return dict(snapshot)


def test_prepared_snapshot_is_format_three_with_the_structured_issuer(
    prepared_context: dict[str, Any], seller: Any
) -> None:
    snapshot = _prepared_snapshot(seller, prepared_context, "fiscal:prepare:format3")
    assert snapshot["snapshot_format"] == 3
    assert snapshot["issuer"]["tax_profile"] == {
        "regime": "GENERAL",
        "accounting_obligation": "NO",
    }
    assert snapshot["legends"] == []


def test_profile_change_after_preparing_keeps_the_old_issuer_and_applies_to_the_next(
    prepared_context: dict[str, Any], seller: Any, admin: Any
) -> None:
    from fiscal.application.preparations import prepare, replace, review
    from fiscal.models import FiscalPreparation

    first = _prepared_snapshot(seller, prepared_context, "fiscal:prepare:profile-a")
    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    save_profile(
        actor=admin,
        entity_id=entity.pk,
        expected_revision=1,
        idempotency_key="profile:comercial:accounting",
        payload={"conditions": profile_conditions(accounting_obligation=applicable("SI"))},
    )
    outcome = replace(
        actor=seller,
        preparation_id=prepared_context["preparation_id"],
        reason="Cambio de perfil",
        idempotency_key="fiscal:replace:profile",
    )
    _fill_draft(seller, outcome.preparation_id, prepared_context["point_id"])
    token = review(actor=seller, preparation_id=outcome.preparation_id).token
    assert token is not None
    assert token is not None
    prepare(
        actor=seller,
        preparation_id=outcome.preparation_id,
        review_token=token,
        idempotency_key="fiscal:prepare:profile-b",
    )
    second = FiscalPreparation.objects.get(pk=outcome.preparation_id).snapshot
    assert first["issuer"]["tax_profile"]["accounting_obligation"] == "NO"
    assert second is not None
    assert second["issuer"]["tax_profile"]["accounting_obligation"] == "SI"
    stored_first = FiscalPreparation.objects.get(pk=prepared_context["preparation_id"]).snapshot
    assert stored_first is not None
    assert stored_first["issuer"]["tax_profile"]["accounting_obligation"] == "NO"


def _review_for_product(
    product: Any,
    *,
    seller: Any,
    admin: Any,
    confirmed_sale: Any,
    key: str,
    point_id: int | None = None,
) -> tuple[Any, int, Any]:
    from fiscal.application.preparations import create_draft, review

    point = point_id if point_id is not None else _setup_commercial_config(admin)
    sale = confirmed_sale(product=product, condition="CONTADO")
    draft = create_draft(
        actor=seller, source_kind="COMMERCIAL", source_id=sale["id"], idempotency_key=key
    )
    _fill_draft(seller, draft.preparation_id, point)
    return review(actor=seller, preparation_id=draft.preparation_id), point, draft


def test_product_code_over_the_limit_blocks_and_a_later_catalog_fix_does_not_unblock_the_sale(
    confirmed_sale: Any, make_product: Any, stock: Any, seller: Any, admin: Any
) -> None:
    from decimal import Decimal

    from catalog.models import Product
    from fiscal.application.preparations import create_draft, review

    product = make_product(code="C" * 31, sale_price=Decimal("100.00"))
    stock(product, 20, "80.00")
    result, point_id, draft = _review_for_product(
        product, seller=seller, admin=admin, confirmed_sale=confirmed_sale, key="fiscal:limit:1"
    )
    assert result.token is None
    [impediment] = [i for i in result.impediments if i["field"] == "line[1].item_code"]
    assert impediment["audience"] == "ADMINISTRATOR"
    assert "31" in impediment["message"]
    assert "25" in impediment["message"]
    assert product.name in impediment["message"]
    assert "catálogo" in impediment["message"]

    Product.objects.filter(pk=product.pk).update(code="CORTO-1")
    assert review(actor=seller, preparation_id=draft.preparation_id).token is None

    next_sale = confirmed_sale(product=product, condition="CONTADO")
    next_draft = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=next_sale["id"],
        idempotency_key="fiscal:limit:2",
    )
    _fill_draft(seller, next_draft.preparation_id, point_id)
    ready = review(actor=seller, preparation_id=next_draft.preparation_id)
    assert ready.impediments == ()
    assert ready.token is not None


def test_product_code_of_twenty_five_characters_is_prepared_whole(
    confirmed_sale: Any, make_product: Any, stock: Any, seller: Any, admin: Any
) -> None:
    from decimal import Decimal

    from fiscal.application.preparations import prepare
    from fiscal.models import FiscalPreparation

    product = make_product(code="D" * 25, sale_price=Decimal("100.00"))
    stock(product, 20, "80.00")
    result, _, draft = _review_for_product(
        product, seller=seller, admin=admin, confirmed_sale=confirmed_sale, key="fiscal:limit:25"
    )
    assert result.impediments == ()
    assert result.token is not None
    prepare(
        actor=seller,
        preparation_id=draft.preparation_id,
        review_token=result.token,
        idempotency_key="fiscal:prepare:limit25",
    )
    snapshot = FiscalPreparation.objects.get(pk=draft.preparation_id).snapshot
    assert snapshot is not None
    assert snapshot["lines"][0]["item_code"] == "D" * 25


def test_valid_qualification_with_a_fifteen_percent_line_blocks_without_touching_amounts(
    prepared_context: dict[str, Any], seller: Any, admin: Any
) -> None:
    from fiscal.application.preparations import review

    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    save_profile(
        actor=admin,
        entity_id=entity.pk,
        expected_revision=1,
        idempotency_key="profile:comercial:qualification",
        payload={"conditions": profile_conditions(artisan_qualification=qualification())},
    )
    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    result = review(actor=seller, preparation_id=prep_id)
    assert result.token is None
    [impediment] = [i for i in result.impediments if i["field"] == "line[1].artisan_rate"]
    assert impediment["audience"] == "ADMINISTRATOR"
    assert "IVA 15 %" in impediment["message"]
    assert prepared_context["sale"]["body"]["grand_total"] == "100.00"


def test_expired_qualification_blocks_by_profile_state_not_by_the_rate_rule(
    prepared_context: dict[str, Any], seller: Any, admin: Any
) -> None:
    from datetime import timedelta

    from django.utils import timezone

    from fiscal.application.preparations import review

    yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    save_profile(
        actor=admin,
        entity_id=entity.pk,
        expected_revision=1,
        idempotency_key="profile:comercial:expired",
        payload={
            "conditions": profile_conditions(
                artisan_qualification=qualification(yesterday, starts_on="2025-01-01")
            )
        },
    )
    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    result = review(actor=seller, preparation_id=prep_id)
    codes = {impediment["code"] for impediment in result.impediments}
    assert result.token is None
    assert "conditions.artisan_qualification.expired" in codes
    assert "line_zero_rate_required" not in codes


def test_profile_in_legacy_format_blocks_the_review_with_an_administrator_impediment(
    prepared_context: dict[str, Any], seller: Any, admin: Any
) -> None:
    from fiscal.application.preparations import review
    from workshop_configuration.models import ElectronicProfileRevision

    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    ElectronicProfileRevision.objects.create(
        fiscal_entity=entity,
        revision=2,
        conditions_format=1,
        conditions={"rimpe": {"status": "UNKNOWN"}},
        created_by=admin,
    )
    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    result = review(actor=seller, preparation_id=prep_id)
    [impediment] = [i for i in result.impediments if i["code"] == "profile.legacy_format"]
    assert result.token is None
    assert impediment["audience"] == "ADMINISTRATOR"
    assert "de nuevo" in impediment["message"]


def test_snapshots_of_earlier_formats_are_read_back_unchanged(
    prepared_context: dict[str, Any], seller: Any, admin: Any
) -> None:
    from fiscal.application.preparations import get_preparation
    from fiscal.models import FiscalPreparation

    current = _prepared_snapshot(seller, prepared_context, "fiscal:prepare:formats")
    format_two = {
        **{k: v for k, v in current.items() if k != "legends"},
        "snapshot_format": 2,
        "legends": ["special_taxpayer: 12345"],
        "issuer": {key: value for key, value in current["issuer"].items() if key != "tax_profile"},
    }
    format_one = {key: value for key, value in format_two.items() if key != "snapshot_format"}
    for legacy in (format_two, format_one):
        FiscalPreparation.objects.filter(pk=prepared_context["preparation_id"]).update(
            snapshot=legacy
        )
        detail = get_preparation(actor=admin, preparation_id=prepared_context["preparation_id"])
        assert detail.snapshot == legacy
        assert detail.technical is not None
        assert "tax_profile" not in detail.technical["issuer"]


def _declare_popular_business(admin: Any) -> None:
    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    save_profile(
        actor=admin,
        entity_id=entity.pk,
        expected_revision=1,
        idempotency_key="profile:comercial:popular",
        payload={"conditions": profile_conditions(tax_regime=applicable("RIMPE_NEGOCIO_POPULAR"))},
    )


def test_popular_business_can_invoice_lines_at_zero_rate(
    prepared_context: dict[str, Any],
    confirmed_sale: Any,
    make_product: Any,
    stock: Any,
    commercial: dict[str, Any],
    seller: Any,
    admin: Any,
) -> None:
    from decimal import Decimal

    from fiscal.application.preparations import create_draft, prepare, review
    from fiscal.models import FiscalPreparation

    _declare_popular_business(admin)
    product = make_product(sale_price=Decimal("40.00"), tax_definition=commercial["zero"])
    stock(product, 20, "80.00")
    sale = confirmed_sale(product=product, condition="CONTADO")
    assert sale["body"]["grand_total"] == "40.00"
    assert sale["body"]["internal_number"].startswith("COM-VEN-")
    draft = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=sale["id"],
        idempotency_key="fiscal:create:popular",
    )
    _fill_draft(
        seller,
        draft.preparation_id,
        prepared_context["point_id"],
        payments={"forms": [{"payment_code": "01", "amount": "40.00"}]},
    )
    result = review(actor=seller, preparation_id=draft.preparation_id)
    assert result.impediments == ()
    assert result.token is not None
    prepare(
        actor=seller,
        preparation_id=draft.preparation_id,
        review_token=result.token,
        idempotency_key="fiscal:prepare:popular",
    )
    snapshot = FiscalPreparation.objects.get(pk=draft.preparation_id).snapshot
    assert snapshot is not None
    assert snapshot["issuer"]["tax_profile"]["regime"] == "RIMPE_NEGOCIO_POPULAR"
    assert snapshot["totals"] == {"base": "40.00", "tax": "0.00", "grand": "40.00"}
    assert snapshot["lines"][0]["percentage_code"] == "0"


def test_popular_business_never_prepares_a_line_with_iva(
    prepared_context: dict[str, Any], seller: Any, admin: Any
) -> None:
    from fiscal.application.preparations import review

    _declare_popular_business(admin)
    prep_id = prepared_context["preparation_id"]
    _fill_draft(seller, prep_id, prepared_context["point_id"])
    result = review(actor=seller, preparation_id=prep_id)
    assert result.token is None
    [impediment] = [i for i in result.impediments if i["field"] == "line[1].popular_rate"]
    assert impediment["audience"] == "ADMINISTRATOR"
    assert "no cobra IVA" in impediment["message"]
    assert "IVA 15 %" in impediment["message"]
    # La venta interna no cambia: sigue confirmada con sus importes.
    assert prepared_context["sale"]["body"]["grand_total"] == "100.00"


def test_business_keeps_invoicing_when_it_moves_from_popular_business_to_entrepreneur(
    confirmed_sale: Any,
    make_product: Any,
    stock: Any,
    commercial: dict[str, Any],
    seller: Any,
    admin: Any,
) -> None:
    """El día del cambio de régimen se programa y después se factura con IVA y nueva leyenda."""
    from datetime import datetime, timedelta
    from decimal import Decimal
    from unittest import mock
    from zoneinfo import ZoneInfo

    from django.utils import timezone

    from fiscal.application.preparations import create_draft, prepare, review
    from fiscal.models import FiscalPreparation
    from workshop_configuration.application.fiscal_tax_mapping import schedule_mapping_successor
    from workshop_configuration.application.taxes import schedule_successor
    from workshop_configuration.models import FiscalTaxMapping, TaxPeriod

    point_id = _setup_commercial_config(admin)
    entity = commercial["entity"]
    sales_tax = TaxDefinition.objects.create(
        fiscal_entity=entity, code="IVAV", name="IVA ventas del negocio"
    )
    period = TaxPeriod.objects.create(
        tax_definition=sales_tax, rate=Decimal("0"), starts_on=date(2025, 1, 1)
    )
    mapping = create_mapping(
        actor=admin,
        definition_id=sales_tax.pk,
        catalog_entry_id=_iva_15_entry("0"),
        starts_on=date(2025, 1, 1),
        ends_on=None,
        source="Certificado de RUC",
    )
    product = make_product(sale_price=Decimal("100.00"), tax_definition=sales_tax)
    stock(product, 20, "80.00")
    _declare_popular_business(admin)

    def invoice(sale: dict[str, Any], key: str) -> dict[str, Any]:
        draft = create_draft(
            actor=seller,
            source_kind="COMMERCIAL",
            source_id=sale["id"],
            idempotency_key=f"fiscal:create:{key}",
        )
        _fill_draft(seller, draft.preparation_id, point_id)
        result = review(actor=seller, preparation_id=draft.preparation_id)
        assert result.impediments == ()
        assert result.token is not None
        prepare(
            actor=seller,
            preparation_id=draft.preparation_id,
            review_token=result.token,
            idempotency_key=f"fiscal:prepare:{key}",
        )
        snapshot = FiscalPreparation.objects.get(pk=draft.preparation_id).snapshot
        assert snapshot is not None
        return dict(snapshot)

    # Antes del cambio: Negocio Popular, IVA 0 %.
    before = invoice(confirmed_sale(product=product, condition="CONTADO"), "before")
    assert before["issuer"]["tax_profile"]["regime"] == "RIMPE_NEGOCIO_POPULAR"
    assert (before["lines"][0]["percentage_code"], before["totals"]["tax"]) == ("0", "0.00")

    # El Administrador programa el cambio de IVA con antelación; el negocio sigue operando.
    day = timezone.localdate() + timedelta(days=30)
    schedule_successor(
        actor=admin,
        period_id=period.pk,
        expected_version=period.version,
        new_rate="15",
        successor_starts_on=day,
    )
    schedule_mapping_successor(
        actor=admin,
        mapping_id=mapping.pk,
        catalog_entry_id=_iva_15_entry("4"),
        starts_on=day,
        source="Pasa a RIMPE Emprendedor",
    )
    still = invoice(confirmed_sale(product=product, condition="CONTADO"), "still")
    assert (still["lines"][0]["percentage_code"], still["totals"]["tax"]) == ("0", "0.00")

    # El día del cambio declara el nuevo régimen y factura con IVA, sin más ajustes.
    moved = datetime.combine(day, datetime.min.time(), tzinfo=ZoneInfo("America/Guayaquil"))
    with (
        mock.patch("django.utils.timezone.now", return_value=moved + timedelta(hours=10)),
        mock.patch("sales.application.reviews.today", return_value=day),
    ):
        save_profile(
            actor=admin,
            entity_id=entity.pk,
            expected_revision=2,
            idempotency_key="profile:comercial:emprendedor",
            payload={
                "conditions": profile_conditions(
                    tax_regime=applicable("RIMPE_EMPRENDEDOR", starts_on=day.isoformat())
                )
            },
        )
        after = invoice(confirmed_sale(product=product, condition="CONTADO"), "after")

    assert after["issuer"]["tax_profile"]["regime"] == "RIMPE_EMPRENDEDOR"
    assert after["issuer"]["tax_profile"]["regime_legend"] == "CONTRIBUYENTE RÉGIMEN RIMPE"
    assert (after["lines"][0]["percentage_code"], after["lines"][0]["tax_rate"]) == ("4", "15.0000")
    assert after["totals"] == {"base": "86.96", "tax": "13.04", "grand": "100.00"}
    assert after["reference_date"] == day.isoformat()

    # Lo ya preparado conserva su régimen y su tarifa.
    assert before["issuer"]["tax_profile"]["regime"] == "RIMPE_NEGOCIO_POPULAR"
    assert FiscalTaxMapping.objects.filter(tax_definition=sales_tax).count() == 2
