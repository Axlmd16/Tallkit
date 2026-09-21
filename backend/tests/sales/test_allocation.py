"""Reparto del valor de salida realmente aplicado entre líneas del mismo producto."""

from decimal import Decimal

import pytest

from sales.domain.allocation import AllocationLine, allocate_output_value
from sales.domain.amounts import AmountValidationError

D = Decimal


def test_value_is_split_by_quantity_with_residue_from_cumulative_proportion() -> None:
    lines = [AllocationLine(1, D(1)), AllocationLine(2, D(1)), AllocationLine(3, D(1))]
    result = allocate_output_value(lines, D("1.000000"))
    assert result == {1: D("0.333333"), 2: D("0.333334"), 3: D("0.333333")}
    assert sum(result.values()) == D("1.000000")


def test_repeated_lines_of_same_product_sum_to_published_value_not_quantity_times_cost() -> None:
    # Inventario publicó 10.000001 por 3 unidades; cantidad x costo publicado (3.333334) = 10.000002
    lines = [AllocationLine(1, D(1)), AllocationLine(2, D(2))]
    result = allocate_output_value(lines, D("10.000001"))
    assert sum(result.values()) == D("10.000001")
    assert result[1] == D("3.333334")
    assert result[2] == D("6.666667")
    assert sum(result.values()) != D("3.333334") * 3


def test_stable_position_order_is_independent_of_input_order() -> None:
    lines = [AllocationLine(3, D(1)), AllocationLine(1, D(1)), AllocationLine(2, D(1))]
    assert allocate_output_value(lines, D("1.000000")) == {
        1: D("0.333333"),
        2: D("0.333334"),
        3: D("0.333333"),
    }


def test_single_line_takes_the_whole_value() -> None:
    assert allocate_output_value([AllocationLine(1, D(5))], D("7.123457")) == {1: D("7.123457")}


def test_rejects_empty_lines_and_non_positive_quantities() -> None:
    with pytest.raises(AmountValidationError):
        allocate_output_value([], D("1.000000"))
    with pytest.raises(AmountValidationError):
        allocate_output_value([AllocationLine(1, D(0))], D("1.000000"))
