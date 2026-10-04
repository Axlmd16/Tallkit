"""Entrada de stock: revisión de solo lectura y registro directo en una sola transacción.

Registrar abre una transacción exterior y toma recursos en el orden total de ADR-0005:
recibo, proveedor, productos, posiciones, contexto de configuración y, al final, número e
inserciones. No existe un borrador persistente: lo que no se confirma no deja registro. La
entrada no calcula ni conserva impuestos, fechas documentales ni totales.
"""

from datetime import date, datetime
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

import inventory.application.posting as posting
from catalog.application.inventory_references import (
    ProductReference,
    ProductReferenceError,
    get_product_references,
    lock_product_references,
)
from identity.application.authorization import require_permission
from identity.models import User
from purchasing.application import queries
from purchasing.application.commands import CommandOutcome, execute_write
from purchasing.application.errors import PurchaseApplicationError, field_error
from purchasing.domain.entry_input import (
    EntryInput,
    EntryLineInput,
    EntryValidationError,
    content_signature,
    parse_entry,
)
from purchasing.models import Purchase, PurchaseFlow, PurchaseLine, PurchaseState
from shared.command_values import canonical_fingerprint
from supplier_registry.application.purchase_references import (
    SupplierReference,
    SupplierReferenceError,
    get_supplier_reference,
    lock_supplier_reference,
)
from workshop_configuration.application.numbering import (
    NumberingError,
    NumberingScopeNotFoundError,
    allocate_number,
    get_numbering_scope_id,
)
from workshop_configuration.application.operation_context import (
    OperationContextError,
    get_operation_context,
    lock_operation_context,
)

REGISTER_ACTION = "purchasing.entry_registered"
_TZ = ZoneInfo("America/Guayaquil")


def business_today() -> date:
    return datetime.now(tz=_TZ).date()


def _parse(payload: dict[str, Any]) -> EntryInput:
    try:
        return parse_entry(payload)
    except EntryValidationError as error:
        raise PurchaseApplicationError(
            error.code,  # type: ignore[arg-type]
            "La solicitud contiene datos inválidos.",
            error.errors,
        ) from None


def _duplicates(signature: str, today: date) -> list[Purchase]:
    """Entradas vigentes del mismo día con exactamente los mismos productos y cantidades."""
    return list(
        Purchase.objects.filter(
            flow=PurchaseFlow.SIMPLE,
            state=PurchaseState.CONFIRMED,
            content_signature=signature,
            confirmed_on=today,
        ).order_by("id")
    )


def _duplicate_dict(purchase: Purchase) -> dict[str, Any]:
    return {
        "purchase_id": purchase.pk,
        "internal_number": purchase.internal_number,
        "confirmed_at": purchase.confirmed_at.isoformat() if purchase.confirmed_at else None,
    }


def _lock_supplier(supplier_id: int) -> SupplierReference:
    try:
        return lock_supplier_reference(supplier_id)
    except SupplierReferenceError as error:
        message = (
            "El proveedor no existe."
            if error.code == "not_found"
            else "El proveedor está inactivo."
        )
        raise field_error("inactive_reference", "supplier_id", message) from None


def _lock_products(lines: tuple[EntryLineInput, ...]) -> dict[int, ProductReference]:
    try:
        return lock_product_references({line.product_id for line in lines})
    except ProductReferenceError as error:
        bad = set(error.missing) | set(error.inactive)
        errors = {
            f"lines.{index}.product_id": [
                "El producto no existe."
                if line.product_id in error.missing
                else "El producto está inactivo."
            ]
            for index, line in enumerate(lines)
            if line.product_id in bad
        }
        raise PurchaseApplicationError(
            "inactive_reference", "Hay productos inexistentes o inactivos.", errors
        ) from None


# ---------------------------------------------------------------------------
# Revisión (solo lectura)
# ---------------------------------------------------------------------------


def review_entry(
    *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> dict[str, Any]:
    """Resumen de lo que entrará; no escribe, no numera y no revela costos."""
    require_permission(
        actor=actor,
        permission="ingresos.crear",
        request_id=request_id,
        denial_action="purchasing.entry_reviewed",
        target_type="purchase",
        target_id="new",
    )
    entry = _parse(payload)
    issues: list[dict[str, str]] = []

    supplier_dict: dict[str, Any] | None = None
    if entry.supplier_id is not None:
        supplier = get_supplier_reference(entry.supplier_id)
        if supplier is None:
            issues.append(_issue("inactive_reference", "supplier_id", "El proveedor no existe."))
        elif not supplier.is_active:
            issues.append(
                _issue("inactive_reference", "supplier_id", "El proveedor está inactivo.")
            )
        else:
            supplier_dict = {"id": supplier.id, "name": supplier.name}

    products = get_product_references(line.product_id for line in entry.lines)
    lines = []
    for index, line in enumerate(entry.lines):
        ref = products.get(line.product_id)
        if ref is None:
            issues.append(
                _issue("inactive_reference", f"lines.{index}.product_id", "El producto no existe.")
            )
        elif not ref.is_active:
            issues.append(
                _issue(
                    "inactive_reference", f"lines.{index}.product_id", "El producto está inactivo."
                )
            )
        lines.append(
            {
                "product_id": line.product_id,
                "code": ref.code if ref else None,
                "name": ref.name if ref else None,
                "unit_name": ref.unit_name if ref else None,
                "unit_symbol": ref.unit_symbol if ref else None,
                "quantity": f"{line.quantity:.0f}",
            }
        )

    try:
        get_operation_context()
    except OperationContextError as error:
        issues.append(_issue("configuration_missing", "configuration", error.detail or error.code))
    try:
        get_numbering_scope_id(entity_type="COMERCIAL", document_type="INGRESO")
    except NumberingScopeNotFoundError:
        issues.append(_issue("configuration_missing", "series", "Falta la serie COM-ING."))

    duplicates = _duplicates(content_signature(entry.lines), business_today())
    unacknowledged = {d.pk for d in duplicates} - set(entry.acknowledged_entry_ids)
    return {
        "can_confirm": not issues,
        "issues": issues,
        "summary": {
            "products": len(entry.lines),
            "units": sum(int(line.quantity) for line in entry.lines),
        },
        "supplier": supplier_dict,
        "reference": entry.reference,
        "observation": entry.observation,
        "lines": lines,
        "duplicates": [_duplicate_dict(d) for d in duplicates],
        "requires_acknowledgement": bool(unacknowledged),
    }


def _issue(code: str, field: str, message: str) -> dict[str, str]:
    return {"code": code, "field": field, "message": message}


# ---------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------


def register_entry(
    *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Registra y confirma la entrada; repetir la misma solicitud no duplica efectos."""
    require_permission(
        actor=actor,
        permission="ingresos.crear",
        request_id=request_id,
        denial_action=REGISTER_ACTION,
        target_type="purchase",
        target_id="new",
    )

    def work() -> tuple[int, dict[str, Any], list[str]]:
        entry = _parse(payload)
        supplier = _lock_supplier(entry.supplier_id) if entry.supplier_id is not None else None
        products = _lock_products(entry.lines)
        signature = content_signature(entry.lines)
        today = business_today()

        try:
            preliminary = get_operation_context()
            positions = posting.lock_positions(products, warehouse_id=preliminary.warehouse_id)
            locked = lock_operation_context(tax_definition_ids=(), on=today)
        except OperationContextError as error:
            raise field_error(
                "configuration_missing", "configuration", error.detail or error.code
            ) from None
        if locked.context.warehouse_id != preliminary.warehouse_id:
            raise PurchaseApplicationError(
                "review_required", "La bodega configurada cambió. Revise nuevamente."
            )
        try:
            scope_id = get_numbering_scope_id(entity_type="COMERCIAL", document_type="INGRESO")
        except NumberingScopeNotFoundError:
            raise field_error(
                "configuration_missing", "series", "Falta la serie COM-ING."
            ) from None

        pending = [
            d for d in _duplicates(signature, today) if d.pk not in entry.acknowledged_entry_ids
        ]
        if pending:
            numbers = ", ".join(d.internal_number or str(d.pk) for d in pending)
            raise PurchaseApplicationError(
                "possible_duplicate",
                "Ya hay una entrada igual registrada hoy. Reconózcala para continuar.",
                {"acknowledged_entry_ids": [f"Reconozca las entradas coincidentes: {numbers}."]},
            )

        purchase = Purchase.objects.create(
            flow=PurchaseFlow.SIMPLE,
            created_by=actor,
            supplier_id=supplier.id if supplier else None,
            external_reference=entry.reference,
            observation=entry.observation,
            content_signature=signature,
        )
        rows = PurchaseLine.objects.bulk_create(
            PurchaseLine(
                purchase=purchase,
                position=position,
                product_id=line.product_id,
                quantity=line.quantity,
                unit_cost=line.unit_cost,
                product_snapshot=_product_snapshot(products[line.product_id]),
            )
            for position, line in enumerate(entry.lines, start=1)
        )
        digest = canonical_fingerprint(
            {
                "purchase_id": purchase.pk,
                "signature": signature,
                "lines": [
                    [
                        line.product_id,
                        str(line.quantity),
                        None if line.unit_cost is None else str(line.unit_cost),
                    ]
                    for line in entry.lines
                ],
                "supplier_id": entry.supplier_id,
                "reference": entry.reference,
                "observation": entry.observation,
            }
        )
        try:
            allocation = allocate_number(
                scope_id=scope_id,
                consumer_type="purchase",
                consumer_id=str(purchase.pk),
                request_key=f"purchase:{purchase.pk}:confirm",
                request_fingerprint=digest,
            )
        except NumberingError as error:
            raise field_error("configuration_missing", "series", str(error)) from None

        operation = posting.prepare_operation(
            kind="PURCHASE_RECEIPT",
            actor=actor,
            source_type="PURCHASE",
            source_id=purchase.pk,
            entry_lines=[
                posting.EntryLine(
                    line.product_id,
                    line.quantity,
                    None if line.unit_cost is None else line.quantity * line.unit_cost,
                    (row.pk,),
                )
                for line, row in zip(entry.lines, rows, strict=True)
            ],
            fingerprint=digest,
        )
        posting.post_operation(operation, positions, products)

        if supplier is not None:
            purchase.supplier_snapshot = {
                "schema_version": 1,
                "id": supplier.id,
                "name": supplier.name,
                "identification_type": supplier.identification_type,
                "identification": supplier.identification,
            }
        purchase.fiscal_snapshot = {
            "schema_version": 1,
            "entity": {
                "id": locked.context.entity_id,
                "type": locked.context.entity_type,
                "ruc": locked.context.ruc,
                "legal_name": locked.context.legal_name,
            },
            "warehouse": {
                "id": locked.context.warehouse_id,
                "name": locked.context.warehouse_name,
            },
            "series_code": allocation.series_code,
        }
        purchase.internal_number = allocation.visible_number
        purchase.number_allocation_id = allocation.allocation_id
        purchase.inventory_operation_id = operation.pk
        purchase.confirmation_fingerprint = canonical_fingerprint(payload)
        purchase.applied_review = digest
        purchase.confirmed_at = timezone.now()
        purchase.confirmed_on = today
        purchase.confirmed_by = actor
        purchase.state = PurchaseState.CONFIRMED
        purchase.version += 1
        with transaction.atomic():
            purchase.save()
        return (
            201,
            queries.purchase_detail(purchase, include_costs=queries.can_see_costs(actor)),
            ["state", "internal_number"],
        )

    return execute_write(
        actor=actor,
        permission="ingresos.confirmar",
        action=REGISTER_ACTION,
        target_type="purchase",
        target_id="new",
        request_id=request_id,
        payload=payload,
        work=work,
    )


def _product_snapshot(ref: ProductReference) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "product_id": ref.id,
        "code": ref.code,
        "name": ref.name,
        "content_quantity": str(ref.content_quantity),
        "unit_name": ref.unit_name,
        "unit_symbol": ref.unit_symbol,
    }
