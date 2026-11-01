"""Datos del comprobante en la preparación comercial (DP-035): correo, plazo y detalle adicional.

Cubre los escenarios de `preparacion-y-seguimiento-fiscal` que se prueban sobre una venta
comercial. Los de operación artesanal están en `tests/workshop/test_fiscal_alignment.py`.
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

import pytest

from sales.application.ledger import ledger_for
from sales.models import Sale

from .test_fiscal_prepare_flow import _setup_commercial_config
from .test_fiscal_source import _payment
from .test_withholdings import parts, settle

RECEIVER: dict[str, str] = {
    "identification_type": "04",
    "identification": "0999999999001",
    "legal_name": "Cliente Fiscal S.A.",
    "address": "Calle 10",
    "email": "cliente@example.com",
}
CONSUMER_FINAL: dict[str, str] = {
    "identification_type": "07",
    "identification": "9999999999999",
    "legal_name": "CONSUMIDOR FINAL",
}


@pytest.fixture
def configured(admin: Any, confirmed_sale: Any) -> int:
    """Configura la entidad comercial; ``confirmed_sale`` la crea antes."""
    return _setup_commercial_config(admin)


def _draft(seller: Any, sale_id: int, key: str) -> UUID:
    from fiscal.application.preparations import create_draft

    return create_draft(
        actor=seller, source_kind="COMMERCIAL", source_id=sale_id, idempotency_key=key
    ).preparation_id


def _save(seller: Any, prep_id: UUID, **overrides: Any) -> Any:
    from fiscal.application.preparations import update_draft
    from fiscal.models import FiscalPreparation

    payload: dict[str, Any] = {
        "receiver": dict(RECEIVER),
        "payments": {"forms": [{"payment_code": "01", "amount": "100.00"}]},
    }
    payload.update(overrides)
    return update_draft(
        actor=seller,
        preparation_id=prep_id,
        expected_version=FiscalPreparation.objects.get(pk=prep_id).version,
        **payload,
    )


def _prepare(seller: Any, prep_id: UUID, key: str) -> dict[str, Any]:
    from fiscal.application.preparations import prepare, review
    from fiscal.models import FiscalPreparation

    result = review(actor=seller, preparation_id=prep_id)
    assert result.impediments == (), result.impediments
    assert result.token is not None
    prepare(actor=seller, preparation_id=prep_id, review_token=result.token, idempotency_key=key)
    snapshot = FiscalPreparation.objects.get(pk=prep_id).snapshot
    assert snapshot is not None
    return dict(snapshot)


def _impediments(seller: Any, prep_id: UUID) -> dict[str, dict[str, str]]:
    from fiscal.application.preparations import review

    result = review(actor=seller, preparation_id=prep_id)
    assert result.token is None
    return {item["field"]: item for item in result.impediments}


def _mark_prepared(prep_id: UUID, snapshot: dict[str, Any], actor: Any) -> None:
    """Deja una preparación completada con una instantánea anterior, como las ya existentes."""
    from django.utils import timezone

    from fiscal.models import FiscalPreparation

    FiscalPreparation.objects.filter(pk=prep_id).update(
        state="PREPARED",
        snapshot=snapshot,
        prepared_at=timezone.now(),
        prepared_by=actor,
        version=2,
    )


def _credit_forms(*pairs: tuple[str, str]) -> dict[str, Any]:
    return {"forms": [{"payment_code": code, "amount": amount} for code, amount in pairs]}


# --- Correo del comprador ---------------------------------------------------------------------


def test_review_blocks_an_identified_receiver_without_email(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    prep = _draft(seller, confirmed_sale(price="100.00", condition="CONTADO")["id"], "al:mail:1")
    _save(seller, prep, receiver={k: v for k, v in RECEIVER.items() if k != "email"})
    impediment = _impediments(seller, prep)["receiver.email"]
    assert impediment["audience"] == "OPERATOR"
    assert "correo" in impediment["message"].lower()


def test_a_draft_without_email_can_be_saved(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    prep = _draft(seller, confirmed_sale(condition="CONTADO")["id"], "al:mail:2")
    saved = _save(seller, prep, receiver={k: v for k, v in RECEIVER.items() if k != "email"})
    assert saved.draft["receiver"].get("email") is None


def test_the_screen_is_asked_for_only_the_email_when_the_rest_is_complete(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import get_preparation

    prep = _draft(seller, confirmed_sale(condition="CONTADO")["id"], "al:mail:3")
    _save(seller, prep, receiver={k: v for k, v in RECEIVER.items() if k != "email"})
    assert get_preparation(actor=seller, preparation_id=prep).missing_fields == ("email",)
    _save(seller, prep)
    assert get_preparation(actor=seller, preparation_id=prep).missing_fields == ()


def test_the_email_completed_in_the_preparation_is_kept_and_the_customer_is_untouched(
    configured: int, seller: Any, confirmed_sale: Any, customer: Any
) -> None:
    built = confirmed_sale(price="100.00", condition="CONTADO")
    sale_before = Sale.objects.get(pk=built["id"])
    prep = _draft(seller, built["id"], "al:mail:4")
    _save(seller, prep)
    snapshot = _prepare(seller, prep, "al:mail:4:prepare")
    assert snapshot["receiver"]["email"] == "cliente@example.com"
    customer.refresh_from_db()
    assert not customer.email
    sale_after = Sale.objects.get(pk=built["id"])
    assert sale_after.customer_snapshot == sale_before.customer_snapshot
    assert (sale_after.state, sale_after.version) == (sale_before.state, sale_before.version)


def test_consumer_final_prepares_without_an_email(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    built = confirmed_sale(price="30.00", condition="CONTADO")
    prep = _draft(seller, built["id"], "al:mail:5")
    _save(
        seller,
        prep,
        receiver=dict(CONSUMER_FINAL),
        payments={"forms": [{"payment_code": "01", "amount": "30.00"}]},
    )
    assert _prepare(seller, prep, "al:mail:5:prepare")["receiver"]["identification_type"] == "07"


def test_confirming_and_collecting_never_ask_for_the_customer_email(
    seller: Any, confirmed_sale: Any, customer: Any
) -> None:
    built = confirmed_sale(price="100.00", condition="CREDITO")
    assert not customer.email
    settle(seller, built["id"], parts(cash="100.00"), None)
    assert ledger_for(Sale.objects.get(pk=built["id"])).balance.balance == Decimal("0")


def test_a_preparation_completed_before_the_email_rule_is_shown_unchanged(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import get_preparation

    prep = _draft(seller, confirmed_sale(condition="CONTADO")["id"], "al:mail:6")
    legacy = {
        "schema_version": "factura-2.1.0",
        "snapshot_format": 3,
        "receiver": {"identification_type": "04", "identification": "0999999999001"},
        "totals": {"grand": "100.00"},
        "lines": [],
        "payments": [{"payment_code": "01", "amount": "100.00"}],
    }
    _mark_prepared(prep, legacy, seller)
    detail = get_preparation(actor=seller, preparation_id=prep)
    assert detail.state == "PREPARED"
    assert detail.snapshot == legacy
    assert detail.missing_fields == ()


# --- Plazo del comprobante --------------------------------------------------------------------


def _sale_state(sale_id: int) -> tuple[Any, ...]:
    sale = Sale.objects.get(pk=sale_id)
    ledger = ledger_for(sale)
    return (sale.state, sale.condition, sale.version, ledger.balance.balance, ledger.balance.state)


def test_a_credit_with_nothing_collected_carries_the_term_on_its_form(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    built = confirmed_sale(price="100.00", condition="CREDITO")
    before = _sale_state(built["id"])
    prep = _draft(seller, built["id"], "al:term:1")
    forms = _credit_forms(("20", "100.00"))
    _save(seller, prep, payments={**forms, "term_days": 30})
    snapshot = _prepare(seller, prep, "al:term:1:prepare")
    assert snapshot["payments"][0]["term_days"] == 30
    assert snapshot["payments"][0]["time_unit"] == "dias"
    assert snapshot["payments"][0]["payment_code"] == "20"
    assert _sale_state(built["id"]) == before


def test_a_credit_without_a_declared_term_is_blocked_with_an_operator_impediment(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    prep = _draft(seller, confirmed_sale(price="100.00", condition="CREDITO")["id"], "al:term:2")
    _save(seller, prep, payments=_credit_forms(("20", "100.00")))
    impediment = _impediments(seller, prep)["payments.term_days"]
    assert impediment["audience"] == "OPERATOR"
    assert "plazo" in impediment["message"].lower()


def test_only_the_form_that_covers_the_pending_balance_carries_the_term(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    built = confirmed_sale(price="100.00", condition="CREDITO")
    _payment(Sale.objects.get(pk=built["id"]), seller, {"EFECTIVO": "40.00"})
    prep = _draft(seller, built["id"], "al:term:3")
    _save(
        seller, prep, payments={**_credit_forms(("01", "40.00"), ("20", "60.00")), "term_days": 15}
    )
    cash, transfer = _prepare(seller, prep, "al:term:3:prepare")["payments"]
    assert "term_days" not in cash
    assert (transfer["term_days"], transfer["time_unit"]) == (15, "dias")


def test_a_credit_already_collected_in_full_does_not_ask_for_a_term(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import DraftFieldNotAllowedError, get_preparation

    built = confirmed_sale(price="100.00", condition="CREDITO")
    _payment(Sale.objects.get(pk=built["id"]), seller, {"EFECTIVO": "100.00"})
    prep = _draft(seller, built["id"], "al:term:4")
    working = get_preparation(actor=seller, preparation_id=prep).working
    assert working is not None
    assert working["term_required"] is False
    with pytest.raises(DraftFieldNotAllowedError):
        _save(seller, prep, payments={**_credit_forms(("01", "100.00")), "term_days": 30})


def test_a_credit_settled_with_a_withholding_does_not_ask_for_a_term(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import get_preparation

    built = confirmed_sale(price="250.00", condition="CREDITO")
    settle(seller, built["id"], parts(transfer="245.00"), "5.00")
    prep = _draft(seller, built["id"], "al:term:5")
    working = get_preparation(actor=seller, preparation_id=prep).working
    assert working is not None
    assert working["term_required"] is False
    _save(seller, prep, payments=_credit_forms(("20", "245.00"), ("01", "5.00")))
    snapshot = _prepare(seller, prep, "al:term:5:prepare")
    assert all("term_days" not in form for form in snapshot["payments"])


def test_a_cash_sale_still_pending_collection_does_not_ask_for_a_term(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import DraftFieldNotAllowedError, get_preparation

    built = confirmed_sale(price="100.00", condition="CONTADO")
    prep = _draft(seller, built["id"], "al:term:6")
    working = get_preparation(actor=seller, preparation_id=prep).working
    assert working is not None
    assert working["term_required"] is False
    with pytest.raises(DraftFieldNotAllowedError):
        _save(seller, prep, payments={**_credit_forms(("01", "100.00")), "term_days": 30})
    assert Sale.objects.get(pk=built["id"]).condition == "CONTADO"


@pytest.mark.parametrize("term", [0, -1, 1.5, "30", 10000, True])
def test_an_invalid_term_is_rejected_without_changing_the_draft(
    configured: int, seller: Any, confirmed_sale: Any, term: Any
) -> None:
    from fiscal.application.preparations import DraftValidationError
    from fiscal.models import FiscalPreparation

    prep = _draft(seller, confirmed_sale(price="100.00", condition="CREDITO")["id"], "al:term:7")
    before = FiscalPreparation.objects.get(pk=prep)
    with pytest.raises(DraftValidationError) as caught:
        _save(seller, prep, payments={**_credit_forms(("20", "100.00")), "term_days": term})
    assert "payments.term_days" in caught.value.errors
    after = FiscalPreparation.objects.get(pk=prep)
    assert (after.version, after.draft) == (before.version, before.draft)


def test_the_unit_cannot_be_chosen_by_the_user(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import DraftFieldNotAllowedError
    from fiscal.models import FiscalPreparation

    prep = _draft(seller, confirmed_sale(price="100.00", condition="CREDITO")["id"], "al:term:8")
    before = FiscalPreparation.objects.get(pk=prep)
    payments = {**_credit_forms(("20", "100.00")), "term_days": 30, "time_unit": "meses"}
    with pytest.raises(DraftFieldNotAllowedError):
        _save(seller, prep, payments=payments)
    assert FiscalPreparation.objects.get(pk=prep).version == before.version


def test_a_term_inside_a_form_is_still_rejected(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import DraftFieldNotAllowedError

    prep = _draft(seller, confirmed_sale(price="100.00", condition="CREDITO")["id"], "al:term:9")
    forms = {"forms": [{"payment_code": "20", "amount": "100.00", "term_days": 30}]}
    with pytest.raises(DraftFieldNotAllowedError):
        _save(seller, prep, payments=forms)


def test_a_collection_that_settles_the_sale_before_completing_drops_the_term(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    built = confirmed_sale(price="100.00", condition="CREDITO")
    prep = _draft(seller, built["id"], "al:term:10")
    _save(seller, prep, payments={**_credit_forms(("01", "100.00")), "term_days": 30})
    _payment(Sale.objects.get(pk=built["id"]), seller, {"EFECTIVO": "100.00"})
    snapshot = _prepare(seller, prep, "al:term:10:prepare")
    assert all("term_days" not in form for form in snapshot["payments"])


def test_a_collection_after_completing_does_not_change_the_snapshot(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.models import FiscalPreparation

    built = confirmed_sale(price="100.00", condition="CREDITO")
    prep = _draft(seller, built["id"], "al:term:11")
    _save(seller, prep, payments={**_credit_forms(("20", "100.00")), "term_days": 30})
    snapshot = _prepare(seller, prep, "al:term:11:prepare")
    _payment(Sale.objects.get(pk=built["id"]), seller, {"EFECTIVO": "40.00"})
    assert FiscalPreparation.objects.get(pk=prep).snapshot == snapshot


def test_a_term_that_expires_does_not_change_the_balance_or_the_payment_state(
    configured: int, seller: Any, confirmed_sale: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    from datetime import timedelta

    from django.utils import timezone

    built = confirmed_sale(price="100.00", condition="CREDITO")
    prep = _draft(seller, built["id"], "al:term:12")
    _save(seller, prep, payments={**_credit_forms(("20", "100.00")), "term_days": 1})
    _prepare(seller, prep, "al:term:12:prepare")
    before = _sale_state(built["id"])
    # Pasan más días que el plazo declarado: nada se marca vencido ni genera alertas.
    real_now = timezone.now
    monkeypatch.setattr(timezone, "now", lambda: real_now() + timedelta(days=90))
    assert _sale_state(built["id"]) == before


def test_a_draft_saved_with_the_old_per_form_term_asks_for_the_term_again(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import get_preparation
    from fiscal.models import FiscalPreparation

    prep = _draft(seller, confirmed_sale(price="100.00", condition="CREDITO")["id"], "al:term:13")
    FiscalPreparation.objects.filter(pk=prep).update(
        draft={
            "draft_format": 2,
            "receiver": dict(RECEIVER),
            "payments": {
                "forms": [
                    {"payment_code": "20", "amount": "100.00", "term_days": 30, "time_unit": "dias"}
                ]
            },
            "additional_info": [],
        }
    )
    working = get_preparation(actor=seller, preparation_id=prep).working
    assert working is not None
    assert working["term_required"] is True
    assert "term_days" not in working["payments"]
    assert working["payments"]["forms"] == [{"payment_code": "20", "amount": "100.00"}]
    assert "payments.term_days" in _impediments(seller, prep)


# --- Detalle adicional ------------------------------------------------------------------------


def test_additional_info_is_kept_in_the_snapshot_without_touching_the_sale(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    built = confirmed_sale(price="100.00", condition="CONTADO")
    before = _sale_state(built["id"])
    prep = _draft(seller, built["id"], "al:info:1")
    pairs = [{"name": "Vehículo", "value": "Placa PCM4567"}]
    _save(seller, prep, additional_info=pairs)
    assert _prepare(seller, prep, "al:info:1:prepare")["additional_info"] == pairs
    assert _sale_state(built["id"]) == before


def test_a_preparation_without_additional_info_has_an_empty_list(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    prep = _draft(seller, confirmed_sale(price="100.00", condition="CONTADO")["id"], "al:info:2")
    _save(seller, prep)
    assert _prepare(seller, prep, "al:info:2:prepare")["additional_info"] == []


def test_a_reserved_name_is_rejected_when_saving_the_draft(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import DraftValidationError

    prep = _draft(seller, confirmed_sale(condition="CONTADO")["id"], "al:info:3")
    with pytest.raises(DraftValidationError) as caught:
        _save(seller, prep, additional_info=[{"name": "ruc proveedor", "value": "1"}])
    assert "additional_info[1].name" in caught.value.errors


def test_more_than_twelve_pairs_are_rejected_when_saving_the_draft(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import DraftValidationError

    prep = _draft(seller, confirmed_sale(condition="CONTADO")["id"], "al:info:4")
    pairs = [{"name": f"Dato {n}", "value": "x"} for n in range(13)]
    with pytest.raises(DraftValidationError) as caught:
        _save(seller, prep, additional_info=pairs)
    assert "additional_info" in caught.value.errors


def test_a_completed_preparation_cannot_change_its_additional_info(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import PreparationStateError

    prep = _draft(seller, confirmed_sale(price="100.00", condition="CONTADO")["id"], "al:info:5")
    _save(seller, prep, additional_info=[{"name": "Dato", "value": "uno"}])
    _prepare(seller, prep, "al:info:5:prepare")
    with pytest.raises(PreparationStateError):
        _save(seller, prep, additional_info=[{"name": "Dato", "value": "dos"}])


def test_saving_without_additional_info_keeps_the_pairs_already_stored(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.models import FiscalPreparation

    prep = _draft(seller, confirmed_sale(condition="CONTADO")["id"], "al:info:6")
    _save(seller, prep, additional_info=[{"name": "Dato", "value": "uno"}])
    _save(seller, prep)
    draft = FiscalPreparation.objects.get(pk=prep).draft
    assert draft is not None
    assert draft["additional_info"] == [{"name": "Dato", "value": "uno"}]


def test_a_draft_that_already_holds_too_many_pairs_gets_an_impediment_and_loses_none(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.models import FiscalPreparation

    prep = _draft(seller, confirmed_sale(price="100.00", condition="CONTADO")["id"], "al:info:7")
    _save(seller, prep)
    stored = FiscalPreparation.objects.get(pk=prep)
    assert stored.draft is not None
    pairs = [{"name": f"Dato {n}", "value": "x"} for n in range(14)]
    FiscalPreparation.objects.filter(pk=prep).update(
        draft={**stored.draft, "additional_info": pairs}
    )
    impediments = _impediments(seller, prep)
    assert impediments["additional_info"]["audience"] == "OPERATOR"
    draft = FiscalPreparation.objects.get(pk=prep).draft
    assert draft is not None
    assert len(draft["additional_info"]) == 14


# --- Detalle de servicio: una venta comercial no lo admite --------------------------------------


def test_a_commercial_draft_starts_with_no_service_details(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.models import FiscalPreparation

    prep = _draft(seller, confirmed_sale(condition="CONTADO")["id"], "al:svc:1")
    draft = FiscalPreparation.objects.get(pk=prep).draft
    assert draft is not None
    assert draft["draft_format"] == 3
    assert draft["service_details"] == []


def test_a_commercial_line_does_not_accept_a_service_detail(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import DraftFieldNotAllowedError
    from fiscal.models import FiscalPreparation

    prep = _draft(seller, confirmed_sale(condition="CONTADO")["id"], "al:svc:2")
    before = FiscalPreparation.objects.get(pk=prep)
    with pytest.raises(DraftFieldNotAllowedError):
        _save(seller, prep, service_details=[{"position": 1, "detail": "no aplica"}])
    assert FiscalPreparation.objects.get(pk=prep).version == before.version
    _save(seller, prep, service_details=[])


# --- Emisor del formato 4 -------------------------------------------------------------------------


def test_the_prepared_snapshot_is_format_four_with_both_issuer_addresses(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from workshop_configuration.models import FiscalEntity

    entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
    entity.trade_name = "Andina"
    entity.save(update_fields=["trade_name"])
    prep = _draft(seller, confirmed_sale(price="100.00", condition="CONTADO")["id"], "al:iss:1")
    _save(seller, prep)
    issuer = _prepare(seller, prep, "al:iss:1:prepare")["issuer"]
    assert issuer["trade_name"] == "Andina"
    assert issuer["address"] == "Av. Matriz 100"
    assert issuer["establishment_address"] == "Sucursal Centro"


def test_an_entity_without_a_trade_name_omits_it_from_the_issuer(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    prep = _draft(seller, confirmed_sale(price="100.00", condition="CONTADO")["id"], "al:iss:2")
    _save(seller, prep)
    snapshot = _prepare(seller, prep, "al:iss:2:prepare")
    assert snapshot["snapshot_format"] == 4
    assert "trade_name" not in snapshot["issuer"]


def test_a_format_three_snapshot_is_still_read_as_it_was_kept(
    configured: int, seller: Any, confirmed_sale: Any
) -> None:
    from fiscal.application.preparations import get_preparation

    prep = _draft(seller, confirmed_sale(condition="CONTADO")["id"], "al:iss:3")
    format_three = {
        "schema_version": "factura-2.1.0",
        "snapshot_format": 3,
        "issuer": {"ruc": "0991234567001", "tax_profile": {"regime": "GENERAL"}},
        "payments": [{"payment_code": "01", "amount": "100.00"}],
        "legends": [],
    }
    _mark_prepared(prep, format_three, seller)
    detail = get_preparation(actor=seller, preparation_id=prep)
    assert detail.snapshot == format_three
