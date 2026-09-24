"""Finalización, reapertura e intervención correctiva: transiciones explícitas y atómicas.

El estado solo cambia aquí. Cada transición bloquea la orden, valida estado y versión, y deja
una ``StateTransition`` inmutable. Finalizar no genera ventas, pagos, deuda ni inventario.
"""

from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from identity.models import User
from workshop.application import projection
from workshop.application.commands import CommandOutcome, CommandResult, execute_write
from workshop.application.errors import WorkshopError, not_editable
from workshop.application.orders import open_order_conflict_after_race, parsed
from workshop.application.support import (
    ensure_version,
    lock_order,
    open_intervention,
    open_order_conflict,
)
from workshop.domain.finalization import pending_requirements
from workshop.domain.input import parse_intervention_update, parse_reopen, parse_version_only
from workshop.domain.states import InterventionKind, OrderState, TransitionError, ensure_transition
from workshop.models import Intervention, ServiceLine, StateTransition


def _transition_or_error(source: str, target: OrderState) -> None:
    try:
        ensure_transition(OrderState(source), target)
    except TransitionError:
        messages = {
            OrderState.FINALIZED: "La orden ya está finalizada.",
            OrderState.REOPENED: "Solo una orden finalizada puede reabrirse.",
        }
        raise WorkshopError("invalid_state", messages[target]) from None


def finalize_order(
    *, actor: User, order_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    def work() -> CommandResult:
        expected = parsed(lambda: parse_version_only(payload))
        order = lock_order(order_id)
        _transition_or_error(order.state, OrderState.FINALIZED)
        ensure_version(order, expected)
        intervention = open_intervention(order)
        line_count = ServiceLine.objects.filter(intervention=intervention).count()
        pending = pending_requirements(projection.facts_for(order, intervention, line_count))
        if pending:
            raise WorkshopError(
                "finalize_requirements",
                "La orden tiene requisitos pendientes para finalizar.",
                {"requirements": [r.message for r in pending]},
                details={"pending": [r.code for r in pending]},
            )
        now = timezone.now()
        intervention.closed_at = now
        intervention.closed_by = actor
        intervention.save(update_fields=["closed_at", "closed_by"])
        StateTransition.objects.create(
            order=order,
            intervention=intervention,
            from_state=order.state,
            to_state=OrderState.FINALIZED.value,
            actor=actor,
        )
        order.state = OrderState.FINALIZED.value
        order.last_finalized_at = now
        order.last_finalized_by = actor
        order.version += 1
        order.updated_by = actor
        order.save()
        return CommandResult(200, order.pk, ("state",))

    return execute_write(
        actor=actor,
        permissions=("mantenimientos.finalizar",),
        action="maintenance.finalize",
        target_id=str(order_id),
        payload=payload,
        work=work,
        project=lambda pk: projection.order_detail(pk, actor),
        request_id=request_id,
    )


def reopen_order(
    *, actor: User, order_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    def work() -> CommandResult:
        data = parsed(lambda: parse_reopen(payload))
        order = lock_order(order_id)
        _transition_or_error(order.state, OrderState.REOPENED)
        ensure_version(order, data.expected_version)
        open_order_conflict(order.vehicle_id, exclude_id=order.pk)
        ordinal = (
            Intervention.objects.filter(order=order).aggregate(m=Max("ordinal"))["m"] or 0
        ) + 1
        order.state = OrderState.REOPENED.value
        order.version += 1
        order.updated_by = actor
        try:
            with transaction.atomic():
                order.save()
        except IntegrityError:
            raise open_order_conflict_after_race(order.vehicle_id, order.pk) from None
        intervention = Intervention.objects.create(
            order=order,
            kind=InterventionKind.CORRECTIVE.value,
            ordinal=ordinal,
            cause=data.reason,
            opened_by=actor,
        )
        StateTransition.objects.create(
            order=order,
            intervention=intervention,
            from_state=OrderState.FINALIZED.value,
            to_state=OrderState.REOPENED.value,
            reason=data.reason,
            actor=actor,
        )
        return CommandResult(200, order.pk, ("state",))

    return execute_write(
        actor=actor,
        permissions=("mantenimientos.reabrir",),
        action="maintenance.reopen",
        target_id=str(order_id),
        payload=payload,
        work=work,
        project=lambda pk: projection.order_detail(pk, actor),
        request_id=request_id,
    )


def update_current_intervention(
    *, actor: User, order_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    def work() -> CommandResult:
        data = parsed(lambda: parse_intervention_update(payload))
        order = lock_order(order_id)
        if order.state != OrderState.REOPENED.value:
            raise (
                not_editable(order.state)
                if order.state == "FINALIZED"
                else WorkshopError(
                    "not_editable", "La orden no tiene una intervención correctiva abierta."
                )
            )
        ensure_version(order, data.expected_version)
        intervention = open_intervention(order)
        changed = [k for k, v in data.fields.items() if getattr(intervention, k) != v]
        for name in changed:
            setattr(intervention, name, data.fields[name])
        if changed:
            intervention.save(update_fields=changed)
            order.version += 1
            order.updated_by = actor
            order.save(update_fields=["version", "updated_by", "updated_at"])
        return CommandResult(200, order.pk, tuple(changed))

    return execute_write(
        actor=actor,
        permissions=("mantenimientos.gestionar",),
        action="maintenance.intervention_update",
        target_id=str(order_id),
        payload=payload,
        work=work,
        project=lambda pk: projection.order_detail(pk, actor),
        request_id=request_id,
    )
