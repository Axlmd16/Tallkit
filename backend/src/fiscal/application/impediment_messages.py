"""Traduce impedimentos técnicos a mensajes comprensibles y a su responsable.

Los datos del receptor y de las formas de pago los completa el usuario operativo; los
de configuración (perfil, puntos, catálogo, formas habilitadas) los resuelve el
Administrador. Ningún mensaje ofrece al usuario operativo corregir datos técnicos.
"""

from typing import Any

OPERATOR = "OPERATOR"
ADMINISTRATOR = "ADMINISTRATOR"

_CONFIGURATION_MESSAGES = {
    "profile": "La entidad todavía no tiene configuración fiscal electrónica guardada.",
    "matrix_address": "Falta la dirección matriz de la entidad.",
    "point_missing": "La entidad no tiene un punto de emisión activo.",
    "default_point_required": "La entidad tiene varios puntos activos sin punto predeterminado.",
    "establishment_address": "Falta la dirección del establecimiento predeterminado.",
    "payment_forms_missing": "La entidad no tiene formas de pago habilitadas.",
    "default_payment_form_required": "La entidad no tiene forma de pago predeterminada.",
}
_SUFFIX = " Debe resolverlo el Administrador en Configuración, pestaña Facturación electrónica."


def _configuration_message(code: str, fallback: str) -> str:
    if code in _CONFIGURATION_MESSAGES:
        return _CONFIGURATION_MESSAGES[code] + _SUFFIX
    if code.startswith("conditions."):
        return "Una condición tributaria de la entidad falta o está fuera de vigencia." + _SUFFIX
    if code.startswith("tax_mapping."):
        return "Un impuesto de la entidad no tiene correspondencia vigente con el SRI." + _SUFFIX
    return (fallback or "La configuración fiscal no está lista.") + _SUFFIX


def classify(impediment: dict[str, Any]) -> dict[str, str]:
    field = str(impediment.get("field", ""))
    message = str(impediment.get("message", ""))
    if field.startswith("config."):
        code = field.removeprefix("config.")
        return {
            "field": field,
            "code": code,
            "audience": ADMINISTRATOR,
            "message": _configuration_message(code, message),
        }
    if field.startswith("line[") and field.endswith(".tax_mapping"):
        return {
            "field": field,
            "code": "line_tax_mapping",
            "audience": ADMINISTRATOR,
            "message": "Un producto o servicio usa un impuesto sin correspondencia vigente con "
            "el SRI." + _SUFFIX,
        }
    return {"field": field, "code": field, "audience": OPERATOR, "message": message}


def classify_all(impediments: Any) -> tuple[dict[str, str], ...]:
    return tuple(classify(item) for item in impediments)
