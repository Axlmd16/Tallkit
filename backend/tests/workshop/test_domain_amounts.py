"""Importes del taller: precios aplicados y cantidades en decimal exacto, sin redondeo."""

from decimal import Decimal

import pytest

from workshop.domain.amounts import (
    AmountError,
    line_subtotal,
    parse_price,
    parse_quantity,
    services_total,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("25", "25.00"), ("0", "0.00"), ("0.10", "0.10"), (19.99, "19.99"), (3, "3.00")],
)
def test_valid_prices(raw: object, expected: str) -> None:
    assert parse_price(raw) == Decimal(expected)


@pytest.mark.parametrize(
    "raw",
    ["-1.00", "10.005", "abc", "", None, True, "NaN", "Infinity", "1e3", "1000000000000.00", []],
)
def test_invalid_prices_are_rejected_without_rounding(raw: object) -> None:
    with pytest.raises(AmountError):
        parse_price(raw)


@pytest.mark.parametrize(("raw", "expected"), [(1, 1), (9999, 9999), ("3", 3)])
def test_valid_quantities(raw: object, expected: int) -> None:
    assert parse_quantity(raw) == expected


@pytest.mark.parametrize("raw", [0, -1, 1.5, "1.5", 10000, True, None, "x"])
def test_invalid_quantities(raw: object) -> None:
    with pytest.raises(AmountError):
        parse_quantity(raw)


def test_subtotal_and_total_are_exact() -> None:
    assert line_subtotal(3, Decimal("0.10")) == Decimal("0.30")
    assert line_subtotal(3, Decimal("12.50")) == Decimal("37.50")
    total = services_total([(3, Decimal("0.10")), (1, Decimal("19.99"))])
    assert total == Decimal("20.29")
    assert str(total) == "20.29"
    assert services_total([]) == Decimal("0.00")
