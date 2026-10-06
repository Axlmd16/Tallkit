"""Interfaz pública del catálogo para ventas comerciales.

Los consumidores obtienen DTO congelados con el precio final vigente y la elección tributaria
del producto; nunca escriben persistencia del catálogo. Los bloqueos permanecen dentro del
proceso y exigen una transacción exterior. La interfaz de inventario no cambia: sus
consumidores siguen sin conocer el precio de venta.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.db.models import Q

from catalog.models import Product


@dataclass(frozen=True)
class SaleProductReference:
    id: int
    code: str
    name: str
    content_quantity: Decimal
    unit_id: int
    unit_name: str
    unit_symbol: str
    is_active: bool
    is_kit: bool
    sale_price: Decimal
    tax_definition_id: int
    manufacturer_code: str = ""
    brand_name: str = ""


@dataclass(frozen=True)
class SaleProductOptionsPage:
    items: tuple[SaleProductReference, ...]
    total_count: int
    page: int
    page_size: int


class SaleProductReferenceError(Exception):
    def __init__(self, missing: tuple[int, ...] = (), inactive: tuple[int, ...] = ()) -> None:
        super().__init__("Referencia de producto de venta inválida.")
        self.missing = missing
        self.inactive = inactive


def _reference(product: Product) -> SaleProductReference:
    return SaleProductReference(
        id=product.pk,
        code=product.code,
        name=product.name,
        content_quantity=product.content_quantity,
        unit_id=product.unit_id,
        unit_name=product.unit.name,
        unit_symbol=product.unit.symbol,
        is_active=product.is_active,
        is_kit=product.is_kit,
        sale_price=product.sale_price,
        tax_definition_id=product.tax_definition_id,
        manufacturer_code=product.manufacturer_code,
        brand_name=product.product_brand.name if product.product_brand else "",
    )


def get_sale_product_references(ids: Iterable[int]) -> dict[int, SaleProductReference]:
    """Referencias activas o inactivas por ID en una sola consulta (consulta histórica)."""
    products = (
        Product.objects.select_related("unit", "product_brand")
        .filter(pk__in=set(ids))
        .order_by("pk")
    )
    return {p.pk: _reference(p) for p in products}


def list_sale_product_options(
    *, search: str = "", page: int = 1, page_size: int = 20
) -> SaleProductOptionsPage:
    """Productos activos seleccionables, paginados en servidor con orden estable."""
    queryset = Product.objects.select_related("unit", "product_brand").filter(is_active=True)
    term = search.strip()
    if term:
        queryset = queryset.filter(
            Q(code__icontains=term) | Q(manufacturer_code__icontains=term) | Q(name__icontains=term)
        )
    queryset = queryset.order_by("name", "id")
    total = queryset.count()
    offset = (page - 1) * page_size
    items = tuple(_reference(p) for p in queryset[offset : offset + page_size])
    return SaleProductOptionsPage(items=items, total_count=total, page=page, page_size=page_size)


def lock_product_references(
    ids: Iterable[int], *, require_active: bool = True
) -> dict[int, SaleProductReference]:
    """Bloquea los productos por ID ascendente dentro de la transacción vigente."""
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("El bloqueo de productos requiere una transacción atómica.")
    requested = sorted(set(ids))
    locked = {
        p.pk: p
        for p in Product.objects.select_related("unit", "product_brand")
        .select_for_update(of=("self",))
        .filter(pk__in=requested)
        .order_by("pk")
    }
    missing = tuple(i for i in requested if i not in locked)
    inactive = tuple(i for i in requested if i in locked and not locked[i].is_active)
    if missing or (require_active and inactive):
        raise SaleProductReferenceError(
            missing=missing, inactive=inactive if require_active else ()
        )
    return {pk: _reference(p) for pk, p in locked.items()}
