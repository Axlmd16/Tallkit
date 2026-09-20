"""Operaciones manuales de inventario: carga inicial, ajustes, vista previa y reversión.

Coordinan bajo una transacción exterior y delegan la valoración y publicación en
``posting``. Las compras no pasan por aquí: reutilizan directamente el núcleo.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.core import signing
from django.db import IntegrityError, transaction

from catalog.application.inventory_references import (
    ProductReference,
    ProductReferenceError,
    get_product_references,
    lock_product_references,
)
from identity.application.authorization import require_permission
from identity.models import User
from inventory.application import posting, queries
from inventory.application.commands import (
    CommandOutcome,
    execute_write,
    reject_unknown_fields,
    validated_version,
)
from inventory.application.errors import (
    InventoryApplicationError,
    field_error,
    not_found,
    stale_record,
)
from inventory.domain.validation import (
    InsufficientStockError,
    InventoryValidationError,
    parse_entry_value,
    parse_movement_quantity,
)
from inventory.domain.valuation import Position, apply_entry, apply_exit
from inventory.models import (
    InventoryMovement,
    InventoryOperation,
    InventoryOperationLine,
    OperationKind,
    OperationState,
)
from shared.command_values import canonical_fingerprint
from workshop_configuration.application.operation_context import (
    OperationContextError,
    get_operation_context,
)

REVIEW_SALT = "inventory.review"
REVIEW_MAX_AGE_SECONDS = 15 * 60
MANUAL_KINDS = (
    OperationKind.INITIAL_LOAD.value,
    OperationKind.ADJUSTMENT_IN.value,
    OperationKind.ADJUSTMENT_OUT.value,
)
ENTRY_KINDS = {OperationKind.INITIAL_LOAD.value, OperationKind.ADJUSTMENT_IN.value}
CREATE_FIELDS = frozenset(
    {
        "idempotency_key",
        "kind",
        "product_id",
        "quantity",
        "unit_cost",
        "reason",
        "reference",
        "notes",
        "corrects_operation_id",
    }
)
UPDATE_FIELDS = frozenset(
    {"idempotency_key", "expected_version", "quantity", "unit_cost", "reason", "reference", "notes"}
)
CONFIRM_FIELDS = frozenset({"idempotency_key", "expected_version", "review_token"})
REVERSE_FIELDS = CONFIRM_FIELDS | {"reason"}
TEXT_MAX = 2000
REFERENCE_MAX = 128
COST_MAX = Decimal("999999999999.999999")
SIX = Decimal("0.000001")


@dataclass(frozen=True)
class ManualInput:
    kind: str
    product_id: int
    quantity: Decimal
    unit_cost: Decimal | None
    reason: str
    reference: str
    notes: str
    corrects_operation_id: int | None


def _text(value: Any, field: str, limit: int, *, required: bool = False) -> str:
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise field_error("validation_error", field, "Este campo es obligatorio.")
        return ""
    if not isinstance(value, str):
        raise field_error("validation_error", field, "Debe ser texto.")
    text = value.strip()
    if len(text) > limit:
        raise field_error("validation_error", field, f"No puede exceder {limit} caracteres.")
    return text


def _wrap(error: InventoryValidationError, field: str | None = None) -> InventoryApplicationError:
    name = field or next(iter(error.errors))
    return InventoryApplicationError(
        "validation_error", str(error), {name: next(iter(error.errors.values()))}
    )


def _parse(values: dict[str, Any]) -> ManualInput:
    kind = values.get("kind")
    if kind not in MANUAL_KINDS:
        raise field_error(
            "validation_error",
            "kind",
            "Use INITIAL_LOAD, ADJUSTMENT_IN o ADJUSTMENT_OUT; las demás operaciones no se envían.",
        )
    product_id = values.get("product_id")
    if isinstance(product_id, bool) or not isinstance(product_id, int) or product_id < 1:
        raise field_error("validation_error", "product_id", "Indique el producto.")
    try:
        quantity = parse_movement_quantity(values.get("quantity"))
    except InventoryValidationError as error:
        raise _wrap(error, "quantity") from None
    cost: Decimal | None = None
    raw_cost = values.get("unit_cost")
    if raw_cost is not None:
        try:
            cost = parse_entry_value(raw_cost)
        except InventoryValidationError as error:
            raise _wrap(error, "unit_cost") from None
        if cost > COST_MAX:
            raise field_error("validation_error", "unit_cost", "El costo excede el máximo.")
    corrects = values.get("corrects_operation_id")
    if corrects is not None and (
        isinstance(corrects, bool) or not isinstance(corrects, int) or corrects < 1
    ):
        raise field_error("validation_error", "corrects_operation_id", "Identificador inválido.")
    reason = _text(values.get("reason"), "reason", TEXT_MAX, required=kind != "INITIAL_LOAD")
    return ManualInput(
        kind=kind,
        product_id=product_id,
        quantity=quantity,
        unit_cost=cost,
        reason=reason or "Carga inicial",
        reference=_text(values.get("reference"), "reference", REFERENCE_MAX),
        notes=_text(values.get("notes"), "notes", TEXT_MAX),
        corrects_operation_id=corrects,
    )


def _current_position(product_id: int, warehouse_id: int) -> Position:
    row = queries.get_position(product_id, warehouse_id=warehouse_id)
    return (
        Position(row.quantity, row.value, row.average)
        if row
        else Position(Decimal(0), Decimal(0), Decimal(0))
    )


def _warehouse_id() -> int:
    try:
        return get_operation_context().warehouse_id
    except OperationContextError:
        raise InventoryApplicationError(
            "validation_error", "Falta la bodega configurada."
        ) from None


def _has_history(product_id: int) -> bool:
    return InventoryMovement.objects.filter(product_id=product_id).exists()


def _already_initialized() -> InventoryApplicationError:
    return field_error(
        "already_initialized",
        "product_id",
        "El producto ya tiene historia de inventario; registre un ajuste justificado.",
    )


def _resolve_cost(data: ManualInput, position: Position) -> Decimal | None:
    """Costo inventariable de una entrada; una corrección vinculada usa el promedio vigente."""
    if data.kind == "ADJUSTMENT_OUT":
        if data.unit_cost is not None:
            raise field_error(
                "validation_error", "unit_cost", "Las salidas se valoran al promedio."
            )
        return None
    if data.corrects_operation_id is not None and data.kind == "ADJUSTMENT_IN":
        if position.quantity > 0:
            if data.unit_cost is not None:
                raise field_error(
                    "validation_error",
                    "unit_cost",
                    "Una corrección se valora al promedio vigente; no admite un costo distinto.",
                )
            return position.average
        if data.unit_cost is None:
            raise field_error(
                "validation_error",
                "unit_cost",
                "Sin existencia vigente, documente el costo de la entrada.",
            )
        return data.unit_cost
    if data.unit_cost is None:
        raise field_error("validation_error", "unit_cost", "El costo unitario es obligatorio.")
    return data.unit_cost


def _validate_references(data: ManualInput) -> ProductReference:
    ref = get_product_references([data.product_id]).get(data.product_id)
    if ref is None:
        raise field_error("validation_error", "product_id", "El producto no existe.")
    if data.kind in ENTRY_KINDS and not ref.is_active:
        raise field_error(
            "inactive_reference", "product_id", "Una entrada nueva exige un producto activo."
        )
    if data.corrects_operation_id is not None:
        target = InventoryOperation.objects.filter(pk=data.corrects_operation_id).first()
        valid = (
            target is not None
            and target.state == OperationState.POSTED
            and target.kind != OperationKind.REVERSAL
            and target.movements.filter(product_id=data.product_id).exists()
        )
        if not valid:
            raise field_error(
                "validation_error",
                "corrects_operation_id",
                "La operación corregida debe estar contabilizada y afectar al producto.",
            )
    return ref


def _prepare_lines(data: ManualInput, cost: Decimal | None) -> dict[str, Any]:
    if data.kind == "ADJUSTMENT_OUT":
        return {"exit_lines": [posting.ExitLine(data.product_id, data.quantity)]}
    assert cost is not None
    return {
        "entry_lines": [
            posting.EntryLine(data.product_id, data.quantity, (data.quantity * cost).quantize(SIX))
        ]
    }


def _content_digest(data: ManualInput, cost: Decimal | None) -> str:
    return canonical_fingerprint(
        {
            "kind": data.kind,
            "product_id": data.product_id,
            "quantity": str(data.quantity),
            "unit_cost": None if cost is None else str(cost.quantize(SIX)),
            "reason": data.reason,
            "corrects": data.corrects_operation_id,
        }
    )


def operation_detail(operation: InventoryOperation) -> dict[str, Any]:
    """Proyección administrativa; las proyecciones operativas se definen en la API."""
    line = operation.lines.order_by("position").first()
    product: dict[str, Any] | None = None
    quantity = cost = value = None
    if line is not None:
        ref = get_product_references([line.product_id]).get(line.product_id)
        product = {
            "id": line.product_id,
            "code": ref.code if ref else None,
            "name": ref.name if ref else None,
            "is_active": ref.is_active if ref else None,
        }
        quantity = f"{line.quantity:.0f}"
        if line.entry_value is not None:
            value = f"{line.entry_value:.6f}"
            cost = f"{(line.entry_value / line.quantity):.6f}"
    return {
        "id": operation.pk,
        "reference": operation.public_reference,
        "kind": operation.kind,
        "state": operation.state,
        "version": operation.version,
        "product": product,
        "quantity": quantity,
        "unit_cost": cost,
        "entry_value": value,
        "reason": operation.reason,
        "notes": operation.observation,
        "external_reference": operation.external_reference,
        "corrects_operation_id": operation.corrects_operation_id,
        "reverses_id": operation.reverses_id,
        "created_at": operation.created_at.isoformat(),
        "posted_at": operation.posted_at.isoformat() if operation.posted_at else None,
    }


def create_operation(
    *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Crea una operación PREPARED sin efecto sobre existencias."""

    def work() -> tuple[int, dict[str, Any], list[str]]:
        reject_unknown_fields(payload, CREATE_FIELDS)
        data = _parse(payload)
        _validate_references(data)
        warehouse_id = _warehouse_id()
        position = _current_position(data.product_id, warehouse_id)
        if data.kind == "INITIAL_LOAD" and _has_history(data.product_id):
            raise _already_initialized()
        cost = _resolve_cost(data, position)
        operation = posting.prepare_operation(
            kind=data.kind,
            actor=actor,
            source_type="",
            source_id=None,
            reason=data.reason,
            observation=data.notes,
            fingerprint=_content_digest(data, cost),
            external_reference=data.reference,
            corrects_operation_id=data.corrects_operation_id,
            **_prepare_lines(data, cost),
        )
        return 201, operation_detail(operation), ["kind", "quantity"]

    return execute_write(
        actor=actor,
        permission="inventario.ajustar",
        action="inventory.operation_prepared",
        target_type="inventory_operation",
        target_id="new",
        request_id=request_id,
        payload=payload,
        work=work,
    )


def _current_values(operation: InventoryOperation) -> dict[str, Any]:
    line = operation.lines.order_by("position").get()
    values: dict[str, Any] = {
        "kind": operation.kind,
        "product_id": line.product_id,
        "quantity": f"{line.quantity:.0f}",
        "reason": operation.reason,
        "reference": operation.external_reference,
        "notes": operation.observation,
        "corrects_operation_id": operation.corrects_operation_id,
    }
    if line.entry_value is not None:
        values["unit_cost"] = f"{(line.entry_value / line.quantity):.6f}"
    return values


def update_operation(
    *, actor: User, operation_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Edita solo una operación PREPARED, con ``expected_version``."""

    def work() -> tuple[int, dict[str, Any], list[str]]:
        reject_unknown_fields(payload, UPDATE_FIELDS)
        expected = validated_version(payload)
        try:
            operation = posting.lock_operation(operation_id)
        except InventoryOperation.DoesNotExist:
            raise not_found() from None
        if operation.state != OperationState.PREPARED:
            raise InventoryApplicationError(
                "not_editable", "Solo una operación preparada puede editarse."
            )
        if operation.version != expected:
            raise stale_record()
        merged = _current_values(operation)
        merged.update(
            {
                k: v
                for k, v in payload.items()
                if k in UPDATE_FIELDS - {"idempotency_key", "expected_version"}
            }
        )
        data = _parse(merged)
        _validate_references(data)
        position = _current_position(data.product_id, _warehouse_id())
        cost = _resolve_cost(data, position)
        operation.lines.all().delete()
        InventoryOperationLine.objects.bulk_create(_lines_for(operation, data, cost))
        operation.reason = data.reason
        operation.observation = data.notes
        operation.external_reference = data.reference
        operation.fingerprint = _content_digest(data, cost)
        operation.version += 1
        operation.save()
        return 200, operation_detail(operation), ["quantity"]

    return execute_write(
        actor=actor,
        permission="inventario.ajustar",
        action="inventory.operation_updated",
        target_type="inventory_operation",
        target_id=str(operation_id),
        request_id=request_id,
        payload=payload,
        work=work,
    )


def _lines_for(
    operation: InventoryOperation, data: ManualInput, cost: Decimal | None
) -> list[InventoryOperationLine]:
    entry_value = None if cost is None else (data.quantity * cost).quantize(SIX)
    return [
        InventoryOperationLine(
            operation=operation,
            position=1,
            product_id=data.product_id,
            quantity=data.quantity,
            entry_value=entry_value,
        )
    ]


# ---------------------------------------------------------------------------
# Revisión (token firmado)
# ---------------------------------------------------------------------------


def _issue_token(actor: User, action: str, operation_id: int, digest: str) -> str:
    return signing.dumps(
        {"a": actor.pk, "act": action, "o": operation_id, "d": digest}, salt=REVIEW_SALT
    )


def _read_token(
    token: Any,
    *,
    actor: User,
    action: str,
    operation_id: int,
    max_age: int | None = REVIEW_MAX_AGE_SECONDS,
) -> str:
    if not isinstance(token, str) or not token:
        raise field_error("validation_error", "review_token", "La revisión es obligatoria.")
    try:
        data = signing.loads(token, salt=REVIEW_SALT, max_age=max_age)
    except signing.SignatureExpired:
        raise field_error(
            "review_required", "review_token", "La revisión venció. Revise nuevamente."
        ) from None
    except signing.BadSignature:
        raise field_error("validation_error", "review_token", "La revisión no es válida.") from None
    if data.get("a") != actor.pk or data.get("act") != action or data.get("o") != operation_id:
        raise field_error("validation_error", "review_token", "La revisión no corresponde.")
    return str(data["d"])


def _confirm_digest(
    operation: InventoryOperation,
    line: InventoryOperationLine,
    position: Position,
    last_ordinal: int,
) -> str:
    return canonical_fingerprint(
        {
            "operation_id": operation.pk,
            "version": operation.version,
            "kind": operation.kind,
            "product_id": line.product_id,
            "quantity": f"{line.quantity:.0f}",
            "entry_value": None if line.entry_value is None else f"{line.entry_value:.6f}",
            "position": [f"{position.quantity:.0f}", f"{position.value:.6f}", last_ordinal],
        }
    )


def _position_state(product_id: int, warehouse_id: int) -> tuple[Position, int]:
    row = queries.get_position(product_id, warehouse_id=warehouse_id)
    if row is None:
        return Position(Decimal(0), Decimal(0), Decimal(0)), 0
    return Position(row.quantity, row.value, row.average), row.last_ordinal


def _evaluate(
    operation: InventoryOperation,
    line: InventoryOperationLine,
    position: Position,
    ref: ProductReference | None,
) -> tuple[list[dict[str, str]], dict[str, str]]:
    issues: list[dict[str, str]] = []
    effect: dict[str, str] = {}
    is_entry = operation.kind in ENTRY_KINDS
    if ref is None:
        issues.append(
            {"code": "validation_error", "field": "product_id", "message": "El producto no existe."}
        )
        return issues, effect
    if is_entry and not ref.is_active:
        issues.append(
            {
                "code": "inactive_reference",
                "field": "product_id",
                "message": "El producto está inactivo.",
            }
        )
    if operation.kind == "INITIAL_LOAD" and _has_history(line.product_id):
        issues.append(
            {
                "code": "already_initialized",
                "field": "product_id",
                "message": "El producto ya tiene historia; registre un ajuste justificado.",
            }
        )
    try:
        if is_entry:
            after = apply_entry(position, line.quantity, line.entry_value or Decimal(0))
        else:
            after = apply_exit(position, line.quantity).position
        effect = {
            "product_id": str(line.product_id),
            "current_quantity": f"{position.quantity:.0f}",
            "resulting_quantity": f"{after.quantity:.0f}",
            "resulting_average": f"{after.average:.6f}",
        }
    except InsufficientStockError:
        issues.append(
            {
                "code": "insufficient_stock",
                "field": "quantity",
                "message": "La existencia es insuficiente para la salida.",
            }
        )
    except InventoryValidationError as error:
        issues.append({"code": "validation_error", "field": "quantity", "message": str(error)})
    return issues, effect


def preview_operation(
    *, actor: User, operation_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    """Efecto previsto de confirmar; solo lectura, sin recibo ni efectos."""
    require_permission(
        actor=actor,
        permission="inventario.ajustar",
        request_id=request_id,
        denial_action="inventory.operation_reviewed",
        target_type="inventory_operation",
        target_id=str(operation_id),
    )
    operation = InventoryOperation.objects.filter(pk=operation_id).first()
    if operation is None:
        raise not_found()
    result: dict[str, Any] = {
        "operation_id": operation.pk,
        "state": operation.state,
        "version": operation.version,
        "can_confirm": False,
        "issues": [],
        "effects": [],
        "review_token": None,
        "expires_in_seconds": REVIEW_MAX_AGE_SECONDS,
    }
    if operation.state != OperationState.PREPARED:
        return result
    line = operation.lines.get()
    ref = get_product_references([line.product_id]).get(line.product_id)
    position, last_ordinal = _position_state(line.product_id, _warehouse_id())
    issues, effect = _evaluate(operation, line, position, ref)
    result["issues"] = issues
    result["effects"] = [effect] if effect else []
    if not issues:
        result["can_confirm"] = True
        result["review_token"] = _issue_token(
            actor,
            "operation.confirm",
            operation.pk,
            _confirm_digest(operation, line, position, last_ordinal),
        )
    return result


def _lock_product(line_product_id: int, *, require_active: bool) -> dict[int, ProductReference]:
    try:
        return lock_product_references([line_product_id], require_active=require_active)
    except ProductReferenceError as error:
        raise field_error(
            "inactive_reference" if error.inactive else "validation_error",
            "product_id",
            "El producto no existe o está inactivo.",
        ) from None


def confirm_operation(
    *, actor: User, operation_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Contabiliza la operación PREPARED; repetir reconoce la operación ya confirmada."""

    def work() -> tuple[int, dict[str, Any], list[str]]:
        reject_unknown_fields(payload, CONFIRM_FIELDS)
        expected = validated_version(payload)
        try:
            operation = posting.lock_operation(operation_id)
        except InventoryOperation.DoesNotExist:
            raise not_found() from None
        if operation.state != OperationState.PREPARED:
            _read_token(
                payload.get("review_token"),
                actor=actor,
                action="operation.confirm",
                operation_id=operation.pk,
                max_age=None,
            )
            return 200, operation_detail(operation), []
        if operation.version != expected:
            raise stale_record()
        reviewed = _read_token(
            payload.get("review_token"),
            actor=actor,
            action="operation.confirm",
            operation_id=operation.pk,
        )
        line = operation.lines.get()
        is_entry = operation.kind in ENTRY_KINDS
        refs = _lock_product(line.product_id, require_active=is_entry)
        warehouse_id = _warehouse_id()
        positions = posting.lock_positions(refs, warehouse_id=warehouse_id)
        locked = positions.positions[line.product_id]
        if operation.kind == "INITIAL_LOAD" and _has_history(line.product_id):
            raise _already_initialized()
        state = Position(locked.quantity, locked.value, locked.average)
        digest = _confirm_digest(operation, line, state, locked.last_ordinal)
        if digest != reviewed:
            raise InventoryApplicationError(
                "review_required", "Las existencias cambiaron desde la revisión. Revise nuevamente."
            )
        try:
            with transaction.atomic():
                posting.post_operation(operation, positions, refs)
        except InsufficientStockError:
            raise field_error(
                "insufficient_stock", "quantity", "La existencia es insuficiente para la salida."
            ) from None
        except IntegrityError as exc:
            if "inv_movement_initial_load_unique" in str(exc):
                raise _already_initialized() from None
            raise
        return 200, operation_detail(operation), ["state"]

    return execute_write(
        actor=actor,
        permission="inventario.ajustar",
        action="inventory.operation_confirmed",
        target_type="inventory_operation",
        target_id=str(operation_id),
        request_id=request_id,
        payload=payload,
        work=work,
    )


# ---------------------------------------------------------------------------
# Reversión manual
# ---------------------------------------------------------------------------

_BLOCKER_CODES = {"later_movements": "unsafe_reversal", "inconsistent": "inventory_inconsistent"}


def _check_reversible_origin(operation: InventoryOperation) -> None:
    if operation.source_type == "PURCHASE":
        raise InventoryApplicationError(
            "validation_error",
            "Esta operación proviene de un ingreso de mercadería; use la anulación del ingreso.",
            {"operation": ["Use la anulación del ingreso de mercadería."]},
        )
    if operation.kind == OperationKind.REVERSAL or operation.kind not in MANUAL_KINDS:
        raise InventoryApplicationError(
            "validation_error", "Esta operación no puede revertirse manualmente."
        )


def _blockers(operation_id: int) -> list[dict[str, Any]]:
    return [
        {
            "code": _BLOCKER_CODES[b.code],
            "field": "operation",
            "product_id": b.product_id,
            "blocking_reference": f"INV-{b.blocking_operation_id}"
            if b.blocking_operation_id
            else None,
            "message": (
                "El producto tiene movimientos posteriores."
                if b.code == "later_movements"
                else "Los saldos actuales no coinciden con el historial."
            ),
        }
        for b in queries.reversal_blockers(operation_id)
    ]


def _reverse_digest(operation: InventoryOperation) -> str:
    return canonical_fingerprint(
        {
            "operation_id": operation.pk,
            "version": operation.version,
            "effects": [
                [
                    str(e.product_id),
                    e.ordinal,
                    str(e.quantity_after),
                    str(e.value_after),
                    str(e.current_quantity),
                    str(e.current_value),
                    e.last_ordinal,
                ]
                for e in queries.operation_effects(operation.pk)
            ],
        }
    )


def reverse_preview(
    *, actor: User, operation_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    """Efecto compensatorio previsto; rechaza operaciones originadas en compras."""
    require_permission(
        actor=actor,
        permission="inventario.ajustar",
        request_id=request_id,
        denial_action="inventory.operation_reverse_reviewed",
        target_type="inventory_operation",
        target_id=str(operation_id),
    )
    operation = InventoryOperation.objects.filter(pk=operation_id).first()
    if operation is None:
        raise not_found()
    _check_reversible_origin(operation)
    result: dict[str, Any] = {
        "operation_id": operation.pk,
        "state": operation.state,
        "version": operation.version,
        "can_reverse": False,
        "issues": [],
        "review_token": None,
        "expires_in_seconds": REVIEW_MAX_AGE_SECONDS,
    }
    if operation.state != OperationState.POSTED:
        return result
    issues = _blockers(operation.pk)
    result["issues"] = issues
    if not issues:
        result["can_reverse"] = True
        result["review_token"] = _issue_token(
            actor, "operation.reverse", operation.pk, _reverse_digest(operation)
        )
    return result


def reverse_manual_operation(
    *, actor: User, operation_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Compensa exactamente una operación manual; repetirla no compensa dos veces."""

    def work() -> tuple[int, dict[str, Any], list[str]]:
        reject_unknown_fields(payload, REVERSE_FIELDS)
        expected = validated_version(payload)
        reason = _text(payload.get("reason"), "reason", TEXT_MAX, required=True)
        try:
            operation = posting.lock_operation(operation_id)
        except InventoryOperation.DoesNotExist:
            raise not_found() from None
        _check_reversible_origin(operation)
        if operation.state == OperationState.REVERSED:
            return 200, operation_detail(operation), []
        if operation.state != OperationState.POSTED:
            raise InventoryApplicationError(
                "not_editable", "Solo una operación contabilizada puede revertirse."
            )
        if operation.version != expected:
            raise stale_record()
        reviewed = _read_token(
            payload.get("review_token"),
            actor=actor,
            action="operation.reverse",
            operation_id=operation.pk,
        )
        movements = list(operation.movements.order_by("product_id"))
        refs = lock_product_references({m.product_id for m in movements}, require_active=False)
        positions = posting.lock_positions(refs, warehouse_id=movements[0].warehouse_id)
        blockers = _blockers(operation.pk)
        if blockers:
            raise InventoryApplicationError(blockers[0]["code"], blockers[0]["message"])
        if _reverse_digest(operation) != reviewed:
            raise InventoryApplicationError(
                "review_required", "Los saldos cambiaron desde la revisión."
            )
        try:
            posting.reverse_operation(
                operation,
                actor=actor,
                source_type="MANUAL_VOID",
                source_id=None,
                reason=reason,
                locked=positions,
                product_refs=refs,
            )
        except posting.ReversalBlockedError as error:
            raise InventoryApplicationError(
                "inventory_inconsistent" if error.code == "inconsistent" else "unsafe_reversal",
                str(error),
            ) from None
        return 200, operation_detail(operation), ["state"]

    return execute_write(
        actor=actor,
        permission="inventario.ajustar",
        action="inventory.operation_reversed",
        target_type="inventory_operation",
        target_id=str(operation_id),
        request_id=request_id,
        payload=payload,
        work=work,
    )


def list_operations(
    *,
    actor: User,
    kind: str | None = None,
    state: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    """Lista administrativa de operaciones manuales (carga inicial y ajustes)."""
    require_permission(
        actor=actor,
        permission="inventario.ajustar",
        request_id=None,
        denial_action="inventory.operation_listed",
        target_type="inventory_operation",
        target_id="list",
    )
    if kind is not None and kind not in MANUAL_KINDS:
        raise field_error("validation_error", "kind", "Tipo de operación desconocido.")
    if state is not None and state not in {s.value for s in OperationState}:
        raise field_error("validation_error", "state", "Estado desconocido.")
    if page < 1 or not 1 <= page_size <= 100:
        raise field_error("validation_error", "page", "Paginación inválida.")
    queryset = InventoryOperation.objects.filter(kind__in=MANUAL_KINDS)
    if kind:
        queryset = queryset.filter(kind=kind)
    if state:
        queryset = queryset.filter(state=state)
    queryset = queryset.order_by("-id")
    count = queryset.count()
    offset = (page - 1) * page_size
    return {
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": -(-count // page_size) if count else 0,
        "results": [operation_detail(o) for o in queryset[offset : offset + page_size]],
    }
