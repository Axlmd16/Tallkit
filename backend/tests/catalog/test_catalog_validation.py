from decimal import Decimal

import pytest

from catalog.domain.errors import CatalogValidationError
from catalog.domain.validation import (
    normalize_code,
    normalize_name,
    normalize_name_key,
    validate_brand,
    validate_category,
    validate_content_quantity,
    validate_id_set,
    validate_price,
    validate_product,
    validate_service,
    validate_unit,
)


def _product(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "code": " ab-1 ",
        "name": "  Aceite 10W40 ",
        "category_id": 1,
        "unit_id": 2,
        "tax_definition_id": 3,
        "content_quantity": "1.5",
        "sale_price": "12.30",
    }
    base.update(overrides)
    return base


def test_name_is_trimmed_and_keeps_case_and_inner_spaces() -> None:
    assert normalize_name("  Filtros   de Aceite ") == "Filtros   de Aceite"


@pytest.mark.parametrize("value", [None, "", "   ", 5])
def test_name_required(value: object) -> None:
    with pytest.raises(CatalogValidationError) as exc:
        normalize_name(value)
    assert "name" in exc.value.errors


def test_name_length_limit() -> None:
    assert len(normalize_name("a" * 255)) == 255
    with pytest.raises(CatalogValidationError):
        normalize_name("a" * 256)


def test_name_key_is_case_insensitive_but_keeps_accents_and_inner_spaces() -> None:
    assert normalize_name_key(" ÁRBOL Uno ") == "árbol uno"
    assert normalize_name_key("Arbol") != normalize_name_key("Árbol")
    assert normalize_name_key("a  b") != normalize_name_key("a b")


def test_code_uppercased_and_trimmed() -> None:
    assert normalize_code("  fil-01ñ ") == "FIL-01Ñ"
    with pytest.raises(CatalogValidationError):
        normalize_code("x" * 65)
    with pytest.raises(CatalogValidationError):
        normalize_code("  ")


def test_category_rejects_hierarchy() -> None:
    with pytest.raises(CatalogValidationError) as exc:
        validate_category({"name": "A", "parent_id": 1})
    assert "parent_id" in exc.value.errors
    assert validate_category({"name": " A ", "description": None}).description == ""


def test_unit_and_brand() -> None:
    unit = validate_unit({"name": "Litro", "symbol": " L "})
    assert (unit.name, unit.symbol) == ("Litro", "L")
    with pytest.raises(CatalogValidationError):
        validate_unit({"name": "Litro", "symbol": "s" * 33})
    assert validate_brand({"name": " Bosch "}).name == "Bosch"


@pytest.mark.parametrize(
    ("text", "expected"),
    [("0", "0.00"), ("10", "10.00"), ("10.5", "10.50"), ("999999999999.99", "999999999999.99")],
)
def test_price_valid(text: str, expected: str) -> None:
    assert validate_price(text) == Decimal(expected)


@pytest.mark.parametrize(
    "value",
    [
        "-0.01",
        "1.001",
        "1e3",
        "NaN",
        "Infinity",
        "1,5",
        "",
        "abc",
        "1000000000000.00",
        5,
        5.5,
        True,
    ],
)
def test_price_invalid(value: object) -> None:
    with pytest.raises(CatalogValidationError):
        validate_price(value)


def test_content_positive_up_to_six_decimals() -> None:
    assert validate_content_quantity("0.000001") == Decimal("0.000001")
    assert validate_content_quantity("999999999999.999999")
    for bad in ["0", "0.0000001", "-1", "1E2", 3, "1000000000000"]:
        with pytest.raises(CatalogValidationError):
            validate_content_quantity(bad)


def test_product_normalization() -> None:
    p = validate_product(_product(vehicle_brand_ids=[5, 3], product_brand_id=None, is_kit=True))
    assert p.code == "AB-1"
    assert p.name == "Aceite 10W40"
    assert p.vehicle_brand_ids == (3, 5)
    assert p.is_kit is True
    assert p.description == ""


@pytest.mark.parametrize(
    "override",
    [
        {"category_id": None},
        {"unit_id": 0},
        {"tax_definition_id": "1"},
        {"is_kit": "yes"},
        {"vehicle_brand_ids": [1, 1]},
        {"vehicle_brand_ids": "1"},
        {"content_quantity": 1},
    ],
)
def test_product_invalid(override: dict[str, object]) -> None:
    with pytest.raises(CatalogValidationError):
        validate_product(_product(**override))


def test_id_set_none_is_empty() -> None:
    assert validate_id_set(None, "vehicle_brand_ids") == ()


def test_service_allows_same_name_and_has_no_code() -> None:
    s = validate_service({"name": " Alineación ", "reference_price": "15", "tax_definition_id": 1})
    assert s.name == "Alineación"
    assert s.reference_price == Decimal("15.00")
    assert not hasattr(s, "code")
    with pytest.raises(CatalogValidationError) as exc:
        validate_service({"name": "x", "reference_price": "-1", "tax_definition_id": 1})
    assert "reference_price" in exc.value.errors
