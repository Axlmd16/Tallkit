"""Reglas puras del proveedor: solo el nombre es obligatorio.

Reutiliza las reglas CI/RUC de personas sin exigir tipo de persona ni teléfono.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from customer_registry.domain.identification import (
    CustomerValidationError,
    IdentificationType,
    validate_email,
    validate_identification,
    validate_identification_type,
)
from supplier_registry.domain.errors import SupplierValidationError

NAME_MAX = 255
PHONE_MAX = 64
ADDRESS_MAX = 1024


def _fail(field: str, message: str) -> SupplierValidationError:
    return SupplierValidationError(message, errors={field: [message]})


def _translate(fn: Callable[[], Any]) -> Any:
    try:
        return fn()
    except CustomerValidationError as exc:
        raise SupplierValidationError(str(exc), errors=exc.errors) from exc


def normalize_supplier_name(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise _fail("name", "El nombre o razón social es obligatorio.")
    stripped = value.strip()
    if len(stripped) > NAME_MAX:
        raise _fail("name", f"El nombre no puede exceder {NAME_MAX} caracteres.")
    return stripped


def normalize_name_key(value: str) -> str:
    return value.strip().lower()


def _optional_text(value: Any, field: str, limit: int, label: str) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise _fail(field, f"{label} debe ser texto.")
    stripped = value.strip()
    if len(stripped) > limit:
        raise _fail(field, f"{label} no puede exceder {limit} caracteres.")
    return stripped


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


@dataclass(frozen=True)
class NormalizedSupplier:
    name: str
    identification_type: str | None
    identification: str | None
    phone: str
    email: str
    address: str


def validate_supplier(data: dict[str, Any]) -> NormalizedSupplier:
    name = normalize_supplier_name(data.get("name"))
    raw_type = data.get("identification_type")
    raw_doc = data.get("identification")
    type_blank, doc_blank = _is_blank(raw_type), _is_blank(raw_doc)

    id_type: str | None = None
    doc: str | None = None
    if type_blank != doc_blank:
        missing = "identification" if doc_blank else "identification_type"
        raise _fail(
            missing,
            "Tipo y número de identificación deben informarse juntos o quedar ambos vacíos.",
        )
    if not type_blank:
        resolved: IdentificationType = _translate(lambda: validate_identification_type(raw_type))
        id_type = resolved.value
        doc = _translate(lambda: validate_identification(raw_doc, resolved))

    return NormalizedSupplier(
        name=name,
        identification_type=id_type,
        identification=doc,
        phone=_optional_text(data.get("phone"), "phone", PHONE_MAX, "El teléfono"),
        email=_translate(lambda: validate_email(data.get("email"))),
        address=_optional_text(data.get("address"), "address", ADDRESS_MAX, "La dirección"),
    )
