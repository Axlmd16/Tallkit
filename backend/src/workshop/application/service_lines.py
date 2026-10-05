"""Líneas de servicio de la intervención abierta.

Orden de bloqueos: recibo → orden → intervención abierta → servicio. El precio aplicado de una
intervención correctiva es siempre 0,00 (DP-015); ninguna acción modifica el catálogo.
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db.models import Max

from identity.application.authorization import require_permission
from identity.models import User
from workshop.application import projection
from workshop.application.commands import TARGET_TYPE, CommandOutcome, CommandResult, execute_write
from workshop.application.errors import WorkshopError, not_editable
from workshop.application.orders import parsed
from workshop.application.support import (
    ensure_state,
    ensure_version,
    lock_order,
    lock_service,
    open_intervention,
)
from workshop.domain.input import parse_line_create, parse_line_update, parse_version_only
from workshop.domain.states import InterventionKind, OrderState
from workshop.models import Intervention, ServiceLine, ServiceOperationLine

ZERO = Decimal("0.00")
PRICE_PERMISSION = "mantenimientos.cambiar_precio_servicio"


def _no_charge_error() -> WorkshopError:
    message = "Los servicios de una intervención correctiva se registran sin cargo."
    return WorkshopError("validation_error", message, {"applied_price": [message]})


def _require_price_permission(actor: User, order_id: int, action: str) -> None:
    require_permission(
        actor=actor,
        permission=PRICE_PERMISSION,
        denial_action=action,
        target_type=TARGET_TYPE,
        target_id=str(order_id),
    )


def _touch(order: Any, actor: User) -> None:
    order.version += 1
    order.updated_by = actor
    order.save(update_fields=["version", "updated_by", "updated_at"])


def _open_line(order: Any, line_id: int) -> tuple[Intervention, ServiceLine]:
    intervention = open_intervention(order)
    line = (
        ServiceLine.objects.select_for_update()
        .filter(pk=line_id, intervention__order=order)
        .first()
    )
    if line is None:
        raise WorkshopError("not_found", "Línea de servicio no encontrada.")
    if line.intervention_id != intervention.pk:
        raise WorkshopError(
            "not_editable", "La línea pertenece a una intervención ya finalizada y se conserva."
        )
    documented = (
        ServiceOperationLine.objects.filter(service_line=line, is_current=True)
        .select_related("operation")
        .first()
    )
    if documented is not None:
        number = documented.operation.internal_number
        raise WorkshopError(
            "line_documented",
            f"La línea pertenece a la operación confirmada {number}; no puede modificarse.",
            details={"operation_id": documented.operation_id, "operation_number": number},
        )
    return intervention, line


def add_line(
    *, actor: User, order_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    action = "maintenance.service_line_add"

    def work() -> CommandResult:
        data = parsed(lambda: parse_line_create(payload))
        order = lock_order(order_id)
        ensure_state(order, OrderState.REGISTERED, OrderState.REOPENED)
        ensure_version(order, data.expected_version)
        intervention = open_intervention(order)
        service = lock_service(data.service_id)
        if intervention.kind == InterventionKind.CORRECTIVE.value:
            if data.applied_price not in (None, ZERO):
                raise _no_charge_error()
            applied = ZERO
        else:
            applied = service.reference_price if data.applied_price is None else data.applied_price
            if applied != service.reference_price:
                _require_price_permission(actor, order_id, action)
        position = (
            ServiceLine.objects.filter(intervention=intervention).aggregate(m=Max("position"))["m"]
            or 0
        ) + 1
        ServiceLine.objects.create(
            intervention=intervention,
            service_id=service.id,
            service_code=service.code,
            service_name=service.name,
            reference_price=service.reference_price,
            applied_price=applied,
            quantity=data.quantity,
            tax_definition_id=service.tax_definition_id,
            tax_name=service.tax_name,
            position=position,
            created_by=actor,
            updated_by=actor,
        )
        _touch(order, actor)
        return CommandResult(201, order.pk, ("service_lines",))

    return execute_write(
        actor=actor,
        permissions=("mantenimientos.gestionar",),
        action=action,
        target_id=str(order_id),
        payload=payload,
        work=work,
        project=lambda pk: projection.order_detail(pk, actor),
        request_id=request_id,
    )


def update_line(
    *,
    actor: User,
    order_id: int,
    line_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    action = "maintenance.service_line_update"

    def work() -> CommandResult:
        data = parsed(lambda: parse_line_update(payload))
        order = lock_order(order_id)
        ensure_state(order, OrderState.REGISTERED, OrderState.REOPENED)
        ensure_version(order, data.expected_version)
        intervention, line = _open_line(order, line_id)
        changed: list[str] = []
        if data.applied_price is not None and data.applied_price != line.applied_price:
            if intervention.kind == InterventionKind.CORRECTIVE.value:
                raise _no_charge_error()
            _require_price_permission(actor, order_id, action)
            line.applied_price = data.applied_price
            changed.append("applied_price")
        if data.quantity is not None and data.quantity != line.quantity:
            line.quantity = data.quantity
            changed.append("quantity")
        if changed:
            line.updated_by = actor
            line.save()
            _touch(order, actor)
        return CommandResult(200, order.pk, tuple(changed))

    return execute_write(
        actor=actor,
        permissions=("mantenimientos.gestionar",),
        action=action,
        target_id=str(order_id),
        payload={**payload, "line_id": line_id},
        work=work,
        project=lambda pk: projection.order_detail(pk, actor),
        request_id=request_id,
    )


def remove_line(
    *,
    actor: User,
    order_id: int,
    line_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    def work() -> CommandResult:
        expected = parsed(lambda: parse_version_only(payload))
        order = lock_order(order_id)
        if order.state == OrderState.FINALIZED.value:
            raise not_editable(order.state)
        ensure_version(order, expected)
        _, line = _open_line(order, line_id)
        line.delete()
        _touch(order, actor)
        return CommandResult(200, order.pk, ("service_lines",))

    return execute_write(
        actor=actor,
        permissions=("mantenimientos.gestionar",),
        action="maintenance.service_line_remove",
        target_id=str(order_id),
        payload={**payload, "line_id": line_id},
        work=work,
        project=lambda pk: projection.order_detail(pk, actor),
        request_id=request_id,
    )
