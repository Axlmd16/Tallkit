"""Anulación conservadora de una venta con tratamiento explícito del dinero recibido.

Solo procede si no hay devoluciones y las salidas siguen siendo el último efecto de cada
producto. Si hay dinero real aplicado, el comando trae el desembolso que el Administrador ya
realizó y lo registra junto con la reversión exacta; el sistema no devuelve dinero físico.
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

from django.utils import timezone

import inventory.application.posting as posting
import inventory.application.queries as inventory_queries
from catalog.application.sales_references import (
    SaleProductReferenceError,
    get_sale_product_references,
    lock_product_references,
)
from identity.application.authorization import require_permission
from identity.models import User
from sales.application import reviews
from sales.application.commands import (
    CommandOutcome,
    CommandResult,
    execute_write,
    parse_operation_id,
    reject_unknown_fields,
    validated_version,
)
from sales.application.errors import SalesApplicationError, field_error, not_found, stale_record
from sales.application.ledger import Ledger, ledger_for
from sales.application.payments import parse_parts
from sales.application.projection import project
from sales.application.refunds import insert_refund
from sales.application.sales import lock_sale
from sales.domain.balances import PaymentMethod
from sales.models import CommercialWithholding, Sale, SaleReturn, SaleVoid
from shared.command_values import canonical_fingerprint

VOID_ACTION = "sale.void"
VOID_FIELDS = frozenset({"idempotency_key", "expected_version", "reason", "refund", "review_token"})
REASON_MAX = 500
_BLOCKER_CODES = {"later_movements": "unsafe_reversal", "inconsistent": "inventory_inconsistent"}

RefundInput = tuple[UUID, list[tuple[PaymentMethod, Decimal]]]


def _reason(payload: dict[str, Any]) -> str:
    reason = payload.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise field_error("validation_error", "reason", "El motivo es obligatorio.")
    if len(reason.strip()) > REASON_MAX:
        raise field_error(
            "validation_error", "reason", f"El motivo no puede exceder {REASON_MAX} caracteres."
        )
    return reason.strip()


def _refund_input(payload: dict[str, Any]) -> RefundInput | None:
    raw = payload.get("refund")
    if raw is None:
        return None
    if not isinstance(raw, dict) or set(raw) - {"operation_id", "parts"}:
        raise field_error("validation_error", "refund", "El desembolso no es válido.")
    return parse_operation_id(raw), parse_parts(raw.get("parts"), "refund.parts")


def _blockers(sale: Sale) -> list[dict[str, Any]]:
    blockers = inventory_queries.reversal_blockers(sale.inventory_operation_id or 0)
    products = get_sale_product_references(b.product_id for b in blockers)
    issues = []
    for blocker in blockers:
        ref = products.get(blocker.product_id)
        label = ref.code if ref else str(blocker.product_id)
        reference = (
            f" (movimiento INV-{blocker.blocking_operation_id})"
            if blocker.blocking_operation_id
            else ""
        )
        issues.append(
            {
                "code": _BLOCKER_CODES[blocker.code],
                "field": "lines",
                "product_id": blocker.product_id,
                "message": (
                    f"El producto {label} tiene movimientos posteriores{reference}; "
                    "no se puede anular la venta."
                    if blocker.code == "later_movements"
                    else f"Los saldos actuales de {label} no coinciden con el historial."
                ),
            }
        )
    return issues


def evaluate_void(sale: Sale, ledger: Ledger, refund: RefundInput | None) -> None:
    """Rechaza toda anulación que dejaría dinero, devoluciones o inventario sin resolver."""
    if sale.origin_type == "MAINTENANCE":
        raise SalesApplicationError(
            "linked_sale_not_voidable",
            "Una venta vinculada al mantenimiento no puede anularse.",
        )
    if sale.state == "DRAFT":
        raise SalesApplicationError("not_editable", "Un borrador no se anula.")
    if sale.state != "CONFIRMED":
        raise SalesApplicationError("invalid_state", "La venta ya está anulada.")
    held = list(
        CommercialWithholding.objects.filter(sale=sale, voided_at__isnull=True)
        .order_by("id")
        .values_list("pk", flat=True)
    )
    if held:
        guidance = (
            "La venta tiene retenciones recibidas vigentes; anúlelas con motivo antes de "
            "anular la venta."
        )
        raise SalesApplicationError(
            "dependency_conflict",
            guidance,
            {"withholdings": [f"Retención {pk} vigente." for pk in held]},
        )
    if SaleReturn.objects.filter(sale=sale).exists():
        guidance = (
            "La venta tiene devoluciones confirmadas; no puede anularse. Limite las "
            "devoluciones adicionales a lo que aún es devolvible."
        )
        raise SalesApplicationError("dependency_conflict", guidance, {"returns": [guidance]})
    blockers = _blockers(sale)
    if blockers:
        first = blockers[0]
        raise SalesApplicationError(
            first["code"],
            first["message"],
            {"lines": [b["message"] for b in blockers]},
        )
    applied = ledger.balance.applied
    if applied > 0:
        if refund is None:
            raise SalesApplicationError(
                "validation_error",
                "La venta tiene dinero recibido; registre el desembolso realizado al cliente.",
                {"refund": ["Indique el desembolso efectivo del dinero recibido."]},
            )
        total = sum((amount for _, amount in refund[1]), Decimal("0.00"))
        if total != applied:
            raise SalesApplicationError(
                "validation_error",
                "El desembolso debe igualar el dinero aplicado a la venta.",
                {"refund.parts": [f"Debe sumar exactamente {applied:.2f}."]},
            )
    elif refund is not None:
        raise SalesApplicationError(
            "validation_error",
            "La venta no tiene dinero recibido por devolver.",
            {"refund": ["No hay dinero aplicado que devolver."]},
        )


def _digest(sale: Sale, ledger: Ledger, reason: str, refund: RefundInput | None) -> str:
    return canonical_fingerprint(
        {
            "sale_id": sale.pk,
            "version": sale.version,
            "reason": reason,
            "operation_id": sale.inventory_operation_id,
            "effects": [
                [
                    e.product_id,
                    e.ordinal,
                    str(e.quantity_after),
                    str(e.value_after),
                    str(e.current_quantity),
                    str(e.current_value),
                    e.last_ordinal,
                ]
                for e in inventory_queries.operation_effects(sale.inventory_operation_id or 0)
            ],
            "applied": str(ledger.balance.applied),
            "refund": None
            if refund is None
            else [str(refund[0]), sorted((m.value, str(a)) for m, a in refund[1])],
        }
    )


def preview_void(
    *, actor: User, sale_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> dict[str, Any]:
    require_permission(
        actor=actor,
        permission="ventas.anular",
        request_id=request_id,
        denial_action="sales.sale_void_reviewed",
        target_type="sale",
        target_id=str(sale_id),
    )
    reject_unknown_fields(payload, VOID_FIELDS - {"review_token", "idempotency_key"})
    reason = _reason(payload)
    refund = _refund_input(payload)
    sale = Sale.objects.filter(pk=sale_id).first()
    if sale is None:
        raise not_found()
    ledger = ledger_for(sale)
    result: dict[str, Any] = {
        "sale_id": sale.pk,
        "state": sale.state,
        "version": sale.version,
        "can_void": False,
        "issues": [],
        "review_token": None,
        "expires_in_seconds": reviews.REVIEW_MAX_AGE_SECONDS,
        "money_to_return": f"{ledger.balance.applied:.2f}",
    }
    try:
        evaluate_void(sale, ledger, refund)
    except SalesApplicationError as error:
        result["issues"] = [
            {"code": error.code, "field": field, "message": messages[0]}
            for field, messages in (error.errors or {"": [error.message]}).items()
        ]
        return result
    result["can_void"] = True
    result["review_token"] = reviews.issue_token(
        actor=actor,
        action=VOID_ACTION,
        sale_id=sale.pk,
        version=sale.version,
        digest=_digest(sale, ledger, reason, refund),
    )
    return result


def void_sale(
    *, actor: User, sale_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Anula la venta; repetir una anulación completada devuelve el resultado existente."""

    def work() -> CommandResult:
        reject_unknown_fields(payload, VOID_FIELDS)
        expected = validated_version(payload)
        reason = _reason(payload)
        refund = _refund_input(payload)
        sale = lock_sale(sale_id)
        if sale.state == "VOIDED":
            if reason != sale.void_reason:
                raise SalesApplicationError(
                    "idempotency_conflict", "La venta ya fue anulada con otro motivo."
                )
            return CommandResult(200, "sale", sale.pk)
        if sale.version != expected:
            raise stale_record()
        ledger = ledger_for(sale)
        evaluate_void(sale, ledger, refund)
        reviewed = reviews.read_token(
            payload.get("review_token"),
            actor=actor,
            action=VOID_ACTION,
            sale_id=sale.pk,
            version=None,
        )
        original = posting.lock_operation(sale.inventory_operation_id or 0)
        lines = list(sale.lines.all())
        try:
            products = lock_product_references(
                {line.product_id for line in lines}, require_active=False
            )
        except SaleProductReferenceError:
            raise SalesApplicationError(
                "inactive_reference", "Hay productos inexistentes en la venta."
            ) from None
        positions = posting.lock_positions(products, warehouse_id=sale.warehouse_id)
        if reviewed != _digest(sale, ledger, reason, refund):
            raise SalesApplicationError(
                "review_required", "Los saldos cambiaron desde la revisión. Revise nuevamente."
            )
        try:
            reversal, _ = posting.reverse_operation(
                original,
                actor=actor,
                source_type="SALE_VOID",
                source_id=sale.pk,
                reason=reason,
                locked=positions,
                product_refs=products,
            )
        except posting.ReversalBlockedError as error:
            raise SalesApplicationError(
                "inventory_inconsistent" if error.code == "inconsistent" else "unsafe_reversal",
                str(error),
            ) from None
        void_refund = None
        if refund is not None:
            void_refund = insert_refund(
                sale=sale,
                actor=actor,
                operation_id=refund[0],
                origin="VOID",
                sale_return=None,
                reason=reason,
                parts=refund[1],
            )
        now = timezone.now()
        SaleVoid.objects.create(
            sale=sale,
            reason=reason,
            voided_at=now,
            voided_by=actor,
            reversal_operation=reversal,
            refund=void_refund,
        )
        sale.state = "VOIDED"
        sale.version += 1
        sale.void_reason = reason
        sale.voided_at = now
        sale.voided_by = actor
        sale.void_operation_id = reversal.pk
        sale.save()
        return CommandResult(200, "sale", sale.pk, ("state",))

    return execute_write(
        actor=actor,
        permission="ventas.anular",
        action="sales.sale_voided",
        target_type="sale",
        target_id=str(sale_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=project,
    )
