"""Detalle de servicio por línea de una preparación artesanal.

Se precarga con el que conserva la operación y se puede ajustar mientras la preparación es
borrador. Va a ``detAdicional`` de la línea (hasta 300 caracteres, ficha técnica 2.34, DP-035
regla 3). Un texto fuera de regla se rechaza: nunca se recorta.
"""

from collections.abc import Iterable
from typing import Any

DETAIL_MAX = 300
_FIELDS = frozenset({"position", "detail"})


class ServiceDetailError(Exception):
    """Detalle de servicio inválido; ``errors`` asocia campo → mensajes."""

    def __init__(self, errors: dict[str, list[str]]) -> None:
        super().__init__("El detalle de servicio contiene datos inválidos.")
        self.errors = errors


def _check_detail(raw: Any) -> tuple[str | None, str | None]:
    if not isinstance(raw, str):
        return None, "El detalle debe ser texto."
    text = raw.strip()
    if "\n" in text or "\r" in text:
        return None, "El detalle admite una sola línea."
    if len(text) > DETAIL_MAX:
        return None, f"El detalle admite hasta {DETAIL_MAX} caracteres; tiene {len(text)}."
    return text, None


def parse_service_details(items: Any, *, valid_positions: Iterable[int]) -> list[dict[str, Any]]:
    """Valida los detalles por posición y los devuelve ordenados, sin espacios exteriores."""
    if items is None:
        return []
    if not isinstance(items, list):
        raise ServiceDetailError(
            {"service_details": ["El detalle de servicio debe ser una lista."]}
        )
    valid = frozenset(valid_positions)
    errors: dict[str, list[str]] = {}
    result: dict[int, str] = {}
    for index, item in enumerate(items, start=1):
        prefix = f"service_details[{index}]"
        if not isinstance(item, dict) or set(item) != _FIELDS:
            errors[prefix] = ["Cada detalle lleva solo posición y texto."]
            continue
        position = item["position"]
        if isinstance(position, bool) or not isinstance(position, int) or position < 1:
            errors[f"{prefix}.position"] = ["La posición debe ser un entero positivo."]
        elif position not in valid:
            errors[f"{prefix}.position"] = [
                "La posición no corresponde a una línea de la operación."
            ]
        elif position in result:
            errors[f"{prefix}.position"] = ["La posición está repetida."]
        text, problem = _check_detail(item["detail"])
        if problem:
            errors[f"{prefix}.detail"] = [problem]
        if f"{prefix}.position" not in errors and text is not None:
            result[position] = text
    if errors:
        raise ServiceDetailError(errors)
    return [{"position": position, "detail": result[position]} for position in sorted(result)]
