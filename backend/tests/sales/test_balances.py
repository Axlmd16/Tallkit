"""Saldo, exceso y estado de pago derivados de E, P y R; condición de la venta."""

from decimal import Decimal

import pytest

from sales.domain.balances import (
    ChargeRejectedError,
    PaymentCondition,
    PaymentState,
    compute_balance,
    validate_charge,
)

D = Decimal


@pytest.mark.parametrize(
    ("exigible", "paid", "refunded", "applied", "balance", "state", "excess"),
    [
        ("100.00", "30.00", "0.00", "30.00", "70.00", PaymentState.PARTIAL, "0.00"),
        ("100.00", "100.00", "0.00", "100.00", "0.00", PaymentState.PAID, "0.00"),
        ("100.00", "0.00", "0.00", "0.00", "100.00", PaymentState.PENDING, "0.00"),
        ("80.00", "100.00", "0.00", "100.00", "0.00", PaymentState.PAID, "20.00"),
        ("80.00", "100.00", "20.00", "80.00", "0.00", PaymentState.PAID, "0.00"),
        ("80.00", "60.00", "0.00", "60.00", "20.00", PaymentState.PARTIAL, "0.00"),
    ],
)
def test_balance_excess_and_state_follow_the_approved_formulas(
    exigible: str,
    paid: str,
    refunded: str,
    applied: str,
    balance: str,
    state: PaymentState,
    excess: str,
) -> None:
    result = compute_balance(D(exigible), D(paid), D(refunded))
    assert result.applied == D(applied)
    assert result.balance == D(balance)
    assert result.excess == D(excess)
    assert result.state is state


def test_return_reducing_receivable_of_partially_paid_sale_keeps_it_partial() -> None:
    result = compute_balance(D("80.00"), D("60.00"), D("0.00"))
    assert (result.balance, result.state, result.excess) == (D("20.00"), PaymentState.PARTIAL, D(0))


def test_zero_amount_sale_has_no_debt_and_rejects_any_charge() -> None:
    result = compute_balance(D("0.00"), D("0.00"), D("0.00"))
    assert (result.balance, result.excess, result.state) == (
        D("0.00"),
        D("0.00"),
        PaymentState.PAID,
    )
    assert result.is_settled_without_payment
    for condition in PaymentCondition:
        with pytest.raises(ChargeRejectedError):
            validate_charge(condition, result.balance, D("0.01"))


def test_cash_sale_requires_charge_equal_to_balance() -> None:
    validate_charge(PaymentCondition.CONTADO, D("50.00"), D("50.00"))
    with pytest.raises(ChargeRejectedError):
        validate_charge(PaymentCondition.CONTADO, D("50.00"), D("20.00"))


def test_credit_sale_accepts_partial_payments_up_to_balance_only() -> None:
    validate_charge(PaymentCondition.CREDITO, D("50.00"), D("20.00"))
    validate_charge(PaymentCondition.CREDITO, D("50.00"), D("50.00"))
    with pytest.raises(ChargeRejectedError):
        validate_charge(PaymentCondition.CREDITO, D("50.00"), D("50.01"))


@pytest.mark.parametrize("amount", ["0", "0.00", "-1.00"])
def test_charge_must_be_positive(amount: str) -> None:
    with pytest.raises(ChargeRejectedError):
        validate_charge(PaymentCondition.CREDITO, D("50.00"), D(amount))


def test_credit_is_a_condition_and_never_a_payment_method() -> None:
    from sales.domain.balances import PaymentMethod

    assert {method.value for method in PaymentMethod} == {"EFECTIVO", "TRANSFERENCIA"}
    assert PaymentMethod.parse("EFECTIVO") is PaymentMethod.EFECTIVO
    with pytest.raises(ChargeRejectedError):
        PaymentMethod.parse("CREDITO")


def test_credit_condition_has_no_due_date_installments_or_interest() -> None:
    assert not hasattr(PaymentCondition.CREDITO, "due_date")
    assert {c.value for c in PaymentCondition} == {"CONTADO", "CREDITO"}
