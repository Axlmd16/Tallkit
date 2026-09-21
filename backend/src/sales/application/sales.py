"""Servicios de venta: borradores con referencias validadas y precios del catálogo.

Un borrador no reserva ni descuenta inventario, no crea deuda ni consume numeración o usos
fiscales. Las escrituras siguen el orden total del diseño: recibo, venta, cliente y productos.
"""

from collections import defaultdict
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.utils import timezone

import inventory.application.posting as posting
from catalog.application.sales_references import (
    SaleProductReference,
    SaleProductReferenceError,
    lock_product_references,
)
from customer_registry.application.sales_references import (
    CustomerReferenceError,
    lock_customer_reference,
)
from identity.models import User
from inventory.domain.validation import InsufficientStockError, InventoryValidationError
from sales.application import reviews
from sales.application.calculation import LineSource, compute_lines, document_totals
from sales.application.commands import (
    CommandOutcome,
    CommandResult,
    execute_write,
    reject_unknown_fields,
    validated_version,
)
from sales.application.errors import (
    SalesApplicationError,
    field_error,
    not_found,
    stale_record,
)
from sales.application.projection import project
from sales.domain.allocation import AllocationLine, allocate_output_value
from sales.domain.draft_input import (
    DRAFT_FIELDS,
    DraftInput,
    DraftValidationError,
    LineInput,
    parse_draft,
)
from sales.models import Sale, SaleCostAllocation, SaleLine
from shared.command_values import canonical_fingerprint
from workshop_configuration.application.configuration_resolver import resolve_configuration
from workshop_configuration.application.numbering import (
    NumberingError,
    NumberingScopeNotFoundError,
    allocate_number,
    get_numbering_scope_id,
)
from workshop_configuration.application.operation_context import (
    LockedOperationContext,
    OperationContextError,
    get_operation_context,
    lock_operation_context,
)


def parse(payload: dict[str, Any]) -> DraftInput:
    try:
        return parse_draft(payload)
    except DraftValidationError as error:
        raise SalesApplicationError(
            error.code,  # type: ignore[arg-type]
            "La solicitud contiene datos inválidos.",
            error.errors,
        ) from None


def lock_customer(customer_id: int, *, require_active: bool = True) -> None:
    try:
        lock_customer_reference(customer_id, require_active=require_active)
    except CustomerReferenceError as error:
        message = "El cliente no existe." if error.missing else "El cliente está inactivo."
        raise field_error("inactive_reference", "customer_id", message) from None


def lock_products(lines: tuple[LineInput, ...]) -> None:
    try:
        lock_product_references({line.product_id for line in lines})
    except SaleProductReferenceError as error:
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
        raise SalesApplicationError(
            "inactive_reference", "Hay productos inexistentes o inactivos.", errors
        ) from None


def _write_lines(sale: Sale, lines: tuple[LineInput, ...]) -> None:
    SaleLine.objects.bulk_create(
        SaleLine(sale=sale, position=index, product_id=line.product_id, quantity=line.quantity)
        for index, line in enumerate(lines, start=1)
    )


def _context() -> Any:
    try:
        return get_operation_context()
    except OperationContextError as error:
        raise SalesApplicationError("configuration_missing", error.detail or error.code) from None


def create_draft(
    *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Crea un borrador sin efectos de stock, deuda, uso fiscal ni numeración."""

    def work() -> CommandResult:
        inp = parse(payload)
        context = _context()
        lock_customer(inp.customer_id)
        lock_products(inp.lines)
        sale = Sale.objects.create(
            customer_id=inp.customer_id,
            fiscal_entity_id=context.entity_id,
            warehouse_id=context.warehouse_id,
            condition=inp.condition.value,
            notes=inp.notes,
            created_by=actor,
        )
        _write_lines(sale, inp.lines)
        return CommandResult(201, "sale", sale.pk, ("customer", "condition", "lines"))

    return execute_write(
        actor=actor,
        permission="ventas.crear",
        action="sales.sale_created",
        target_type="sale",
        target_id="new",
        request_id=request_id,
        payload=payload,
        work=work,
        project=project,
    )


def lock_sale(sale_id: int) -> Sale:
    """La venta es la raíz de consistencia: toda acción que la cambie la bloquea primero."""
    sale = Sale.objects.select_for_update().filter(pk=sale_id).first()
    if sale is None:
        raise not_found()
    return sale


def _merge(sale: Sale, payload: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {
        "customer_id": sale.customer_id,
        "condition": sale.condition,
        "notes": sale.notes,
        "lines": [
            {"product_id": line.product_id, "quantity": f"{line.quantity:.0f}"}
            for line in sale.lines.order_by("position")
        ],
    }
    merged.update({k: v for k, v in payload.items() if k in DRAFT_FIELDS})
    return merged


def update_draft(
    *, actor: User, sale_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Edita un borrador con ``expected_version``; sustituye la colección de líneas completa."""

    def work() -> CommandResult:
        reject_unknown_fields(payload, DRAFT_FIELDS | {"idempotency_key", "expected_version"})
        expected = validated_version(payload)
        sale = lock_sale(sale_id)
        if sale.state != "DRAFT":
            raise SalesApplicationError(
                "not_editable", "Una venta confirmada o anulada no puede editarse."
            )
        if sale.version != expected:
            raise stale_record()
        inp = parse(_merge(sale, payload))
        lock_customer(inp.customer_id)
        lock_products(inp.lines)
        sale.customer_id = inp.customer_id
        sale.condition = inp.condition.value
        sale.notes = inp.notes
        sale.version += 1
        sale.save()
        sale.lines.all().delete()
        _write_lines(sale, inp.lines)
        return CommandResult(200, "sale", sale.pk, ("customer", "condition", "lines"))

    return execute_write(
        actor=actor,
        permission="ventas.crear",
        action="sales.sale_updated",
        target_type="sale",
        target_id=str(sale_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=project,
    )


def get_sale(*, actor: User, sale_id: int, request_id: UUID | None = None) -> dict[str, Any]:
    from sales.application import reads

    return reads.sale_detail(actor=actor, sale_id=sale_id, request_id=request_id)


def list_sales(
    *,
    actor: User,
    state: str | None = None,
    customer_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> dict[str, Any]:
    from sales.application import reads

    return reads.list_sales(
        actor=actor,
        state=state,
        customer_id=customer_id,
        page=page,
        page_size=page_size,
        request_id=request_id,
    )


# ---------------------------------------------------------------------------
# Confirmación
# ---------------------------------------------------------------------------

CONFIRM_FIELDS = frozenset({"idempotency_key", "expected_version", "review_token"})
_CONFIG_CODES = {
    "missing_entity": "configuration_missing",
    "missing_warehouse": "configuration_missing",
    "missing_tax": "configuration_missing",
    "missing_rate": "configuration_missing",
    "ambiguous_rate": "configuration_ambiguous",
    "invalid_tax_scope": "validation_error",
}


def _raise_issues(issues: list[reviews.Issue]) -> None:
    """Falla con el primer código y todos los campos que lo comparten."""
    if not issues:
        return
    code = issues[0].code
    errors: dict[str, list[str]] = {}
    for issue in issues:
        if issue.code == code:
            errors.setdefault(issue.field, []).append(issue.message)
    raise SalesApplicationError(code, issues[0].message, errors)  # type: ignore[arg-type]


def _config_error(
    error: OperationContextError,
    lines: list[SaleLine],
    products: dict[int, SaleProductReference],
) -> SalesApplicationError:
    field = "configuration"
    if error.definition_id is not None:
        for index, line in enumerate(lines):
            product = products.get(line.product_id)
            if product and product.tax_definition_id == error.definition_id:
                field = f"lines.{index}.product_id"
                break
    return SalesApplicationError(
        _CONFIG_CODES[error.code],  # type: ignore[arg-type]
        error.detail or error.code,
        {field: [error.detail or error.code]},
    )


def record_allocations(sale_lines: list[SaleLine], operation: posting.PostingResult) -> None:
    """Reparte el valor realmente aplicado de cada movimiento entre las líneas del producto."""
    by_product: dict[int, list[SaleLine]] = defaultdict(list)
    for line in sale_lines:
        by_product[line.product_id].append(line)
    rows: list[SaleCostAllocation] = []
    for movement in operation.movements:
        product_lines = by_product[movement.product_id]
        values = allocate_output_value(
            [AllocationLine(line.position, line.quantity) for line in product_lines],
            -movement.value_delta,
        )
        for line in product_lines:
            rows.append(
                SaleCostAllocation(
                    sale_line=line,
                    movement=movement,
                    quantity=line.quantity,
                    published_unit_cost=movement.applied_unit_cost,
                    applied_value=values[line.position],
                )
            )
    SaleCostAllocation.objects.bulk_create(rows)


def _product_snapshot(ref: SaleProductReference) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "product_id": ref.id,
        "code": ref.code,
        "name": ref.name,
        "content_quantity": str(ref.content_quantity),
        "unit_name": ref.unit_name,
        "unit_symbol": ref.unit_symbol,
        "is_kit": ref.is_kit,
    }


def confirm_sale(
    *, actor: User, sale_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Confirma la venta en una sola transacción; repetir no duplica efectos.

    Orden de recursos: recibo, venta, cliente, productos, posiciones, configuración y
    numeración; después solo inserciones. No crea pagos ni documentos fiscales.
    """

    def work() -> CommandResult:
        reject_unknown_fields(payload, CONFIRM_FIELDS)
        expected = validated_version(payload)
        token = payload.get("review_token")
        sale = lock_sale(sale_id)
        if sale.state != "DRAFT":
            digest = reviews.read_token(
                token,
                actor=actor,
                action=reviews.CONFIRM_ACTION,
                sale_id=sale.pk,
                version=None,
                max_age=None,
            )
            if digest != sale.applied_review:
                raise SalesApplicationError(
                    "idempotency_conflict", "La venta ya fue confirmada con contenido distinto."
                )
            return CommandResult(200, "sale", sale.pk)
        if sale.version != expected:
            raise stale_record()
        reviewed = reviews.read_token(
            token,
            actor=actor,
            action=reviews.CONFIRM_ACTION,
            sale_id=sale.pk,
            version=sale.version,
        )
        lines = list(sale.lines.order_by("position"))
        try:
            customer = lock_customer_reference(sale.customer_id)
        except CustomerReferenceError as error:
            message = "El cliente no existe." if error.missing else "El cliente está inactivo."
            raise field_error("inactive_reference", "customer_id", message) from None
        try:
            products = lock_product_references({line.product_id for line in lines})
        except SaleProductReferenceError as error:
            bad = set(error.missing) | set(error.inactive)
            raise SalesApplicationError(
                "inactive_reference",
                "Hay productos inexistentes o inactivos.",
                {
                    f"lines.{index}.product_id": ["El producto no existe o está inactivo."]
                    for index, line in enumerate(lines)
                    if line.product_id in bad
                },
            ) from None
        preliminary = _context()
        positions = posting.lock_positions(products, warehouse_id=preliminary.warehouse_id)
        on = reviews.today()  # capturada tras los bloqueos de datos maestros y posiciones
        try:
            locked: LockedOperationContext = lock_operation_context(
                tax_definition_ids={p.tax_definition_id for p in products.values()}, on=on
            )
        except OperationContextError as error:
            raise _config_error(error, lines, products) from None
        if reviews.today() != on or locked.context.warehouse_id != preliminary.warehouse_id:
            raise SalesApplicationError(
                "review_required", "La fecha o la configuración cambió. Revise nuevamente."
            )
        try:
            scope_id = get_numbering_scope_id(entity_type="COMERCIAL", document_type="VENTA")
        except NumberingScopeNotFoundError:
            raise field_error(
                "configuration_missing", "series", "Falta la serie COM-VEN."
            ) from None

        rates = {pk: snap.rate for pk, snap in locked.taxes.items()}
        computations = compute_lines(
            [LineSource(line.position, line.product_id, line.quantity) for line in lines],
            products,
            rates,
        )
        snapshot = reviews.ReviewSnapshot(
            sale=sale,
            lines=lines,
            customer=customer,
            products=products,
            rates=dict(rates),
            computations=computations,
            context=locked.context,
            operational_date=on,
            availability={pid: pos.quantity for pid, pos in positions.positions.items()},
        )
        _raise_issues(reviews.collect_issues(snapshot))
        digest = reviews.confirmation_digest(snapshot)
        if digest != reviewed:
            raise SalesApplicationError(
                "review_required", "Los importes o datos relevantes cambiaron desde la revisión."
            )
        totals = document_totals(computations)
        assert totals is not None

        consumer_id = str(sale.pk)
        resolve_configuration(
            entity_type="COMERCIAL",
            tax_codes=[snap.code for snap in locked.taxes.values()],
            operation_date=on,
            consumer_type="sale",
            consumer_id=consumer_id,
        )
        try:
            allocation = allocate_number(
                scope_id=scope_id,
                consumer_type="sale",
                consumer_id=consumer_id,
                request_key=f"sale:{sale.pk}:confirm",
                request_fingerprint=digest,
            )
        except NumberingError as error:
            raise field_error("configuration_missing", "series", str(error)) from None

        needed: dict[int, Decimal] = defaultdict(Decimal)
        for line in lines:
            needed[line.product_id] += line.quantity
        operation = posting.prepare_operation(
            kind="SALE_OUT",
            actor=actor,
            source_type="SALE",
            source_id=sale.pk,
            exit_lines=[posting.ExitLine(pid, qty) for pid, qty in sorted(needed.items())],
            fingerprint=digest,
        )
        try:
            result = posting.post_operation(operation, positions, products)
        except (InsufficientStockError, InventoryValidationError):
            raise SalesApplicationError(
                "insufficient_stock", "La existencia es insuficiente para confirmar la venta."
            ) from None

        for line, comp in zip(lines, computations, strict=True):
            assert comp.amounts is not None
            snap = locked.taxes[comp.tax_definition_id or 0]
            SaleLine.objects.filter(pk=line.pk).update(
                product_snapshot=_product_snapshot(products[line.product_id]),
                tax_definition_id=snap.definition_id,
                tax_snapshot={
                    "schema_version": 1,
                    "definition_id": snap.definition_id,
                    "code": snap.code,
                    "name": snap.name,
                    "rate": format(snap.rate, "f"),
                    "period_id": snap.period_id,
                    "starts_on": snap.starts_on.isoformat(),
                    "ends_on": snap.ends_on.isoformat() if snap.ends_on else None,
                },
                unit_price=comp.unit_price,
                tax_rate=comp.tax_rate,
                base_amount=comp.amounts.base,
                tax_amount=comp.amounts.tax,
                total_amount=comp.amounts.total,
            )
        fresh_lines = list(sale.lines.order_by("position"))
        record_allocations(fresh_lines, result)

        sale.customer_snapshot = {
            "schema_version": 1,
            "id": customer.id,
            "name": customer.name,
            "identification_type": customer.identification_type,
            "identification": customer.identification,
            "phone": customer.phone,
            "email": customer.email,
            "address": customer.address,
        }
        sale.fiscal_snapshot = {
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
        sale.operational_date = on
        sale.base_total = totals.base
        sale.tax_total = totals.tax
        sale.grand_total = totals.total
        sale.internal_number = allocation.visible_number
        sale.number_allocation_id = allocation.allocation_id
        sale.inventory_operation_id = operation.pk
        sale.confirmation_fingerprint = canonical_fingerprint(payload)
        sale.applied_review = digest
        sale.confirmed_at = timezone.now()
        sale.confirmed_by = actor
        sale.state = "CONFIRMED"
        sale.version += 1
        sale.save()
        return CommandResult(200, "sale", sale.pk, ("state", "internal_number"))

    return execute_write(
        actor=actor,
        permission="ventas.confirmar",
        action="sales.sale_confirmed",
        target_type="sale",
        target_id=str(sale_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=project,
    )
