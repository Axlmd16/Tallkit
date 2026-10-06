"""Indicadores de proformas para el resumen de inicio.

Cada función decide con ``has_permission`` —que no audita denegaciones— si el actor puede ver
el indicador y devuelve ``None`` cuando no puede. Los conteos reutilizan los filtros de la lista.
"""

from identity.application.authorization import has_permission
from identity.models import User
from proformas.application import clock, queries
from proformas.domain.validity import EffectiveState
from proformas.models import Proforma

EXPIRING_WITHIN_DAYS = 1


def proformas_expiring(actor: User) -> int | None:
    """Ofertas vigentes que vencen hoy o mañana según el día del negocio."""
    if not has_permission(actor, "proformas.ver"):
        return None
    rows = queries.expiring(Proforma.objects.all(), clock.today(), EXPIRING_WITHIN_DAYS)
    return rows.count()


def proforma_drafts(actor: User) -> int | None:
    if not has_permission(actor, "proformas.ver"):
        return None
    rows = queries.filter_by_effective_state(
        Proforma.objects.all(), EffectiveState.DRAFT, clock.today()
    )
    return rows.count()
