"""Datos del comprobante en la preparación artesanal (DP-035).

Cubre los escenarios de `preparacion-y-seguimiento-fiscal` que se prueban sobre una operación
de servicios: correo, plazo con cobros y retenciones, detalle de servicio y emisor. Los de venta
comercial están en `tests/sales/test_fiscal_alignment.py`.
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

import pytest
from tests.workshop.workshop_helpers import add_line, confirm_services, create, key

from workshop.models import ServiceLine, ServiceOperation, ServiceOperationLine

from .test_fiscal_preparation import _configure_artisan
from .test_fiscal_source import _pay

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(manager: Any, artisan_billing: Any, customer: Any, vehicle: Any) -> dict[str, Any]:
    return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)


@pytest.fixture
def configured(admin: Any, artisan: dict[str, Any]) -> dict[str, Any]:
    _configure_artisan(admin, artisan, rate_code="4")
    return artisan


def _operation(
    manager: Any,
    order: dict[str, Any],
    make_service: Any,
    *,
    price: str = "25.00",
    detail: str | None = None,
    condition: str = "CONTADO",
) -> int:
    payload: dict[str, Any] = {"service_id": make_service().pk, "applied_price": price}
    if detail is not None:
        payload["detail"] = detail
    add_line(manager, order["id"], **payload)
    operation_id: int = confirm_services(manager, order["id"], condition)["id"]
    return operation_id


def _draft(manager: Any, operation_id: int) -> UUID:
    from fiscal.application.preparations import create_draft

    return create_draft(
        actor=manager,
        source_kind="ARTISAN",
        source_id=operation_id,
        idempotency_key=f"fiscal:artisan:{key()}",
    ).preparation_id


def _save(manager: Any, prep_id: UUID, **overrides: Any) -> Any:
    from fiscal.application.preparations import get_preparation, update_draft

    detail = get_preparation(actor=manager, preparation_id=prep_id)
    assert detail.working is not None
    payload: dict[str, Any] = {
        "receiver": {**detail.working["receiver"], "email": "ana@example.com"},
        "payments": {"forms": detail.working["payments"]["forms"]},
    }
    payload.update(overrides)
    return update_draft(
        actor=manager, preparation_id=prep_id, expected_version=detail.version, **payload
    )


def _prepare(manager: Any, prep_id: UUID) -> dict[str, Any]:
    from fiscal.application.preparations import prepare, review
    from fiscal.models import FiscalPreparation

    result = review(actor=manager, preparation_id=prep_id)
    assert result.impediments == (), result.impediments
    assert result.token is not None
    prepare(
        actor=manager,
        preparation_id=prep_id,
        review_token=result.token,
        idempotency_key=f"fiscal:prepare:{key()}",
    )
    snapshot = FiscalPreparation.objects.get(pk=prep_id).snapshot
    assert snapshot is not None
    return dict(snapshot)


def _working(manager: Any, prep_id: UUID) -> dict[str, Any]:
    from fiscal.application.preparations import get_preparation

    working = get_preparation(actor=manager, preparation_id=prep_id).working
    assert working is not None
    return dict(working)


# --- Correo: la instantánea del cliente de una orden de taller no lo conserva ---------------------


def test_an_artisan_draft_asks_for_the_email_because_the_order_does_not_keep_it(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    from fiscal.application.preparations import get_preparation, review

    prep = _draft(manager, _operation(manager, order, make_service))
    assert "email" in get_preparation(actor=manager, preparation_id=prep).missing_fields
    result = review(actor=manager, preparation_id=prep)
    [impediment] = [i for i in result.impediments if i["field"] == "receiver.email"]
    assert impediment["audience"] == "OPERATOR"


def test_the_email_typed_in_the_preparation_is_kept_without_touching_the_customer_or_operation(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any, customer: Any
) -> None:
    operation_id = _operation(manager, order, make_service)
    before = ServiceOperation.objects.get(pk=operation_id)
    prep = _draft(manager, operation_id)
    _save(manager, prep, payments={"forms": _working(manager, prep)["payments"]["forms"]})
    snapshot = _prepare(manager, prep)
    assert snapshot["receiver"]["email"] == "ana@example.com"
    customer.refresh_from_db()
    assert not customer.email
    after = ServiceOperation.objects.get(pk=operation_id)
    assert after.customer_snapshot == before.customer_snapshot
    assert (after.state, after.version) == (before.state, before.version)


# --- Plazo ------------------------------------------------------------------------------------


def test_an_artisan_credit_with_a_partial_collection_puts_the_term_on_the_pending_form(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    operation_id = _operation(manager, order, make_service, price="100.00", condition="CREDITO")
    _pay(manager, operation_id, "40.00")
    prep = _draft(manager, operation_id)
    forms = [
        {"payment_code": "01", "amount": "40.00"},
        {"payment_code": "20", "amount": "60.00"},
    ]
    _save(manager, prep, payments={"forms": forms, "term_days": 15})
    cash, transfer = _prepare(manager, prep)["payments"]
    assert "term_days" not in cash
    assert (transfer["term_days"], transfer["time_unit"]) == (15, "dias")


def test_an_artisan_credit_settled_with_a_withholding_does_not_ask_for_a_term(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    operation_id = _operation(manager, order, make_service, price="250.00", condition="CREDITO")
    _pay(manager, operation_id, "245.00", withheld="5.00")
    prep = _draft(manager, operation_id)
    assert _working(manager, prep)["term_required"] is False
    forms = [{"payment_code": "01", "amount": "245.00"}, {"payment_code": "20", "amount": "5.00"}]
    _save(manager, prep, payments={"forms": forms})
    assert all("term_days" not in form for form in _prepare(manager, prep)["payments"])


def test_an_artisan_cash_operation_does_not_ask_for_a_term(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    from fiscal.application.preparations import DraftFieldNotAllowedError

    prep = _draft(manager, _operation(manager, order, make_service, condition="CONTADO"))
    assert _working(manager, prep)["term_required"] is False
    forms = _working(manager, prep)["payments"]["forms"]
    with pytest.raises(DraftFieldNotAllowedError):
        _save(manager, prep, payments={"forms": forms, "term_days": 30})


def test_the_term_does_not_change_the_operation_balance_or_payment_state(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    from workshop.application.service_operations import balance_of

    operation_id = _operation(manager, order, make_service, price="100.00", condition="CREDITO")
    operation = ServiceOperation.objects.get(pk=operation_id)
    before = (operation.state, operation.version, balance_of(operation).balance)
    prep = _draft(manager, operation_id)
    forms = _working(manager, prep)["payments"]["forms"]
    _save(manager, prep, payments={"forms": forms, "term_days": 30})
    _prepare(manager, prep)
    operation.refresh_from_db()
    assert (operation.state, operation.version, balance_of(operation).balance) == before
    assert balance_of(operation).balance == Decimal("100.00")


# --- Detalle de servicio --------------------------------------------------------------------------


def test_the_draft_is_preloaded_with_the_detail_kept_by_the_operation(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    prep = _draft(manager, _operation(manager, order, make_service, detail="frenos delanteros"))
    assert _working(manager, prep)["service_details"] == [
        {"position": 1, "detail": "frenos delanteros"}
    ]


def test_a_line_without_detail_is_listed_with_an_empty_detail_and_prepares_without_one(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    prep = _draft(manager, _operation(manager, order, make_service))
    assert _working(manager, prep)["service_details"] == [{"position": 1, "detail": ""}]
    _save(manager, prep)
    snapshot = _prepare(manager, prep)
    assert "service_detail" not in snapshot["lines"][0]


def test_the_adjusted_detail_goes_to_the_snapshot_and_the_operation_keeps_the_original(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    operation_id = _operation(manager, order, make_service, detail="frenos delanteros")
    prep = _draft(manager, operation_id)
    _save(manager, prep, service_details=[{"position": 1, "detail": "frenos y rectificado"}])
    snapshot = _prepare(manager, prep)
    assert snapshot["lines"][0]["service_detail"] == "frenos y rectificado"
    assert ServiceOperationLine.objects.get(operation_id=operation_id).detail == "frenos delanteros"
    assert ServiceLine.objects.get().detail == "frenos delanteros"


def test_the_untouched_detail_travels_to_the_snapshot_as_the_operation_kept_it(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    prep = _draft(manager, _operation(manager, order, make_service, detail="rotación"))
    _save(manager, prep)
    assert _prepare(manager, prep)["lines"][0]["service_detail"] == "rotación"


def test_an_emptied_detail_leaves_the_line_without_one(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    prep = _draft(manager, _operation(manager, order, make_service, detail="rotación"))
    _save(manager, prep, service_details=[{"position": 1, "detail": ""}])
    assert "service_detail" not in _prepare(manager, prep)["lines"][0]


@pytest.mark.parametrize(
    ("details", "field"),
    [
        ([{"position": 1, "detail": "x" * 301}], "service_details[1].detail"),
        ([{"position": 1, "detail": "dos\nlíneas"}], "service_details[1].detail"),
        ([{"position": 7, "detail": "x"}], "service_details[1].position"),
    ],
)
def test_an_invalid_detail_is_rejected_without_changing_the_draft(
    manager: Any,
    configured: Any,
    order: dict[str, Any],
    make_service: Any,
    details: list[dict[str, Any]],
    field: str,
) -> None:
    from fiscal.application.preparations import DraftValidationError
    from fiscal.models import FiscalPreparation

    prep = _draft(manager, _operation(manager, order, make_service))
    before = FiscalPreparation.objects.get(pk=prep)
    with pytest.raises(DraftValidationError) as caught:
        _save(manager, prep, service_details=details)
    assert field in caught.value.errors
    after = FiscalPreparation.objects.get(pk=prep)
    assert (after.version, after.draft) == (before.version, before.draft)


def test_saving_without_details_keeps_the_ones_already_adjusted(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    prep = _draft(manager, _operation(manager, order, make_service, detail="original"))
    _save(manager, prep, service_details=[{"position": 1, "detail": "ajustado"}])
    _save(manager, prep)
    assert _working(manager, prep)["service_details"] == [{"position": 1, "detail": "ajustado"}]


def test_a_draft_saved_before_this_change_is_preloaded_from_the_operation(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    from fiscal.models import FiscalPreparation

    prep = _draft(manager, _operation(manager, order, make_service, detail="rotación"))
    stored = FiscalPreparation.objects.get(pk=prep)
    assert stored.draft is not None
    legacy = {k: v for k, v in stored.draft.items() if k != "service_details"}
    FiscalPreparation.objects.filter(pk=prep).update(draft={**legacy, "draft_format": 2})
    assert _working(manager, prep)["service_details"] == [{"position": 1, "detail": "rotación"}]


def test_a_replacement_preloads_the_operation_detail_and_the_old_snapshot_keeps_its_own(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    from fiscal.application.preparations import replace
    from fiscal.models import FiscalPreparation

    prep = _draft(manager, _operation(manager, order, make_service, detail="original"))
    _save(manager, prep, service_details=[{"position": 1, "detail": "ajustado"}])
    old_snapshot = _prepare(manager, prep)
    replaced = replace(
        actor=manager, preparation_id=prep, reason="Dato corregido", idempotency_key=key()
    )
    assert _working(manager, replaced.preparation_id)["service_details"] == [
        {"position": 1, "detail": "original"}
    ]
    old = FiscalPreparation.objects.get(pk=prep)
    assert old.state == "CANCELLED"
    assert old.snapshot == old_snapshot
    assert old_snapshot["lines"][0]["service_detail"] == "ajustado"


# --- Emisor -----------------------------------------------------------------------------------


def test_a_popular_business_snapshot_carries_its_derived_legend(
    manager: Any, admin: Any, artisan: dict[str, Any], order: dict[str, Any], make_service: Any
) -> None:
    from tests.workshop_configuration.profile_helpers import applicable

    from workshop_configuration.models import TaxPeriod

    TaxPeriod.objects.filter(tax_definition=artisan["tax"]).update(rate=Decimal("0"))
    _configure_artisan(
        admin, artisan, rate_code="0", tax_regime=applicable("RIMPE_NEGOCIO_POPULAR")
    )
    prep = _draft(manager, _operation(manager, order, make_service))
    _save(manager, prep)
    profile = _prepare(manager, prep)["issuer"]["tax_profile"]
    assert profile["regime"] == "RIMPE_NEGOCIO_POPULAR"
    assert profile["regime_legend"] == "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE"


def test_a_large_taxpayer_snapshot_carries_its_resolution_number(
    manager: Any, admin: Any, artisan: dict[str, Any], order: dict[str, Any], make_service: Any
) -> None:
    from tests.workshop_configuration.profile_helpers import applicable

    _configure_artisan(
        admin, artisan, rate_code="4", large_taxpayer=applicable("NAC-GCFOIOC21-00000868-E")
    )
    prep = _draft(manager, _operation(manager, order, make_service))
    _save(manager, prep)
    profile = _prepare(manager, prep)["issuer"]["tax_profile"]
    assert profile["large_taxpayer_resolution"] == "NAC-GCFOIOC21-00000868-E"


def test_the_artisan_issuer_keeps_both_addresses_and_the_trade_name_when_declared(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    entity = configured["entity"]
    entity.trade_name = "Taller Ana"
    entity.save(update_fields=["trade_name"])
    prep = _draft(manager, _operation(manager, order, make_service))
    _save(manager, prep)
    issuer = _prepare(manager, prep)["issuer"]
    assert issuer["trade_name"] == "Taller Ana"
    assert issuer["address"] == "Matriz del taller"
    assert issuer["establishment_address"] == "Local del taller"


# --- El correo de la ficha del cliente llega a la preparación artesanal ---------------------------


def test_the_draft_is_prefilled_with_the_email_and_address_of_the_customer_card(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any, customer: Any
) -> None:
    from fiscal.application.preparations import get_preparation, review

    customer.email = "ficha@example.com"
    customer.address = "Av. Principal 1"
    customer.save(update_fields=["email", "address"])
    prep = _draft(manager, _operation(manager, order, make_service))
    working = _working(manager, prep)
    assert working["receiver"]["email"] == "ficha@example.com"
    assert working["receiver"]["address"] == "Av. Principal 1"
    assert get_preparation(actor=manager, preparation_id=prep).missing_fields == ()
    assert review(actor=manager, preparation_id=prep).impediments == ()


def test_the_prefilled_email_prepares_without_typing_and_keeps_the_card_untouched(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any, customer: Any
) -> None:
    from fiscal.application.preparations import prepare, review
    from fiscal.models import FiscalPreparation

    customer.email = "ficha@example.com"
    customer.save(update_fields=["email"])
    prep = _draft(manager, _operation(manager, order, make_service))
    result = review(actor=manager, preparation_id=prep)
    assert result.token is not None
    prepare(
        actor=manager,
        preparation_id=prep,
        review_token=result.token,
        idempotency_key=f"fiscal:prepare:{key()}",
    )
    snapshot = FiscalPreparation.objects.get(pk=prep).snapshot
    assert snapshot is not None
    assert snapshot["receiver"]["email"] == "ficha@example.com"
    customer.refresh_from_db()
    assert customer.email == "ficha@example.com"


def test_an_email_typed_in_the_preparation_wins_over_the_card_and_does_not_change_it(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any, customer: Any
) -> None:
    customer.email = "ficha@example.com"
    customer.save(update_fields=["email"])
    prep = _draft(manager, _operation(manager, order, make_service))
    forms = _working(manager, prep)["payments"]["forms"]
    _save(
        manager,
        prep,
        receiver={**_working(manager, prep)["receiver"], "email": "otro@example.com"},
        payments={"forms": forms},
    )
    assert _prepare(manager, prep)["receiver"]["email"] == "otro@example.com"
    customer.refresh_from_db()
    assert customer.email == "ficha@example.com"


def test_a_card_without_email_still_asks_for_it(
    manager: Any, configured: Any, order: dict[str, Any], make_service: Any
) -> None:
    prep = _draft(manager, _operation(manager, order, make_service))
    assert _working(manager, prep)["receiver"].get("email") is None
