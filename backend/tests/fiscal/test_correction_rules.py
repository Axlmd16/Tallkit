from __future__ import annotations

from datetime import date

import pytest

from fiscal.domain.corrections import (
    CorrectionAction,
    CorrectionFacts,
    EvaluationOutcome,
    evaluate_correction,
)


def _facts(**overrides: object) -> CorrectionFacts:
    values = {
        "consumer_final_transmitted": False,
        "supports_tax_refund": False,
        "negotiable_traded": False,
        "external_history_complete": True,
        "holidays_complete": True,
        "holidays": (),
        "calendar_source": "Calendario administrativo de ensayo",
        "calendar_version": "2026-09-26",
    }
    values.update(overrides)
    return CorrectionFacts(**values)  # type: ignore[arg-type]


def test_online_cancellation_is_locally_eligible_through_day_seven_next_month() -> None:
    result = evaluate_correction(
        action=CorrectionAction.ONLINE_CANCELLATION,
        issue_date=date(2026, 9, 25),
        reference_date=date(2026, 10, 7),
        facts=_facts(),
    )

    assert result.outcome is EvaluationOutcome.ELIGIBLE
    assert result.deadline == date(2026, 10, 7)
    assert result.normative_version == "NAC-DGERCGC25-00000014+00000017"


def test_online_cancellation_after_deadline_is_blocked_with_credit_note_guidance() -> None:
    result = evaluate_correction(
        action=CorrectionAction.ONLINE_CANCELLATION,
        issue_date=date(2026, 9, 25),
        reference_date=date(2026, 10, 8),
        facts=_facts(),
    )

    assert result.outcome is EvaluationOutcome.BLOCKED
    assert "nota de crédito" in result.reasons[0]


def test_unknown_holiday_calendar_and_conditioning_facts_remain_pending() -> None:
    result = evaluate_correction(
        action=CorrectionAction.ONLINE_CANCELLATION,
        issue_date=date(2026, 9, 25),
        reference_date=date(2026, 10, 6),
        facts=_facts(holidays_complete=False, negotiable_traded=None),
    )

    assert result.outcome is EvaluationOutcome.PENDING
    assert set(result.pending_facts) == {"calendar", "negotiable_traded"}


@pytest.mark.parametrize(
    ("fact", "action"),
    [
        ("consumer_final_transmitted", CorrectionAction.ONLINE_CANCELLATION),
        ("consumer_final_transmitted", CorrectionAction.CREDIT_NOTE),
        ("supports_tax_refund", CorrectionAction.CREDIT_NOTE),
        ("negotiable_traded", CorrectionAction.CREDIT_NOTE),
    ],
)
def test_legal_restrictions_block_both_or_the_applicable_route(
    fact: str, action: CorrectionAction
) -> None:
    result = evaluate_correction(
        action=action,
        issue_date=date(2026, 9, 25),
        reference_date=date(2026, 9, 26),
        facts=_facts(**{fact: True}),
    )

    assert result.outcome is EvaluationOutcome.BLOCKED


def test_credit_note_does_not_apply_a_general_twelve_month_limit() -> None:
    result = evaluate_correction(
        action=CorrectionAction.CREDIT_NOTE,
        issue_date=date(2024, 1, 1),
        reference_date=date(2026, 9, 26),
        facts=_facts(),
    )

    assert result.outcome is EvaluationOutcome.ELIGIBLE
    assert result.deadline is None


def test_incomplete_external_history_keeps_credit_note_pending() -> None:
    result = evaluate_correction(
        action=CorrectionAction.CREDIT_NOTE,
        issue_date=date(2026, 9, 25),
        reference_date=date(2026, 9, 26),
        facts=_facts(external_history_complete=False),
    )

    assert result.outcome is EvaluationOutcome.PENDING
    assert result.pending_facts == ("external_history_complete",)
