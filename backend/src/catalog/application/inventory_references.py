"""Interfaz pública del catálogo para compras e inventario.

Los consumidores obtienen DTO congelados con lo necesario para identificar y valorar un
producto; nunca reciben precio de venta ni escriben persistencia del catálogo. Los
bloqueos permanecen dentro del módulo y exigen una transacción exterior.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.db.models import Q

from catalog.models import Product


@dataclass(frozen=True)
class ProductReference:
    id: int
    code: str
    name: str
    content_quantity: Decimal
    unit_id: int
    unit_name: str
    unit_symbol: str
    is_active: bool
    tax_definition_id: int


@dataclass(frozen=True)
class ProductReferencesPage:
    items: tuple[ProductReference, ...]
    total_count: int
    page: int
    page_size: int


class ProductReferenceError(Exception):
    def __init__(self, missing: tuple[int, ...] = (), inactive: tuple[int, ...] = ()) -> None:
        super().__init__("Referencia de producto inválida.")
        self.missing = missing
        self.inactive = inactive


def _reference(product: Product) -> ProductReference:
    return ProductReference(
        id=product.pk,
        code=product.code,
        name=product.name,
        content_quantity=product.content_quantity,
        unit_id=product.unit_id,
        unit_name=product.unit.name,
        unit_symbol=product.unit.symbol,
        is_active=product.is_active,
        tax_definition_id=product.tax_definition_id,
    )


def get_product_references(ids: Iterable[int]) -> dict[int, ProductReference]:
    """Referencias activas o inactivas por ID en una sola consulta."""
    products = Product.objects.select_related("unit").filter(pk__in=set(ids)).order_by("pk")
    return {p.pk: _reference(p) for p in products}


def list_product_references(
    *, search: str = "", page: int = 1, page_size: int = 20, include_inactive: bool = False
) -> ProductReferencesPage:
    """Búsqueda paginada en servidor por código, código de fabricante o nombre."""
    queryset = Product.objects.select_related("unit")
    if not include_inactive:
        queryset = queryset.filter(is_active=True)
    term = search.strip()
    if term:
        queryset = queryset.filter(
            Q(code__icontains=term) | Q(manufacturer_code__icontains=term) | Q(name__icontains=term)
        )
    queryset = queryset.order_by("name", "id")
    total = queryset.count()
    offset = (page - 1) * page_size
    items = tuple(_reference(p) for p in queryset[offset : offset + page_size])
    return ProductReferencesPage(items=items, total_count=total, page=page, page_size=page_size)


def lock_product_references(
    ids: Iterable[int], *, require_active: bool = True
) -> dict[int, ProductReference]:
    """Bloquea los productos por ID ascendente dentro de la transacción vigente."""
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("El bloqueo de productos requiere una transacción atómica.")
    requested = sorted(set(ids))
    locked = {
        p.pk: p
        for p in Product.objects.select_related("unit")
        .select_for_update(of=("self",))
        .filter(pk__in=requested)
        .order_by("pk")
    }
    missing = tuple(i for i in requested if i not in locked)
    inactive = tuple(i for i in requested if i in locked and not locked[i].is_active)
    if missing or (require_active and inactive):
        raise ProductReferenceError(missing=missing, inactive=inactive if require_active else ())
    return {pk: _reference(p) for pk, p in locked.items()}
