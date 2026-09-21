"""Importes de venta: total = cantidad x precio final; base por redondeo HALF_UP."""

from decimal import Decimal

import pytest

from sales.domain.amounts import (
    MONEY_MAX,
    AmountValidationError,
    calculate_document_totals,
    calculate_line,
    parse_price,
    parse_quantity,
)

D = Decimal


def test_line_breakdown_from_final_price_with_included_tax() -> None:
    line = calculate_line(D(2), D("11.50"), D(15))
    assert (line.total, line.base, line.tax) == (D("23.00"), D("20.00"), D("3.00"))


def test_half_cent_base_rounds_half_up_and_keeps_line_total() -> None:
    line = calculate_line(D(1), D("0.03"), D(20))
    assert (line.base, line.tax, line.total) == (D("0.03"), D("0.00"), D("0.03"))


def test_document_totals_sum_already_rounded_lines_without_global_recalculation() -> None:
    first = calculate_line(D(1), D("0.03"), D(20))
    second = calculate_line(D(1), D("0.03"), D(20))
    totals = calculate_document_totals([first, second])
    assert (totals.base, totals.tax, totals.total) == (D("0.06"), D("0.00"), D("0.06"))


def test_explicit_zero_rate_yields_zero_tax() -> None:
    line = calculate_line(D(3), D("4.00"), D(0))
    assert (line.base, line.tax, line.total) == (D("12.00"), D("0.00"), D("12.00"))


def test_missing_rate_is_an_error_never_an_exemption() -> None:
    with pytest.raises(AmountValidationError) as error:
        calculate_line(D(1), D("4.00"), None)
    assert "tax_rate" in error.value.errors


@pytest.mark.parametrize("value", ["0", "-1", "1.5", "2.0001", "abc", "", "NaN", "Infinity", "1e3"])
def test_quantity_rejects_zero_negative_fractional_and_non_finite(value: str) -> None:
    with pytest.raises(AmountValidationError) as error:
        parse_quantity(value)
    assert "quantity" in error.value.errors


@pytest.mark.parametrize("value", [1.0, True, None, [1]])
def test_quantity_rejects_binary_floats_booleans_and_other_types(value: object) -> None:
    with pytest.raises(AmountValidationError):
        parse_quantity(value)


def test_quantity_accepts_whole_numbers_and_rejects_overflow() -> None:
    assert parse_quantity("12") == D(12)
    assert parse_quantity(3) == D(3)
    with pytest.raises(AmountValidationError):
        parse_quantity("1000000000000")


@pytest.mark.parametrize("value", ["1.001", "-0.01", "x", "NaN", "Infinity", "1e2", 1.5, True])
def test_price_rejects_more_than_two_decimals_negatives_and_non_finite(value: object) -> None:
    with pytest.raises(AmountValidationError) as error:
        parse_price(value)
    assert "unit_price" in error.value.errors


def test_price_is_never_truncated_or_rounded() -> None:
    assert parse_price("11.50") == D("11.50")
    assert parse_price("0") == D("0")
    with pytest.raises(AmountValidationError):
        parse_price("11.505")


def test_price_rejects_overflow() -> None:
    with pytest.raises(AmountValidationError):
        parse_price(str(MONEY_MAX + D("0.01")))


def test_line_total_overflow_is_rejected() -> None:
    with pytest.raises(AmountValidationError) as error:
        calculate_line(D("999999999999"), MONEY_MAX, D(15))
    assert "total" in error.value.errors


def test_document_total_overflow_is_rejected() -> None:
    big = calculate_line(D(1), MONEY_MAX, D(0))
    with pytest.raises(AmountValidationError) as error:
        calculate_document_totals([big, calculate_line(D(1), D("0.01"), D(0))])
    assert "total" in error.value.errors


def test_zero_total_sale_is_valid_with_zero_amounts() -> None:
    line = calculate_line(D(2), D("0.00"), D(15))
    totals = calculate_document_totals([line])
    assert (totals.base, totals.tax, totals.total) == (D("0.00"), D("0.00"), D("0.00"))
