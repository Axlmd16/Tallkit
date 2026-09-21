"""Importes y costos de devoluciones parciales con residuos sobre valores históricos."""

from decimal import Decimal

import pytest

from sales.domain.amounts import AmountValidationError
from sales.domain.returns import (
    ReturnValidationError,
    allocate_return_cost,
    calculate_return_amounts,
    ensure_cumulative_amounts,
    ensure_return_quantity,
    receivable_after_returns,
)

D = Decimal


def test_historical_example_returns_one_of_two_units_at_original_price_and_rate() -> None:
    amounts = calculate_return_amounts(
        unit_price=D("11.50"),
        original_base=D("20.00"),
        sold_quantity=D(2),
        previously_returned=D(0),
        quantity=D(1),
    )
    assert (amounts.total, amounts.base, amounts.tax) == (D("11.50"), D("10.00"), D("1.50"))


def test_successive_returns_absorb_the_residue() -> None:
    results = []
    returned = D(0)
    for _ in range(3):
        results.append(
            calculate_return_amounts(
                unit_price=D("0.05"),
                original_base=D("0.13"),
                sold_quantity=D(3),
                previously_returned=returned,
                quantity=D(1),
            )
        )
        returned += 1
    assert [r.base for r in results] == [D("0.04"), D("0.05"), D("0.04")]
    assert [r.tax for r in results] == [D("0.01"), D("0.00"), D("0.01")]
    assert [r.total for r in results] == [D("0.05")] * 3
    assert sum(r.base for r in results) == D("0.13")
    assert sum(r.tax for r in results) == D("0.02")


def test_a_single_return_of_everything_restores_the_original_amounts() -> None:
    amounts = calculate_return_amounts(D("0.05"), D("0.13"), D(3), D(0), D(3))
    assert (amounts.total, amounts.base, amounts.tax) == (D("0.15"), D("0.13"), D("0.02"))


def test_cost_allocation_uses_cumulative_proportion_with_fit_before_unfit() -> None:
    # Valor histórico 10.000000 en 3 unidades; se devuelve 1 apta y 1 no apta.
    first = allocate_return_cost(D("10.000000"), D(3), D(0), fit_quantity=D(1), unfit_quantity=D(1))
    assert first.fit_value == D("3.333333")
    assert first.unfit_value == D("3.333334")
    last = allocate_return_cost(D("10.000000"), D(3), D(2), fit_quantity=D(1), unfit_quantity=D(0))
    assert last.fit_value == D("3.333333")
    assert first.fit_value + first.unfit_value + last.fit_value == D("10.000000")


def test_last_returned_tranche_exhausts_the_line_residue() -> None:
    values = []
    returned = D(0)
    for _ in range(3):
        values.append(allocate_return_cost(D("1.000000"), D(3), returned, D(1), D(0)).fit_value)
        returned += 1
    assert values == [D("0.333333"), D("0.333334"), D("0.333333")]
    assert sum(values) == D("1.000000")


def test_returning_every_unit_as_fit_restores_exactly_the_historical_value() -> None:
    allocation = allocate_return_cost(D("7.777777"), D(7), D(0), D(7), D(0))
    assert allocation.fit_value == D("7.777777")
    assert allocation.unfit_value == D("0.000000")


def test_mixed_return_never_reimburses_the_value_assigned_to_unfit_units() -> None:
    allocation = allocate_return_cost(D("10.000000"), D(4), D(0), D(2), D(2))
    assert allocation.fit_value == D("5.000000")
    assert allocation.unfit_value == D("5.000000")
    assert allocation.fit_value < D("10.000000")


def test_rejects_accumulated_quantity_above_sold() -> None:
    ensure_return_quantity(sold=D(3), previously_returned=D(1), requested=D(2))
    with pytest.raises(ReturnValidationError):
        ensure_return_quantity(sold=D(3), previously_returned=D(2), requested=D(2))
    with pytest.raises(ReturnValidationError):
        ensure_return_quantity(sold=D(3), previously_returned=D(0), requested=D(0))


def test_rejects_accumulated_amounts_above_original() -> None:
    ensure_cumulative_amounts(
        original_total=D("1.00"),
        original_base=D("0.90"),
        returned_total=D("1.00"),
        returned_base=D("0.90"),
    )
    with pytest.raises(ReturnValidationError):
        ensure_cumulative_amounts(
            original_total=D("1.00"),
            original_base=D("0.90"),
            returned_total=D("1.01"),
            returned_base=D("0.90"),
        )
    with pytest.raises(ReturnValidationError):
        ensure_cumulative_amounts(
            original_total=D("1.00"),
            original_base=D("0.90"),
            returned_total=D("1.00"),
            returned_base=D("0.91"),
        )


def test_negative_derived_receivable_is_rejected() -> None:
    assert receivable_after_returns(D("100.00"), D("20.00")) == D("80.00")
    with pytest.raises(ReturnValidationError):
        receivable_after_returns(D("100.00"), D("100.01"))


def test_amount_errors_are_reported_for_invalid_inputs() -> None:
    with pytest.raises(AmountValidationError):
        calculate_return_amounts(D("1.00"), D("1.00"), D(0), D(0), D(1))
