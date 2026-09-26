"""Los estados propios describen preparación local, nunca una respuesta oficial."""

import pytest


def test_only_local_preparation_states_are_accepted() -> None:
    from fiscal.domain.states import PreparationState

    assert tuple(PreparationState) == (
        PreparationState.DRAFT,
        PreparationState.PREPARED,
        PreparationState.CANCELLED,
    )
    for external_state in ("SENT", "RECEIVED", "AUTHORIZED", "REJECTED", "VOIDED_BY_SRI"):
        with pytest.raises(ValueError, match="not a valid PreparationState"):
            PreparationState(external_state)


def test_cancelled_preparation_is_terminal() -> None:
    from fiscal.domain.states import PreparationState, can_transition

    assert can_transition(PreparationState.DRAFT, PreparationState.PREPARED)
    assert can_transition(PreparationState.DRAFT, PreparationState.CANCELLED)
    assert can_transition(PreparationState.PREPARED, PreparationState.CANCELLED)
    assert not can_transition(PreparationState.CANCELLED, PreparationState.DRAFT)
    assert not can_transition(PreparationState.CANCELLED, PreparationState.PREPARED)
