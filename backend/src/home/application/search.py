"""Búsqueda global de solo lectura en vehículos, clientes, facturas locales y productos.

Compone únicamente las lecturas publicadas en ``home_summary`` por cada módulo dueño. Un grupo
no autorizado se devuelve como ``None``. Nunca mezcla totales entre negocios ni expone costos.
"""

from typing import Any

import catalog.application.home_summary as catalog_summary
import customer_registry.application.home_summary as customer_summary
import fiscal.application.home_summary as fiscal_summary
import inventory.application.home_summary as inventory_summary
import workshop.application.home_summary as workshop_summary
from home.application.snapshot import read_snapshot
from identity.models import User

LIMIT = 5
MIN_QUERY_LENGTH = 2


def global_search(actor: User, raw_query: str, *, limit: int = LIMIT) -> dict[str, Any]:
    query = raw_query.strip()
    with read_snapshot():
        vehicles_res = customer_summary.search_vehicles(actor, query, limit=limit)
        customers_res = customer_summary.search_customers(actor, query, limit=limit)
        invoices_res = fiscal_summary.search_preparations(actor, query, limit=limit)
        products_res = catalog_summary.search_products(actor, query, limit=limit)

        vehicles_block: dict[str, Any] | None = None
        if vehicles_res is not None:
            v_items, v_total = vehicles_res
            open_orders = (
                workshop_summary.open_orders_by_vehicles(actor, [v.id for v in v_items])
                if v_items
                else {}
            )
            vehicles_block = {
                "total": v_total,
                "items": [
                    {
                        "id": v.id,
                        "plate": v.plate,
                        "label": v.label,
                        "owner_id": v.owner_id,
                        "owner_name": v.owner_name,
                        "open_order": (
                            {
                                "id": order.id,
                                "number": order.number,
                                "status": order.status,
                            }
                            if open_orders is not None and (order := open_orders.get(v.id))
                            else None
                        ),
                    }
                    for v in v_items
                ],
            }

        customers_block: dict[str, Any] | None = None
        if customers_res is not None:
            c_items, c_total = customers_res
            customers_block = {
                "total": c_total,
                "items": [
                    {
                        "id": c.id,
                        "full_name": c.full_name,
                        "identification_type": c.identification_type,
                        "identification": c.identification,
                    }
                    for c in c_items
                ],
            }

        invoices_block: dict[str, Any] | None = None
        if invoices_res is not None:
            i_items, i_total = invoices_res
            invoices_block = {
                "total": i_total,
                "items": [
                    {
                        "id": i.id,
                        "entity": i.entity,
                        "number": i.number,
                        "customer_name": i.customer_name,
                        "date": i.date,
                        "state": i.state,
                        "total": i.total,
                    }
                    for i in i_items
                ],
            }

        products_block: dict[str, Any] | None = None
        if products_res is not None:
            p_items, p_total = products_res
            stocks = (
                inventory_summary.stock_quantities(actor, [p.id for p in p_items])
                if p_items
                else {}
            )
            products_block = {
                "total": p_total,
                "items": [
                    {
                        "id": p.id,
                        "code": p.code,
                        "manufacturer_code": p.manufacturer_code,
                        "name": p.name,
                        "sale_price": p.sale_price,
                        "stock": stocks.get(p.id) if stocks is not None else None,
                    }
                    for p in p_items
                ],
            }

    return {
        "query": query,
        "vehicles": vehicles_block,
        "customers": customers_block,
        "invoices": invoices_block,
        "products": products_block,
    }
