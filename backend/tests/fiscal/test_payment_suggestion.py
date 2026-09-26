"""La sugerencia de formas de pago parte de los cobros y nunca los registra."""

from decimal import Decimal

from fiscal.domain.payment_suggestion import suggest_payment_forms

FORMS = {"EFECTIVO": "01", "TRANSFERENCIA": "20"}


def _pairs(result: object) -> list[tuple[str, str]]:
    return [(form.payment_code, form.amount) for form in result.forms]  # type: ignore[attr-defined]


def test_collected_total_is_suggested_by_method() -> None:
    result = suggest_payment_forms(
        total="100.00",
        collected={"EFECTIVO": Decimal("30.00"), "TRANSFERENCIA": Decimal("70.00")},
        enabled_forms=FORMS,
        default_code="01",
    )
    assert _pairs(result) == [("01", "30.00"), ("20", "70.00")]
    assert result.origin == "COLLECTED"


def test_partial_collection_adds_remainder_with_default() -> None:
    result = suggest_payment_forms(
        total="100.00",
        collected={"EFECTIVO": Decimal("40.00")},
        enabled_forms=FORMS,
        default_code="20",
    )
    assert _pairs(result) == [("01", "40.00"), ("20", "60.00")]
    assert result.origin == "MIXED"


def test_remainder_merges_with_same_default_form() -> None:
    result = suggest_payment_forms(
        total="100.00",
        collected={"EFECTIVO": Decimal("40.00")},
        enabled_forms=FORMS,
        default_code="01",
    )
    assert _pairs(result) == [("01", "100.00")]


def test_without_collection_the_default_covers_the_total() -> None:
    result = suggest_payment_forms(
        total="25.00", collected={}, enabled_forms=FORMS, default_code="01"
    )
    assert _pairs(result) == [("01", "25.00")]
    assert result.origin == "DEFAULT"


def test_excess_over_total_falls_back_to_default() -> None:
    result = suggest_payment_forms(
        total="50.00",
        collected={"TRANSFERENCIA": Decimal("80.00")},
        enabled_forms=FORMS,
        default_code="01",
    )
    assert _pairs(result) == [("01", "50.00")]
    assert result.origin == "DEFAULT"


def test_method_with_disabled_form_goes_to_remainder() -> None:
    result = suggest_payment_forms(
        total="100.00",
        collected={"EFECTIVO": Decimal("30.00"), "TRANSFERENCIA": Decimal("70.00")},
        enabled_forms={"EFECTIVO": "01"},
        default_code="01",
    )
    assert _pairs(result) == [("01", "100.00")]


def test_without_default_or_forms_nothing_is_invented() -> None:
    result = suggest_payment_forms(total="25.00", collected={}, enabled_forms={}, default_code=None)
    assert result.forms == ()
    assert result.origin == "NONE"


def test_amounts_are_exact_cents() -> None:
    result = suggest_payment_forms(
        total="10.01",
        collected={"EFECTIVO": Decimal("3.335")},
        enabled_forms=FORMS,
        default_code="20",
    )
    assert _pairs(result) == [("01", "3.34"), ("20", "6.67")]
    assert sum(Decimal(amount) for _, amount in _pairs(result)) == Decimal("10.01")
