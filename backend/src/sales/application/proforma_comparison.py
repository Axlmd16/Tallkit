"""Comparación en servidor entre la copia cotizada y la venta de origen proforma.

Usa exclusivamente la copia inmutable guardada en la venta: nunca consulta la oferta. Para un
borrador compara con los valores vigentes del catálogo; para una venta confirmada, con sus
importes históricos.
"""

from collections.abc import Mapping, Sequence
from decimal import Decimal
from typing import Any

from catalog.application.sales_references import SaleProductReference
from sales.application.calculation import LineComputation
from sales.domain.proforma_comparison import ComparedLine, compare
from sales.models import Sale, SaleLine


def quoted_lines(snapshot: Mapping[str, Any]) -> list[ComparedLine]:
    return [
        ComparedLine(
            product_id=int(line["product_id"]),
            product_code=line["product_code"],
            product_name=line["product_name"],
            quantity=Decimal(line["quantity"]),
            unit_price=Decimal(line["unit_price"]),
            tax_rate=Decimal(line["tax_rate"]),
            base_amount=Decimal(line["base_amount"]),
            tax_amount=Decimal(line["tax_amount"]),
            total_amount=Decimal(line["total_amount"]),
        )
        for line in snapshot["lines"]
    ]


def computed_lines(
    computations: Sequence[LineComputation], products: Mapping[int, SaleProductReference]
) -> list[ComparedLine]:
    """Líneas del borrador con precio final de catálogo y tarifa vigentes."""
    result = []
    for comp in computations:
        ref = products.get(comp.product_id)
        result.append(
            ComparedLine(
                product_id=comp.product_id,
                product_code=ref.code if ref else None,
                product_name=ref.name if ref else None,
                quantity=comp.quantity,
                unit_price=comp.unit_price,
                tax_rate=comp.tax_rate,
                base_amount=comp.amounts.base if comp.amounts else None,
                tax_amount=comp.amounts.tax if comp.amounts else None,
                total_amount=comp.amounts.total if comp.amounts else None,
            )
        )
    return result


def _historical_lines(lines: Sequence[SaleLine]) -> list[ComparedLine]:
    return [
        ComparedLine(
            product_id=line.product_id,
            product_code=line.product_snapshot["code"] if line.product_snapshot else None,
            product_name=line.product_snapshot["name"] if line.product_snapshot else None,
            quantity=line.quantity,
            unit_price=line.unit_price,
            tax_rate=line.tax_rate,
            base_amount=line.base_amount,
            tax_amount=line.tax_amount,
            total_amount=line.total_amount,
        )
        for line in lines
    ]


def _result(snapshot: Mapping[str, Any], current: Sequence[ComparedLine]) -> dict[str, Any]:
    return {
        "proforma_id": snapshot["proforma_id"],
        "proforma_number": snapshot["number"],
        "issue_date": snapshot["issue_date"],
        "valid_until": snapshot["valid_until"],
        **compare(quoted_lines(snapshot), current),
    }


def from_computations(
    sale: Sale,
    computations: Sequence[LineComputation],
    products: Mapping[int, SaleProductReference],
) -> dict[str, Any] | None:
    if sale.proforma_snapshot is None:
        return None
    return _result(sale.proforma_snapshot, computed_lines(computations, products))


def for_sale(sale: Sale) -> dict[str, Any] | None:
    """Comparación vigente de una venta; ``None`` si su origen no es una proforma."""
    if sale.proforma_snapshot is None:
        return None
    if sale.state != "DRAFT":
        return _result(
            sale.proforma_snapshot, _historical_lines(list(sale.lines.order_by("position")))
        )
    from sales.application import reviews

    snapshot = reviews.build_snapshot(sale)
    return from_computations(sale, snapshot.computations, snapshot.products)
