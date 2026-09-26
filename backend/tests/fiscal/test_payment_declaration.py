"""Formas de pago declaradas para el comprobante, separadas de los cobros reales."""

import pytest


def test_cash_and_transfer_codes_are_supported() -> None:
    from fiscal.domain.payment_declaration import validate_payment_declaration

    declaration = validate_payment_declaration(
        condition="CONTADO",
        forms=[{"payment_code": "01", "amount": "11.50"}],
        total="11.50",
    )
    assert declaration.forms[0].payment_code == "01"
    assert declaration.pending == ()


def test_forms_must_cover_the_total() -> None:
    from fiscal.domain.payment_declaration import (
        PaymentDeclarationError,
        validate_payment_declaration,
    )

    with pytest.raises(PaymentDeclarationError) as exc:
        validate_payment_declaration(
            condition="CONTADO",
            forms=[{"payment_code": "01", "amount": "10.00"}],
            total="11.50",
        )
    assert "amount" in exc.value.errors


def test_combined_forms_sum_to_total() -> None:
    from fiscal.domain.payment_declaration import validate_payment_declaration

    declaration = validate_payment_declaration(
        condition="CONTADO",
        forms=[
            {"payment_code": "01", "amount": "5.00"},
            {"payment_code": "20", "amount": "6.50"},
        ],
        total="11.50",
    )
    assert len(declaration.forms) == 2


def test_credit_is_not_a_payment_code() -> None:
    from fiscal.domain.payment_declaration import (
        PaymentDeclarationError,
        validate_payment_declaration,
    )

    with pytest.raises(PaymentDeclarationError):
        validate_payment_declaration(
            condition="CREDITO",
            forms=[{"payment_code": "CREDITO", "amount": "11.50"}],
            total="11.50",
        )


def test_unsupported_payment_code_is_rejected() -> None:
    from fiscal.domain.payment_declaration import (
        PaymentDeclarationError,
        validate_payment_declaration,
    )

    with pytest.raises(PaymentDeclarationError):
        validate_payment_declaration(
            condition="CONTADO",
            forms=[{"payment_code": "16", "amount": "11.50"}],
            total="11.50",
        )


def test_credit_without_term_marks_pending_without_inventing_dates() -> None:
    from fiscal.domain.payment_declaration import validate_payment_declaration

    declaration = validate_payment_declaration(
        condition="CREDITO",
        forms=[{"payment_code": "20", "amount": "11.50"}],
        total="11.50",
    )
    assert any("plazo" in item or "unidad" in item for item in declaration.pending)
    # No se inventa vencimiento.
    assert declaration.forms[0].term_days is None


def test_credit_with_term_is_accepted() -> None:
    from fiscal.domain.payment_declaration import validate_payment_declaration

    declaration = validate_payment_declaration(
        condition="CREDITO",
        forms=[
            {
                "payment_code": "20",
                "amount": "11.50",
                "term_days": 30,
                "time_unit": "dias",
            }
        ],
        total="11.50",
    )
    assert declaration.pending == ()
    assert declaration.forms[0].term_days == 30


def test_cash_condition_rejects_term_fields() -> None:
    from fiscal.domain.payment_declaration import (
        PaymentDeclarationError,
        validate_payment_declaration,
    )

    with pytest.raises(PaymentDeclarationError):
        validate_payment_declaration(
            condition="CONTADO",
            forms=[{"payment_code": "01", "amount": "11.50", "term_days": 30}],
            total="11.50",
        )


def test_unknown_condition_is_rejected() -> None:
    from fiscal.domain.payment_declaration import (
        PaymentDeclarationError,
        validate_payment_declaration,
    )

    with pytest.raises(PaymentDeclarationError):
        validate_payment_declaration(
            condition="MIXTO",
            forms=[{"payment_code": "01", "amount": "11.50"}],
            total="11.50",
        )
