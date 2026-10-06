"""Vigencia y transiciones con el reloj recibido como dato."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

import pytest

from proformas.domain.validity import (
    EffectiveState,
    ProformaState,
    TransitionError,
    ValidityError,
    effective_state,
    ensure_allowed,
    local_date,
    resolve_valid_until,
    suggested_valid_until,
)

GYE = ZoneInfo("America/Guayaquil")
ISSUED_ON = date(2026, 10, 6)
UNTIL = date(2026, 10, 13)


def test_suggested_validity_is_issue_date_plus_seven_days() -> None:
    assert suggested_valid_until(ISSUED_ON) == UNTIL


def test_default_mode_follows_the_issue_date() -> None:
    assert resolve_valid_until(None, date(2026, 10, 7)) == date(2026, 10, 14)


def test_explicit_date_is_kept_and_may_equal_the_issue_date() -> None:
    assert resolve_valid_until(date(2026, 10, 20), ISSUED_ON) == date(2026, 10, 20)
    assert resolve_valid_until(ISSUED_ON, ISSUED_ON) == ISSUED_ON


def test_explicit_date_before_issue_is_rejected() -> None:
    with pytest.raises(ValidityError):
        resolve_valid_until(date(2026, 10, 5), ISSUED_ON)


def test_validity_is_inclusive_until_the_end_of_the_local_day() -> None:
    last_second = datetime(2026, 10, 13, 23, 59, 59, tzinfo=GYE)
    first_second = datetime(2026, 10, 14, 0, 0, 0, tzinfo=GYE)
    assert effective_state(ProformaState.ISSUED, UNTIL, local_date(last_second)) == "VALID"
    assert effective_state(ProformaState.ISSUED, UNTIL, local_date(first_second)) == "EXPIRED"


def test_local_day_does_not_follow_utc() -> None:
    # 04:30 UTC del día 14 todavía es 23:30 del 13 en Guayaquil.
    instant = datetime(2026, 10, 14, 4, 30, tzinfo=UTC)
    assert local_date(instant) == UNTIL
    assert effective_state(ProformaState.ISSUED, UNTIL, local_date(instant)) == "VALID"


def test_local_date_requires_an_aware_instant() -> None:
    with pytest.raises(ValueError, match="zona"):
        local_date(datetime(2026, 10, 14, 4, 30))


@pytest.mark.parametrize("state", [ProformaState.CONVERTED, ProformaState.VOIDED])
def test_terminal_states_take_precedence_over_expiry(state: ProformaState) -> None:
    assert effective_state(state, UNTIL, date(2027, 1, 1)) == state.value


def test_draft_never_expires() -> None:
    assert effective_state(ProformaState.DRAFT, None, date(2027, 1, 1)) == EffectiveState.DRAFT


@pytest.mark.parametrize(
    ("action", "state", "today", "allowed"),
    [
        ("edit", ProformaState.DRAFT, ISSUED_ON, True),
        ("edit", ProformaState.ISSUED, ISSUED_ON, False),
        ("edit", ProformaState.CONVERTED, ISSUED_ON, False),
        ("edit", ProformaState.VOIDED, ISSUED_ON, False),
        ("issue", ProformaState.DRAFT, ISSUED_ON, True),
        ("convert", ProformaState.ISSUED, UNTIL, True),
        ("convert", ProformaState.ISSUED, date(2026, 10, 14), False),
        ("convert", ProformaState.DRAFT, ISSUED_ON, False),
        ("convert", ProformaState.VOIDED, ISSUED_ON, False),
        ("convert", ProformaState.CONVERTED, ISSUED_ON, False),
        ("void", ProformaState.DRAFT, ISSUED_ON, True),
        ("void", ProformaState.ISSUED, ISSUED_ON, True),
        ("void", ProformaState.ISSUED, date(2026, 11, 1), True),
        ("void", ProformaState.CONVERTED, ISSUED_ON, False),
        ("void", ProformaState.VOIDED, ISSUED_ON, False),
        ("copy", ProformaState.ISSUED, date(2026, 11, 1), True),
        ("copy", ProformaState.VOIDED, ISSUED_ON, True),
        ("copy", ProformaState.CONVERTED, ISSUED_ON, True),
        ("copy", ProformaState.DRAFT, ISSUED_ON, False),
    ],
)
def test_actions_follow_the_effective_state(
    action: str, state: ProformaState, today: date, allowed: bool
) -> None:
    until = None if state is ProformaState.DRAFT else UNTIL
    if allowed:
        ensure_allowed(action, state, until, today)
        return
    with pytest.raises(TransitionError):
        ensure_allowed(action, state, until, today)


def test_rejection_names_the_effective_state() -> None:
    with pytest.raises(TransitionError) as error:
        ensure_allowed("convert", ProformaState.ISSUED, UNTIL, date(2026, 10, 14))
    assert error.value.code == "proforma_expired"
    with pytest.raises(TransitionError) as error:
        ensure_allowed("convert", ProformaState.CONVERTED, UNTIL, ISSUED_ON)
    assert error.value.code == "proforma_converted"
    with pytest.raises(TransitionError) as error:
        ensure_allowed("void", ProformaState.VOIDED, UNTIL, ISSUED_ON)
    assert error.value.code == "proforma_voided"


def test_no_action_reactivates_an_expired_or_voided_offer() -> None:
    for state in (ProformaState.ISSUED, ProformaState.VOIDED):
        for action in ("edit", "issue"):
            with pytest.raises(TransitionError):
                ensure_allowed(action, state, UNTIL, date(2026, 12, 1))
