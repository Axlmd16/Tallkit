"""Lista local y de solo lectura de preparaciones de factura, acotada por entidad fiscal."""

from dataclasses import dataclass
from typing import Any

from django.db.models import Q

from fiscal.application.preparations import FiscalPreparationError
from fiscal.domain.states import PreparationState
from fiscal.models import FiscalPreparation
from identity.application.authorization import has_permission, require_permission
from identity.models import User
from sales.application.fiscal_source import read_fiscal_source_summaries as commercial_summaries
from workshop.application.fiscal_source import read_fiscal_source_summaries as artisan_summaries

PAGE_SIZE_DEFAULT = 20
PAGE_SIZE_MAX = 100
ENTITIES = ("COMERCIAL", "ARTESANAL")
_VIEW_PERMISSION = {"COMERCIAL": "fiscal.comercial.ver", "ARTESANAL": "fiscal.artesanal.ver"}


class PreparationListError(FiscalPreparationError):
    """Filtro o paginación inválidos."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(f"{message} ({field})")
        self.field = field


@dataclass(frozen=True)
class PreparationListRow:
    id: str
    entity: str
    fiscal_entity_id: int
    source_kind: str
    source_id: int
    state: str
    number: str | None
    customer_name: str | None
    total: str | None
    source_date: str | None
    created_at: str


@dataclass(frozen=True)
class PreparationListPage:
    count: int
    page: int
    page_size: int
    total_pages: int
    results: tuple[PreparationListRow, ...]


def list_preparations(
    *,
    actor: User,
    entity: str | None = None,
    state: str | None = None,
    page: int = 1,
    page_size: int = PAGE_SIZE_DEFAULT,
) -> PreparationListPage:
    """Preparaciones locales de las entidades que el usuario puede consultar.

    Es de solo lectura: no crea, edita, numera ni cancela, y ninguna fila afirma estado oficial.
    Filtrar por una entidad que el usuario no puede consultar se rechaza sin revelar filas.
    """
    if entity is not None and entity not in ENTITIES:
        raise PreparationListError("entity", "Use COMERCIAL o ARTESANAL.")
    if state is not None and state not in {item.value for item in PreparationState}:
        raise PreparationListError("state", "Use DRAFT, PREPARED o CANCELLED.")
    if page < 1:
        raise PreparationListError("page", "La página debe ser 1 o mayor.")
    if not 1 <= page_size <= PAGE_SIZE_MAX:
        raise PreparationListError("page_size", f"Use entre 1 y {PAGE_SIZE_MAX} filas por página.")

    if entity is not None:
        require_permission(actor=actor, permission=_VIEW_PERMISSION[entity])
        allowed = [entity]
    else:
        allowed = [name for name in ENTITIES if has_permission(actor, _VIEW_PERMISSION[name])]
        if not allowed:
            require_permission(actor=actor, permission=_VIEW_PERMISSION["COMERCIAL"])

    scope = Q(pk__in=[])
    if "COMERCIAL" in allowed:
        scope |= Q(commercial_sale__isnull=False)
    if "ARTESANAL" in allowed:
        scope |= Q(artisan_operation__isnull=False)
    query = FiscalPreparation.objects.filter(scope)
    if state is not None:
        query = query.filter(state=state)

    count = query.count()
    offset = (page - 1) * page_size
    rows = list(
        query.select_related("fiscal_entity").order_by("-created_at", "-id")[
            offset : offset + page_size
        ]
    )
    sale_ids = [row.commercial_sale_id for row in rows if row.commercial_sale_id is not None]
    operation_ids = [
        row.artisan_operation_id for row in rows if row.artisan_operation_id is not None
    ]
    sales = commercial_summaries(sale_ids) if sale_ids else {}
    operations = artisan_summaries(operation_ids) if operation_ids else {}

    results: list[PreparationListRow] = []
    for row in rows:
        commercial = row.commercial_sale_id is not None
        source_id = row.commercial_sale_id if commercial else row.artisan_operation_id
        assert source_id is not None
        summary: Any = (sales if commercial else operations).get(source_id)
        results.append(
            PreparationListRow(
                id=str(row.pk),
                entity=row.fiscal_entity.entity_type,
                fiscal_entity_id=row.fiscal_entity_id,
                source_kind="COMMERCIAL" if commercial else "ARTISAN",
                source_id=source_id,
                state=row.state,
                number=summary.internal_number if summary else None,
                customer_name=summary.customer_name if summary else None,
                total=summary.grand_total if summary else None,
                source_date=(
                    summary.operational_date.isoformat()
                    if summary and summary.operational_date
                    else None
                ),
                created_at=row.created_at.isoformat(),
            )
        )
    return PreparationListPage(
        count=count,
        page=page,
        page_size=page_size,
        total_pages=-(-count // page_size) if count else 0,
        results=tuple(results),
    )
