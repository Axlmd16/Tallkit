"""Detalle adicional del comprobante: pares de nombre y valor validados sin recortar."""

from typing import Any

import pytest

from fiscal.domain.additional_info import (
    MAX_PAIRS,
    RESERVED_NAMES,
    AdditionalInfoError,
    validate_additional_info,
)


def _pair(name: str, value: str) -> dict[str, str]:
    return {"name": name, "value": value}


def test_no_pairs_is_valid_and_yields_an_empty_list() -> None:
    assert validate_additional_info([]) == []
    assert validate_additional_info(None) == []


def test_pairs_are_returned_without_surrounding_spaces() -> None:
    result = validate_additional_info([_pair("  Vehículo ", " Placa PCM4567 ")])
    assert result == [{"name": "Vehículo", "value": "Placa PCM4567"}]


def test_up_to_twelve_pairs_are_admitted() -> None:
    pairs = [_pair(f"Dato {n}", "valor") for n in range(MAX_PAIRS)]
    assert len(validate_additional_info(pairs)) == 12


def test_a_thirteenth_pair_is_rejected_stating_the_maximum() -> None:
    pairs = [_pair(f"Dato {n}", "valor") for n in range(MAX_PAIRS + 1)]
    with pytest.raises(AdditionalInfoError) as caught:
        validate_additional_info(pairs)
    assert "12" in " ".join(" ".join(m) for m in caught.value.errors.values())


@pytest.mark.parametrize(
    "name",
    [
        "RUC Proveedor",
        "ruc proveedor",
        " RUC   PROVEEDOR ",
        "Gran Contribuyente",
        "GRAN CONTRIBUYENTE",
    ],
)
def test_reserved_names_are_rejected_whatever_their_case_or_spacing(name: str) -> None:
    with pytest.raises(AdditionalInfoError) as caught:
        validate_additional_info([_pair(name, "123")])
    assert "additional_info[1].name" in caught.value.errors
    assert "no lo escribe" in caught.value.errors["additional_info[1].name"][0]


def test_the_reserved_names_are_the_two_the_issuer_data_provides() -> None:
    assert frozenset({"ruc proveedor", "gran contribuyente"}) == RESERVED_NAMES


def test_repeated_names_are_rejected_ignoring_case() -> None:
    with pytest.raises(AdditionalInfoError) as caught:
        validate_additional_info([_pair("Vehículo", "uno"), _pair("VEHÍCULO", "dos")])
    assert "additional_info[2].name" in caught.value.errors


@pytest.mark.parametrize("field", ["name", "value"])
def test_three_hundred_characters_are_admitted_and_three_hundred_and_one_are_not(
    field: str,
) -> None:
    ok = _pair("N", "V") | {field: "x" * 300}
    assert validate_additional_info([ok])[0][field] == "x" * 300
    too_long = _pair("N", "V") | {field: "x" * 301}
    with pytest.raises(AdditionalInfoError) as caught:
        validate_additional_info([too_long])
    message = caught.value.errors[f"additional_info[1].{field}"][0]
    assert "301" in message
    assert "300" in message


@pytest.mark.parametrize("field", ["name", "value"])
@pytest.mark.parametrize("text", ["", "   ", "dos\nlíneas", "dos\rlíneas"])
def test_empty_or_multiline_text_is_rejected(field: str, text: str) -> None:
    with pytest.raises(AdditionalInfoError) as caught:
        validate_additional_info([_pair("N", "V") | {field: text}])
    assert f"additional_info[1].{field}" in caught.value.errors


@pytest.mark.parametrize(
    "item",
    [
        "texto",
        ["name", "value"],
        {"name": "N"},
        {"value": "V"},
        {"name": "N", "value": "V", "extra": "x"},
        {"name": 1, "value": "V"},
        {"name": "N", "value": None},
    ],
)
def test_malformed_pairs_are_rejected(item: Any) -> None:
    with pytest.raises(AdditionalInfoError) as caught:
        validate_additional_info([item])
    assert any(key.startswith("additional_info[1]") for key in caught.value.errors)


def test_a_list_is_required() -> None:
    with pytest.raises(AdditionalInfoError) as caught:
        validate_additional_info({"name": "N", "value": "V"})
    assert "additional_info" in caught.value.errors


def test_every_error_is_reported_not_only_the_first() -> None:
    with pytest.raises(AdditionalInfoError) as caught:
        validate_additional_info([_pair("ruc proveedor", "1"), _pair("Ok", ""), _pair("Ok", "x")])
    assert {
        "additional_info[1].name",
        "additional_info[2].value",
        "additional_info[3].name",
    } <= set(caught.value.errors)
