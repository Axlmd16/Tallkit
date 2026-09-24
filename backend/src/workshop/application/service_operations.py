"""Operación artesanal de servicios (ART-SER): vista previa, confirmación, consulta y anulación.

Orden de bloqueos (D7): recibo → orden → líneas de servicio pendientes → contexto artesanal
(entidad, impuestos) → numeración → inserciones. La operación nace confirmada: las líneas
iniciales no documentadas de la orden son el detalle pendiente. Nunca produce efectos de
inventario ni registra pagos.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db import transaction
from django.db.models import F, Max, Sum
from django.utils import timezone

from identity.application.authorization import has_permission, require_permission
from identity.models import User
from shared.money import ZERO, BalanceResult, PaymentCondition, PaymentState, compute_balance
from workshop.application.commands import CommandOutcome, CommandResult, execute_write
from workshop.application.errors import WorkshopError, field_error, stale_record
from workshop.application.support import business_today, lock_order, user_label
from workshop.domain.service_operation import (
    ConditionError,
    DocumentableLine,
    LineComputation,
    RateInfo,
    compute_lines,
    document_totals,
    parse_condition,
    review_digest,
)
from workshop.models import (
    SNAPSHOT_SCHEMA_VERSION,
    ArtisanPayment,
    MaintenanceOrder,
    ServiceLine,
    ServiceOperation,
    ServiceOperationLine,
)
from workshop_configuration.application.workshop_references import (
    ArtisanContextError,
    ArtisanEntityMissingError,
    ArtisanNumberingError,
    ArtisanTaxSnapshot,
    allocate_artisan_number,
    lock_artisan_operation_context,
    review_artisan_operation_context,
)

TARGET_TYPE = "service_operation"
CONFIRM_FIELDS = frozenset({"condition", "review_digest", "expected_version", "idempotency_key"})
VOID_FIELDS = frozenset({"reason", "expected_version", "idempotency_key"})


def _operation_not_found() -> WorkshopError:
    return WorkshopError("not_found", "Operación artesanal no encontrada.")


def _order_not_found() -> WorkshopError:
    return WorkshopError("not_found", "Orden de mantenimiento no encontrada.")


def _reject_unknown(payload: dict[str, Any], allowed: frozenset[str]) -> None:
    unknown = sorted(set(payload) - allowed)
    if unknown:
        raise WorkshopError(
            "unknown_field",
            "La solicitud contiene campos no admitidos.",
            {name: ["Campo no admitido."] for name in unknown},
        )


def _condition(payload: dict[str, Any]) -> PaymentCondition:
    try:
        return parse_condition(payload.get("condition"))
    except ConditionError as error:
        raise field_error("validation_error", "condition", str(error)) from None


def _expected_version(payload: dict[str, Any]) -> int:
    value = payload.get("expected_version")
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise field_error(
            "validation_error", "expected_version", "La versión esperada es obligatoria."
        )
    return value


# --- Selección y cálculo ---------------------------------------------------------------------


def _pending_lines(order: MaintenanceOrder, *, lock: bool) -> list[ServiceLine]:
    """Líneas de la intervención inicial sin documentación vigente, en su orden visible."""
    query = ServiceLine.objects.filter(
        intervention__order=order, intervention__kind="INITIAL"
    ).exclude(documentations__is_current=True)
    if lock:
        query = query.select_for_update(of=("self",))
    return list(query.order_by("position", "id"))


def _documentable(lines: list[ServiceLine]) -> list[DocumentableLine]:
    return [
        DocumentableLine(
            line_id=line.pk,
            service_id=line.service_id,
            service_name=line.service_name,
            quantity=line.quantity,
            reference_price=line.reference_price,
            applied_price=line.applied_price,
            tax_definition_id=line.tax_definition_id,
        )
        for line in lines
    ]


@dataclass(frozen=True)
class _Resolution:
    rates: dict[int, RateInfo | None]
    taxes: dict[int, ArtisanTaxSnapshot]
    issues: list[dict[str, Any]]
    entity: Any


def _resolve_taxes(tax_ids: set[int], on: Any, *, lock: bool = True) -> _Resolution:
    """Resuelve cada definición por separado para identificar la que falta.

    Con ``lock`` (confirmación) bloquea dentro de la transacción exterior; sin él (vista previa)
    solo lee, sin bloquear filas de configuración.
    """
    resolve = lock_artisan_operation_context if lock else review_artisan_operation_context
    rates: dict[int, RateInfo | None] = {}
    taxes: dict[int, ArtisanTaxSnapshot] = {}
    issues: list[dict[str, Any]] = []
    entity = None
    for tax_id in sorted(tax_ids):
        try:
            with transaction.atomic():
                locked = resolve(tax_definition_ids=[tax_id], on=on)
        except ArtisanContextError as error:
            rates[tax_id] = None
            issues.append(
                {
                    "code": "configuration_missing",
                    "tax_definition_id": tax_id,
                    "message": error.detail or "El impuesto no tiene una vigencia única.",
                }
            )
            continue
        entity = locked.entity
        snap = locked.taxes[tax_id]
        taxes[tax_id] = snap
        rates[tax_id] = RateInfo(rate=snap.rate, period_id=snap.period_id)
    return _Resolution(rates, taxes, issues, entity)


def _money(value: Decimal | None) -> str | None:
    return None if value is None else format(value, "f")


def _line_view(computation: LineComputation) -> dict[str, Any]:
    line, amounts = computation.line, computation.amounts
    return {
        "service_line_id": line.line_id,
        "service_id": line.service_id,
        "service_name": line.service_name,
        "quantity": line.quantity,
        "reference_price": _money(line.reference_price),
        "applied_price": _money(line.applied_price),
        "tax_definition_id": line.tax_definition_id,
        "tax_rate": _money(computation.rate.rate) if computation.rate else None,
        "base_amount": _money(amounts.base) if amounts else None,
        "tax_amount": _money(amounts.tax) if amounts else None,
        "total_amount": _money(amounts.total) if amounts else None,
    }


def _replaced_operations(lines: list[ServiceLine]) -> list[ServiceOperation]:
    return list(
        ServiceOperation.objects.filter(
            lines__service_line__in=lines, lines__is_current=False, state="VOIDED"
        )
        .distinct()
        .order_by("-voided_at", "-id")
    )


def _warnings(order: MaintenanceOrder, replaced: list[ServiceOperation]) -> list[dict[str, str]]:
    warnings: list[dict[str, str]] = []
    if order.predates_billing:
        warnings.append(
            {
                "code": "predates_billing",
                "message": "La orden es anterior a la documentación de servicios: verifique "
                "que estos servicios no se cobraron fuera del sistema.",
            }
        )
    for operation in replaced:
        warnings.append(
            {
                "code": "replaces_voided",
                "message": f"Estas líneas estuvieron documentadas en {operation.internal_number}, "
                "anulada; la nueva operación la reemplazará.",
            }
        )
    return warnings


# --- Vista previa ------------------------------------------------------------------------------


def preview_operation(
    *, actor: User, order_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> dict[str, Any]:
    """Proyección sin efectos: líneas pendientes, importes, efectos y huella de revisión."""
    require_permission(
        actor=actor,
        permission="servicios_economicos.confirmar",
        request_id=request_id,
        denial_action="maintenance.service_operation_preview",
        target_type="maintenance_order",
        target_id=str(order_id),
    )
    _reject_unknown(payload, frozenset({"condition"}))
    condition = _condition(payload)
    order = MaintenanceOrder.objects.filter(pk=order_id).first()
    if order is None:
        raise _order_not_found()
    on = business_today()
    lines = _pending_lines(order, lock=False)
    documentable = _documentable(lines)
    resolution = _resolve_taxes({line.tax_definition_id for line in documentable}, on, lock=False)
    computations = compute_lines(documentable, resolution.rates)
    totals = document_totals(computations)
    issues = list(resolution.issues)
    if not lines or (totals is not None and totals.total <= 0):
        issues.append(
            {
                "code": "nothing_to_document",
                "message": "No hay importe de servicios por documentar.",
            }
        )
    return {
        "order_id": order.pk,
        "order_number": order.number,
        "condition": condition.value,
        "operational_date": on.isoformat(),
        "lines": [_line_view(c) for c in computations],
        "totals": {
            "base": _money(totals.base),
            "tax": _money(totals.tax),
            "total": _money(totals.total),
        }
        if totals
        else None,
        "effects": {
            "series": "ART-SER",
            "creates_balance": True,
            "affects_inventory": False,
            "registers_payment": False,
        },
        "issues": issues,
        "warnings": _warnings(order, _replaced_operations(lines)),
        "review_digest": review_digest(
            order_id=order.pk,
            customer_id=order.customer_id,
            condition=condition,
            on=on,
            computations=computations,
        ),
    }


# --- Confirmación -----------------------------------------------------------------------------


def _config_error(issues: list[dict[str, Any]]) -> WorkshopError:
    messages = [issue["message"] for issue in issues]
    return WorkshopError(
        "configuration_missing",
        "Falta configuración tributaria vigente para documentar los servicios.",
        {"lines": messages},
        details={"tax_definition_ids": [issue["tax_definition_id"] for issue in issues]},
    )


def confirm_operation(
    *, actor: User, order_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    def work() -> CommandResult:
        _reject_unknown(payload, CONFIRM_FIELDS)
        condition = _condition(payload)
        expected = _expected_version(payload)
        reviewed = payload.get("review_digest")
        order = lock_order(order_id)
        if order.version != expected:
            raise stale_record()
        lines = _pending_lines(order, lock=True)
        if not lines:
            raise WorkshopError("nothing_to_document", "No hay servicios pendientes de documentar.")
        documentable = _documentable(lines)
        on = business_today()
        resolution = _resolve_taxes({line.tax_definition_id for line in documentable}, on)
        if resolution.issues:
            raise _config_error(resolution.issues)
        computations = compute_lines(documentable, resolution.rates)
        totals = document_totals(computations)
        if totals is None or totals.total <= 0:
            raise WorkshopError(
                "nothing_to_document", "Las líneas pendientes no tienen importe por documentar."
            )
        digest = review_digest(
            order_id=order.pk,
            customer_id=order.customer_id,
            condition=condition,
            on=on,
            computations=computations,
        )
        if digest != reviewed:
            raise WorkshopError(
                "review_required",
                "Los servicios, importes o la condición cambiaron desde la revisión.",
            )
        replaced = _replaced_operations(lines)
        sequence = ServiceOperation.objects.filter(order=order).aggregate(n=Max("id"))["n"] or 0
        try:
            allocation = allocate_artisan_number(
                request_key=f"service-operation:{order.pk}:{sequence}:{digest}"
            )
        except (ArtisanNumberingError, ArtisanEntityMissingError) as error:
            raise field_error("configuration_missing", "series", str(error)) from None
        entity = resolution.entity
        operation = ServiceOperation.objects.create(
            order=order,
            fiscal_entity_id=entity.id,
            customer_id=order.customer_id,
            customer_snapshot=order.customer_snapshot,
            vehicle_snapshot=order.vehicle_snapshot,
            fiscal_snapshot={
                "schema_version": SNAPSHOT_SCHEMA_VERSION,
                "entity": {
                    "id": entity.id,
                    "type": "ARTESANAL",
                    "ruc": entity.ruc,
                    "legal_name": entity.legal_name,
                },
                "series_code": allocation.series_code,
            },
            number_allocation_id=allocation.allocation_id,
            internal_number=allocation.visible_number,
            condition=condition.value,
            operational_date=on,
            base_total=totals.base,
            tax_total=totals.tax,
            grand_total=totals.total,
            replaces=replaced[0] if replaced else None,
            applied_review=digest,
            created_by=actor,
        )
        ServiceOperationLine.objects.bulk_create(
            ServiceOperationLine(
                operation=operation,
                service_line_id=c.line.line_id,
                position=index,
                service_id=c.line.service_id,
                service_name=c.line.service_name,
                quantity=c.line.quantity,
                reference_price=c.line.reference_price,
                applied_price=c.line.applied_price,
                tax_definition_id=c.line.tax_definition_id,
                tax_snapshot=_tax_snapshot(resolution.taxes[c.line.tax_definition_id]),
                tax_rate=resolution.taxes[c.line.tax_definition_id].rate,
                base_amount=c.amounts.base,  # type: ignore[union-attr]
                tax_amount=c.amounts.tax,  # type: ignore[union-attr]
                total_amount=c.amounts.total,  # type: ignore[union-attr]
            )
            for index, c in enumerate(computations, start=1)
        )
        order.version += 1
        order.updated_by = actor
        order.save(update_fields=["version", "updated_by", "updated_at"])
        return CommandResult(201, operation.pk, ("service_operation",))

    return execute_write(
        actor=actor,
        permissions=("servicios_economicos.confirmar",),
        action="maintenance.service_operation_confirm",
        target_id=str(order_id),
        payload=payload,
        work=work,
        project=lambda pk: operation_detail(pk, actor),
        request_id=request_id,
        target_type=TARGET_TYPE,
    )


def _tax_snapshot(snap: ArtisanTaxSnapshot) -> dict[str, Any]:
    return {
        "schema_version": SNAPSHOT_SCHEMA_VERSION,
        "definition_id": snap.definition_id,
        "code": snap.code,
        "name": snap.name,
        "rate": format(snap.rate, "f"),
        "period_id": snap.period_id,
        "starts_on": snap.starts_on.isoformat(),
        "ends_on": snap.ends_on.isoformat() if snap.ends_on else None,
    }


# --- Saldo y consulta -------------------------------------------------------------------------


def paid_total(operation: ServiceOperation) -> Decimal:
    total = ArtisanPayment.objects.filter(
        service_operation=operation, correction__isnull=True
    ).aggregate(total=Sum("amount"))["total"]
    return total or ZERO


def balance_of(operation: ServiceOperation) -> BalanceResult:
    exigible = operation.grand_total if operation.state == "CONFIRMED" else ZERO
    return compute_balance(exigible, paid_total(operation), ZERO)


def _allowed_actions(operation: ServiceOperation, actor: User, balance: BalanceResult) -> list[str]:
    actions: list[str] = []
    confirmed = operation.state == "CONFIRMED"
    if confirmed and balance.balance > 0 and has_permission(actor, "pagos_artesanales.registrar"):
        actions.append("pay")
    if confirmed and balance.applied == 0 and has_permission(actor, "servicios_economicos.anular"):
        actions.append("void")
    return actions


def operation_summary(operation: ServiceOperation, actor: User | None = None) -> dict[str, Any]:
    balance = balance_of(operation)
    summary = {
        "id": operation.pk,
        "internal_number": operation.internal_number,
        "order_id": operation.order_id,
        "state": operation.state,
        "condition": operation.condition,
        "operational_date": operation.operational_date.isoformat(),
        "customer_snapshot": operation.customer_snapshot,
        "grand_total": _money(operation.grand_total),
        "paid": _money(balance.applied),
        "balance": _money(balance.balance),
        "payment_state": balance.state.value
        if operation.state == "CONFIRMED"
        else PaymentState.PAID.value,
        "replaces": _ref(operation.replaces),
        "replaced_by": [_ref(o) for o in operation.replaced_by.order_by("id")],
        "void_reason": operation.void_reason,
        "version": operation.version,
    }
    if actor is not None:
        summary["allowed_actions"] = _allowed_actions(operation, actor, balance)
    return summary


def _ref(operation: ServiceOperation | None) -> dict[str, Any] | None:
    if operation is None:
        return None
    return {"id": operation.pk, "internal_number": operation.internal_number}


def operation_detail(operation_id: int, actor: User) -> dict[str, Any]:
    operation = (
        ServiceOperation.objects.select_related("order", "replaces", "created_by", "voided_by")
        .filter(pk=operation_id)
        .first()
    )
    if operation is None:
        raise _operation_not_found()
    body = operation_summary(operation, actor)
    body.update(
        {
            "order_number": operation.order.number,
            "vehicle_snapshot": operation.vehicle_snapshot,
            "fiscal_snapshot": operation.fiscal_snapshot,
            "base_total": _money(operation.base_total),
            "tax_total": _money(operation.tax_total),
            "lines": [
                {
                    "id": line.pk,
                    "service_line_id": line.service_line_id,
                    "position": line.position,
                    "service_id": line.service_id,
                    "service_name": line.service_name,
                    "quantity": line.quantity,
                    "reference_price": _money(line.reference_price),
                    "applied_price": _money(line.applied_price),
                    "tax_name": line.tax_snapshot.get("name"),
                    "tax_rate": _money(line.tax_rate),
                    "base_amount": _money(line.base_amount),
                    "tax_amount": _money(line.tax_amount),
                    "total_amount": _money(line.total_amount),
                }
                for line in operation.lines.all()
            ],
            "payments": payment_history(operation),
            "created_by": user_label(operation.created_by),
            "created_at": operation.created_at.isoformat(),
            "voided_by": user_label(operation.voided_by),
            "voided_at": operation.voided_at.isoformat() if operation.voided_at else None,
            "fiscal_notice": "Documento interno: no constituye factura electrónica autorizada "
            "por el SRI.",
        }
    )
    return body


def _payment_status(payment: ArtisanPayment) -> str:
    correction = getattr(payment, "correction", None)
    if correction is None:
        return "EFFECTIVE"
    return "REPLACED" if correction.replacement_payment_id else "VOIDED"


def payment_history(operation: ServiceOperation) -> list[dict[str, Any]]:
    payments = (
        ArtisanPayment.objects.filter(service_operation=operation)
        .select_related("created_by", "correction", "correction__created_by")
        .prefetch_related("parts")
        .order_by("effective_at", "id")
    )
    history: list[dict[str, Any]] = []
    for payment in payments:
        correction = getattr(payment, "correction", None)
        history.append(
            {
                "id": payment.pk,
                "operation_id": str(payment.operation_id),
                "amount": _money(payment.amount),
                "effective_at": payment.effective_at.isoformat(),
                "effective_date": payment.effective_date.isoformat(),
                "created_by": user_label(payment.created_by),
                "status": _payment_status(payment),
                "parts": [
                    {"method": part.method, "amount": _money(part.amount)}
                    for part in sorted(payment.parts.all(), key=lambda p: p.method)
                ],
                "correction": {
                    "reason": correction.reason,
                    "created_by": user_label(correction.created_by),
                    "created_at": correction.created_at.isoformat(),
                    "replacement_payment_id": correction.replacement_payment_id,
                }
                if correction
                else None,
            }
        )
    return history


def get_operation(
    *, actor: User, operation_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    require_permission(
        actor=actor,
        permission="servicios_economicos.ver",
        request_id=request_id,
        denial_action="maintenance.service_operation_view",
        target_type=TARGET_TYPE,
        target_id=str(operation_id),
    )
    return operation_detail(operation_id, actor)


def order_operations(order_id: int, actor: User) -> list[dict[str, Any]]:
    return [
        operation_summary(operation, actor)
        for operation in ServiceOperation.objects.filter(order_id=order_id)
        .select_related("replaces")
        .order_by("created_at", "id")
    ]


def documented_numbers(line_ids: list[int]) -> dict[int, dict[str, Any]]:
    """Operación vigente que documenta cada línea de servicio."""
    rows = ServiceOperationLine.objects.filter(
        service_line_id__in=line_ids, is_current=True
    ).select_related("operation")
    return {
        row.service_line_id: {"id": row.operation_id, "number": row.operation.internal_number}
        for row in rows
        if row.service_line_id is not None
    }


def has_current_operation(order_id: int) -> list[str]:
    return list(
        ServiceOperation.objects.filter(order_id=order_id, state="CONFIRMED")
        .order_by("id")
        .values_list("internal_number", flat=True)
    )


# --- Anulación --------------------------------------------------------------------------------


def lock_operation(operation_id: int) -> ServiceOperation:
    operation = (
        ServiceOperation.objects.select_for_update(of=("self",)).filter(pk=operation_id).first()
    )
    if operation is None:
        raise _operation_not_found()
    return operation


def void_preview(*, actor: User, operation_id: int) -> dict[str, Any]:
    require_permission(
        actor=actor,
        permission="servicios_economicos.anular",
        denial_action="maintenance.service_operation_void_preview",
        target_type=TARGET_TYPE,
        target_id=str(operation_id),
    )
    operation = ServiceOperation.objects.filter(pk=operation_id).first()
    if operation is None:
        raise _operation_not_found()
    balance = balance_of(operation)
    blockers: list[str] = []
    if operation.state != "CONFIRMED":
        blockers.append("La operación ya está anulada.")
    if balance.applied > 0:
        blockers.append(
            "Tiene pagos vigentes: corrija primero los pagos registrados por error. El reembolso "
            "de dinero recibido no forma parte de esta entrega."
        )
    return {
        "id": operation.pk,
        "internal_number": operation.internal_number,
        "grand_total": _money(operation.grand_total),
        "paid": _money(balance.applied),
        "can_void": not blockers,
        "blockers": blockers,
        "effects": {"affects_inventory": False, "releases_lines": True, "keeps_number": True},
        "version": operation.version,
    }


def void_operation(
    *, actor: User, operation_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    def work() -> CommandResult:
        _reject_unknown(payload, VOID_FIELDS)
        reason = payload.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            raise field_error("validation_error", "reason", "El motivo es obligatorio.")
        if len(reason.strip()) > 500:
            raise field_error("validation_error", "reason", "El motivo admite 500 caracteres.")
        expected = _expected_version(payload)
        operation = ServiceOperation.objects.filter(pk=operation_id).only("order_id").first()
        if operation is None:
            raise _operation_not_found()
        lock_order(operation.order_id)
        operation = lock_operation(operation_id)
        if operation.state != "CONFIRMED":
            raise WorkshopError("invalid_state", "La operación ya está anulada.")
        if operation.version != expected:
            raise WorkshopError(
                "stale_record",
                "La operación cambió desde que la consultó.",
                {"expected_version": ["La versión esperada no coincide con la vigente."]},
            )
        if paid_total(operation) > 0:
            raise WorkshopError(
                "payments_block_void",
                "La operación tiene pagos vigentes: corrija primero los pagos registrados por "
                "error. El reembolso de dinero recibido no forma parte de esta entrega.",
            )
        operation.state = "VOIDED"
        operation.void_reason = reason.strip()
        operation.voided_at = timezone.now()
        operation.voided_by = actor
        operation.version += 1
        operation.save()
        ServiceOperationLine.objects.filter(operation=operation).update(is_current=False)
        MaintenanceOrder.objects.filter(pk=operation.order_id).update(version=F("version") + 1)
        return CommandResult(200, operation.pk, ("state",))

    return execute_write(
        actor=actor,
        permissions=("servicios_economicos.anular",),
        action="maintenance.service_operation_void",
        target_id=str(operation_id),
        payload=payload,
        work=work,
        project=lambda pk: operation_detail(pk, actor),
        request_id=request_id,
        target_type=TARGET_TYPE,
    )
