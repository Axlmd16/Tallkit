"""Importes de compra: redondeo HALF_UP por línea, impuesto y valor inventariable."""

from decimal import Decimal

import pytest

from purchasing.domain.amounts import (
    AmountValidationError,
    InventoryTaxTreatment,
    calculate_document_totals,
    calculate_line,
    parse_quantity,
    parse_unit_cost,
)

D = Decimal
RECOVERABLE = InventoryTaxTreatment.RECOVERABLE
NON_RECOVERABLE = InventoryTaxTreatment.NON_RECOVERABLE


def test_line_amounts_use_rounded_base_tax_and_total() -> None:
    line = calculate_line(D(2), D("10.00"), D(10), RECOVERABLE)
    assert (line.base, line.tax, line.total) == (D("20.00"), D("2.00"), D("22.00"))


def test_rounding_happens_per_line_and_document_sums_rounded_lines() -> None:
    first = calculate_line(D(1), D("0.335"), D(10), RECOVERABLE)
    second = calculate_line(D(1), D("0.335"), D(10), RECOVERABLE)
    assert (first.base, first.tax) == (D("0.34"), D("0.03"))
    totals = calculate_document_totals([first, second])
    assert (totals.base, totals.tax, totals.total) == (D("0.68"), D("0.06"), D("0.74"))


def test_tax_is_computed_on_the_already_rounded_base() -> None:
    # 3 x 0.335 = 1.005 → base 1.01 (HALF_UP); 10 % de 1.01 = 0.101 → 0.10
    line = calculate_line(D(3), D("0.335"), D(10), RECOVERABLE)
    assert (line.base, line.tax) == (D("1.01"), D("0.10"))


def test_recoverable_tax_is_excluded_from_inventory_value() -> None:
    line = calculate_line(D(2), D("10.00"), D(10), RECOVERABLE)
    assert line.inventory_value == D("20.00")


def test_non_recoverable_tax_is_added_to_inventory_value() -> None:
    line = calculate_line(D(2), D("10.00"), D(10), NON_RECOVERABLE)
    assert line.inventory_value == D("22.00")


@pytest.mark.parametrize("value", [None, "", "PARTIAL", "recoverable"])
def test_treatment_must_be_explicit_and_binary(value: object) -> None:
    with pytest.raises(AmountValidationError) as error:
        InventoryTaxTreatment.parse(value)
    assert "tax_treatment" in error.value.errors


@pytest.mark.parametrize("value", ["0", "1.5", "-1", "1.000001", "abc", "NaN", "Infinity", "1e3"])
def test_invalid_quantities_are_rejected_without_truncating(value: str) -> None:
    with pytest.raises(AmountValidationError) as error:
        parse_quantity(value)
    assert "quantity" in error.value.errors


def test_quantity_accepts_whole_values_including_trailing_zero_fraction() -> None:
    assert parse_quantity("3") == D(3)
    assert parse_quantity("3.000000") == D(3)
    assert parse_quantity(7) == D(7)


def test_quantity_range_limit() -> None:
    assert parse_quantity("999999999999") == D("999999999999")
    with pytest.raises(AmountValidationError):
        parse_quantity("1000000000000")


@pytest.mark.parametrize(
    "value",
    ["-0.01", "1.0000001", "NaN", "-Infinity", "Infinity", "1,5", "", "1e2", "1000000000000"],
)
def test_invalid_unit_costs_are_rejected_without_rounding(value: str) -> None:
    with pytest.raises(AmountValidationError) as error:
        parse_unit_cost(value)
    assert "unit_cost" in error.value.errors


def test_unit_cost_accepts_zero_and_six_decimals() -> None:
    assert parse_unit_cost("0") == D(0)
    assert parse_unit_cost("0.123456") == D("0.123456")
    assert parse_unit_cost("999999999999.999999") == D("999999999999.999999")


@pytest.mark.parametrize("bad", [1.5, True, None, [1]])
def test_non_text_non_decimal_inputs_are_rejected(bad: object) -> None:
    with pytest.raises(AmountValidationError):
        parse_unit_cost(bad)
    with pytest.raises(AmountValidationError):
        parse_quantity(bad)


def test_explicit_zero_rate_is_accepted_with_zero_tax() -> None:
    line = calculate_line(D(2), D("10.00"), D(0), RECOVERABLE)
    assert (line.tax, line.total) == (D("0.00"), D("20.00"))


def test_missing_rate_is_not_converted_into_an_exemption() -> None:
    with pytest.raises(AmountValidationError) as error:
        calculate_line(D(2), D("10.00"), None, RECOVERABLE)
    assert "tax_rate" in error.value.errors


def test_amounts_do_not_depend_on_the_global_decimal_context() -> None:
    import decimal

    with decimal.localcontext() as ctx:
        ctx.prec = 3
        line = calculate_line(D("999999999999"), D("999999999999.999999"), D(15), NON_RECOVERABLE)
    reference = calculate_line(D("999999999999"), D("999999999999.999999"), D(15), NON_RECOVERABLE)
    assert line == reference
    assert line.base == D("999999999998999999000000.00")
