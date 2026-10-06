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
    validate_settlement,
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


# --- Retenciones recibidas -------------------------------------------------


def test_withholding_completes_the_balance_without_counting_as_money() -> None:
    result = compute_balance(D("250.00"), D("245.00"), D("0.00"), D("5.00"))
    assert result.balance == D("0.00")
    assert result.state is PaymentState.PAID
    assert result.withheld == D("5.00")
    assert result.applied == D("250.00")
    assert result.excess == D("0.00")
    assert result.withheld_excess == D("0.00")


def test_withholding_alone_is_a_partial_application() -> None:
    result = compute_balance(D("100.00"), D("0.00"), D("0.00"), D("2.00"))
    assert (result.balance, result.state) == (D("98.00"), PaymentState.PARTIAL)


def test_excess_after_a_return_is_limited_to_the_money_collected() -> None:
    result = compute_balance(D("0.00"), D("245.00"), D("0.00"), D("5.00"))
    assert result.balance == D("0.00")
    assert result.excess == D("245.00")
    assert result.withheld_excess == D("5.00")


def test_excess_is_withheld_only_when_no_money_remains() -> None:
    result = compute_balance(D("0.00"), D("245.00"), D("245.00"), D("5.00"))
    assert (result.excess, result.withheld_excess) == (D("0.00"), D("5.00"))


@pytest.mark.parametrize(
    ("exigible", "paid", "refunded"),
    [
        ("100.00", "0.00", "0.00"),
        ("100.00", "30.00", "0.00"),
        ("100.00", "100.00", "0.00"),
        ("80.00", "100.00", "0.00"),
        ("80.00", "100.00", "20.00"),
        ("0.00", "0.00", "0.00"),
    ],
)
def test_balance_without_withholding_matches_the_previous_result(
    exigible: str, paid: str, refunded: str
) -> None:
    plain = compute_balance(D(exigible), D(paid), D(refunded))
    explicit = compute_balance(D(exigible), D(paid), D(refunded), D("0.00"))
    assert plain == explicit
    assert plain.withheld == D("0.00")
    assert plain.withheld_excess == D("0.00")
    applied = D(paid) - D(refunded)
    assert plain.applied == applied
    assert plain.balance == max(D(exigible) - applied, D("0.00"))
    assert plain.excess == max(applied - D(exigible), D("0.00"))


def test_settlement_accepts_money_plus_withholding_in_cash_sales() -> None:
    validate_settlement(PaymentCondition.CONTADO, D("250.00"), D("245.00"), D("5.00"))


def test_settlement_accepts_withholding_alone_on_credit() -> None:
    validate_settlement(PaymentCondition.CREDITO, D("5.00"), D("0.00"), D("5.00"))


@pytest.mark.parametrize(
    ("condition", "balance", "money", "withheld", "field"),
    [
        (PaymentCondition.CONTADO, "250.00", "200.00", "5.00", "amount"),
        (PaymentCondition.CREDITO, "5.00", "0.00", "5.01", "withholding"),
        (PaymentCondition.CREDITO, "10.00", "8.00", "5.00", "amount"),
        (PaymentCondition.CREDITO, "10.00", "0.00", "0.00", "amount"),
        (PaymentCondition.CREDITO, "10.00", "-1.00", "5.00", "amount"),
        (PaymentCondition.CREDITO, "10.00", "5.00", "-1.00", "withholding"),
        (PaymentCondition.CREDITO, "0.00", "0.00", "5.00", "amount"),
    ],
)
def test_settlement_rejects_invalid_combinations(
    condition: PaymentCondition, balance: str, money: str, withheld: str, field: str
) -> None:
    with pytest.raises(ChargeRejectedError) as error:
        validate_settlement(condition, D(balance), D(money), D(withheld))
    assert field in error.value.errors


def test_charge_validation_still_behaves_as_before() -> None:
    validate_charge(PaymentCondition.CREDITO, D("10.00"), D("4.00"))
    with pytest.raises(ChargeRejectedError):
        validate_charge(PaymentCondition.CONTADO, D("10.00"), D("4.00"))
    with pytest.raises(ChargeRejectedError):
        validate_charge(PaymentCondition.CREDITO, D("10.00"), D("0.00"))
