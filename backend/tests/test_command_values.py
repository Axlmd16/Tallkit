import pytest

from shared.command_values import (
    InvalidIdempotencyKeyError,
    canonical_fingerprint,
    validate_idempotency_key,
)


@pytest.mark.parametrize("key", ["abcdefgh", "a.b:c-d_e1", "x" * 128])
def test_valid_keys(key: str) -> None:
    assert validate_idempotency_key(key) == key


@pytest.mark.parametrize("key", ["short", "x" * 129, "with space!", "ñandúñandú", None, 12345678])
def test_invalid_keys(key: object) -> None:
    with pytest.raises(InvalidIdempotencyKeyError):
        validate_idempotency_key(key)


def test_fingerprint_ignores_key_and_order() -> None:
    a = canonical_fingerprint({"name": "x", "idempotency_key": "k1", "n": 1})
    b = canonical_fingerprint({"n": 1, "idempotency_key": "k2", "name": "x"})
    assert a == b
    assert len(a) == 64


def test_omitted_differs_from_cleared() -> None:
    omitted = canonical_fingerprint({"expected_version": 1})
    cleared = canonical_fingerprint({"expected_version": 1, "description": None})
    assert omitted != cleared


def test_set_fields_are_order_insensitive() -> None:
    kw = {"set_fields": frozenset({"ids"})}
    assert canonical_fingerprint({"ids": [3, 1, 2]}, **kw) == canonical_fingerprint(
        {"ids": [1, 2, 3]}, **kw
    )
    assert canonical_fingerprint({"ids": [3, 1]}) != canonical_fingerprint({"ids": [1, 3]})


def test_different_payload_differs() -> None:
    assert canonical_fingerprint({"a": 1}) != canonical_fingerprint({"a": 2})
