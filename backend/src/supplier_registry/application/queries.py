"""Consultas y proyecciones JSON de proveedores."""

from dataclasses import dataclass
from typing import Any

from django.db.models import Q, QuerySet
from django.db.models.functions import Lower, Trim

from supplier_registry.application.errors import SupplierApplicationError, field_error, not_found
from supplier_registry.domain.validation import normalize_name_key
from supplier_registry.models import Supplier

MAX_PAGE_SIZE = 100
MATCH_LIMIT = 10


@dataclass(frozen=True)
class Page:
    results: list[dict[str, Any]]
    count: int
    page: int
    page_size: int

    def as_dict(self) -> dict[str, Any]:
        total_pages = -(-self.count // self.page_size) if self.count else 0
        return {
            "count": self.count,
            "page": self.page,
            "page_size": self.page_size,
            "total_pages": total_pages,
            "results": self.results,
        }


def supplier_dict(supplier: Supplier) -> dict[str, Any]:
    return {
        "id": supplier.pk,
        "name": supplier.name,
        "identification_type": supplier.identification_type,
        "identification": supplier.identification,
        "phone": supplier.phone,
        "email": supplier.email,
        "address": supplier.address,
        "is_active": supplier.is_active,
        "version": supplier.version,
        "created_at": supplier.created_at.isoformat(),
        "updated_at": supplier.updated_at.isoformat(),
    }


def _positive_int(value: Any, field: str, maximum: int | None = None) -> int:
    try:
        number = int(str(value))
    except ValueError:
        raise field_error("validation_error", field, "Debe ser un entero positivo.") from None
    if number < 1 or (maximum is not None and number > maximum):
        raise field_error("validation_error", field, "Valor fuera del rango permitido.")
    return number


def _ordered(queryset: QuerySet[Supplier]) -> QuerySet[Supplier]:
    return queryset.order_by(Lower(Trim("name")), "id")


def list_suppliers(params: dict[str, Any]) -> Page:
    search = params.get("search", "")
    if not isinstance(search, str):
        raise field_error("validation_error", "search", "La búsqueda debe ser texto.")
    is_active = params.get("is_active", "true")
    if is_active not in ("true", "false", "all"):
        raise field_error("validation_error", "is_active", "Use true, false o all.")
    page = _positive_int(params.get("page", 1), "page")
    page_size = _positive_int(params.get("page_size", 20), "page_size", MAX_PAGE_SIZE)

    queryset = Supplier.objects.all()
    if is_active != "all":
        queryset = queryset.filter(is_active=is_active == "true")
    term = search.strip()
    if term:
        queryset = queryset.filter(Q(name__icontains=term) | Q(identification__icontains=term))
    queryset = _ordered(queryset)
    count = queryset.count()
    offset = (page - 1) * page_size
    rows = list(queryset[offset : offset + page_size])
    return Page([supplier_dict(s) for s in rows], count, page, page_size)


def get_supplier(pk: int) -> dict[str, Any]:
    supplier = Supplier.objects.filter(pk=pk).first()
    if supplier is None:
        raise not_found("El proveedor")
    return supplier_dict(supplier)


def find_name_matches(payload: dict[str, Any]) -> dict[str, Any]:
    """Coincidencias por nombre completo normalizado, incluidos inactivos.

    Advertencia consultiva: no copia contactos ni impide guardar.
    """
    unknown = set(payload) - {"name", "exclude_id"}
    if unknown:
        raise SupplierApplicationError(
            "unknown_field",
            "La solicitud contiene campos no admitidos.",
            {n: ["Campo no admitido."] for n in sorted(unknown)},
        )
    name = payload.get("name")
    if not isinstance(name, str) or not name.strip():
        raise field_error("validation_error", "name", "El nombre es obligatorio.")
    queryset = Supplier.objects.annotate(_key=Lower(Trim("name"))).filter(
        _key=normalize_name_key(name)
    )
    if (exclude_id := payload.get("exclude_id")) is not None:
        if isinstance(exclude_id, bool) or not isinstance(exclude_id, int):
            raise field_error("validation_error", "exclude_id", "Debe ser un entero.")
        queryset = queryset.exclude(pk=exclude_id)
    rows = list(queryset.order_by("name", "id")[: MATCH_LIMIT + 1])
    return {
        "results": [
            {"id": s.pk, "name": s.name, "is_active": s.is_active} for s in rows[:MATCH_LIMIT]
        ],
        "has_more": len(rows) > MATCH_LIMIT,
    }
