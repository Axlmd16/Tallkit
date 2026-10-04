"""Valoración por promedio ponderado con residuos de redondeo trazables."""

from decimal import Decimal

import pytest

from inventory.domain.validation import (
    InsufficientStockError,
    InventoryValidationError,
    parse_entry_value,
    parse_movement_quantity,
)
from inventory.domain.valuation import (
    EMPTY_POSITION,
    Position,
    apply_entry,
    apply_exit,
    receive_entry,
    reverse_exactly,
)

D = Decimal


def position(quantity: str, value: str, average: str) -> Position:
    return Position(D(quantity), D(value), D(average))


def test_weighted_average_after_an_entry() -> None:
    after = apply_entry(position("10", "20.00", "2.000000"), D(5), D("20.00"))
    assert (after.quantity, after.value, after.average) == (D(15), D("40.000000"), D("2.666667"))


def test_terminal_residue_is_absorbed_by_the_last_exit() -> None:
    current = position("3", "1.000000", "0.333333")
    applied = []
    for _ in range(3):
        result = apply_exit(current, D(1))
        applied.append(result.applied_value)
        current = result.position
    assert applied == [D("0.333333"), D("0.333333"), D("0.333334")]
    assert current == EMPTY_POSITION
    assert (current.quantity, current.value, current.average) == (D(0), D(0), D(0))


def test_partial_exit_keeps_average_and_never_exceeds_retained_value() -> None:
    # Valor conservado inferior al nominal: se acota con min y se registra el ajuste.
    current = position("100", "0.000050", "0.000333")
    result = apply_exit(current, D(1))
    assert result.nominal_value == D("0.000333")
    assert result.applied_value == D("0.000050")
    assert result.rounding_adjustment == D("-0.000283")
    assert result.position.value == D(0)
    assert result.position.average == D("0.000333")  # no se recalcula
    assert result.position.quantity == D(99)


def test_regular_partial_exit_has_no_adjustment() -> None:
    result = apply_exit(position("10", "20.000000", "2.000000"), D(4))
    assert result.applied_value == D("8.000000")
    assert result.rounding_adjustment == D(0)
    assert result.position == position("6", "12.000000", "2.000000")


def test_entry_after_depletion_does_not_carry_old_value() -> None:
    after = apply_entry(EMPTY_POSITION, D(2), D("7.00"))
    assert after.average == D("3.500000")
    assert after.value == D("7.000000")


def test_exact_reversal_restores_previous_quantity_value_and_average() -> None:
    before = position("3", "1.000000", "0.333333")
    exited = apply_exit(before, D(3))
    restored = reverse_exactly(exited.position, before=before, after=exited.position)
    assert restored == before


def test_exact_reversal_of_an_entry_restores_residue() -> None:
    before = position("3", "1.000000", "0.333333")
    after = apply_entry(before, D(2), D("1.000000"))
    assert reverse_exactly(after, before=before, after=after) == before


def test_reversal_is_blocked_when_position_moved_after_the_original() -> None:
    before = position("3", "1.000000", "0.333333")
    after = apply_entry(before, D(2), D("1.000000"))
    moved = apply_exit(after, D(1)).position
    with pytest.raises(InventoryValidationError):
        reverse_exactly(moved, before=before, after=after)


def test_insufficient_stock_fails_before_valuing() -> None:
    with pytest.raises(InsufficientStockError) as error:
        apply_exit(position("2", "4.000000", "2.000000"), D(3))
    assert (error.value.available, error.value.requested) == (D(2), D(3))
    with pytest.raises(InsufficientStockError):
        apply_exit(EMPTY_POSITION, D(1))


def test_large_quantities_and_tiny_costs_keep_value_non_negative() -> None:
    current = apply_entry(EMPTY_POSITION, D("999999999999"), D("0.000001"))
    assert current.average == D("0.000000")
    result = apply_exit(current, D("999999999998"))
    assert result.position.value >= 0
    assert result.applied_value <= D("0.000001")
    last = apply_exit(result.position, D(1))
    assert last.position == EMPTY_POSITION


def test_long_alternating_sequences_lose_no_value() -> None:
    current = EMPTY_POSITION
    total_in = D(0)
    total_out = D(0)
    for step in range(1, 400):
        entry_value = D(step % 7 + 1) / D(3)
        entry_value = entry_value.quantize(D("0.000001"))
        quantity = D(step % 5 + 1)
        current = apply_entry(current, quantity, entry_value)
        total_in += entry_value
        if step % 2 == 0 and current.quantity > 1:
            result = apply_exit(current, D(1))
            total_out += result.applied_value
            current = result.position
        assert current.value >= 0
    final = apply_exit(current, current.quantity)
    total_out += final.applied_value
    assert final.position == EMPTY_POSITION
    assert total_in == total_out  # cada centésima de valor entrante sale exactamente


@pytest.mark.parametrize("value", ["0", "-1", "1.5", "NaN", "abc", "1000000000000"])
def test_movement_quantity_rejects_invalid_values(value: str) -> None:
    with pytest.raises(InventoryValidationError):
        parse_movement_quantity(value)


def test_movement_quantity_accepts_whole_positive_values() -> None:
    assert parse_movement_quantity("12") == D(12)


@pytest.mark.parametrize("value", ["-0.01", "0.0000001", "NaN", "Infinity", "x"])
def test_entry_value_rejects_invalid_values_without_rounding(value: str) -> None:
    with pytest.raises(InventoryValidationError):
        parse_entry_value(value)


def test_entry_value_accepts_zero_and_six_decimals() -> None:
    assert parse_entry_value("0") == D(0)
    assert parse_entry_value("12.123456") == D("12.123456")


# --- Entradas sin costo registrado (simplificar-entradas-de-stock-por-vendedor) ----------


def unvalued(quantity: str) -> Position:
    return Position(D(quantity), D("0.000000"), D("0.000000"), valued=False)


def test_entry_with_cost_on_a_valued_position_keeps_the_weighted_average() -> None:
    result = receive_entry(position("10", "20.00", "2.000000"), D(5), D("20.00"))
    assert (result.position.quantity, result.position.value) == (D(15), D("40.000000"))
    assert result.position.average == D("2.666667")
    assert result.position.valued is True
    assert result.value_delta == D("20.000000")
    assert result.regularization_value == D(0)


def test_first_costed_entry_values_the_previous_units_at_its_cost() -> None:
    result = receive_entry(unvalued("5"), D(5), D("10.00"))
    assert (result.position.quantity, result.position.value) == (D(10), D("20.000000"))
    assert result.position.average == D("2.000000")
    assert result.position.valued is True
    assert result.regularization_value == D("10.000000")
    assert result.value_delta == D("20.000000")


def test_explicit_zero_cost_is_known_and_distinct_from_no_cost() -> None:
    result = receive_entry(unvalued("5"), D(5), D(0))
    assert result.position.valued is True
    assert (result.position.value, result.position.average) == (D(0), D(0))
    assert result.regularization_value == D(0)


def test_entry_without_cost_on_a_valued_position_keeps_the_average() -> None:
    result = receive_entry(position("10", "20.00", "2.000000"), D(5), None)
    assert (result.position.quantity, result.position.value) == (D(15), D("30.000000"))
    assert result.position.average == D("2.000000")
    assert result.position.valued is True
    assert result.value_delta == D("10.000000")


def test_entry_without_cost_preserves_the_rounding_residue_of_the_value() -> None:
    result = receive_entry(position("10", "20.000001", "2.000000"), D(5), None)
    assert result.position.value == D("30.000001")
    assert result.position.average == D("2.000000")


def test_entry_without_cost_after_depletion_uses_the_last_known_average() -> None:
    result = receive_entry(EMPTY_POSITION, D(2), None, last_average=D("3.500000"))
    assert (result.position.quantity, result.position.value) == (D(2), D("7.000000"))
    assert result.position.average == D("3.500000")
    assert result.position.valued is True


def test_entry_without_cost_and_without_any_average_stays_unvalued() -> None:
    result = receive_entry(EMPTY_POSITION, D(5), None)
    assert result.position == unvalued("5")
    assert result.position.valued is False
    assert result.value_delta == D(0)


def test_entry_without_cost_on_an_unvalued_position_stays_unvalued() -> None:
    result = receive_entry(unvalued("5"), D(3), None, last_average=D("9.000000"))
    assert result.position == unvalued("8")


def test_partial_exit_from_an_unvalued_position_carries_no_value() -> None:
    result = apply_exit(unvalued("5"), D(2))
    assert result.position == unvalued("3")
    assert (result.nominal_value, result.applied_value, result.rounding_adjustment) == (
        D(0),
        D(0),
        D(0),
    )


def test_total_exit_from_an_unvalued_position_leaves_an_empty_valued_position() -> None:
    result = apply_exit(unvalued("5"), D(5))
    assert result.position == EMPTY_POSITION
    assert result.position.valued is True


def test_exact_reversal_restores_the_valuation_state() -> None:
    after = unvalued("5")
    assert reverse_exactly(after, before=EMPTY_POSITION, after=after) == EMPTY_POSITION


def test_reversal_is_blocked_when_only_the_valuation_state_differs() -> None:
    recorded = unvalued("5")
    drifted = Position(D(5), D("0.000000"), D("0.000000"), valued=True)
    with pytest.raises(InventoryValidationError):
        reverse_exactly(drifted, before=EMPTY_POSITION, after=recorded)
