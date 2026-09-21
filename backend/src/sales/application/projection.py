"""Proyección de resultados por tipo e ID; se repite con los permisos vigentes al reintentar."""

from collections.abc import Callable
from typing import Any

from sales.application import queries
from sales.models import CommercialPayment, CommercialRefund, Sale, SaleReturn


def project(kind: str, result_id: int) -> dict[str, Any]:
    if kind == "sale":
        return queries.sale_detail(Sale.objects.get(pk=result_id))
    if kind == "payment":
        return queries.payment_detail(
            CommercialPayment.objects.select_related("sale").get(pk=result_id)
        )
    if kind == "return":
        return queries.return_detail(SaleReturn.objects.select_related("sale").get(pk=result_id))
    if kind == "refund":
        return queries.refund_detail(
            CommercialRefund.objects.select_related("sale").get(pk=result_id)
        )
    for extra in EXTRA_PROJECTORS:
        found: dict[str, Any] | None = extra(kind, result_id)
        if found is not None:
            return found
    raise LookupError(kind)


EXTRA_PROJECTORS: list[Callable[[str, int], dict[str, Any] | None]] = []
