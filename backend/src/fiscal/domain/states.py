"""Estados locales de preparación, independientes de cualquier respuesta externa."""

from enum import StrEnum


class PreparationState(StrEnum):
    DRAFT = "DRAFT"
    PREPARED = "PREPARED"
    CANCELLED = "CANCELLED"


_TRANSITIONS = frozenset(
    {
        (PreparationState.DRAFT, PreparationState.PREPARED),
        (PreparationState.DRAFT, PreparationState.CANCELLED),
        (PreparationState.PREPARED, PreparationState.CANCELLED),
    }
)


def can_transition(current: PreparationState, target: PreparationState) -> bool:
    return (current, target) in _TRANSITIONS
