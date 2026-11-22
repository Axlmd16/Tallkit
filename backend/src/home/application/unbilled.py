"""Lista de trabajo «Falta facturar» para Inicio: solo lectura y separada por negocio."""

from __future__ import annotations

from typing import Any

from fiscal.application.home_summary import prepared_source_ids
from identity.models import User
from sales.application.home_summary import confirmed_sales_without_ids
from workshop.application.home_summary import confirmed_operations_without_ids


def unbilled_summary(actor: User, *, limit: int = 8) -> dict[str, Any]:
    """Operaciones confirmadas vigentes sin preparación fiscal local completada."""
    prepared_com, prepared_art = prepared_source_ids(actor)

    commercial_rows: list[dict[str, Any]] | None = None
    commercial_count: int | None = None
    if prepared_com is not None:
        res_com = confirmed_sales_without_ids(actor, exclude_ids=prepared_com, limit=limit)
        if res_com is not None:
            rows_c, commercial_count = res_com
            commercial_rows = [
                {
                    "entity": "COMERCIAL",
                    "source_id": row.sale_id,
                    "order_id": row.order_id,
                    "number": row.number,
                    "customer_name": row.customer_name,
                    "date": row.date.isoformat(),
                    "total": f"{row.total:.2f}",
                    "fiscal_state": "PENDING_LOCAL",
                }
                for row in rows_c
            ]

    artisan_rows: list[dict[str, Any]] | None = None
    artisan_count: int | None = None
    if prepared_art is not None:
        res_art = confirmed_operations_without_ids(actor, exclude_ids=prepared_art, limit=limit)
        if res_art is not None:
            rows_a, artisan_count = res_art
            artisan_rows = [
                {
                    "entity": "ARTESANAL",
                    "source_id": row.operation_id,
                    "order_id": row.order_id,
                    "number": row.number,
                    "customer_name": row.customer_name,
                    "date": row.date.isoformat(),
                    "total": f"{row.total:.2f}",
                    "fiscal_state": "PENDING_LOCAL",
                }
                for row in rows_a
            ]

    return {
        "commercial": (
            {"count": commercial_count, "items": commercial_rows}
            if commercial_rows is not None
            else None
        ),
        "artisan": (
            {"count": artisan_count, "items": artisan_rows} if artisan_rows is not None else None
        ),
    }
