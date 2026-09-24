"""Cobros del RUC artesanal: registro, corrección administrativa e historial.

Cada pago pertenece a una sola operación artesanal confirmada. Orden de bloqueos: recibo →
operación → inserciones. El saldo se valida dentro de la misma transacción, por lo que dos
cobros simultáneos no producen sobrepago. ``operation_id`` identifica el hecho ante reintentos
con otra clave de transporte. No existen pagos de orden, anticipos ni saldos a favor.
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

from django.utils import timezone

from identity.application.authorization import require_permission
from identity.models import User
from shared.money import (
    AmountValidationError,
    ChargeRejectedError,
    PaymentCondition,
    PaymentMethod,
    parse_amount,
    validate_charge,
)
from workshop.application.commands import CommandOutcome, CommandResult, execute_write
from workshop.application.errors import WorkshopError, field_error
from workshop.application.service_operations import (
    TARGET_TYPE,
    balance_of,
    lock_operation,
    operation_detail,
    payment_history,
)
from workshop.application.support import business_today
from workshop.models import (
    ArtisanPayment,
    ArtisanPaymentCorrection,
    ArtisanPaymentPart,
    ServiceOperation,
)

PAYMENT_FIELDS = frozenset({"operation_id", "parts", "idempotency_key"})
CORRECT_FIELDS = frozenset({"operation_id", "reason", "replacement", "idempotency_key"})
PARTS_MAX = 2
REASON_MAX = 500

Parts = list[tuple[PaymentMethod, Decimal]]


def _reject_unknown(payload: dict[str, Any], allowed: frozenset[str]) -> None:
    unknown = sorted(set(payload) - allowed)
    if unknown:
        raise WorkshopError(
            "unknown_field",
            "La solicitud contiene campos no admitidos.",
            {name: ["Campo no admitido."] for name in unknown},
        )


def _fact_id(raw: Any, field: str = "operation_id") -> UUID:
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        raise field_error(
            "validation_error", field, "Indique un identificador de operación válido."
        ) from None


def parse_parts(raw: Any, prefix: str = "parts") -> Parts:
    """Una parte por medio real, positiva y con hasta dos decimales; nunca redondea."""
    if not isinstance(raw, list) or not 1 <= len(raw) <= PARTS_MAX:
        raise field_error("validation_error", prefix, "Indique una o dos partes por medio.")
    parts: Parts = []
    seen: set[PaymentMethod] = set()
    for index, item in enumerate(raw):
        where = f"{prefix}.{index}"
        if not isinstance(item, dict) or set(item) - {"method", "amount"}:
            raise field_error("validation_error", where, "La parte debe tener medio e importe.")
        try:
            method = PaymentMethod.parse(item.get("method"))
            amount = parse_amount(item.get("amount"), "amount", "El importe")
        except ChargeRejectedError as error:
            raise field_error("validation_error", f"{where}.method", str(error)) from None
        except AmountValidationError as error:
            raise field_error(
                "validation_error", f"{where}.amount", error.errors["amount"][0]
            ) from None
        if method in seen:
            raise field_error("validation_error", f"{where}.method", "Un medio no puede repetirse.")
        if amount <= 0:
            raise field_error(
                "validation_error", f"{where}.amount", "El importe debe ser mayor que cero."
            )
        seen.add(method)
        parts.append((method, amount))
    return parts


def _total(parts: Parts) -> Decimal:
    return sum((amount for _, amount in parts), Decimal("0.00"))


def _validate(operation: ServiceOperation, balance: Decimal, amount: Decimal, field: str) -> None:
    try:
        validate_charge(PaymentCondition(operation.condition), balance, amount)
    except ChargeRejectedError as error:
        message = str(error).replace("la venta", "la operación")
        raise WorkshopError("validation_error", message, {field: [message]}) from None


def _insert(operation: ServiceOperation, actor: User, fact: UUID, parts: Parts) -> ArtisanPayment:
    payment = ArtisanPayment.objects.create(
        operation_id=fact,
        service_operation=operation,
        amount=_total(parts),
        effective_at=timezone.now(),
        effective_date=business_today(),
        created_by=actor,
    )
    ArtisanPaymentPart.objects.bulk_create(
        ArtisanPaymentPart(payment=payment, method=method.value, amount=amount)
        for method, amount in parts
    )
    return payment


def _bump(operation: ServiceOperation) -> None:
    operation.version += 1
    operation.save(update_fields=["version"])


def _payable(operation: ServiceOperation) -> None:
    if operation.state != "CONFIRMED":
        raise WorkshopError("invalid_state", "Una operación anulada no admite cobros.")


def register_payment(
    *, actor: User, operation_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    def work() -> CommandResult:
        _reject_unknown(payload, PAYMENT_FIELDS)
        fact = _fact_id(payload.get("operation_id"))
        parts = parse_parts(payload.get("parts"))
        operation = lock_operation(operation_id)
        existing = ArtisanPayment.objects.filter(operation_id=fact).first()
        if existing is not None:
            same = existing.service_operation_id == operation.pk and sorted(
                (p.method, p.amount) for p in existing.parts.all()
            ) == sorted((m.value, a) for m, a in parts)
            if not same:
                raise WorkshopError(
                    "idempotency_conflict",
                    "Este identificador de operación ya se usó con otros datos.",
                )
            return CommandResult(200, operation.pk)
        _payable(operation)
        _validate(operation, balance_of(operation).balance, _total(parts), "parts")
        _insert(operation, actor, fact, parts)
        _bump(operation)
        return CommandResult(201, operation.pk, ("payments",))

    return execute_write(
        actor=actor,
        permissions=("pagos_artesanales.registrar",),
        action="maintenance.artisan_payment_register",
        target_id=str(operation_id),
        payload=payload,
        work=work,
        project=lambda pk: operation_detail(pk, actor),
        request_id=request_id,
        target_type=TARGET_TYPE,
    )


def _reason(payload: dict[str, Any]) -> str:
    reason = payload.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise field_error("validation_error", "reason", "El motivo es obligatorio.")
    if len(reason.strip()) > REASON_MAX:
        raise field_error(
            "validation_error", "reason", f"El motivo no puede exceder {REASON_MAX} caracteres."
        )
    return reason.strip()


def _replacement(payload: dict[str, Any]) -> tuple[UUID, Parts] | None:
    raw = payload.get("replacement")
    if raw is None:
        return None
    if not isinstance(raw, dict) or set(raw) - {"operation_id", "parts"}:
        raise field_error("validation_error", "replacement", "El reemplazo no es válido.")
    return (
        _fact_id(raw.get("operation_id"), "replacement.operation_id"),
        parse_parts(raw.get("parts"), "replacement.parts"),
    )


def correct_payment(
    *,
    actor: User,
    operation_id: int,
    payment_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    """Anula lógicamente un pago registrado por error y, opcionalmente, lo sustituye."""

    def work() -> CommandResult:
        _reject_unknown(payload, CORRECT_FIELDS)
        fact = _fact_id(payload.get("operation_id"))
        reason = _reason(payload)
        replacement = _replacement(payload)
        operation = lock_operation(operation_id)
        payment = (
            ArtisanPayment.objects.select_for_update()
            .filter(pk=payment_id, service_operation=operation)
            .first()
        )
        if payment is None:
            raise WorkshopError("not_found", "Pago no encontrado.")
        existing = ArtisanPaymentCorrection.objects.filter(operation_id=fact).first()
        if existing is not None:
            if existing.original_payment_id != payment.pk:
                raise WorkshopError(
                    "idempotency_conflict",
                    "Este identificador de operación ya se usó con otros datos.",
                )
            return CommandResult(200, operation.pk)
        if ArtisanPaymentCorrection.objects.filter(original_payment=payment).exists():
            raise WorkshopError("invalid_state", "El pago ya fue corregido.")
        _payable(operation)
        new_payment = None
        if replacement is not None:
            balance_after = balance_of(operation).balance + payment.amount
            _validate(operation, balance_after, _total(replacement[1]), "replacement.parts")
            new_payment = _insert(operation, actor, replacement[0], replacement[1])
        ArtisanPaymentCorrection.objects.create(
            operation_id=fact,
            service_operation=operation,
            original_payment=payment,
            replacement_payment=new_payment,
            reason=reason,
            created_by=actor,
        )
        _bump(operation)
        return CommandResult(200, operation.pk, ("payment_correction",))

    return execute_write(
        actor=actor,
        permissions=("pagos_artesanales.anular",),
        action="maintenance.artisan_payment_correct",
        target_id=str(payment_id),
        payload=payload,
        work=work,
        project=lambda pk: operation_detail(pk, actor),
        request_id=request_id,
        target_type=TARGET_TYPE,
    )


def list_payments(*, actor: User, operation_id: int) -> list[dict[str, Any]]:
    require_permission(
        actor=actor,
        permission="pagos_artesanales.ver",
        denial_action="maintenance.artisan_payments_view",
        target_type=TARGET_TYPE,
        target_id=str(operation_id),
    )
    operation = ServiceOperation.objects.filter(pk=operation_id).first()
    if operation is None:
        raise WorkshopError("not_found", "Operación artesanal no encontrada.")
    return payment_history(operation)
