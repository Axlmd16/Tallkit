from datetime import date
from decimal import Decimal

import pytest

from workshop_configuration.domain.validation import (
    MAX_SEQUENCE_VALUE,
    ConfigurationValidationError,
    DocumentType,
    FiscalEntityType,
    format_internal_number,
    parse_document_type,
    parse_fiscal_entity_type,
    validate_legal_name,
    validate_ruc,
    validate_series_code,
    validate_tax_code,
    validate_tax_interval,
    validate_tax_rate,
)


def test_parses_only_supported_fiscal_and_document_types() -> None:
    assert parse_fiscal_entity_type(" comercial ") is FiscalEntityType.COMERCIAL
    assert parse_fiscal_entity_type(FiscalEntityType.ARTESANAL) is FiscalEntityType.ARTESANAL
    assert parse_document_type("venta") is DocumentType.VENTA
    assert parse_document_type(DocumentType.SERVICIO) is DocumentType.SERVICIO

    with pytest.raises(ConfigurationValidationError):
        parse_fiscal_entity_type("SUCURSAL")
    with pytest.raises(ConfigurationValidationError):
        parse_document_type("FACTURA_ELECTRONICA")


def test_ruc_preserves_leading_zero_and_requires_exactly_thirteen_ascii_digits() -> None:
    assert validate_ruc(" 0991234567001 ") == "0991234567001"

    for invalid in (
        "991234567001",
        "09912345670010",
        "099123456700A",
        "\uff10991234567001",
        991234567001,
    ):
        with pytest.raises(ConfigurationValidationError) as exc_info:
            validate_ruc(invalid)
        assert "ruc" in exc_info.value.errors


def test_legal_name_is_trimmed_and_enforces_the_documented_limit() -> None:
    assert validate_legal_name("  Taller Comercial  ") == "Taller Comercial"
    assert validate_legal_name("R" * 200) == "R" * 200

    for invalid in ("   ", "R" * 201, None):
        with pytest.raises(ConfigurationValidationError) as exc_info:
            validate_legal_name(invalid)
        assert "legal_name" in exc_info.value.errors


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("0", Decimal("0")),
        ("12", Decimal("12")),
        ("12.3456", Decimal("12.3456")),
        ("100.0000", Decimal("100.0000")),
    ],
)
def test_tax_rate_accepts_textual_decimals_without_changing_precision(
    raw: str, expected: Decimal
) -> None:
    assert validate_tax_rate(raw) == expected


@pytest.mark.parametrize(
    "invalid",
    ["-0.0001", "100.0001", "12.34567", "1e1", "12,5", "", 12, Decimal("12")],
)
def test_tax_rate_rejects_out_of_range_or_non_contractual_representations(
    invalid: object,
) -> None:
    with pytest.raises(ConfigurationValidationError) as exc_info:
        validate_tax_rate(invalid)
    assert "rate" in exc_info.value.errors


def test_tax_interval_accepts_closed_or_open_ordered_dates() -> None:
    start = date(2026, 9, 15)

    assert validate_tax_interval(start, None) == (start, None)
    assert validate_tax_interval(start, start) == (start, start)
    assert validate_tax_interval(start, date(2026, 9, 30)) == (
        start,
        date(2026, 9, 30),
    )


def test_tax_interval_rejects_non_dates_and_an_end_before_start() -> None:
    for start, end in (
        (date(2026, 9, 15), date(2026, 9, 14)),
        ("2026-09-15", None),
        (date(2026, 9, 15), "2026-09-30"),
    ):
        with pytest.raises(ConfigurationValidationError) as exc_info:
            validate_tax_interval(start, end)
        assert "period" in exc_info.value.errors


def test_codes_are_normalized_and_enforce_distinct_contracts() -> None:
    assert validate_tax_code(" iva_ventas ") == "IVA_VENTAS"
    assert validate_series_code(" com-ven ") == "COM-VEN"

    for invalid in ("1IVA", "IVA VENTAS", "A" * 21):
        with pytest.raises(ConfigurationValidationError):
            validate_tax_code(invalid)
    for invalid in ("AB", "COM_VEN", "A" * 21):
        with pytest.raises(ConfigurationValidationError):
            validate_series_code(invalid)


def test_internal_number_uses_six_digits_minimum_and_grows_without_reset() -> None:
    assert format_internal_number("COM-VEN", 1) == "COM-VEN-000001"
    assert format_internal_number("COM-VEN", 999_999) == "COM-VEN-999999"
    assert format_internal_number("COM-VEN", 1_000_000) == "COM-VEN-1000000"
    assert format_internal_number("ART-SER", MAX_SEQUENCE_VALUE) == ("ART-SER-9223372036854775807")


def test_internal_number_rejects_invalid_series_and_sequence_boundaries() -> None:
    for series, sequence in (
        ("COM_VEN", 1),
        ("COM-VEN", 0),
        ("COM-VEN", -1),
        ("COM-VEN", MAX_SEQUENCE_VALUE + 1),
        ("COM-VEN", True),
    ):
        with pytest.raises(ConfigurationValidationError):
            format_internal_number(series, sequence)
