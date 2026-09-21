"""Reembolsos efectivos de exceso pagado tras una devolución.

Registra un hecho: el dinero ya fue devuelto físicamente al cliente. No invoca bancos ni
sistemas externos, no crea saldo a favor y no compensa ventas entre sí.
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db.models import Sum
from django.utils import timezone

from identity.application.authorization import require_permission
from identity.models import User
from sales.application import reviews
from sales.application.commands import (
    CommandOutcome,
    CommandResult,
    execute_write,
    parse_operation_id,
    reject_unknown_fields,
)
from sales.application.errors import SalesApplicationError, field_error, not_found
from sales.application.ledger import Ledger, ledger_for
from sales.application.payments import parse_parts
from sales.application.projection import project
from sales.application.sales import lock_sale
from sales.domain.balances import PaymentMethod
from sales.models import CommercialRefund, RefundPart, Sale, SaleReturn
from shared.command_values import canonical_fingerprint

REFUND_ACTION = "refund.register"
REFUND_FIELDS = frozenset(
    {
        "idempotency_key",
        "operation_id",
        "sale_return_id",
        "reason",
        "parts",
        "review_token",
        "entity_type",
    }
)
REASON_MAX = 500


def _reason(payload: dict[str, Any]) -> str:
    reason = payload.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise field_error("validation_error", "reason", "El motivo es obligatorio.")
    if len(reason.strip()) > REASON_MAX:
        raise field_error(
            "validation_error", "reason", f"El motivo no puede exceder {REASON_MAX} caracteres."
        )
    return reason.strip()


def _return_id(payload: dict[str, Any]) -> int:
    value = payload.get("sale_return_id")
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise field_error("validation_error", "sale_return_id", "Indique la devolución de origen.")
    return value


def _check_scope(payload: dict[str, Any]) -> None:
    if payload.get("entity_type", "COMERCIAL") != "COMERCIAL":
        raise field_error(
            "validation_error",
            "entity_type",
            "Un reembolso comercial no puede aplicarse a una operación artesanal.",
        )


def attributable_remaining(sale_return: SaleReturn) -> Decimal:
    """Parte de la devolución que aún puede reembolsarse."""
    refunded = CommercialRefund.objects.filter(sale_return=sale_return).aggregate(t=Sum("amount"))[
        "t"
    ] or Decimal("0.00")
    return sale_return.grand_total - refunded


def validate_refund(
    sale: Sale,
    ledger: Ledger,
    sale_return: SaleReturn | None,
    parts: list[tuple[PaymentMethod, Decimal]],
) -> Decimal:
    if sale.state != "CONFIRMED":
        raise SalesApplicationError(
            "invalid_state", "Solo una venta confirmada admite reembolsos por devolución."
        )
    if sale_return is None or sale_return.sale_id != sale.pk:
        raise field_error(
            "validation_error", "sale_return_id", "La devolución no pertenece a esta venta."
        )
    total = sum((amount for _, amount in parts), Decimal("0.00"))
    if ledger.balance.excess <= 0:
        raise SalesApplicationError(
            "validation_error",
            "La venta no tiene exceso pagado pendiente de reembolso.",
            {"amount": ["No hay exceso pendiente de reembolso."]},
        )
    if total > ledger.balance.excess:
        raise SalesApplicationError(
            "validation_error",
            "El reembolso excede el exceso vigente de la venta.",
            {"amount": ["El importe excede el exceso pendiente de reembolso."]},
        )
    if total > attributable_remaining(sale_return):
        raise SalesApplicationError(
            "validation_error",
            "El reembolso excede la obligación atribuible a la devolución.",
            {"amount": ["El importe excede lo atribuible a esta devolución."]},
        )
    return total


def _digest(
    sale: Sale,
    ledger: Ledger,
    operation_id: UUID,
    sale_return_id: int,
    reason: str,
    parts: list[tuple[PaymentMethod, Decimal]],
) -> str:
    return canonical_fingerprint(
        {
            "sale_id": sale.pk,
            "version": sale.version,
            "operation_id": str(operation_id),
            "sale_return_id": sale_return_id,
            "reason": reason,
            "parts": sorted((m.value, str(a)) for m, a in parts),
            "exigible": str(ledger.exigible),
            "paid": str(ledger.paid),
            "refunded": str(ledger.refunded),
        }
    )


def preview_refund(
    *, actor: User, sale_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> dict[str, Any]:
    require_permission(
        actor=actor,
        permission="ventas.devolver",
        request_id=request_id,
        denial_action="sales.refund_reviewed",
        target_type="sale",
        target_id=str(sale_id),
    )
    reject_unknown_fields(payload, REFUND_FIELDS - {"review_token"})
    _check_scope(payload)
    operation_id = parse_operation_id(payload)
    return_id = _return_id(payload)
    reason = _reason(payload)
    parts = parse_parts(payload.get("parts"))
    sale = Sale.objects.filter(pk=sale_id).first()
    if sale is None:
        raise not_found()
    ledger = ledger_for(sale)
    result: dict[str, Any] = {
        "sale_id": sale.pk,
        "version": sale.version,
        "can_register": False,
        "issues": [],
        "review_token": None,
        "expires_in_seconds": reviews.REVIEW_MAX_AGE_SECONDS,
        "refund_due_before": f"{ledger.balance.excess:.2f}",
    }
    try:
        total = validate_refund(
            sale, ledger, SaleReturn.objects.filter(pk=return_id).first(), parts
        )
    except SalesApplicationError as error:
        result["issues"] = [
            {"code": error.code, "field": field, "message": messages[0]}
            for field, messages in (error.errors or {"": [error.message]}).items()
        ]
        return result
    result["can_register"] = True
    result["refund_due_after"] = f"{ledger.balance.excess - total:.2f}"
    result["review_token"] = reviews.issue_token(
        actor=actor,
        action=REFUND_ACTION,
        sale_id=sale.pk,
        version=sale.version,
        digest=_digest(sale, ledger, operation_id, return_id, reason, parts),
    )
    return result


def insert_refund(
    *,
    sale: Sale,
    actor: User,
    operation_id: UUID,
    origin: str,
    sale_return: SaleReturn | None,
    reason: str,
    parts: list[tuple[PaymentMethod, Decimal]],
) -> CommercialRefund:
    """Inserción compartida con la anulación; no abre transacciones ni reclama recibos."""
    total = sum((amount for _, amount in parts), Decimal("0.00"))
    refund = CommercialRefund.objects.create(
        operation_id=operation_id,
        sale=sale,
        origin=origin,
        sale_return=sale_return,
        amount=total,
        reason=reason,
        effective_at=timezone.now(),
        effective_date=reviews.today(),
        created_by=actor,
    )
    RefundPart.objects.bulk_create(
        RefundPart(refund=refund, method=method.value, amount=amount) for method, amount in parts
    )
    return refund


def register_refund(
    *, actor: User, sale_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Registra el desembolso ya realizado; repetir el mismo ``operation_id`` no lo duplica."""

    def work() -> CommandResult:
        reject_unknown_fields(payload, REFUND_FIELDS)
        _check_scope(payload)
        operation_id = parse_operation_id(payload)
        return_id = _return_id(payload)
        reason = _reason(payload)
        parts = parse_parts(payload.get("parts"))
        sale = lock_sale(sale_id)
        existing = CommercialRefund.objects.filter(operation_id=operation_id).first()
        if existing is not None:
            same = (
                existing.sale_id == sale.pk
                and existing.sale_return_id == return_id
                and sorted((p.method, p.amount) for p in existing.parts.all())
                == sorted((m.value, a) for m, a in parts)
            )
            if not same:
                raise SalesApplicationError(
                    "idempotency_conflict",
                    "Este identificador de operación ya se usó con otros datos.",
                )
            return CommandResult(200, "refund", existing.pk)
        sale_return = SaleReturn.objects.select_for_update().filter(pk=return_id).first()
        ledger = ledger_for(sale)
        validate_refund(sale, ledger, sale_return, parts)
        reviewed = reviews.read_token(
            payload.get("review_token"),
            actor=actor,
            action=REFUND_ACTION,
            sale_id=sale.pk,
            version=None,
        )
        if reviewed != _digest(sale, ledger, operation_id, return_id, reason, parts):
            raise SalesApplicationError(
                "review_required", "La venta cambió desde la revisión. Revise nuevamente."
            )
        refund = insert_refund(
            sale=sale,
            actor=actor,
            operation_id=operation_id,
            origin="RETURN",
            sale_return=sale_return,
            reason=reason,
            parts=parts,
        )
        sale.version += 1
        sale.save(update_fields=["version", "updated_at"])
        return CommandResult(201, "refund", refund.pk, ("amount", "parts"))

    return execute_write(
        actor=actor,
        permission="ventas.devolver",
        action="sales.refund_registered",
        target_type="sale",
        target_id=str(sale_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=project,
    )


def refund_history(*, actor: User, sale_id: int) -> list[dict[str, Any]]:
    from sales.application import queries

    require_permission(
        actor=actor,
        permission="ventas.ver",
        request_id=None,
        denial_action="sales.refunds_viewed",
        target_type="sale",
        target_id=str(sale_id),
    )
    sale = Sale.objects.filter(pk=sale_id).first()
    if sale is None:
        raise not_found()
    return [
        queries.refund_detail(r)
        for r in CommercialRefund.objects.filter(sale=sale)
        .select_related("sale")
        .order_by("effective_at", "id")
    ]
