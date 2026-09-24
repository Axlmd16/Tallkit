"""Requisitos para finalizar la intervención abierta.

Las comprobaciones son funciones puras. La coordinación con repuestos y ventas (DP-021) se
añadirá como comprobación adicional en la funcionalidad correspondiente; hoy no existe.
"""

from collections.abc import Callable, Iterable
from dataclasses import dataclass

from workshop.domain.states import InterventionKind


@dataclass(frozen=True)
class Requirement:
    code: str
    message: str


@dataclass(frozen=True)
class FinalizationFacts:
    kind: InterventionKind
    diagnosis: str
    line_count: int
    work_performed: str


FinalizationCheck = Callable[[FinalizationFacts], Iterable[Requirement]]


def operational_data_check(facts: FinalizationFacts) -> tuple[Requirement, ...]:
    pending: list[Requirement] = []
    if facts.kind is InterventionKind.INITIAL:
        if not facts.diagnosis.strip():
            pending.append(Requirement("diagnosis", "Registre el diagnóstico."))
        if facts.line_count < 1:
            pending.append(Requirement("service_lines", "Agregue al menos un servicio."))
    elif not facts.work_performed.strip():
        pending.append(Requirement("work_performed", "Registre el trabajo correctivo realizado."))
    return tuple(pending)


DEFAULT_CHECKS: tuple[FinalizationCheck, ...] = (operational_data_check,)


def pending_requirements(
    facts: FinalizationFacts, *, extra_checks: tuple[FinalizationCheck, ...] = ()
) -> tuple[Requirement, ...]:
    pending: list[Requirement] = []
    for check in (*DEFAULT_CHECKS, *extra_checks):
        pending.extend(check(facts))
    return tuple(pending)
