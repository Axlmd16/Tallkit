"""Plazo del comprobante: solo en crédito con saldo pendiente, un valor entero de días."""

import random
from decimal import Decimal

import pytest

from fiscal.domain.payment_declaration import DeclaredPaymentForm
from fiscal.domain.payment_term import (
    TERM_UNIT,
    PaymentTermError,
    forms_with_term,
    parse_term_days,
    term_required,
)


@pytest.mark.parametrize(
    ("condition", "pending", "expected"),
    [
        ("CREDITO", "80.00", True),
        ("CREDITO", Decimal("0.01"), True),
        ("CREDITO", "0.00", False),
        ("CREDITO", Decimal("0"), False),
        ("CONTADO", "80.00", False),
        ("CONTADO", "0.00", False),
    ],
)
def test_the_term_is_required_only_for_credit_with_a_pending_balance(
    condition: str, pending: str | Decimal, expected: bool
) -> None:
    assert term_required(condition, pending) is expected


def test_the_unit_is_always_days() -> None:
    assert TERM_UNIT == "dias"


@pytest.mark.parametrize("value", [1, 30, 365, 9999])
def test_a_whole_number_of_days_between_one_and_9999_is_accepted(value: int) -> None:
    assert parse_term_days(value) == value


@pytest.mark.parametrize(
    "value", [0, -1, 10000, 1.5, 30.0, "30", "", None, True, False, [30], {"days": 30}]
)
def test_other_values_are_rejected_without_converting_them(value: object) -> None:
    with pytest.raises(PaymentTermError) as caught:
        parse_term_days(value)
    assert "term_days" in caught.value.errors


def _forms(*pairs: tuple[str, str]) -> tuple[DeclaredPaymentForm, ...]:
    return tuple(DeclaredPaymentForm(payment_code=code, amount=amount) for code, amount in pairs)


def test_with_no_collections_every_declared_form_carries_the_term() -> None:
    forms = _forms(("01", "40.00"), ("20", "60.00"))
    assert forms_with_term(forms, {}) == (0, 1)


def test_a_form_already_collected_in_full_carries_no_term() -> None:
    forms = _forms(("01", "40.00"), ("20", "60.00"))
    assert forms_with_term(forms, {"01": Decimal("40.00")}) == (1,)


def test_a_form_collected_only_in_part_still_carries_the_term() -> None:
    forms = _forms(("01", "40.00"), ("20", "60.00"))
    assert forms_with_term(forms, {"01": "10.00", "20": "60.00"}) == (0,)


def test_the_collection_of_a_code_that_was_not_declared_does_not_cover_another_form() -> None:
    assert forms_with_term(_forms(("20", "100.00")), {"01": Decimal("40.00")}) == (0,)


def test_when_everything_is_collected_no_form_carries_a_term() -> None:
    forms = _forms(("01", "40.00"), ("20", "60.00"))
    assert forms_with_term(forms, {"01": "40.00", "20": "60.00"}) == ()


def test_with_a_pending_balance_at_least_one_form_always_carries_the_term() -> None:
    """Las formas suman el total y lo cobrado es menor: alguna debe superar su cobro."""
    rng = random.Random(20261101)  # noqa: S311 - semilla fija: prueba reproducible
    for _ in range(500):
        total = Decimal(rng.randint(100, 100_000)) / 100
        cut = Decimal(rng.randint(1, int(total * 100) - 1)) / 100
        forms = _forms(("01", str(cut)), ("20", str(total - cut)))
        collected_total = Decimal(rng.randint(0, int(total * 100) - 1)) / 100
        share = Decimal(rng.randint(0, int(collected_total * 100))) / 100
        collected = {"01": share, "20": collected_total - share}
        assert forms_with_term(forms, collected), (forms, collected)
