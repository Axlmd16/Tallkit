"""Reglas locales versionadas para solicitudes fiscales; no ejecutan acciones ante el SRI."""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from enum import StrEnum

NORMATIVE_VERSION = "NAC-DGERCGC25-00000014+00000017"


class CorrectionAction(StrEnum):
    ONLINE_CANCELLATION = "ONLINE_CANCELLATION"
    CREDIT_NOTE = "CREDIT_NOTE"


class EvaluationOutcome(StrEnum):
    ELIGIBLE = "ELIGIBLE"
    PENDING = "PENDING"
    BLOCKED = "BLOCKED"


@dataclass(frozen=True)
class CorrectionFacts:
    consumer_final_transmitted: bool | None
    supports_tax_refund: bool | None
    negotiable_traded: bool | None
    external_history_complete: bool | None
    holidays_complete: bool
    holidays: tuple[date, ...]
    calendar_source: str
    calendar_version: str


@dataclass(frozen=True)
class CorrectionEvaluation:
    outcome: EvaluationOutcome
    normative_version: str
    evaluated_on: date
    deadline: date | None
    reasons: tuple[str, ...]
    pending_facts: tuple[str, ...]
    calendar_source: str
    calendar_version: str


def _next_month(day: date) -> tuple[int, int]:
    if day.month == 12:
        return day.year + 1, 1
    return day.year, day.month + 1


def _cancellation_deadline(issue_date: date, holidays: tuple[date, ...]) -> date:
    year, month = _next_month(issue_date)
    day = min(7, calendar.monthrange(year, month)[1])
    deadline = date(year, month, day)
    holiday_set = set(holidays)
    while deadline.weekday() >= 5 or deadline in holiday_set:
        deadline += timedelta(days=1)
    return deadline


def evaluate_correction(
    *,
    action: CorrectionAction,
    issue_date: date,
    reference_date: date,
    facts: CorrectionFacts,
) -> CorrectionEvaluation:
    reasons: list[str] = []
    pending: list[str] = []

    for name in (
        "consumer_final_transmitted",
        "supports_tax_refund",
        "negotiable_traded",
    ):
        value = getattr(facts, name)
        if value is None:
            pending.append(name)
        elif value:
            reasons.append(name)

    if action is CorrectionAction.CREDIT_NOTE:
        if facts.external_history_complete is not True:
            pending.append("external_history_complete")
        deadline = None
    else:
        deadline = _cancellation_deadline(issue_date, facts.holidays)
        if not facts.holidays_complete or not facts.calendar_source.strip():
            pending.append("calendar")
        if reference_date > deadline:
            reasons.append(
                "El plazo local de anulación concluyó; corresponde evaluar una nota de crédito."
            )

    if reasons:
        outcome = EvaluationOutcome.BLOCKED
    elif pending:
        outcome = EvaluationOutcome.PENDING
    else:
        outcome = EvaluationOutcome.ELIGIBLE
    return CorrectionEvaluation(
        outcome=outcome,
        normative_version=NORMATIVE_VERSION,
        evaluated_on=reference_date,
        deadline=deadline,
        reasons=tuple(reasons),
        pending_facts=tuple(pending),
        calendar_source=facts.calendar_source,
        calendar_version=facts.calendar_version,
    )
