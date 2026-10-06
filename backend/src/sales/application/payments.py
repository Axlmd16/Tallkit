"""Cobros comerciales y su corrección administrativa.

Toda acción bloquea primero la venta (raíz de consistencia) y después el pago; nunca en orden
inverso. Se registran hechos, no se mueve dinero: cada cobro tiene un ``operation_id`` estable,
fecha efectiva del sistema y partes por medio real. Nada se almacena como saldo.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db import transaction
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
from sales.application.projection import project
from sales.application.sales import lock_sale
from sales.domain.amounts import AmountValidationError, parse_amount
from sales.domain.balances import (
    ChargeRejectedError,
    PaymentCondition,
    PaymentMethod,
    validate_charge,
)
from sales.models import (
    CommercialPayment,
    CommercialWithholding,
    PaymentCorrection,
    PaymentPart,
    Sale,
)
from shared.command_values import canonical_fingerprint
from shared.money import validate_settlement
from shared.withholding import exceeds_warning, warning_threshold
from workshop_configuration.application.operation_context import received_withholding_settings

PAYMENT_ACTION = "payment.register"
CORRECT_ACTION = "payment.correct"
PAYMENT_FIELDS = frozenset(
    {"idempotency_key", "operation_id", "parts", "review_token", "entity_type", "withholding"}
)
WITHHOLDING_FIELDS = frozenset({"amount", "acknowledged"})
ZERO = Decimal("0.00")
CORRECT_FIELDS = frozenset(
    {"idempotency_key", "operation_id", "reason", "replacement", "review_token"}
)
REASON_MAX = 500
PARTS_MAX = 2


def parse_parts(raw: Any, prefix: str = "parts") -> list[tuple[PaymentMethod, Decimal]]:
    """Una parte por medio real, positiva y con hasta dos decimales; nunca redondea."""
    if not isinstance(raw, list) or not 1 <= len(raw) <= PARTS_MAX:
        raise field_error("validation_error", prefix, "Indique una o dos partes por medio.")
    parts: list[tuple[PaymentMethod, Decimal]] = []
    seen: set[PaymentMethod] = set()
    for index, item in enumerate(raw):
        where = f"{prefix}.{index}"
        if not isinstance(item, dict) or set(item) - {"method", "amount"}:
            raise field_error("validation_error", where, "La parte debe tener medio e importe.")
        try:
            method = PaymentMethod.parse(item.get("method"))
        except ChargeRejectedError as error:
            raise field_error("validation_error", f"{where}.method", str(error)) from None
        if method in seen:
            raise field_error("validation_error", f"{where}.method", "Un medio no puede repetirse.")
        seen.add(method)
        try:
            amount = parse_amount(item.get("amount"), "amount", "El importe")
        except AmountValidationError as error:
            raise field_error(
                "validation_error", f"{where}.amount", error.errors["amount"][0]
            ) from None
        if amount <= 0:
            raise field_error(
                "validation_error", f"{where}.amount", "El importe debe ser mayor que cero."
            )
        parts.append((method, amount))
    return parts


@dataclass(frozen=True)
class WithholdingInput:
    """Retención de la acción: importe y reconocimiento de la advertencia."""

    amount: Decimal
    acknowledged: bool = False


Parts = list[tuple[PaymentMethod, Decimal]]


def parse_withholding(raw: Any) -> WithholdingInput | None:
    if raw is None:
        return None
    if not isinstance(raw, dict) or set(raw) - WITHHOLDING_FIELDS:
        raise field_error(
            "validation_error", "withholding", "La retención solo admite importe y confirmación."
        )
    try:
        amount = parse_amount(raw.get("amount"), "amount", "La retención")
    except AmountValidationError as error:
        raise field_error(
            "validation_error", "withholding.amount", error.errors["amount"][0]
        ) from None
    if amount <= 0:
        raise field_error(
            "validation_error", "withholding.amount", "La retención debe ser mayor que cero."
        )
    acknowledged = raw.get("acknowledged", False)
    if not isinstance(acknowledged, bool):
        raise field_error(
            "validation_error", "withholding.acknowledged", "La confirmación debe ser sí o no."
        )
    return WithholdingInput(amount, acknowledged)


def parse_settlement(payload: dict[str, Any]) -> tuple[Parts, WithholdingInput | None]:
    """Dinero y retención de una misma acción; debe existir al menos uno."""
    withholding = parse_withholding(payload.get("withholding"))
    if withholding is not None and payload.get("parts") in (None, []):
        return [], withholding
    return parse_parts(payload.get("parts")), withholding


def withholding_warning(
    sale: Sale, ledger: Ledger, withholding: WithholdingInput | None
) -> dict[str, str] | None:
    """Umbral configurado de la entidad cuando la retención acumulada resulta inusual."""
    if withholding is None:
        return None
    _, percentage = received_withholding_settings("COMERCIAL")
    if not exceeds_warning(ledger.exigible, ledger.withheld, withholding.amount, percentage):
        return None
    assert percentage is not None
    return {
        "percentage": f"{percentage:.2f}",
        "threshold": f"{warning_threshold(ledger.exigible, percentage):.2f}",
    }


def _check_scope(payload: dict[str, Any]) -> None:
    if payload.get("entity_type", "COMERCIAL") != "COMERCIAL":
        raise field_error(
            "validation_error",
            "entity_type",
            "Un cobro comercial no puede aplicarse a una operación artesanal.",
        )


def validate_payment(
    sale: Sale,
    ledger: Ledger,
    parts: Parts,
    withholding: WithholdingInput | None = None,
) -> Decimal:
    """Reglas de cobro contra la venta y su saldo; devuelve el dinero total de la acción."""
    if sale.state == "DRAFT":
        raise SalesApplicationError(
            "invalid_state", "Una venta en borrador no admite cobros ni anticipos."
        )
    if sale.state == "VOIDED":
        raise SalesApplicationError("invalid_state", "Una venta anulada no admite cobros.")
    total = sum((amount for _, amount in parts), ZERO)
    withheld = withholding.amount if withholding is not None else ZERO
    if withholding is not None and not received_withholding_settings("COMERCIAL")[0]:
        raise field_error(
            "validation_error", "withholding", "Esta entidad no registra retenciones recibidas."
        )
    try:
        if withholding is None:
            validate_charge(PaymentCondition(sale.condition), ledger.balance.balance, total)
        else:
            validate_settlement(
                PaymentCondition(sale.condition), ledger.balance.balance, total, withheld
            )
    except ChargeRejectedError as error:
        raise SalesApplicationError("validation_error", str(error), error.errors) from None
    warning = withholding_warning(sale, ledger, withholding)
    if warning is not None and withholding is not None and not withholding.acknowledged:
        raise field_error(
            "withholding_warning",
            "withholding",
            f"La retención supera el {warning['percentage']} % del total. Confirme que es "
            "correcta.",
        )
    return total


def _payment_digest(
    sale: Sale,
    ledger: Ledger,
    operation_id: UUID,
    parts: Parts,
    withholding: WithholdingInput | None = None,
) -> str:
    return canonical_fingerprint(
        {
            "sale_id": sale.pk,
            "version": sale.version,
            "operation_id": str(operation_id),
            "parts": sorted((m.value, str(a)) for m, a in parts),
            "exigible": str(ledger.exigible),
            "paid": str(ledger.paid),
            "refunded": str(ledger.refunded),
            "withheld": str(ledger.withheld),
            "withholding": None if withholding is None else str(withholding.amount),
        }
    )


def preview_payment(
    *, actor: User, sale_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> dict[str, Any]:
    """Revisión de solo lectura de un cobro; sin recibo ni efectos."""
    require_permission(
        actor=actor,
        permission="pagos_comerciales.registrar",
        request_id=request_id,
        denial_action="sales.payment_reviewed",
        target_type="sale",
        target_id=str(sale_id),
    )
    reject_unknown_fields(payload, PAYMENT_FIELDS - {"review_token"})
    _check_scope(payload)
    operation_id = parse_operation_id(payload)
    parts, withholding = parse_settlement(payload)
    sale = Sale.objects.filter(pk=sale_id).first()
    if sale is None:
        raise not_found()
    ledger = ledger_for(sale)
    result: dict[str, Any] = {
        "warning": withholding_warning(sale, ledger, withholding),
        "sale_id": sale.pk,
        "version": sale.version,
        "operation_id": str(operation_id),
        "can_register": False,
        "issues": [],
        "review_token": None,
        "expires_in_seconds": reviews.REVIEW_MAX_AGE_SECONDS,
        "balance_before": f"{ledger.balance.balance:.2f}",
        "balance_after": None,
    }
    try:
        total = validate_payment(sale, ledger, parts, withholding)
    except SalesApplicationError as error:
        result["issues"] = [
            {"code": error.code, "field": field, "message": messages[0]}
            for field, messages in (error.errors or {"": [error.message]}).items()
        ]
        return result
    withheld = withholding.amount if withholding is not None else ZERO
    result["can_register"] = True
    result["balance_after"] = f"{ledger.balance.balance - total - withheld:.2f}"
    result["review_token"] = reviews.issue_token(
        actor=actor,
        action=PAYMENT_ACTION,
        sale_id=sale.pk,
        version=sale.version,
        digest=_payment_digest(sale, ledger, operation_id, parts, withholding),
    )
    return result


def _insert_payment(
    sale: Sale,
    actor: User,
    operation_id: UUID,
    parts: list[tuple[PaymentMethod, Decimal]],
    total: Decimal,
) -> CommercialPayment:
    now = timezone.now()
    payment = CommercialPayment.objects.create(
        operation_id=operation_id,
        sale=sale,
        amount=total,
        effective_at=now,
        effective_date=reviews.today(),
        created_by=actor,
    )
    PaymentPart.objects.bulk_create(
        PaymentPart(payment=payment, method=method.value, amount=amount) for method, amount in parts
    )
    return payment


def _insert_withholding(
    sale: Sale,
    actor: User,
    operation_id: UUID,
    amount: Decimal,
    payment: CommercialPayment | None,
) -> CommercialWithholding:
    withholding: CommercialWithholding = CommercialWithholding.objects.create(
        operation_id=operation_id,
        sale=sale,
        customer_id=sale.customer_id,
        payment=payment,
        amount=amount,
        effective_at=timezone.now(),
        effective_date=reviews.today(),
        created_by=actor,
    )
    return withholding


def _existing_settlement(
    sale: Sale, operation_id: UUID, parts: Parts, withholding: WithholdingInput | None
) -> CommandResult | None:
    """Reintento de la misma acción: mismo contenido devuelve el hecho; otro, conflicto."""
    payment = CommercialPayment.objects.filter(operation_id=operation_id).first()
    held = CommercialWithholding.objects.filter(operation_id=operation_id).first()
    if payment is None and held is None:
        return None
    same_payment = (payment is None and not parts) or (
        payment is not None
        and payment.sale_id == sale.pk
        and sorted((p.method, p.amount) for p in payment.parts.all())
        == sorted((m.value, a) for m, a in parts)
    )
    same_withholding = (held is None and withholding is None) or (
        held is not None
        and withholding is not None
        and held.sale_id == sale.pk
        and held.amount == withholding.amount
    )
    if not (same_payment and same_withholding):
        raise SalesApplicationError(
            "idempotency_conflict",
            "Este identificador de operación ya se usó con otros datos.",
        )
    if payment is not None:
        return CommandResult(200, "payment", payment.pk)
    assert held is not None
    return CommandResult(200, "withholding", held.pk)


def _bump_version(sale: Sale) -> None:
    sale.version += 1
    sale.save(update_fields=["version", "updated_at"])


def register_payment(
    *, actor: User, sale_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Registra un cobro completo; repetir el mismo ``operation_id`` no lo duplica."""

    def work() -> CommandResult:
        reject_unknown_fields(payload, PAYMENT_FIELDS)
        _check_scope(payload)
        operation_id = parse_operation_id(payload)
        parts, withholding = parse_settlement(payload)
        sale = lock_sale(sale_id)
        existing = _existing_settlement(sale, operation_id, parts, withholding)
        if existing is not None:
            return existing
        ledger = ledger_for(sale)
        total = validate_payment(sale, ledger, parts, withholding)
        reviewed = reviews.read_token(
            payload.get("review_token"),
            actor=actor,
            action=PAYMENT_ACTION,
            sale_id=sale.pk,
            version=None,
        )
        if reviewed != _payment_digest(sale, ledger, operation_id, parts, withholding):
            raise SalesApplicationError(
                "review_required", "La venta cambió desde la revisión. Revise nuevamente."
            )
        payment = _insert_payment(sale, actor, operation_id, parts, total) if parts else None
        held = (
            None
            if withholding is None
            else _insert_withholding(sale, actor, operation_id, withholding.amount, payment)
        )
        _bump_version(sale)
        if payment is not None:
            changed = ("amount", "parts", "withholding") if held else ("amount", "parts")
            return CommandResult(201, "payment", payment.pk, changed)
        assert held is not None
        return CommandResult(201, "withholding", held.pk, ("withholding",))

    return execute_write(
        actor=actor,
        permission="pagos_comerciales.registrar",
        action="sales.payment_registered",
        target_type="sale",
        target_id=str(sale_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=project,
    )


# ---------------------------------------------------------------------------
# Corrección administrativa
# ---------------------------------------------------------------------------


def lock_payment(sale: Sale, payment_id: int) -> CommercialPayment:
    """El pago se bloquea siempre después de su venta."""
    payment = CommercialPayment.objects.select_for_update().filter(pk=payment_id, sale=sale).first()
    if payment is None:
        raise not_found("Pago")
    return payment


def _reason(payload: dict[str, Any]) -> str:
    reason = payload.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise field_error("validation_error", "reason", "El motivo es obligatorio.")
    if len(reason.strip()) > REASON_MAX:
        raise field_error(
            "validation_error", "reason", f"El motivo no puede exceder {REASON_MAX} caracteres."
        )
    return reason.strip()


def _replacement(
    payload: dict[str, Any],
) -> tuple[UUID, list[tuple[PaymentMethod, Decimal]]] | None:
    raw = payload.get("replacement")
    if raw is None:
        return None
    if not isinstance(raw, dict) or set(raw) - {"operation_id", "parts"}:
        raise field_error("validation_error", "replacement", "El reemplazo no es válido.")
    return parse_operation_id(raw), parse_parts(raw.get("parts"), "replacement.parts")


def evaluate_correction(
    sale: Sale,
    payment: CommercialPayment,
    ledger: Ledger,
    replacement: tuple[UUID, list[tuple[PaymentMethod, Decimal]]] | None,
) -> Decimal | None:
    """Valida el resultado neto de la corrección; devuelve el importe del reemplazo."""
    if sale.state != "CONFIRMED":
        raise SalesApplicationError(
            "invalid_state", "Solo una venta confirmada admite corregir sus pagos."
        )
    if PaymentCorrection.objects.filter(original_payment=payment).exists():
        raise SalesApplicationError("invalid_state", "El pago ya fue corregido.")
    paid_after = ledger.paid - payment.amount
    if paid_after - ledger.refunded < 0:
        raise SalesApplicationError(
            "dependency_conflict",
            "Un reembolso efectivo depende de este pago; no puede anularse sin dejar sin "
            "respaldo el dinero ya devuelto.",
            {"payment": ["Existen reembolsos registrados que dependen de este pago."]},
        )
    if replacement is None:
        return None
    balance_after = max(
        ledger.exigible - (paid_after - ledger.refunded) - ledger.withheld, Decimal("0.00")
    )
    total = sum((amount for _, amount in replacement[1]), Decimal("0.00"))
    try:
        validate_charge(PaymentCondition(sale.condition), balance_after, total)
    except ChargeRejectedError as error:
        raise SalesApplicationError(
            "validation_error",
            str(error),
            {"replacement.parts": next(iter(error.errors.values()))},
        ) from None
    return total


def _correction_digest(
    sale: Sale,
    payment: CommercialPayment,
    ledger: Ledger,
    operation_id: UUID,
    reason: str,
    replacement: tuple[UUID, list[tuple[PaymentMethod, Decimal]]] | None,
) -> str:
    return canonical_fingerprint(
        {
            "sale_id": sale.pk,
            "version": sale.version,
            "payment_id": payment.pk,
            "operation_id": str(operation_id),
            "reason": reason,
            "replacement": None
            if replacement is None
            else [str(replacement[0]), sorted((m.value, str(a)) for m, a in replacement[1])],
            "paid": str(ledger.paid),
            "refunded": str(ledger.refunded),
            "exigible": str(ledger.exigible),
        }
    )


def preview_correction(
    *,
    actor: User,
    sale_id: int,
    payment_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> dict[str, Any]:
    require_permission(
        actor=actor,
        permission="pagos_comerciales.anular",
        request_id=request_id,
        denial_action="sales.payment_correction_reviewed",
        target_type="payment",
        target_id=str(payment_id),
    )
    reject_unknown_fields(payload, CORRECT_FIELDS - {"review_token"})
    operation_id = parse_operation_id(payload)
    reason = _reason(payload)
    replacement = _replacement(payload)
    sale = Sale.objects.filter(pk=sale_id).first()
    payment = CommercialPayment.objects.filter(pk=payment_id, sale_id=sale_id).first()
    if sale is None or payment is None:
        raise not_found("Pago")
    ledger = ledger_for(sale)
    result: dict[str, Any] = {
        "sale_id": sale.pk,
        "payment_id": payment.pk,
        "version": sale.version,
        "can_correct": False,
        "issues": [],
        "review_token": None,
        "expires_in_seconds": reviews.REVIEW_MAX_AGE_SECONDS,
    }
    try:
        evaluate_correction(sale, payment, ledger, replacement)
    except SalesApplicationError as error:
        result["issues"] = [
            {"code": error.code, "field": field, "message": messages[0]}
            for field, messages in (error.errors or {"": [error.message]}).items()
        ]
        return result
    result["can_correct"] = True
    result["review_token"] = reviews.issue_token(
        actor=actor,
        action=CORRECT_ACTION,
        sale_id=sale.pk,
        version=sale.version,
        digest=_correction_digest(sale, payment, ledger, operation_id, reason, replacement),
    )
    return result


def correct_payment(
    *,
    actor: User,
    sale_id: int,
    payment_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    """Anula lógicamente un pago erróneo y, opcionalmente, lo sustituye, en una sola acción."""

    def work() -> CommandResult:
        reject_unknown_fields(payload, CORRECT_FIELDS)
        operation_id = parse_operation_id(payload)
        reason = _reason(payload)
        replacement = _replacement(payload)
        sale = lock_sale(sale_id)
        payment = lock_payment(sale, payment_id)
        existing = PaymentCorrection.objects.filter(operation_id=operation_id).first()
        if existing is not None:
            if existing.original_payment_id != payment.pk:
                raise SalesApplicationError(
                    "idempotency_conflict",
                    "Este identificador de operación ya se usó con otros datos.",
                )
            return CommandResult(200, "payment", payment.pk)
        ledger = ledger_for(sale)
        replacement_total = evaluate_correction(sale, payment, ledger, replacement)
        reviewed = reviews.read_token(
            payload.get("review_token"),
            actor=actor,
            action=CORRECT_ACTION,
            sale_id=sale.pk,
            version=None,
        )
        if reviewed != _correction_digest(sale, payment, ledger, operation_id, reason, replacement):
            raise SalesApplicationError(
                "review_required", "La venta cambió desde la revisión. Revise nuevamente."
            )
        with transaction.atomic():
            new_payment = None
            if replacement is not None and replacement_total is not None:
                new_payment = _insert_payment(
                    sale, actor, replacement[0], replacement[1], replacement_total
                )
            PaymentCorrection.objects.create(
                operation_id=operation_id,
                sale=sale,
                original_payment=payment,
                replacement_payment=new_payment,
                reason=reason,
                created_by=actor,
            )
        _bump_version(sale)
        return CommandResult(200, "payment", payment.pk, ("correction",))

    return execute_write(
        actor=actor,
        permission="pagos_comerciales.anular",
        action="sales.payment_corrected",
        target_type="payment",
        target_id=str(payment_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=project,
    )


def payment_history(*, actor: User, sale_id: int) -> list[dict[str, Any]]:
    from sales.application import queries

    require_permission(
        actor=actor,
        permission="pagos_comerciales.ver",
        request_id=None,
        denial_action="sales.payments_viewed",
        target_type="sale",
        target_id=str(sale_id),
    )
    sale = Sale.objects.filter(pk=sale_id).first()
    if sale is None:
        raise not_found()
    return [
        queries.payment_detail(p)
        for p in CommercialPayment.objects.filter(sale=sale)
        .select_related("sale")
        .order_by("effective_at", "id")
    ]
