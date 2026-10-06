"""Reglas puras del comprobante de retención y de la advertencia por importe."""

from decimal import Decimal

import pytest

from shared.withholding import (
    WithholdingValidationError,
    exceeds_warning,
    parse_voucher_number,
    validate_breakdown,
)

D = Decimal


def test_voucher_number_keeps_its_official_shape() -> None:
    assert parse_voucher_number("001-001-000028564") == "001-001-000028564"
    assert parse_voucher_number(" 001-501-000003607 ") == "001-501-000003607"


@pytest.mark.parametrize(
    "value",
    ["1-1-28564", "001001000028564", "001-001-00002856A", "001-001-0000285640", "", None, 1],
)
def test_voucher_number_rejects_other_shapes(value: object) -> None:
    with pytest.raises(WithholdingValidationError) as error:
        parse_voucher_number(value)
    assert "voucher_number" in error.value.errors


def test_breakdown_must_add_up_to_the_amount() -> None:
    assert validate_breakdown(D("5.00"), "5.00", "0.00") == (D("5.00"), D("0.00"))
    assert validate_breakdown(D("5.00"), "3.50", "1.50") == (D("3.50"), D("1.50"))
    assert validate_breakdown(D("5.00"), None, None) is None


@pytest.mark.parametrize(
    ("income", "vat"),
    [("3.00", "1.00"), ("5.00", None), (None, "5.00"), ("-1.00", "6.00"), ("2.505", "2.495")],
)
def test_breakdown_rejects_incoherent_values(income: object, vat: object) -> None:
    with pytest.raises(WithholdingValidationError):
        validate_breakdown(D("5.00"), income, vat)


def test_warning_compares_accumulated_withholding_with_the_threshold() -> None:
    assert exceeds_warning(D("100.00"), D("0.00"), D("25.00"), D("20")) is True
    assert exceeds_warning(D("100.00"), D("0.00"), D("20.00"), D("20")) is False
    assert exceeds_warning(D("100.00"), D("15.00"), D("6.00"), D("20")) is True
    assert exceeds_warning(D("33.33"), D("0.00"), D("3.34"), D("10")) is True
    assert exceeds_warning(D("33.33"), D("0.00"), D("3.33"), D("10")) is False


def test_warning_disabled_never_fires() -> None:
    assert exceeds_warning(D("100.00"), D("0.00"), D("99.00"), None) is False
