"""Reglas puras de validación y normalización del catálogo.

No depende de Django, DRF ni HTTP. Las reglas entre registros (categoría activa,
ámbito tributario, unicidad) pertenecen a la capa de aplicación.
"""

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from catalog.domain.errors import CatalogValidationError

NAME_MAX = 255
DESCRIPTION_MAX = 2000
# `codigoPrincipal` del comprobante electrónico admite 25 caracteres; el código del fabricante
# es una referencia externa que no viaja al comprobante.
PRODUCT_CODE_MAX = 25
MANUFACTURER_CODE_MAX = 64
SYMBOL_MAX = 32

PRICE_MAX = Decimal("999999999999.99")
PRICE_SCALE = 2
CONTENT_MAX = Decimal("999999999999.999999")
CONTENT_SCALE = 6

_DECIMAL_TEXT = re.compile(r"^-?\d+(\.\d+)?$")


def _fail(field: str, message: str) -> CatalogValidationError:
    return CatalogValidationError(message, errors={field: [message]})


def normalize_name(value: Any, field: str = "name", label: str = "El nombre") -> str:
    """Recorta espacios exteriores; conserva capitalización y espacios interiores."""
    if not isinstance(value, str) or not value.strip():
        raise _fail(field, f"{label} es obligatorio.")
    stripped = value.strip()
    if len(stripped) > NAME_MAX:
        raise _fail(field, f"{label} no puede exceder {NAME_MAX} caracteres.")
    return stripped


def normalize_name_key(value: str) -> str:
    """Clave de comparación de duplicados: equivalente a ``Lower(Trim(name))``."""
    return value.strip().lower()


def normalize_code(value: Any, *, current: str | None = None) -> str:
    """Código interno normalizado; `current` es el código vigente de un producto que se edita.

    Un producto registrado antes del límite conserva su código largo mientras no lo cambie:
    solo un código distinto del vigente debe caber en `PRODUCT_CODE_MAX`.
    """
    if not isinstance(value, str) or not value.strip():
        raise _fail("code", "El código es obligatorio.")
    code = value.strip().upper()
    if "\n" in code or "\r" in code:
        raise _fail("code", "El código no puede contener saltos de línea.")
    if len(code) > PRODUCT_CODE_MAX and code != current:
        raise _fail("code", f"El código no puede exceder {PRODUCT_CODE_MAX} caracteres.")
    return code


def normalize_manufacturer_code(value: Any) -> str:
    """Código de fabricante opcional; vacío o ausente equivale a ``""``."""
    if value is None:
        return ""
    if not isinstance(value, str):
        raise _fail("manufacturer_code", "El código del fabricante debe ser texto.")
    code = value.strip().upper()
    if len(code) > MANUFACTURER_CODE_MAX:
        raise _fail(
            "manufacturer_code",
            f"El código del fabricante no puede exceder {MANUFACTURER_CODE_MAX} caracteres.",
        )
    return code


def normalize_optional_text(
    value: Any, field: str, max_length: int = DESCRIPTION_MAX, label: str = "El campo"
) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise _fail(field, f"{label} debe ser texto.")
    stripped = value.strip()
    if len(stripped) > max_length:
        raise _fail(field, f"{label} no puede exceder {max_length} caracteres.")
    return stripped


def _parse_decimal(value: Any, field: str, label: str, scale: int, maximum: Decimal) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, str):
        raise _fail(field, f"{label} debe enviarse como texto decimal.")
    text = value.strip()
    if not _DECIMAL_TEXT.match(text):
        raise _fail(field, f"{label} debe ser un número decimal ordinario.")
    try:
        number = Decimal(text)
    except InvalidOperation as exc:  # pragma: no cover - el patrón ya lo impide
        raise _fail(field, f"{label} no es un número válido.") from exc
    if -number.as_tuple().exponent > scale:  # type: ignore[operator]
        raise _fail(field, f"{label} admite como máximo {scale} decimales.")
    if number > maximum:
        raise _fail(field, f"{label} no puede exceder {maximum}.")
    return number


def validate_price(value: Any, field: str = "sale_price", label: str = "El precio") -> Decimal:
    """Precio final en USD: 0 a 999999999999.99, hasta dos decimales, sin redondeo."""
    number = _parse_decimal(value, field, label, PRICE_SCALE, PRICE_MAX)
    if number < 0:
        raise _fail(field, f"{label} no puede ser negativo.")
    return number.quantize(Decimal("0.01"))


def validate_content_quantity(value: Any, field: str = "content_quantity") -> Decimal:
    """Contenido de la presentación: mayor que cero, hasta seis decimales."""
    number = _parse_decimal(value, field, "El contenido", CONTENT_SCALE, CONTENT_MAX)
    if number <= 0:
        raise _fail(field, "El contenido debe ser mayor que cero.")
    return number


def validate_id(value: Any, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise _fail(field, "Debe ser un identificador entero positivo.")
    return int(value)


def validate_optional_id(value: Any, field: str) -> int | None:
    return None if value is None else validate_id(value, field)


def validate_id_set(value: Any, field: str) -> tuple[int, ...]:
    """Lista de IDs sin duplicados; se devuelve ordenada porque representa un conjunto."""
    if value is None:
        return ()
    if not isinstance(value, list | tuple):
        raise _fail(field, "Debe ser una lista de identificadores.")
    ids = [validate_id(item, field) for item in value]
    if len(set(ids)) != len(ids):
        raise _fail(field, "La lista no puede contener identificadores repetidos.")
    return tuple(sorted(ids))


@dataclass(frozen=True)
class NormalizedCategory:
    name: str
    description: str


def validate_category(data: dict[str, Any]) -> NormalizedCategory:
    if "parent_id" in data or "parent" in data:
        raise _fail("parent_id", "Las categorías son planas; no admiten categoría padre.")
    return NormalizedCategory(
        name=normalize_name(data.get("name"), label="El nombre de la categoría"),
        description=normalize_optional_text(
            data.get("description"), "description", label="La descripción"
        ),
    )


@dataclass(frozen=True)
class NormalizedUnit:
    name: str
    symbol: str


def validate_unit(data: dict[str, Any]) -> NormalizedUnit:
    return NormalizedUnit(
        name=normalize_name(data.get("name"), label="El nombre de la unidad"),
        symbol=normalize_optional_text(
            data.get("symbol"), "symbol", SYMBOL_MAX, label="El símbolo"
        ),
    )


@dataclass(frozen=True)
class NormalizedBrand:
    name: str


def validate_brand(data: dict[str, Any]) -> NormalizedBrand:
    return NormalizedBrand(name=normalize_name(data.get("name"), label="El nombre de la marca"))


@dataclass(frozen=True)
class NormalizedProduct:
    code: str
    manufacturer_code: str
    name: str
    description: str
    category_id: int
    unit_id: int
    product_brand_id: int | None
    vehicle_brand_ids: tuple[int, ...]
    tax_definition_id: int
    content_quantity: Decimal
    sale_price: Decimal
    is_kit: bool


def validate_product(data: dict[str, Any], *, current_code: str | None = None) -> NormalizedProduct:
    is_kit = data.get("is_kit", False)
    if not isinstance(is_kit, bool):
        raise _fail("is_kit", "El indicador de kit debe ser verdadero o falso.")
    return NormalizedProduct(
        code=normalize_code(data.get("code"), current=current_code),
        manufacturer_code=normalize_manufacturer_code(data.get("manufacturer_code")),
        name=normalize_name(data.get("name"), label="El nombre del producto"),
        description=normalize_optional_text(
            data.get("description"), "description", label="La descripción"
        ),
        category_id=validate_id(data.get("category_id"), "category_id"),
        unit_id=validate_id(data.get("unit_id"), "unit_id"),
        product_brand_id=validate_optional_id(data.get("product_brand_id"), "product_brand_id"),
        vehicle_brand_ids=validate_id_set(data.get("vehicle_brand_ids"), "vehicle_brand_ids"),
        tax_definition_id=validate_id(data.get("tax_definition_id"), "tax_definition_id"),
        content_quantity=validate_content_quantity(data.get("content_quantity")),
        sale_price=validate_price(data.get("sale_price")),
        is_kit=is_kit,
    )


@dataclass(frozen=True)
class NormalizedService:
    name: str
    description: str
    reference_price: Decimal
    tax_definition_id: int


def validate_service(data: dict[str, Any]) -> NormalizedService:
    return NormalizedService(
        name=normalize_name(data.get("name"), label="El nombre del servicio"),
        description=normalize_optional_text(
            data.get("description"), "description", label="La descripción"
        ),
        reference_price=validate_price(
            data.get("reference_price"), "reference_price", "El precio referencial"
        ),
        tax_definition_id=validate_id(data.get("tax_definition_id"), "tax_definition_id"),
    )
