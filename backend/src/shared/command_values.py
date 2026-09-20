"""Funciones puras para claves de comando idempotentes y huellas canónicas.

No comparten persistencia: cada módulo conserva su propio recibo y transacción.
"""

import hashlib
import json
import re
from typing import Any

IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")

_ABSENT = object()


class InvalidIdempotencyKeyError(ValueError):
    pass


def validate_idempotency_key(value: Any) -> str:
    if not isinstance(value, str) or not IDEMPOTENCY_KEY_PATTERN.match(value):
        raise InvalidIdempotencyKeyError(
            "La clave debe tener de 8 a 128 caracteres ASCII: letras, dígitos, . _ : -"
        )
    return value


def _canonicalize(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _canonicalize(v) for k, v in value.items()}
    if isinstance(value, tuple):
        return [_canonicalize(v) for v in value]
    if isinstance(value, set | frozenset):
        return sorted(_canonicalize(v) for v in value)
    return value


def canonical_fingerprint(
    payload: dict[str, Any],
    *,
    set_fields: frozenset[str] = frozenset(),
    exclude: frozenset[str] = frozenset({"idempotency_key"}),
) -> str:
    """SHA-256 canónico de los campos enviados.

    Un campo omitido no aparece y uno enviado como ``None`` sí, de modo que
    omitir y borrar producen huellas distintas. Los campos de ``set_fields``
    representan conjuntos y se ordenan.
    """
    data: dict[str, Any] = {}
    for key, value in payload.items():
        if key in exclude:
            continue
        if key in set_fields and isinstance(value, list | tuple | set | frozenset):
            value = sorted(value)
        data[key] = _canonicalize(value)
    canonical = json.dumps(
        data, sort_keys=True, separators=(",", ":"), ensure_ascii=True, default=str
    )
    return hashlib.sha256(canonical.encode()).hexdigest()
