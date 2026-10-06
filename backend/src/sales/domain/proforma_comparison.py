"""Comparación entre lo cotizado en una proforma y la venta actual.

Regla pura, sin Django ni persistencia. Agrupa por producto y suma cantidades e importes de
las líneas repetidas; separa productos retirados y agregados y señala cambios de cantidad,
precio final y tarifa. No reescribe la oferta ni acepta valores enviados por el cliente.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

ZERO = Decimal("0.00")


@dataclass(frozen=True)
class ComparedLine:
    product_id: int
    product_code: str | None
    product_name: str | None
    quantity: Decimal
    unit_price: Decimal | None
    tax_rate: Decimal | None
    base_amount: Decimal | None
    tax_amount: Decimal | None
    total_amount: Decimal | None


@dataclass
class _Group:
    product_id: int
    product_code: str | None
    product_name: str | None
    quantity: Decimal
    unit_price: Decimal | None
    tax_rate: Decimal | None
    base: Decimal | None
    tax: Decimal | None
    total: Decimal | None


def _add(left: Decimal | None, right: Decimal | None) -> Decimal | None:
    return None if left is None or right is None else left + right


def _group(lines: Sequence[ComparedLine]) -> dict[int, _Group]:
    groups: dict[int, _Group] = {}
    for line in lines:
        group = groups.get(line.product_id)
        if group is None:
            groups[line.product_id] = _Group(
                line.product_id,
                line.product_code,
                line.product_name,
                line.quantity,
                line.unit_price,
                line.tax_rate,
                line.base_amount,
                line.tax_amount,
                line.total_amount,
            )
            continue
        group.quantity += line.quantity
        group.base = _add(group.base, line.base_amount)
        group.tax = _add(group.tax, line.tax_amount)
        group.total = _add(group.total, line.total_amount)
    return groups


def _money(value: Decimal | None) -> str | None:
    return None if value is None else f"{value:.2f}"


def _rate(value: Decimal | None) -> str | None:
    return None if value is None else format(value.normalize(), "f")


def _side(group: _Group | None) -> dict[str, Any] | None:
    if group is None:
        return None
    return {
        "quantity": f"{group.quantity:.0f}",
        "unit_price": _money(group.unit_price),
        "tax_rate": _rate(group.tax_rate),
        "base_amount": _money(group.base),
        "tax_amount": _money(group.tax),
        "total_amount": _money(group.total),
    }


def _totals(groups: dict[int, _Group]) -> dict[str, str | None] | None:
    base = tax = total = ZERO
    for group in groups.values():
        if group.base is None or group.tax is None or group.total is None:
            return None
        base += group.base
        tax += group.tax
        total += group.total
    return {"base": _money(base), "tax": _money(tax), "total": _money(total)}


def _changes(quoted: _Group, current: _Group) -> list[str]:
    changes = []
    if quoted.quantity != current.quantity:
        changes.append("quantity")
    if quoted.unit_price != current.unit_price:
        changes.append("unit_price")
    if quoted.tax_rate != current.tax_rate:
        changes.append("tax_rate")
    return changes


def compare(quoted: Sequence[ComparedLine], current: Sequence[ComparedLine]) -> dict[str, Any]:
    """Diferencias por producto y totales de ambos documentos."""
    before, after = _group(quoted), _group(current)
    products: list[dict[str, Any]] = []
    for product_id in [*before, *(pid for pid in after if pid not in before)]:
        old, new = before.get(product_id), after.get(product_id)
        named = old or new
        assert named is not None
        if old is None:
            status = "ADDED"
            changes: list[str] = []
        elif new is None:
            status, changes = "REMOVED", []
        else:
            changes = _changes(old, new)
            status = "CHANGED" if changes else "UNCHANGED"
        products.append(
            {
                "product_id": product_id,
                "product_code": named.product_code,
                "product_name": named.product_name,
                "status": status,
                "changes": changes,
                "quoted": _side(old),
                "current": _side(new),
            }
        )
    quoted_totals, current_totals = _totals(before), _totals(after)
    difference: str | None = None
    if quoted_totals and current_totals:
        difference = _money(
            Decimal(str(current_totals["total"])) - Decimal(str(quoted_totals["total"]))
        )
    return {
        "products": products,
        "totals": {"quoted": quoted_totals, "current": current_totals, "difference": difference},
        "has_differences": any(item["status"] != "UNCHANGED" for item in products),
    }
