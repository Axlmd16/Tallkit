"""Búsqueda de solo lectura de productos para la búsqueda global.

Nunca expone costos, costo promedio ni valoración.
"""

from dataclasses import dataclass

from catalog.models import Product
from identity.application.authorization import has_permission
from identity.models import User
from shared.text import fold_compact, fold_text


@dataclass(frozen=True)
class ProductSearchRow:
    id: int
    code: str
    manufacturer_code: str
    name: str
    sale_price: str


def search_products(
    actor: User, query: str, *, limit: int = 5
) -> tuple[list[ProductSearchRow], int] | None:
    """Busca productos activos por nombre, código interno o código del fabricante."""
    if not has_permission(actor, "productos.ver"):
        return None
    term = fold_text(query)
    compact = fold_compact(query)
    if len(term) < 2:
        return [], 0

    matches: list[ProductSearchRow] = []
    total = 0
    rows = (
        Product.objects.filter(is_active=True)
        .order_by("name", "id")
        .values_list("id", "code", "manufacturer_code", "name", "sale_price")
    )
    for pid, code, manufacturer_code, name, sale_price in rows:
        haystack_text = fold_text(f"{name} {code} {manufacturer_code}")
        haystack_compact = fold_compact(f"{code} {manufacturer_code}")
        if term in haystack_text or (compact and compact in haystack_compact):
            total += 1
            if len(matches) < limit:
                matches.append(
                    ProductSearchRow(
                        id=pid,
                        code=code,
                        manufacturer_code=manufacturer_code,
                        name=name,
                        sale_price=f"{sale_price:.2f}",
                    )
                )
    return matches, total
