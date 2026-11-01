"""Detalle de servicio por línea en el borrador fiscal: precarga, ajuste y límites."""

from typing import Any

import pytest

from fiscal.domain.service_details import (
    DETAIL_MAX,
    ServiceDetailError,
    parse_service_details,
)


def test_no_details_is_valid_and_yields_an_empty_list() -> None:
    assert parse_service_details([], valid_positions=[1, 2]) == []
    assert parse_service_details(None, valid_positions=[1, 2]) == []


def test_details_are_returned_by_position_without_surrounding_spaces() -> None:
    result = parse_service_details(
        [{"position": 2, "detail": " rotación "}, {"position": 1, "detail": "frenos"}],
        valid_positions=[1, 2],
    )
    assert result == [
        {"position": 1, "detail": "frenos"},
        {"position": 2, "detail": "rotación"},
    ]


def test_an_empty_detail_is_kept_so_the_line_can_be_cleared() -> None:
    assert parse_service_details([{"position": 1, "detail": "  "}], valid_positions=[1]) == [
        {"position": 1, "detail": ""}
    ]


def test_three_hundred_characters_are_admitted() -> None:
    result = parse_service_details(
        [{"position": 1, "detail": "d" * DETAIL_MAX}], valid_positions=[1]
    )
    assert len(result[0]["detail"]) == 300


def test_three_hundred_and_one_characters_are_rejected_with_both_lengths() -> None:
    with pytest.raises(ServiceDetailError) as caught:
        parse_service_details([{"position": 1, "detail": "d" * 301}], valid_positions=[1])
    message = caught.value.errors["service_details[1].detail"][0]
    assert "301" in message
    assert "300" in message


@pytest.mark.parametrize("detail", ["dos\nlíneas", "dos\rlíneas", 7, None, ["x"]])
def test_multiline_or_non_text_details_are_rejected(detail: Any) -> None:
    with pytest.raises(ServiceDetailError) as caught:
        parse_service_details([{"position": 1, "detail": detail}], valid_positions=[1])
    assert "service_details[1].detail" in caught.value.errors


def test_a_position_that_is_not_a_line_of_the_operation_is_rejected() -> None:
    with pytest.raises(ServiceDetailError) as caught:
        parse_service_details([{"position": 9, "detail": "x"}], valid_positions=[1, 2])
    assert "service_details[1].position" in caught.value.errors


def test_a_repeated_position_is_rejected() -> None:
    with pytest.raises(ServiceDetailError) as caught:
        parse_service_details(
            [{"position": 1, "detail": "a"}, {"position": 1, "detail": "b"}], valid_positions=[1]
        )
    assert "service_details[2].position" in caught.value.errors


@pytest.mark.parametrize("position", [True, "1", 1.0, None, 0, -1])
def test_a_position_must_be_a_positive_whole_number(position: Any) -> None:
    with pytest.raises(ServiceDetailError) as caught:
        parse_service_details([{"position": position, "detail": "x"}], valid_positions=[1])
    assert "service_details[1].position" in caught.value.errors


@pytest.mark.parametrize(
    "item",
    [
        "texto",
        ["position", "detail"],
        {"position": 1},
        {"detail": "x"},
        {"position": 1, "detail": "x", "x": 1},
    ],
)
def test_malformed_entries_are_rejected(item: Any) -> None:
    with pytest.raises(ServiceDetailError) as caught:
        parse_service_details([item], valid_positions=[1])
    assert any(key.startswith("service_details[1]") for key in caught.value.errors)


def test_a_list_is_required() -> None:
    with pytest.raises(ServiceDetailError) as caught:
        parse_service_details({"position": 1, "detail": "x"}, valid_positions=[1])
    assert "service_details" in caught.value.errors


def test_a_commercial_operation_has_no_positions_so_it_accepts_none() -> None:
    assert parse_service_details([], valid_positions=[]) == []
    with pytest.raises(ServiceDetailError):
        parse_service_details([{"position": 1, "detail": "x"}], valid_positions=[])
