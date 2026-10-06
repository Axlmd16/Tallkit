"""Vigencia, estado efectivo y transiciones de una proforma.

El reloj se recibe como dato: ninguna función consulta la hora del sistema. VIGENTE y VENCIDA
son proyecciones del estado emitido y de la fecha de vigencia respecto del día local; la
vigencia es una fecha de calendario inclusiva en America/Guayaquil.
"""

from datetime import date, datetime, timedelta
from enum import StrEnum
from zoneinfo import ZoneInfo

BUSINESS_TZ = ZoneInfo("America/Guayaquil")
DEFAULT_VALIDITY_DAYS = 7


class ProformaState(StrEnum):
    """Estado persistido; el vencimiento nunca se escribe."""

    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    CONVERTED = "CONVERTED"
    VOIDED = "VOIDED"


class EffectiveState(StrEnum):
    DRAFT = "DRAFT"
    VALID = "VALID"
    EXPIRED = "EXPIRED"
    CONVERTED = "CONVERTED"
    VOIDED = "VOIDED"


class ValidityError(ValueError):
    """La fecha de vigencia no es admisible para la fecha de emisión."""


class TransitionError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def local_date(instant: datetime) -> date:
    """Día del negocio al que pertenece un instante con zona."""
    if instant.tzinfo is None:
        raise ValueError("El instante debe incluir zona horaria.")
    return instant.astimezone(BUSINESS_TZ).date()


def suggested_valid_until(issue_date: date) -> date:
    return issue_date + timedelta(days=DEFAULT_VALIDITY_DAYS)


def resolve_valid_until(explicit: date | None, issue_date: date) -> date:
    """Vigencia que tendría la oferta si se emitiera en ``issue_date``."""
    if explicit is None:
        return suggested_valid_until(issue_date)
    if explicit < issue_date:
        raise ValidityError("La vigencia no puede ser anterior a la fecha de emisión.")
    return explicit


def effective_state(
    state: ProformaState | str, valid_until: date | None, today: date
) -> EffectiveState:
    persisted = ProformaState(state)
    if persisted is not ProformaState.ISSUED:
        return EffectiveState(persisted.value)
    assert valid_until is not None
    return EffectiveState.VALID if today <= valid_until else EffectiveState.EXPIRED


_ALLOWED: dict[str, frozenset[EffectiveState]] = {
    "edit": frozenset({EffectiveState.DRAFT}),
    "issue": frozenset({EffectiveState.DRAFT}),
    "convert": frozenset({EffectiveState.VALID}),
    "void": frozenset({EffectiveState.DRAFT, EffectiveState.VALID, EffectiveState.EXPIRED}),
    "copy": frozenset(
        {
            EffectiveState.VALID,
            EffectiveState.EXPIRED,
            EffectiveState.CONVERTED,
            EffectiveState.VOIDED,
        }
    ),
}
_REJECTIONS: dict[EffectiveState, tuple[str, str]] = {
    EffectiveState.DRAFT: ("proforma_not_issued", "La proforma todavía es un borrador."),
    EffectiveState.VALID: (
        "proforma_issued",
        "La proforma emitida no se modifica; cree una nueva vinculada.",
    ),
    EffectiveState.EXPIRED: (
        "proforma_expired",
        "La proforma está vencida; cree una nueva vinculada con valores actuales.",
    ),
    EffectiveState.CONVERTED: ("proforma_converted", "La proforma ya fue convertida en venta."),
    EffectiveState.VOIDED: ("proforma_voided", "La proforma está anulada."),
}


def allowed_actions(
    state: ProformaState | str, valid_until: date | None, today: date
) -> tuple[str, ...]:
    current = effective_state(state, valid_until, today)
    return tuple(action for action, states in _ALLOWED.items() if current in states)


def ensure_allowed(
    action: str, state: ProformaState | str, valid_until: date | None, today: date
) -> None:
    """Rechaza la acción que el estado efectivo no admite; nunca reactiva una oferta."""
    current = effective_state(state, valid_until, today)
    if current not in _ALLOWED[action]:
        raise TransitionError(*_REJECTIONS[current])
