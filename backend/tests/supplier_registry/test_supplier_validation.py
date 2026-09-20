from typing import Any

import pytest

from customer_registry.domain import identification
from supplier_registry.domain.errors import SupplierValidationError
from supplier_registry.domain.validation import (
    normalize_name_key,
    normalize_supplier_name,
    validate_supplier,
)


def test_only_name_is_required() -> None:
    s = validate_supplier({"name": "  Repuestos SA  "})
    assert s.name == "Repuestos SA"
    assert s.identification_type is None
    assert s.identification is None
    assert (s.phone, s.email, s.address) == ("", "", "")


@pytest.mark.parametrize("value", [None, "", "  ", 3])
def test_name_required(value: object) -> None:
    with pytest.raises(SupplierValidationError) as exc:
        normalize_supplier_name(value)
    assert "name" in exc.value.errors


def test_name_too_long() -> None:
    with pytest.raises(SupplierValidationError):
        normalize_supplier_name("x" * 256)


def test_blank_pair_is_absent() -> None:
    s = validate_supplier({"name": "A", "identification_type": "", "identification": "  "})
    assert s.identification_type is None
    assert s.identification is None


@pytest.mark.parametrize(
    "extra",
    [{"identification_type": "CI"}, {"identification": "0912345678"}],
)
def test_incomplete_pair_rejected(extra: dict[str, str]) -> None:
    with pytest.raises(SupplierValidationError):
        validate_supplier({"name": "A", **extra})


def test_ci_and_ruc_lengths_and_leading_zeros() -> None:
    ok = validate_supplier(
        {"name": "A", "identification_type": " ci ", "identification": " 0912345678 "}
    )
    assert (ok.identification_type, ok.identification) == ("CI", "0912345678")
    ruc = validate_supplier(
        {"name": "A", "identification_type": "RUC", "identification": "0912345678001"}
    )
    assert ruc.identification == "0912345678001"
    for typ, doc in [("CI", "123"), ("RUC", "0912345678"), ("PAS", "0912345678")]:
        with pytest.raises(SupplierValidationError):
            validate_supplier({"name": "A", "identification_type": typ, "identification": doc})


def test_contacts_optional_and_validated() -> None:
    s = validate_supplier(
        {"name": "A", "phone": " 099 ", "email": "a@b.co", "address": " Calle 1 "}
    )
    assert (s.phone, s.email, s.address) == ("099", "a@b.co", "Calle 1")
    bad_values: list[dict[str, Any]] = [
        {"email": "no-email"},
        {"phone": "9" * 65},
        {"address": "a" * 1025},
        {"phone": 5},
    ]
    for bad in bad_values:
        with pytest.raises(SupplierValidationError):
            validate_supplier({"name": "A", **bad})


def test_name_key_and_identification_reexport() -> None:
    assert normalize_name_key(" ACME ") == "acme"
    assert identification.IdentificationType.CI.value == "CI"
