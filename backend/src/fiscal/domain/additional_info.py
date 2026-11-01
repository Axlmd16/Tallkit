"""Detalle adicional del comprobante: pares de nombre y valor que completan toda la factura.

El esquema 2.1.0 admite hasta 15 ``campoAdicional`` de hasta 300 caracteres. Se reservan 3
para los campos que agregan el sistema y el proveedor de emisión, por lo que el usuario puede
escribir hasta 12 (DP-035). Nada se recorta ni se corrige: un valor fuera de regla se rechaza.
"""

from typing import Any

MAX_PAIRS = 12
NAME_MAX = 300
VALUE_MAX = 300
# Los escribe el sistema, no el usuario: ``NOR-004`` (RUC Proveedor) y ``NOR-003`` (Anexo 24).
RESERVED_NAMES = frozenset({"ruc proveedor", "gran contribuyente"})
_FIELDS = frozenset({"name", "value"})


class AdditionalInfoError(Exception):
    """Detalle adicional inválido; ``errors`` asocia campo → mensajes."""

    def __init__(self, errors: dict[str, list[str]]) -> None:
        super().__init__("El detalle adicional contiene datos inválidos.")
        self.errors = errors


def _key(name: str) -> str:
    """Nombre comparable: sin mayúsculas ni espacios repetidos."""
    return " ".join(name.split()).casefold()


def _text(raw: Any, limit: int, label: str) -> tuple[str | None, str | None]:
    if not isinstance(raw, str):
        return None, f"{label} debe ser texto."
    text = raw.strip()
    if not text:
        return None, f"{label} es obligatorio."
    if "\n" in text or "\r" in text:
        return None, f"{label} admite una sola línea."
    if len(text) > limit:
        return None, f"{label} admite hasta {limit} caracteres; tiene {len(text)}."
    return text, None


def validate_additional_info(items: Any) -> list[dict[str, str]]:
    """Devuelve los pares sin espacios exteriores o acumula todos los errores por campo."""
    if items is None:
        return []
    if not isinstance(items, list):
        raise AdditionalInfoError({"additional_info": ["El detalle adicional debe ser una lista."]})
    errors: dict[str, list[str]] = {}
    if len(items) > MAX_PAIRS:
        errors["additional_info"] = [f"Se admiten hasta {MAX_PAIRS} datos adicionales."]
    result: list[dict[str, str]] = []
    seen: set[str] = set()
    for position, item in enumerate(items, start=1):
        prefix = f"additional_info[{position}]"
        if not isinstance(item, dict) or set(item) != _FIELDS:
            errors[prefix] = ["Cada dato lleva solo nombre y valor."]
            continue
        name, name_error = _text(item["name"], NAME_MAX, "El nombre")
        value, value_error = _text(item["value"], VALUE_MAX, "El valor")
        if name_error:
            errors[f"{prefix}.name"] = [name_error]
        if value_error:
            errors[f"{prefix}.value"] = [value_error]
        if name is not None:
            key = _key(name)
            if key in RESERVED_NAMES:
                errors[f"{prefix}.name"] = [
                    f"«{name}» está reservado: el sistema lo agrega y no lo escribe el usuario."
                ]
            elif key in seen:
                errors[f"{prefix}.name"] = [f"El nombre «{name}» está repetido."]
            seen.add(key)
        if name is not None and value is not None and f"{prefix}.name" not in errors:
            result.append({"name": name, "value": value})
    if errors:
        raise AdditionalInfoError(errors)
    return result
