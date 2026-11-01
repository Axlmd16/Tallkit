"""Contrato público de lectura fiscal del origen comercial."""

from dataclasses import FrozenInstanceError
from typing import Any

import pytest
from django.db import transaction

from sales.models import Sale


def test_confirmed_sale_source_uses_historical_snapshots_and_decimal_strings(
    confirmed_sale: Any,
) -> None:
    from sales.application.fiscal_source import read_fiscal_source

    built = confirmed_sale(price="11.50", quantity=2)
    source = read_fiscal_source(built["id"])

    assert source.source_id == built["id"]
    assert source.state == "CONFIRMED"
    assert source.grand_total == "23.00"
    assert source.customer_snapshot["schema_version"] == 1
    assert source.issuer_snapshot["entity"]["type"] == "COMERCIAL"
    assert len(source.lines) == 1
    assert source.lines[0].quantity == "2"
    assert source.lines[0].total_amount == "23.00"
    assert source.return_ids == ()
    assert not source.has_void
    with pytest.raises(FrozenInstanceError):
        source.state = "VOIDED"  # type: ignore[misc]


def test_locking_read_returns_same_source_without_mutating_sale(confirmed_sale: Any) -> None:
    from sales.application.fiscal_source import lock_fiscal_source, read_fiscal_source

    built = confirmed_sale()
    before = Sale.objects.get(pk=built["id"])
    with transaction.atomic():
        locked = lock_fiscal_source(built["id"])
    current = Sale.objects.get(pk=built["id"])

    assert locked == read_fiscal_source(built["id"])
    assert (current.state, current.version, current.internal_number) == (
        before.state,
        before.version,
        before.internal_number,
    )


def _payment(sale: Sale, user: Any, parts: dict[str, str]) -> Any:
    from datetime import date
    from decimal import Decimal
    from uuid import uuid4

    from django.utils import timezone

    from sales.models import CommercialPayment, PaymentPart

    payment = CommercialPayment.objects.create(
        operation_id=uuid4(),
        sale=sale,
        amount=sum((Decimal(v) for v in parts.values()), Decimal("0")),
        effective_at=timezone.now(),
        effective_date=date(2026, 9, 26),
        created_by=user,
    )
    for method, amount in parts.items():
        PaymentPart.objects.create(payment=payment, method=method, amount=Decimal(amount))
    return payment


def test_collected_by_method_counts_only_current_payments(confirmed_sale: Any, seller: Any) -> None:
    from uuid import uuid4

    from sales.application.fiscal_source import read_fiscal_source
    from sales.models import PaymentCorrection

    built = confirmed_sale(price="50.00", quantity=2)
    sale = Sale.objects.get(pk=built["id"])
    assert read_fiscal_source(sale.pk).collected_by_method == {}

    original = _payment(sale, seller, {"EFECTIVO": "30.00"})
    _payment(sale, seller, {"EFECTIVO": "10.00", "TRANSFERENCIA": "20.00"})
    replacement = _payment(sale, seller, {"TRANSFERENCIA": "25.00"})
    PaymentCorrection.objects.create(
        operation_id=uuid4(),
        sale=sale,
        original_payment=original,
        replacement_payment=replacement,
        reason="Medio equivocado",
        created_by=seller,
    )
    collected = read_fiscal_source(sale.pk).collected_by_method
    assert {method: str(amount) for method, amount in collected.items()} == {
        "EFECTIVO": "10.00",
        "TRANSFERENCIA": "45.00",
    }
    with pytest.raises(TypeError):
        collected["EFECTIVO"] = 0  # type: ignore[index]


def test_withholding_is_never_a_payment_form_and_needs_no_preparation(
    confirmed_sale: Any, seller: Any
) -> None:
    from fiscal.domain.payment_suggestion import suggest_payment_forms
    from fiscal.models import FiscalPreparation
    from sales.application.fiscal_source import read_fiscal_source

    from .test_withholdings import parts, settle

    built = confirmed_sale(price="250.00")
    settle(seller, built["id"], parts(transfer="245.00"), "5.00")
    assert not FiscalPreparation.objects.exists()

    source = read_fiscal_source(built["id"])
    assert {m: str(a) for m, a in source.collected_by_method.items()} == {"TRANSFERENCIA": "245.00"}
    assert source.grand_total == "250.00"
    suggestion = suggest_payment_forms(
        total=source.grand_total,
        collected=source.collected_by_method,
        enabled_forms={"EFECTIVO": "01", "TRANSFERENCIA": "20"},
        default_code="01",
    )
    assert {form.payment_code: form.amount for form in suggestion.forms} == {
        "01": "5.00",
        "20": "245.00",
    }
    assert sum(float(form.amount) for form in suggestion.forms) == 250.0


# --- Saldo pendiente expuesto por el módulo dueño (DP-035, diseño 6) -----------------------------


def test_pending_balance_without_collections_is_the_whole_total(confirmed_sale: Any) -> None:
    from sales.application.fiscal_source import read_fiscal_source

    built = confirmed_sale(price="50.00", condition="CREDITO")
    source = read_fiscal_source(built["id"])
    assert (source.grand_total, source.pending_balance) == ("50.00", "50.00")


def test_pending_balance_subtracts_current_payments(confirmed_sale: Any, seller: Any) -> None:
    from sales.application.fiscal_source import read_fiscal_source

    built = confirmed_sale(price="100.00", condition="CREDITO")
    _payment(Sale.objects.get(pk=built["id"]), seller, {"EFECTIVO": "40.00"})
    assert read_fiscal_source(built["id"]).pending_balance == "60.00"


def test_pending_balance_is_zero_when_a_withholding_covers_the_rest(
    confirmed_sale: Any, seller: Any
) -> None:
    from sales.application.fiscal_source import read_fiscal_source

    from .test_withholdings import parts, settle

    built = confirmed_sale(price="250.00", condition="CREDITO")
    settle(seller, built["id"], parts(transfer="245.00"), "5.00")
    assert read_fiscal_source(built["id"]).pending_balance == "0.00"


def test_pending_balance_follows_the_amount_still_due_after_a_return(
    confirmed_sale: Any, admin: Any
) -> None:
    from sales.application.fiscal_source import read_fiscal_source

    from .test_returns import do_return, item, line_id, request

    built = confirmed_sale(price="10.00", quantity=5, condition="CREDITO")
    do_return(admin, built["id"], request([item(line_id(built["id"]), fit=2)]))
    source = read_fiscal_source(built["id"])
    assert (source.grand_total, source.pending_balance) == ("50.00", "30.00")


def test_pending_balance_never_goes_negative(confirmed_sale: Any, seller: Any) -> None:
    from sales.application.fiscal_source import read_fiscal_source

    built = confirmed_sale(price="30.00", condition="CONTADO")
    _payment(Sale.objects.get(pk=built["id"]), seller, {"EFECTIVO": "30.00"})
    assert read_fiscal_source(built["id"]).pending_balance == "0.00"
