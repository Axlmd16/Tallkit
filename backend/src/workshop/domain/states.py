"""Estados de la orden, intervenciones y acciones permitidas por estado y permisos."""

from enum import StrEnum


class OrderState(StrEnum):
    REGISTERED = "REGISTERED"
    FINALIZED = "FINALIZED"
    REOPENED = "REOPENED"


class InterventionKind(StrEnum):
    INITIAL = "INITIAL"
    CORRECTIVE = "CORRECTIVE"


OPEN_STATES = frozenset({OrderState.REGISTERED, OrderState.REOPENED})
TRANSITIONS = frozenset(
    {
        (OrderState.REGISTERED, OrderState.FINALIZED),
        (OrderState.REOPENED, OrderState.FINALIZED),
        (OrderState.FINALIZED, OrderState.REOPENED),
    }
)


class TransitionError(ValueError):
    pass


def ensure_transition(source: OrderState, target: OrderState) -> None:
    if (source, target) not in TRANSITIONS:
        raise TransitionError(f"Transición no permitida: {source} → {target}.")


def open_intervention_kind(state: OrderState) -> InterventionKind | None:
    """Intervención editable según el estado: la inicial al registrar, la correctiva al reabrir."""
    if state is OrderState.REGISTERED:
        return InterventionKind.INITIAL
    if state is OrderState.REOPENED:
        return InterventionKind.CORRECTIVE
    return None


def allowed_actions(state: OrderState, permissions: frozenset[str]) -> tuple[str, ...]:
    """Acciones visibles calculadas en servidor; el frontend no decide transiciones."""
    manage = "mantenimientos.gestionar" in permissions
    actions: list[str] = []
    if state is OrderState.REGISTERED and manage:
        actions.append("edit")
    if state is OrderState.REOPENED and manage:
        actions.append("edit_intervention")
    if state in OPEN_STATES:
        if manage:
            actions.append("manage_services")
        if (
            state is OrderState.REGISTERED
            and manage
            and "mantenimientos.cambiar_precio_servicio" in permissions
        ):
            actions.append("change_price")
        if "mantenimientos.gestionar_fotos" in permissions:
            actions.append("manage_photos")
        if "mantenimientos.finalizar" in permissions:
            actions.append("finalize")
    if state is OrderState.FINALIZED and "mantenimientos.reabrir" in permissions:
        actions.append("reopen")
    return tuple(actions)
