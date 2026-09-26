"""Validadores puros del receptor fiscal: formato por tipo, sin algoritmo universal."""

from decimal import Decimal

import pytest


def test_valid_ruc_preserves_leading_zeros() -> None:
    from fiscal.domain.receiver import parse_receiver

    receiver = parse_receiver(
        {
            "identification_type": "04",
            "identification": "0991234567001",
            "legal_name": "Comercial Andina S.A.",
        }
    )

    assert receiver.identification_type == "04"
    assert receiver.identification == "0991234567001"
    assert not receiver.is_consumer_final


def test_valid_cedula_ten_digits() -> None:
    from fiscal.domain.receiver import parse_receiver

    receiver = parse_receiver(
        {
            "identification_type": "05",
            "identification": "0102030405",
            "legal_name": "Juan Pérez",
        }
    )

    assert receiver.identification == "0102030405"


def test_ruc_not_rejected_by_cedula_check_digit_algorithm() -> None:
    from fiscal.domain.receiver import parse_receiver

    # Formato válido de RUC que no supera un algoritmo pensado para cédulas.
    receiver = parse_receiver(
        {
            "identification_type": "04",
            "identification": "9999999999001",
            "legal_name": "Sociedad Ejemplo",
        }
    )

    assert receiver.identification == "9999999999001"


def test_cedula_with_letters_is_rejected_without_silent_change() -> None:
    from fiscal.domain.receiver import FiscalReceiverError, parse_receiver

    with pytest.raises(FiscalReceiverError) as exc:
        parse_receiver(
            {
                "identification_type": "05",
                "identification": "01A2030405",
                "legal_name": "Juan Pérez",
            }
        )
    assert "identification" in exc.value.errors


def test_cedula_wrong_length_is_rejected() -> None:
    from fiscal.domain.receiver import FiscalReceiverError, parse_receiver

    with pytest.raises(FiscalReceiverError):
        parse_receiver(
            {
                "identification_type": "05",
                "identification": "12345",
                "legal_name": "Juan Pérez",
            }
        )


def test_passport_keeps_alphanumeric_representation() -> None:
    from fiscal.domain.receiver import parse_receiver

    receiver = parse_receiver(
        {
            "identification_type": "06",
            "identification": "AB1234567",
            "legal_name": "Foreign Buyer",
        }
    )

    assert receiver.identification == "AB1234567"


def test_foreign_identification_is_supported() -> None:
    from fiscal.domain.receiver import parse_receiver

    receiver = parse_receiver(
        {
            "identification_type": "08",
            "identification": "X-9910",
            "legal_name": "Comprador Exterior",
        }
    )

    assert receiver.identification_type == "08"


def test_unsupported_identification_type_is_rejected() -> None:
    from fiscal.domain.receiver import FiscalReceiverError, parse_receiver

    with pytest.raises(FiscalReceiverError) as exc:
        parse_receiver(
            {
                "identification_type": "01",
                "identification": "0102030405",
                "legal_name": "No soportado",
            }
        )
    assert "identification_type" in exc.value.errors


def test_consumer_final_requires_official_identification() -> None:
    from fiscal.domain.receiver import (
        CONSUMER_FINAL_IDENTIFICATION,
        FiscalReceiverError,
        parse_receiver,
    )

    ok = parse_receiver(
        {
            "identification_type": "07",
            "identification": CONSUMER_FINAL_IDENTIFICATION,
            "legal_name": "CONSUMIDOR FINAL",
        }
    )
    assert ok.is_consumer_final

    with pytest.raises(FiscalReceiverError):
        parse_receiver(
            {
                "identification_type": "07",
                "identification": "0991234567001",
                "legal_name": "CONSUMIDOR FINAL",
            }
        )


def test_consumer_final_total_limit_is_enforced() -> None:
    from fiscal.domain.receiver import (
        CONSUMER_FINAL_MAX_TOTAL,
        FiscalReceiverError,
        check_consumer_final_total,
    )

    check_consumer_final_total(CONSUMER_FINAL_MAX_TOTAL)  # USD 50 admitido
    check_consumer_final_total(Decimal("49.99"))

    with pytest.raises(FiscalReceiverError):
        check_consumer_final_total(Decimal("50.01"))


def test_email_optional_but_validated_when_present() -> None:
    from fiscal.domain.receiver import FiscalReceiverError, parse_receiver

    without = parse_receiver(
        {
            "identification_type": "05",
            "identification": "0102030405",
            "legal_name": "Juan Pérez",
        }
    )
    assert without.email is None

    valid = parse_receiver(
        {
            "identification_type": "05",
            "identification": "0102030405",
            "legal_name": "Juan Pérez",
            "email": "juan@example.com",
        }
    )
    assert valid.email == "juan@example.com"

    with pytest.raises(FiscalReceiverError) as exc:
        parse_receiver(
            {
                "identification_type": "05",
                "identification": "0102030405",
                "legal_name": "Juan Pérez",
                "email": "no-arroba",
            }
        )
    assert "email" in exc.value.errors


def test_legal_name_is_required() -> None:
    from fiscal.domain.receiver import FiscalReceiverError, parse_receiver

    with pytest.raises(FiscalReceiverError) as exc:
        parse_receiver(
            {
                "identification_type": "05",
                "identification": "0102030405",
                "legal_name": "   ",
            }
        )
    assert "legal_name" in exc.value.errors


def test_unknown_payload_fields_are_rejected() -> None:
    from fiscal.domain.receiver import FiscalReceiverError, parse_receiver

    with pytest.raises(FiscalReceiverError):
        parse_receiver(
            {
                "identification_type": "05",
                "identification": "0102030405",
                "legal_name": "Juan Pérez",
                "customer_id": 42,
            }
        )
