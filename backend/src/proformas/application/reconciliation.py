"""Conciliación de solo lectura entre ofertas convertidas y vínculos de ventas.

El estado convertida y la referencia única de la venta se escriben en la misma transacción;
esta consulta verifica ambos hechos sin repararlos. Los vínculos provienen del contrato
público de ventas: nunca se leen sus modelos.
"""

from dataclasses import dataclass

import sales.application.proforma_links as proforma_links
from proformas.models import Proforma


@dataclass(frozen=True)
class Difference:
    code: str
    proforma_id: int
    detail: str

    def render(self) -> str:
        return f"[{self.code}] proforma {self.proforma_id}: {self.detail}"


def reconcile() -> list[Difference]:
    """Diferencias entre estado convertida y venta vinculada; lista vacía si coinciden."""
    links = {link.proforma_id: link for link in proforma_links.all_sale_links()}
    states = dict(Proforma.objects.values_list("pk", "state"))
    numbers = dict(Proforma.objects.values_list("pk", "internal_number"))
    differences: list[Difference] = []
    for proforma_id, state in sorted(states.items()):
        link = links.get(proforma_id)
        if state == "CONVERTED" and link is None:
            differences.append(
                Difference(
                    "converted_without_sale",
                    proforma_id,
                    f"{numbers[proforma_id]} figura convertida y no existe una venta vinculada.",
                )
            )
        if state != "CONVERTED" and link is not None:
            differences.append(
                Difference(
                    "sale_without_conversion",
                    proforma_id,
                    f"la venta {link.sale_id} la referencia, pero su estado es {state}.",
                )
            )
    for proforma_id, link in sorted(links.items()):
        if proforma_id not in states:
            differences.append(
                Difference(
                    "sale_without_proforma",
                    proforma_id,
                    f"la venta {link.sale_id} referencia una oferta inexistente.",
                )
            )
    return differences
