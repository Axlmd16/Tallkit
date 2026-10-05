"""Proyección del detalle de una orden con permisos y requisitos calculados en servidor."""

from decimal import Decimal
from typing import Any

from catalog.application.workshop_references import get_service_active_states
from customer_registry.application.workshop_references import get_active_states
from identity.models import User
from sales.application.workshop_links import open_linked_line_count
from workshop.application.errors import not_found
from workshop.application.support import actor_permissions, user_label
from workshop.domain.amounts import line_subtotal, services_total
from workshop.domain.finalization import FinalizationFacts, pending_requirements
from workshop.domain.states import (
    InterventionKind,
    OrderState,
    allowed_actions,
    billing_actions,
)
from workshop.models import (
    Intervention,
    MaintenanceOrder,
    OrderPhoto,
    ServiceLine,
    ServiceOperationLine,
)


def money(value: Decimal) -> str:
    return f"{value:.2f}"


def _line(
    line: ServiceLine,
    active: dict[int, bool],
    corrective: bool,
    documented: dict[int, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "id": line.pk,
        "service_id": line.service_id,
        "service_code": line.service_code,
        "service_name": line.service_name,
        "service_is_active": active.get(line.service_id, False),
        "reference_price": money(line.reference_price),
        "applied_price": money(line.applied_price),
        "quantity": line.quantity,
        "subtotal": money(line_subtotal(line.quantity, line.applied_price)),
        "tax_name": line.tax_name,
        "no_charge": corrective,
        "documented_by": (documented or {}).get(line.pk),
    }


def photo_item(photo: OrderPhoto) -> dict[str, Any]:
    base = f"/api/v1/maintenance-orders/{photo.order_id}/photos/{photo.pk}"
    return {
        "id": photo.pk,
        "intervention_id": photo.intervention_id,
        "description": photo.description,
        "content_type": photo.content_type,
        "size_bytes": photo.size_bytes,
        "width": photo.width,
        "height": photo.height,
        "uploaded_by": user_label(photo.uploaded_by),
        "uploaded_at": photo.uploaded_at.isoformat(),
        "file_url": f"{base}/file/",
        "thumbnail_url": f"{base}/thumbnail/",
    }


def facts_for(
    order: MaintenanceOrder, intervention: Intervention, line_count: int
) -> FinalizationFacts:
    return FinalizationFacts(
        kind=InterventionKind(intervention.kind),
        diagnosis=order.diagnosis,
        line_count=line_count,
        work_performed=intervention.work_performed,
        pending_part_lines=open_linked_line_count(order.pk),
    )


def order_detail(order_id: int, actor: User) -> dict[str, Any]:
    order = (
        MaintenanceOrder.objects.select_related(
            "fiscal_entity",
            "created_by",
            "updated_by",
            "last_finalized_by",
            "odometer_confirmed_by",
        )
        .filter(pk=order_id)
        .first()
    )
    if order is None:
        raise not_found()
    interventions = list(
        Intervention.objects.filter(order=order).select_related("opened_by", "closed_by")
    )
    lines = list(
        ServiceLine.objects.filter(intervention__order=order).order_by(
            "intervention__ordinal", "position", "id"
        )
    )
    photos = list(
        OrderPhoto.objects.filter(order=order, removed_at__isnull=True).select_related(
            "uploaded_by"
        )
    )
    transitions = list(order.transitions.select_related("actor"))
    customers_active, vehicles_active = get_active_states({order.customer_id}, {order.vehicle_id})
    services_active = get_service_active_states({line.service_id for line in lines})
    documented = {
        row.service_line_id: {"id": row.operation_id, "number": row.operation.internal_number}
        for row in ServiceOperationLine.objects.filter(
            service_line__in=lines, is_current=True
        ).select_related("operation")
        if row.service_line_id is not None
    }
    by_intervention: dict[int, list[ServiceLine]] = {}
    for line in lines:
        by_intervention.setdefault(line.intervention_id, []).append(line)

    state = OrderState(order.state)
    initial_lines = [
        line for i in interventions if i.kind == "INITIAL" for line in by_intervention.get(i.pk, [])
    ]
    pending: list[dict[str, str]] = []
    open_one = next((i for i in interventions if i.closed_at is None), None)
    if open_one is not None:
        facts = facts_for(order, open_one, len(by_intervention.get(open_one.pk, [])))
        pending = [{"code": r.code, "message": r.message} for r in pending_requirements(facts)]

    return {
        "id": order.pk,
        "number": order.number,
        "state": order.state,
        "version": order.version,
        "fiscal_entity": {
            "ruc": order.fiscal_entity.ruc,
            "legal_name": order.fiscal_entity.legal_name,
        },
        "customer": {
            "id": order.customer_id,
            **{k: v for k, v in order.customer_snapshot.items() if k != "schema_version"},
            "is_active": customers_active.get(order.customer_id, False),
        },
        "vehicle": {
            "id": order.vehicle_id,
            **{k: v for k, v in order.vehicle_snapshot.items() if k != "schema_version"},
            "is_active": vehicles_active.get(order.vehicle_id, False),
        },
        "opened_on": order.opened_on.isoformat(),
        "odometer_km": order.odometer_km,
        "odometer_confirmation": (
            {
                "by": user_label(order.odometer_confirmed_by),
                "at": order.odometer_confirmed_at.isoformat(),
            }
            if order.odometer_confirmed_at
            else None
        ),
        "diagnosis": order.diagnosis,
        "notes": order.notes,
        "created_by": user_label(order.created_by),
        "created_at": order.created_at.isoformat(),
        "updated_by": user_label(order.updated_by),
        "updated_at": order.updated_at.isoformat(),
        "last_finalized_by": user_label(order.last_finalized_by),
        "last_finalized_at": order.last_finalized_at.isoformat()
        if order.last_finalized_at
        else None,
        "services_total": money(
            services_total((line.quantity, line.applied_price) for line in initial_lines)
        ),
        "interventions": [
            {
                "id": i.pk,
                "kind": i.kind,
                "ordinal": i.ordinal,
                "cause": i.cause,
                "work_performed": i.work_performed,
                "notes": i.notes,
                "is_open": i.closed_at is None,
                "opened_by": user_label(i.opened_by),
                "opened_at": i.opened_at.isoformat(),
                "closed_by": user_label(i.closed_by),
                "closed_at": i.closed_at.isoformat() if i.closed_at else None,
                "lines": [
                    _line(line, services_active, i.kind == "CORRECTIVE", documented)
                    for line in by_intervention.get(i.pk, [])
                ],
                "subtotal": money(
                    services_total(
                        (ln.quantity, ln.applied_price) for ln in by_intervention.get(i.pk, [])
                    )
                ),
            }
            for i in interventions
        ],
        "photos": [photo_item(p) for p in photos],
        "transitions": [
            {
                "id": t.pk,
                "from_state": t.from_state,
                "to_state": t.to_state,
                "reason": t.reason,
                "actor": user_label(t.actor),
                "occurred_at": t.occurred_at.isoformat(),
                "intervention_id": t.intervention_id,
            }
            for t in transitions
        ],
        "pending_requirements": pending,
        "allowed_actions": list(allowed_actions(state, actor_permissions(actor))),
        "billing_actions": list(
            billing_actions(
                state,
                actor_permissions(actor),
                pending_services=any(
                    line.applied_price > 0 and line.pk not in documented for line in initial_lines
                ),
            )
        ),
    }
