"""Entrada de un borrador de oferta: cliente, vigencia y líneas producto/cantidad."""

from datetime import date
from decimal import Decimal
from typing import Any

import pytest

from proformas.domain.draft_input import DraftValidationError, parse_draft


def _payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "customer_id": 7,
        "lines": [{"product_id": 3, "quantity": "2"}],
    }
    payload.update(overrides)
    return payload


def test_valid_draft_keeps_customer_lines_and_default_validity() -> None:
    draft = parse_draft(_payload())
    assert draft.customer_id == 7
    assert draft.valid_until is None
    assert [(line.product_id, line.quantity) for line in draft.lines] == [(3, Decimal(2))]


def test_explicit_validity_is_a_calendar_date() -> None:
    assert parse_draft(_payload(valid_until="2026-10-20")).valid_until == date(2026, 10, 20)


def test_draft_may_be_saved_without_lines() -> None:
    assert parse_draft(_payload(lines=[])).lines == ()


def test_kit_is_quoted_as_one_intact_line() -> None:
    draft = parse_draft(_payload(lines=[{"product_id": 9, "quantity": 1}]))
    assert len(draft.lines) == 1
    assert draft.lines[0].quantity == Decimal(1)


@pytest.mark.parametrize("quantity", ["0", "-1", "1.5", "abc", None, 1.5, True])
def test_non_positive_or_fractional_quantity_is_rejected(quantity: Any) -> None:
    with pytest.raises(DraftValidationError) as error:
        parse_draft(_payload(lines=[{"product_id": 3, "quantity": quantity}]))
    assert error.value.code == "validation_error"
    assert "lines.0.quantity" in error.value.errors


@pytest.mark.parametrize(
    "field",
    ["unit_price", "price", "discount", "tax_rate", "tax_definition_id", "service_id", "total"],
)
def test_manual_price_discount_tax_and_services_are_rejected_on_lines(field: str) -> None:
    line = {"product_id": 3, "quantity": "1", field: "0"}
    with pytest.raises(DraftValidationError) as error:
        parse_draft(_payload(lines=[line]))
    assert error.value.code == "unknown_field"
    assert f"lines.0.{field}" in error.value.errors


@pytest.mark.parametrize("field", ["discount", "condition", "payments", "total", "number"])
def test_unknown_header_fields_are_rejected(field: str) -> None:
    with pytest.raises(DraftValidationError) as error:
        parse_draft(_payload(**{field: "0"}))
    assert error.value.code == "unknown_field"
    assert field in error.value.errors


def test_artisan_entity_is_rejected() -> None:
    with pytest.raises(DraftValidationError) as error:
        parse_draft(_payload(entity_type="ARTESANAL"))
    assert "entity_type" in error.value.errors


@pytest.mark.parametrize("customer_id", [0, -1, "7", True])
def test_a_given_customer_must_be_a_registered_identifier(customer_id: Any) -> None:
    with pytest.raises(DraftValidationError) as error:
        parse_draft(_payload(customer_id=customer_id))
    assert "customer_id" in error.value.errors


@pytest.mark.parametrize("value", ["13/10/2026", "2026-13-01", 20261013, ""])
def test_invalid_validity_date_is_rejected(value: Any) -> None:
    with pytest.raises(DraftValidationError) as error:
        parse_draft(_payload(valid_until=value))
    assert "valid_until" in error.value.errors


def test_invalid_line_does_not_partially_accept_the_others() -> None:
    lines = [{"product_id": 3, "quantity": "1"}, {"product_id": 4, "quantity": "0"}]
    with pytest.raises(DraftValidationError) as error:
        parse_draft(_payload(lines=lines))
    assert list(error.value.errors) == ["lines.1.quantity"]
