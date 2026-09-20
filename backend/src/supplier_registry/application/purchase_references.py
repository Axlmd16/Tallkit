"""Interfaz pública de proveedores para compras.

Expone solo identidad, estado y versión; no permite editar proveedores ni copia contactos.
El bloqueo permanece en este módulo y exige una transacción exterior.
"""

from dataclasses import dataclass
from typing import Literal

from django.db import transaction
from django.db.models import Q

from supplier_registry.models import Supplier


@dataclass(frozen=True)
class SupplierReference:
    id: int
    name: str
    identification_type: str | None
    identification: str | None
    is_active: bool
    version: int


@dataclass(frozen=True)
class SupplierReferencesPage:
    items: tuple[SupplierReference, ...]
    total_count: int
    page: int
    page_size: int


class SupplierReferenceError(Exception):
    def __init__(self, code: Literal["not_found", "inactive"]) -> None:
        super().__init__(code)
        self.code = code


def _reference(supplier: Supplier) -> SupplierReference:
    return SupplierReference(
        id=supplier.pk,
        name=supplier.name,
        identification_type=supplier.identification_type,
        identification=supplier.identification,
        is_active=supplier.is_active,
        version=supplier.version,
    )


def get_supplier_reference(supplier_id: int) -> SupplierReference | None:
    supplier = Supplier.objects.filter(pk=supplier_id).first()
    return None if supplier is None else _reference(supplier)


def list_supplier_references(
    *, search: str = "", page: int = 1, page_size: int = 20, include_inactive: bool = False
) -> SupplierReferencesPage:
    queryset = Supplier.objects.all()
    if not include_inactive:
        queryset = queryset.filter(is_active=True)
    term = search.strip()
    if term:
        queryset = queryset.filter(Q(name__icontains=term) | Q(identification__icontains=term))
    queryset = queryset.order_by("name", "id")
    total = queryset.count()
    offset = (page - 1) * page_size
    items = tuple(_reference(s) for s in queryset[offset : offset + page_size])
    return SupplierReferencesPage(items=items, total_count=total, page=page, page_size=page_size)


def lock_supplier_reference(supplier_id: int, *, require_active: bool = True) -> SupplierReference:
    """Bloquea la raíz del proveedor dentro de la transacción vigente."""
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("El bloqueo de proveedores requiere una transacción atómica.")
    supplier = Supplier.objects.select_for_update().filter(pk=supplier_id).first()
    if supplier is None:
        raise SupplierReferenceError("not_found")
    if require_active and not supplier.is_active:
        raise SupplierReferenceError("inactive")
    return _reference(supplier)
