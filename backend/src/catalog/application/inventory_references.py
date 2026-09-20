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


@dataclass(frozen=True)
class StockCatalogRow:
    id: int
    code: str
    manufacturer_code: str
    name: str
    category_id: int
    category_name: str
    unit_name: str
    unit_symbol: str
    content_quantity: Decimal
    is_active: bool


@dataclass(frozen=True)
class StockCatalogPage:
    rows: tuple[StockCatalogRow, ...]
    total_count: int
    page: int
    page_size: int


def list_stock_catalog(
    *,
    search: str = "",
    category_id: int | None = None,
    active: str | None = None,
    history_product_ids: Iterable[int] = (),
    positive_product_ids: Iterable[int] = (),
    stock: str = "all",
    page: int = 1,
    page_size: int = 20,
) -> StockCatalogPage:
    """Productos del catálogo para la lista de existencias, filtrados por intersección.

    ``active``: ``true``/``false`` filtran por estado; ``all`` no filtra; ``None`` (sin
    filtro explícito) incluye los activos más los inactivos con historia o saldo.
    ``stock``: ``positive`` exige existencia, ``zero`` la excluye. Las existencias las aporta
    inventario; el catálogo no conoce cantidades.
    """
    queryset = Product.objects.select_related("unit", "category")
    term = search.strip()
    if term:
        queryset = queryset.filter(
            Q(code__icontains=term) | Q(manufacturer_code__icontains=term) | Q(name__icontains=term)
        )
    if category_id is not None:
        queryset = queryset.filter(category_id=category_id)
    if active == "true":
        queryset = queryset.filter(is_active=True)
    elif active == "false":
        queryset = queryset.filter(is_active=False)
    elif active is None:
        queryset = queryset.filter(Q(is_active=True) | Q(pk__in=set(history_product_ids)))
    positive = set(positive_product_ids)
    if stock == "positive":
        queryset = queryset.filter(pk__in=positive)
    elif stock == "zero":
        queryset = queryset.exclude(pk__in=positive)
    queryset = queryset.order_by("name", "id")
    total = queryset.count()
    offset = (page - 1) * page_size
    rows = tuple(
        StockCatalogRow(
            id=p.pk,
            code=p.code,
            manufacturer_code=p.manufacturer_code,
            name=p.name,
            category_id=p.category_id,
            category_name=p.category.name,
            unit_name=p.unit.name,
            unit_symbol=p.unit.symbol,
            content_quantity=p.content_quantity,
            is_active=p.is_active,
        )
        for p in queryset[offset : offset + page_size]
    )
    return StockCatalogPage(rows=rows, total_count=total, page=page, page_size=page_size)


def get_stock_catalog_row(product_id: int) -> StockCatalogRow | None:
    product = Product.objects.select_related("unit", "category").filter(pk=product_id).first()
    if product is None:
        return None
    return StockCatalogRow(
        id=product.pk,
        code=product.code,
        manufacturer_code=product.manufacturer_code,
        name=product.name,
        category_id=product.category_id,
        category_name=product.category.name,
        unit_name=product.unit.name,
        unit_symbol=product.unit.symbol,
        content_quantity=product.content_quantity,
        is_active=product.is_active,
    )
