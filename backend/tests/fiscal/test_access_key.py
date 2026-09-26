"""Clave de acceso de 49 dígitos y fecha fiscal en America/Guayaquil (puro)."""

from datetime import UTC, date, datetime

import pytest


def test_build_access_key_has_49_valid_digits() -> None:
    from fiscal.domain.access_key import build_access_key, validate_access_key

    key = build_access_key(
        emission_date=date(2026, 9, 25),
        doc_type="01",
        ruc="0991234567001",
        environment="1",
        establishment="001",
        emission_point="001",
        sequential="000000001",
        numeric_code="12345678",
    )
    assert len(key) == 49
    assert key.isdigit()
    assert key.startswith("25092026")  # ddmmaaaa
    assert validate_access_key(key)


def test_verification_digit_edge_cases() -> None:
    from fiscal.domain.access_key import verification_digit

    assert verification_digit("0" * 48) == "0"  # modulo 0 -> 11 -> 0
    assert verification_digit("0" * 47 + "6") == "1"  # modulo 1 -> 10 -> 1


def test_validate_rejects_altered_check_digit() -> None:
    from fiscal.domain.access_key import build_access_key, validate_access_key

    key = build_access_key(
        emission_date=date(2026, 9, 25),
        doc_type="01",
        ruc="0991234567001",
        environment="1",
        establishment="001",
        emission_point="001",
        sequential="000000001",
        numeric_code="12345678",
    )
    wrong_last = "0" if key[-1] != "0" else "1"
    altered = key[:-1] + wrong_last
    assert not validate_access_key(altered)


def test_validate_rejects_bad_length_or_non_digit() -> None:
    from fiscal.domain.access_key import validate_access_key

    assert not validate_access_key("123")
    assert not validate_access_key("A" * 49)


def test_local_reference_date_uses_guayaquil() -> None:
    from fiscal.domain.access_key import emission_date_component, local_reference_date

    instant = datetime(2026, 9, 26, 2, 30, 0, tzinfo=UTC)
    local = local_reference_date(instant)
    assert local == date(2026, 9, 25)
    assert emission_date_component(local) == "25092026"


def test_sequential_out_of_range_is_rejected() -> None:
    from fiscal.domain.access_key import AccessKeyError, build_access_key

    for bad in ("000000000", "1000000000", "12345"):
        with pytest.raises(AccessKeyError):
            build_access_key(
                emission_date=date(2026, 9, 25),
                doc_type="01",
                ruc="0991234567001",
                environment="1",
                establishment="001",
                emission_point="001",
                sequential=bad,
                numeric_code="12345678",
            )


def test_unsupported_document_type_is_rejected() -> None:
    from fiscal.domain.access_key import AccessKeyError, build_access_key

    with pytest.raises(AccessKeyError):
        build_access_key(
            emission_date=date(2026, 9, 25),
            doc_type="18",  # no soportado
            ruc="0991234567001",
            environment="1",
            establishment="001",
            emission_point="001",
            sequential="000000001",
            numeric_code="12345678",
        )


def test_invalid_component_widths_are_rejected() -> None:
    from fiscal.domain.access_key import AccessKeyError, build_access_key

    with pytest.raises(AccessKeyError):
        build_access_key(
            emission_date=date(2026, 9, 25),
            doc_type="01",
            ruc="123",  # RUC no tiene 13 dígitos
            environment="1",
            establishment="001",
            emission_point="001",
            sequential="000000001",
            numeric_code="12345678",
        )
    with pytest.raises(AccessKeyError):
        build_access_key(
            emission_date=date(2026, 9, 25),
            doc_type="01",
            ruc="0991234567001",
            environment="3",  # ambiente inválido
            establishment="001",
            emission_point="001",
            sequential="000000001",
            numeric_code="12345678",
        )
    with pytest.raises(AccessKeyError):
        build_access_key(
            emission_date=date(2026, 9, 25),
            doc_type="01",
            ruc="0991234567001",
            environment="1",
            establishment="001",
            emission_point="001",
            sequential="000000001",
            numeric_code="1234",  # código numérico de 8 dígitos
        )


def test_format_sequential_pads_to_nine() -> None:
    from fiscal.domain.access_key import format_sequential

    assert format_sequential(1) == "000000001"
    assert format_sequential(999999999) == "999999999"
    from fiscal.domain.access_key import AccessKeyError

    with pytest.raises(AccessKeyError):
        format_sequential(0)
    with pytest.raises(AccessKeyError):
        format_sequential(1000000000)
