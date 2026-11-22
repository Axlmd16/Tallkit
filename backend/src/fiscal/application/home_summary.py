"""Búsqueda de solo lectura de preparaciones locales de factura para la búsqueda global.

Respeta la separación fiscal por permiso (``fiscal.comercial.ver`` y ``fiscal.artesanal.ver``)
y devuelve únicamente el estado local; nunca presenta una preparación como autorizada.
"""

from dataclasses import dataclass
from typing import Any

from django.db.models import Q

from fiscal.models import FiscalPreparation
from identity.application.authorization import has_permission
from identity.models import User
from sales.application.fiscal_source import read_fiscal_source_summaries as commercial_summaries
from shared.text import fold_compact, fold_text
from workshop.application.fiscal_source import read_fiscal_source_summaries as artisan_summaries

_VIEW_PERMISSION = {"COMERCIAL": "fiscal.comercial.ver", "ARTESANAL": "fiscal.artesanal.ver"}


@dataclass(frozen=True)
class InvoiceSearchRow:
    id: str
    entity: str
    number: str | None
    customer_name: str | None
    date: str | None
    state: str
    total: str | None


def search_preparations(
    actor: User, query: str, *, limit: int = 5
) -> tuple[list[InvoiceSearchRow], int] | None:
    """Busca preparaciones locales en las entidades que el actor puede consultar."""
    allowed = [name for name, perm in _VIEW_PERMISSION.items() if has_permission(actor, perm)]
    if not allowed:
        return None
    term = fold_text(query)
    compact = fold_compact(query)
    if len(term) < 2:
        return [], 0

    scope = Q(pk__in=[])
    if "COMERCIAL" in allowed:
        scope |= Q(commercial_sale__isnull=False)
    if "ARTESANAL" in allowed:
        scope |= Q(artisan_operation__isnull=False)

    rows = list(
        FiscalPreparation.objects.filter(scope)
        .select_related("fiscal_entity", "identity", "identity__numbering_scope")
        .order_by("-created_at", "-id")
    )
    if not rows:
        return [], 0

    sale_ids = [r.commercial_sale_id for r in rows if r.commercial_sale_id is not None]
    op_ids = [r.artisan_operation_id for r in rows if r.artisan_operation_id is not None]
    sales = commercial_summaries(sale_ids) if sale_ids else {}
    operations = artisan_summaries(op_ids) if op_ids else {}

    matches: list[InvoiceSearchRow] = []
    total = 0
    for row in rows:
        commercial = row.commercial_sale_id is not None
        source_id = row.commercial_sale_id if commercial else row.artisan_operation_id
        assert source_id is not None
        summary: Any = (sales if commercial else operations).get(source_id)
        internal_number = summary.internal_number if summary else None
        customer_name = summary.customer_name if summary else None
        trial_number = ""
        try:
            ident = row.identity
        except FiscalPreparation.identity.RelatedObjectDoesNotExist:
            ident = None
        if ident is not None:
            est = ident.numbering_scope.establishment_code
            pto = ident.numbering_scope.emission_point_code
            trial_number = f"{est}-{pto}-{ident.sequential:09d}"

        haystack_text = fold_text(f"{customer_name or ''} {internal_number or ''} {trial_number}")
        haystack_compact = fold_compact(f"{internal_number or ''} {trial_number}")
        if term in haystack_text or (compact and compact in haystack_compact):
            total += 1
            if len(matches) < limit:
                source_date = (
                    summary.operational_date.isoformat()
                    if summary and summary.operational_date
                    else row.created_at.date().isoformat()
                )
                matches.append(
                    InvoiceSearchRow(
                        id=str(row.pk),
                        entity=row.fiscal_entity.entity_type,
                        number=trial_number or internal_number,
                        customer_name=customer_name,
                        date=source_date,
                        state=row.state,
                        total=summary.grand_total if summary else None,
                    )
                )
    return matches, total



def prepared_source_ids(actor: User) -> tuple[set[int] | None, set[int] | None]:
    """Devuelve IDs de ventas comerciales y operaciones artesanales con preparación PREPARED."""
    commercial: set[int] | None = None
    artisan: set[int] | None = None
    if has_permission(actor, "fiscal.comercial.ver"):
        commercial = set(
            FiscalPreparation.objects.filter(
                commercial_sale__isnull=False, state="PREPARED"
            ).values_list("commercial_sale_id", flat=True)
        )
    if has_permission(actor, "fiscal.artesanal.ver"):
        artisan = set(
            FiscalPreparation.objects.filter(
                artisan_operation__isnull=False, state="PREPARED"
            ).values_list("artisan_operation_id", flat=True)
        )
    return commercial, artisan
