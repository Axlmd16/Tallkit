"""Formas de pago declaradas: habilitadas, suma exacta, sin plazo ni crédito como código."""

import pytest

from fiscal.domain.payment_declaration import (
    PaymentDeclarationError,
    validate_payment_declaration,
)

ENABLED = ("01", "20")


def _validate(condition: str, forms: list[dict[str, object]], total: str = "11.50") -> object:
    return validate_payment_declaration(
        condition=condition,
        forms=forms,
        total=total,
        enabled_codes=ENABLED,
    )


def test_cash_and_transfer_codes_are_supported() -> None:
    declaration = _validate("CONTADO", [{"payment_code": "01", "amount": "11.50"}])
    assert declaration.forms[0].payment_code == "01"  # type: ignore[attr-defined]


def test_forms_must_cover_the_total_and_report_difference() -> None:
    with pytest.raises(PaymentDeclarationError) as exc:
        _validate("CONTADO", [{"payment_code": "01", "amount": "49.99"}], total="50.00")
    assert "0.01" in exc.value.errors["amount"][0]


def test_combined_forms_sum_to_total() -> None:
    declaration = _validate(
        "CONTADO",
        [{"payment_code": "01", "amount": "5.00"}, {"payment_code": "20", "amount": "6.50"}],
    )
    assert len(declaration.forms) == 2  # type: ignore[attr-defined]


@pytest.mark.parametrize("code", ["CREDITO", "16", "19"])
def test_disabled_or_invented_codes_are_rejected(code: str) -> None:
    with pytest.raises(PaymentDeclarationError):
        _validate("CREDITO", [{"payment_code": code, "amount": "11.50"}])


def test_credit_without_term_is_accepted() -> None:
    declaration = _validate("CREDITO", [{"payment_code": "20", "amount": "11.50"}])
    assert declaration.forms[0].amount == "11.50"  # type: ignore[attr-defined]


@pytest.mark.parametrize("condition", ["CONTADO", "CREDITO"])
def test_term_fields_are_rejected(condition: str) -> None:
    with pytest.raises(PaymentDeclarationError) as exc:
        _validate(
            condition,
            [{"payment_code": "20", "amount": "11.50", "term_days": 30, "time_unit": "dias"}],
        )
    assert "plazo" in next(iter(exc.value.errors.values()))[0]


def test_unknown_condition_is_rejected() -> None:
    with pytest.raises(PaymentDeclarationError):
        _validate("MIXTO", [{"payment_code": "01", "amount": "11.50"}])
