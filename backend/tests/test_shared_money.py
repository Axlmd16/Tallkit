"""Reglas monetarias puras compartidas por los dos RUC."""

from decimal import Decimal

import pytest

from shared.money import (
    AmountValidationError,
    ChargeRejectedError,
    PaymentCondition,
    PaymentMethod,
    PaymentState,
    calculate_document_totals,
    calculate_line,
    compute_balance,
    parse_amount,
    validate_charge,
)

D = Decimal


@pytest.mark.parametrize("value", ["1.001", "-0.01", "x", "NaN", "Infinity", "1e2", 1.5, True])
def test_amount_rejects_excess_precision_negative_and_non_decimal_input(value: object) -> None:
    with pytest.raises(AmountValidationError) as error:
        parse_amount(value, "amount", "El importe")
    assert "amount" in error.value.errors


def test_amount_accepts_two_decimals_without_silent_rounding() -> None:
    assert parse_amount("11.50", "amount", "El importe") == D("11.50")
    assert parse_amount("0", "amount", "El importe") == D("0.00")


def test_inclusive_tax_breakdown_uses_half_up_and_keeps_line_total() -> None:
    line = calculate_line(D(2), D("11.50"), D(15))
    assert (line.total, line.base, line.tax) == (D("23.00"), D("20.00"), D("3.00"))

    half_cent = calculate_line(D(1), D("0.03"), D(20))
    assert (half_cent.base, half_cent.tax, half_cent.total) == (
        D("0.03"),
        D("0.00"),
        D("0.03"),
    )


def test_document_totals_sum_already_rounded_lines() -> None:
    lines = [calculate_line(D(1), D("0.03"), D(20)) for _ in range(2)]
    totals = calculate_document_totals(lines)
    assert (totals.base, totals.tax, totals.total) == (D("0.06"), D("0.00"), D("0.06"))


@pytest.mark.parametrize(
    ("exigible", "paid", "refunded", "applied", "balance", "state", "excess"),
    [
        ("100.00", "30.00", "0.00", "30.00", "70.00", PaymentState.PARTIAL, "0.00"),
        ("100.00", "100.00", "0.00", "100.00", "0.00", PaymentState.PAID, "0.00"),
        ("100.00", "0.00", "0.00", "0.00", "100.00", PaymentState.PENDING, "0.00"),
        ("80.00", "100.00", "0.00", "100.00", "0.00", PaymentState.PAID, "20.00"),
        ("80.00", "100.00", "20.00", "80.00", "0.00", PaymentState.PAID, "0.00"),
    ],
)
def test_balance_is_derived_from_exigible_payments_and_refunds(
    exigible: str,
    paid: str,
    refunded: str,
    applied: str,
    balance: str,
    state: PaymentState,
    excess: str,
) -> None:
    result = compute_balance(D(exigible), D(paid), D(refunded))
    assert (result.applied, result.balance, result.state, result.excess) == (
        D(applied),
        D(balance),
        state,
        D(excess),
    )


def test_charge_validation_keeps_condition_separate_from_real_payment_method() -> None:
    validate_charge(PaymentCondition.CONTADO, D("50.00"), D("50.00"))
    validate_charge(PaymentCondition.CREDITO, D("50.00"), D("20.00"))

    with pytest.raises(ChargeRejectedError):
        validate_charge(PaymentCondition.CONTADO, D("50.00"), D("20.00"))
    with pytest.raises(ChargeRejectedError):
        validate_charge(PaymentCondition.CREDITO, D("50.00"), D("50.01"))
    with pytest.raises(ChargeRejectedError):
        PaymentMethod.parse("CREDITO")
