"""Anulación de ingresos y compras anteriores, con revisión firmada.

La anulación sirve a los dos flujos: compensa exactamente el efecto del ingreso con los
movimientos inversos del núcleo de inventario y conserva el documento. Toma los recursos en
el orden total de ADR-0005: recibo, identidad y compra, operación original, productos y
posiciones.
"""

from typing import Any
from uuid import UUID

from django.core import signing
from django.utils import timezone

import inventory.application.posting as posting
import inventory.application.queries as inventory_queries
from catalog.application.inventory_references import (
    ProductReference,
    get_product_references,
    lock_product_references,
)
from identity.application.authorization import require_permission
from identity.models import User
from purchasing.application import queries
from purchasing.application.commands import (
    CommandOutcome,
    execute_write,
    reject_unknown_fields,
    validated_version,
)
from purchasing.application.errors import (
    PurchaseApplicationError,
    field_error,
    not_found,
    stale_record,
)
from purchasing.models import Purchase, PurchaseDocumentIdentity
from shared.command_values import canonical_fingerprint

REVIEW_SALT = "purchasing.review"
REVIEW_MAX_AGE_SECONDS = 15 * 60


def issue_review_token(*, actor: User, action: str, purchase_id: int, digest: str) -> str:
    """Token firmado con identificadores y digest; sin costos ni datos del proveedor."""
    return signing.dumps(
        {"a": actor.pk, "act": action, "p": purchase_id, "d": digest}, salt=REVIEW_SALT
    )


def read_review_token(
    token: Any,
    *,
    actor: User,
    action: str,
    purchase_id: int,
    max_age: int | None = REVIEW_MAX_AGE_SECONDS,
) -> str:
    """Valida firma, vencimiento y ligadura a actor, acción y compra; devuelve el digest."""
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
    if (
        not isinstance(data, dict)
        or data.get("a") != actor.pk
        or data.get("act") != action
        or data.get("p") != purchase_id
    ):
        raise field_error("validation_error", "review_token", "La revisión no corresponde.")
    return str(data["d"])


def _lock_purchase(purchase_id: int) -> Purchase:
    """Identidad (si existe) primero y compra después, con lectura previa del vínculo."""
    identity_ids = list(
        Purchase.objects.filter(pk=purchase_id).values_list("document_identity_id", flat=True)
    )
    if not identity_ids:
        raise not_found()
    if identity_ids[0] is not None:
        PurchaseDocumentIdentity.objects.select_for_update().filter(pk=identity_ids[0]).first()
    purchase = (
        Purchase.objects.select_for_update(of=("self",))
        .select_related("document_identity", "confirmed_by", "created_by")
        .filter(pk=purchase_id)
        .first()
    )
    if purchase is None:
        raise not_found()
    return purchase


VOID_ACTION = "purchase.void"
VOID_FIELDS = frozenset({"idempotency_key", "expected_version", "review_token", "reason"})
REASON_MAX = 2000
_BLOCKER_CODES = {
    "later_movements": "unsafe_reversal",
    "inconsistent": "inventory_inconsistent",
    "reserved_stock": "insufficient_stock",
}


def _void_digest(purchase: Purchase) -> str:
    return canonical_fingerprint(
        {
            "purchase_id": purchase.pk,
            "operation_id": purchase.inventory_operation_id,
            "effects": [
                [
                    e.product_id,
                    e.ordinal,
                    str(e.quantity_after),
                    str(e.value_after),
                    str(e.current_quantity),
                    str(e.current_reserved),
                    str(e.current_value),
                    e.last_ordinal,
                ]
                for e in inventory_queries.operation_effects(purchase.inventory_operation_id or 0)
            ],
        }
    )


def _blocker_issues(
    purchase: Purchase, products: dict[int, ProductReference]
) -> list[dict[str, Any]]:
    issues = []
    for blocker in inventory_queries.reversal_blockers(purchase.inventory_operation_id or 0):
        ref = products.get(blocker.product_id)
        reference = (
            f"INV-{blocker.blocking_operation_id}" if blocker.blocking_operation_id else None
        )
        issues.append(
            {
                "code": _BLOCKER_CODES[blocker.code],
                "field": "lines",
                "product_id": blocker.product_id,
                "product_code": ref.code if ref else None,
                "blocking_reference": reference,
                "message": (
                    "El producto tiene movimientos posteriores; no se puede anular el ingreso."
                    if blocker.code == "later_movements"
                    else (
                        "La disponibilidad es insuficiente para anular el ingreso."
                        if blocker.code == "reserved_stock"
                        else "Los saldos actuales no coinciden con el historial del ingreso."
                    )
                ),
            }
        )
    return issues


def void_preview(
    *, actor: User, purchase_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    """Efecto compensatorio previsto; solo lectura, sin recibo ni efectos."""
    require_permission(
        actor=actor,
        permission="ingresos.anular",
        request_id=request_id,
        denial_action="purchasing.purchase_void_reviewed",
        target_type="purchase",
        target_id=str(purchase_id),
    )
    purchase = Purchase.objects.select_related("document_identity").filter(pk=purchase_id).first()
    if purchase is None:
        raise not_found()
    if purchase.state == "DRAFT":
        raise PurchaseApplicationError("not_editable", "Un borrador no se anula.")
    result: dict[str, Any] = {
        "purchase_id": purchase.pk,
        "state": purchase.state,
        "version": purchase.version,
        "can_void": False,
        "issues": [],
        "effects": [],
        "review_token": None,
        "expires_in_seconds": REVIEW_MAX_AGE_SECONDS,
    }
    if purchase.state != "CONFIRMED":
        return result
    lines = list(purchase.lines.all())
    products = get_product_references(line.product_id for line in lines)
    issues = _blocker_issues(purchase, products)
    result["issues"] = issues
    result["effects"] = [
        {
            "product_id": e.product_id,
            "code": products[e.product_id].code if e.product_id in products else None,
            "quantity_to_remove": f"{e.quantity_in:.0f}",
            "quantity_to_restore": f"{e.quantity_out:.0f}",
            "current_quantity": f"{e.current_quantity:.0f}",
        }
        for e in inventory_queries.operation_effects(purchase.inventory_operation_id or 0)
    ]
    if not issues:
        result["can_void"] = True
        result["review_token"] = issue_review_token(
            actor=actor, action=VOID_ACTION, purchase_id=purchase.pk, digest=_void_digest(purchase)
        )
    return result


def _validated_reason(payload: dict[str, Any]) -> str:
    reason = payload.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise field_error("validation_error", "reason", "El motivo es obligatorio.")
    if len(reason.strip()) > REASON_MAX:
        raise field_error(
            "validation_error", "reason", f"El motivo no puede exceder {REASON_MAX} caracteres."
        )
    return reason.strip()


def void_purchase(
    *, actor: User, purchase_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Anula el ingreso compensando exactamente su efecto; repetirlo no compensa dos veces."""

    def work() -> tuple[int, dict[str, Any], list[str]]:
        reject_unknown_fields(payload, VOID_FIELDS)
        expected = validated_version(payload)
        reason = _validated_reason(payload)
        purchase = _lock_purchase(purchase_id)
        if purchase.state == "VOIDED":
            if reason != purchase.void_reason:
                raise PurchaseApplicationError(
                    "idempotency_conflict", "El ingreso ya fue anulado con otro motivo."
                )
            return 200, queries.purchase_detail(purchase, include_costs=True), []
        if purchase.state == "DRAFT":
            raise PurchaseApplicationError("not_editable", "Un borrador no se anula.")
        if purchase.version != expected:
            raise stale_record()
        reviewed = read_review_token(
            payload.get("review_token"), actor=actor, action=VOID_ACTION, purchase_id=purchase.pk
        )
        lines = list(purchase.lines.all())
        original = posting.lock_operation(purchase.inventory_operation_id or 0)
        products = lock_product_references(
            {line.product_id for line in lines}, require_active=False
        )
        warehouse_id = int((purchase.fiscal_snapshot or {})["warehouse"]["id"])
        positions = posting.lock_positions(products, warehouse_id=warehouse_id)
        issues = _blocker_issues(purchase, products)
        if issues:
            first = issues[0]
            raise PurchaseApplicationError(
                first["code"],
                first["message"],
                {
                    "lines": [
                        f"Producto {i['product_code']}: "
                        f"movimiento posterior {i['blocking_reference']}"
                        if i["blocking_reference"]
                        else f"Producto {i['product_code']}: saldo inconsistente"
                        for i in issues
                    ]
                },
            )
        if _void_digest(purchase) != reviewed:
            raise PurchaseApplicationError(
                "review_required", "Los saldos cambiaron desde la revisión. Revise nuevamente."
            )
        try:
            reversal, _ = posting.reverse_operation(
                original,
                actor=actor,
                source_type="PURCHASE_VOID",
                source_id=purchase.pk,
                reason=reason,
                locked=positions,
                product_refs=products,
            )
        except posting.ReversalBlockedError as error:
            raise PurchaseApplicationError(
                "inventory_inconsistent" if error.code == "inconsistent" else "unsafe_reversal",
                str(error),
            ) from None
        purchase.state = "VOIDED"
        purchase.version += 1
        purchase.void_reason = reason
        purchase.voided_at = timezone.now()
        purchase.voided_by = actor
        purchase.void_operation_id = reversal.pk
        purchase.save(
            update_fields=[
                "state",
                "version",
                "void_reason",
                "voided_at",
                "voided_by",
                "void_operation",
                "updated_at",
            ]
        )
        return 200, queries.purchase_detail(purchase, include_costs=True), ["state"]

    return execute_write(
        actor=actor,
        permission="ingresos.anular",
        action="purchasing.purchase_voided",
        target_type="purchase",
        target_id=str(purchase_id),
        request_id=request_id,
        payload=payload,
        work=work,
    )
