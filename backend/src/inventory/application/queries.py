"""Consultas de solo lectura de inventario: nunca crean ni bloquean posiciones."""

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from django.core import signing
from django.db import connection, transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from catalog.application.inventory_references import (
    StockCatalogRow,
    get_stock_catalog_row,
    list_stock_catalog,
)
from inventory.application.errors import InventoryApplicationError, field_error, not_found
from inventory.domain.validation import InventoryValidationError
from inventory.domain.valuation import Position, reverse_exactly
from inventory.models import (
    InventoryMovement,
    InventoryOperation,
    InventoryPosition,
    OperationKind,
)
from shared.command_values import canonical_fingerprint


def get_position(product_id: int, *, warehouse_id: int) -> InventoryPosition | None:
    return InventoryPosition.objects.filter(
        product_id=product_id, warehouse_id=warehouse_id
    ).first()


@dataclass(frozen=True)
class OperationEffect:
    product_id: int
    movement_id: int
    ordinal: int
    quantity_in: Decimal
    quantity_out: Decimal
    quantity_after: Decimal
    value_after: Decimal
    current_quantity: Decimal
    current_reserved: Decimal
    current_value: Decimal
    last_ordinal: int
    applied_unit_cost: Decimal
    value_delta: Decimal

    @property
    def applied_value(self) -> Decimal:
        """Valor absoluto realmente aplicado por el movimiento, incluidos sus residuos."""
        return abs(self.value_delta)


@dataclass(frozen=True)
class ReversalBlocker:
    product_id: int
    code: str  # later_movements | inconsistent | reserved_stock
    blocking_operation_id: int | None


def operation_effects(operation_id: int) -> list[OperationEffect]:
    """Efecto de una operación sobre cada posición y estado actual de esta, por producto."""
    movements = (
        InventoryMovement.objects.filter(operation_id=operation_id)
        .select_related("position")
        .order_by("product_id")
    )
    return [
        OperationEffect(
            product_id=m.product_id,
            movement_id=m.pk,
            ordinal=m.ordinal,
            quantity_in=m.quantity_in,
            quantity_out=m.quantity_out,
            quantity_after=m.quantity_after,
            value_after=m.value_after,
            current_quantity=m.position.quantity,
            current_reserved=m.position.reserved,
            current_value=m.position.value,
            last_ordinal=m.position.last_ordinal,
            applied_unit_cost=m.applied_unit_cost,
            value_delta=m.value_delta,
        )
        for m in movements
    ]


def reversal_blockers(operation_id: int) -> list[ReversalBlocker]:
    """Productos que impiden revertir la operación completa (lectura sin bloqueos)."""
    blockers: list[ReversalBlocker] = []
    for movement in (
        InventoryMovement.objects.filter(operation_id=operation_id)
        .select_related("position")
        .order_by("product_id")
    ):
        position = movement.position
        if position.last_ordinal != movement.ordinal:
            later = (
                InventoryMovement.objects.filter(position=position, ordinal__gt=movement.ordinal)
                .order_by("ordinal")
                .first()
            )
            blockers.append(
                ReversalBlocker(
                    movement.product_id, "later_movements", later.operation_id if later else None
                )
            )
            continue
        try:
            reverse_exactly(
                Position(position.quantity, position.value, position.average),
                before=Position(
                    movement.quantity_before, movement.value_before, movement.average_before
                ),
                after=Position(
                    movement.quantity_after, movement.value_after, movement.average_after
                ),
            )
        except InventoryValidationError:
            blockers.append(ReversalBlocker(movement.product_id, "inconsistent", None))
            continue
        if movement.quantity_in > 0 and movement.quantity_before < position.reserved:
            blockers.append(ReversalBlocker(movement.product_id, "reserved_stock", None))
    return blockers


# ---------------------------------------------------------------------------
# Lista de existencias y ficha
# ---------------------------------------------------------------------------

MAX_PAGE_SIZE = 100
CUT_SALT = "inventory.kardex"
CUT_MAX_AGE_SECONDS = 30 * 60
_TZ = ZoneInfo("America/Guayaquil")
_STOCK_VALUES = ("all", "positive", "zero")
_ACTIVE_VALUES = (None, "true", "false", "all")


def _validate_page(page: int, page_size: int) -> None:
    if page < 1:
        raise field_error("validation_error", "page", "La página debe ser 1 o mayor.")
    if not 1 <= page_size <= MAX_PAGE_SIZE:
        raise field_error(
            "validation_error", "page_size", f"El tamaño debe estar entre 1 y {MAX_PAGE_SIZE}."
        )


def _product_dict(row: StockCatalogRow) -> dict[str, Any]:
    return {
        "id": row.id,
        "code": row.code,
        "manufacturer_code": row.manufacturer_code,
        "name": row.name,
        "category": {"id": row.category_id, "name": row.category_name},
        "unit": {"name": row.unit_name, "symbol": row.unit_symbol},
        "content_quantity": f"{row.content_quantity:.6f}",
        "is_active": row.is_active,
    }


def _stock_row(
    row: StockCatalogRow, position: InventoryPosition | None, include_valuation: bool
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "product": _product_dict(row),
        "quantity": f"{position.quantity:.0f}" if position else "0",
        "reserved": f"{position.reserved:.0f}" if position else "0",
        "available": f"{position.quantity - position.reserved:.0f}" if position else "0",
        "version": position.version if position else 0,
        "last_ordinal": position.last_ordinal if position else 0,
    }
    if include_valuation:
        result["average_cost"] = f"{position.average:.6f}" if position else "0.000000"
        result["inventory_value"] = f"{position.value:.6f}" if position else "0.000000"
    return result


def list_stock(
    *,
    include_valuation: bool,
    search: str = "",
    category_id: int | None = None,
    active: str | None = None,
    stock: str = "all",
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    """Existencias por producto; sin crear posiciones. La valoración exige permiso explícito."""
    if stock not in _STOCK_VALUES:
        raise field_error("validation_error", "stock", "Use all, positive o zero.")
    if active not in _ACTIVE_VALUES:
        raise field_error("validation_error", "is_active", "Use true, false o all.")
    _validate_page(page, page_size)
    positions = InventoryPosition.objects
    catalog_page = list_stock_catalog(
        search=search,
        category_id=category_id,
        active=active,
        history_product_ids=positions.filter(last_ordinal__gt=0).values_list(
            "product_id", flat=True
        ),
        positive_product_ids=positions.filter(quantity__gt=0).values_list("product_id", flat=True),
        stock=stock,
        page=page,
        page_size=page_size,
    )
    by_product = {
        p.product_id: p for p in positions.filter(product_id__in=[r.id for r in catalog_page.rows])
    }
    count = catalog_page.total_count
    return {
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": -(-count // page_size) if count else 0,
        "results": [
            _stock_row(row, by_product.get(row.id), include_valuation) for row in catalog_page.rows
        ],
    }


def get_stock_item(product_id: int, *, include_valuation: bool) -> dict[str, Any]:
    row = get_stock_catalog_row(product_id)
    if row is None:
        raise not_found()
    position = InventoryPosition.objects.filter(product_id=product_id).first()
    return _stock_row(row, position, include_valuation)


# ---------------------------------------------------------------------------
# Kardex con corte estable
# ---------------------------------------------------------------------------


@contextmanager
def read_snapshot() -> Iterator[None]:
    """Transacción corta de solo lectura REPEATABLE READ, configurada antes de consultar.

    Dentro de una transacción exterior ya abierta el nivel no puede cambiarse: el llamador
    que la abrió es quien elige el aislamiento.
    """
    if connection.in_atomic_block:
        yield
        return
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        yield


def _day_start(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=_TZ).astimezone(UTC)


def _quantity(value: Decimal) -> str:
    return f"{value:.0f}"


def _money(value: Decimal) -> str:
    return f"{value:.6f}"


def _validate_kardex(
    *,
    date_from: date | None,
    date_to: date | None,
    movement_type: str | None,
    source_type: str | None,
    source_id: int | None,
    page: int,
    page_size: int,
) -> None:
    _validate_page(page, page_size)
    if date_from and date_to and date_from > date_to:
        raise field_error(
            "validation_error", "date_from", "La fecha inicial no puede ser posterior a la final."
        )
    if movement_type is not None and movement_type not in {k.value for k in OperationKind}:
        raise field_error("validation_error", "movement_type", "Tipo de movimiento desconocido.")
    if (source_type is None) != (source_id is None):
        missing = "source_id" if source_id is None else "source_type"
        raise field_error(
            "validation_error", missing, "Indique tipo e identificador del origen juntos."
        )


def _totals(queryset: Any, include_valuation: bool) -> dict[str, Any]:
    aggregate = queryset.aggregate(
        count=Count("id"),
        quantity_in=Sum("quantity_in"),
        quantity_out=Sum("quantity_out"),
        value_in=Sum("value_delta", filter=Q(value_delta__gt=0)),
        value_out=Sum("value_delta", filter=Q(value_delta__lt=0)),
    )
    zero = Decimal(0)
    totals: dict[str, Any] = {
        "count": aggregate["count"],
        "quantity_in": _quantity(aggregate["quantity_in"] or zero),
        "quantity_out": _quantity(aggregate["quantity_out"] or zero),
    }
    if include_valuation:
        totals["value_in"] = _money(aggregate["value_in"] or zero)
        totals["value_out"] = _money(-(aggregate["value_out"] or zero))
    return totals


def _row(movement: InventoryMovement, include_valuation: bool) -> dict[str, Any]:
    operation = movement.operation
    snapshot = movement.product_snapshot
    row: dict[str, Any] = {
        "ordinal": movement.ordinal,
        "effective_at": movement.effective_at.isoformat(),
        "movement_type": movement.movement_type,
        "source": {
            "type": operation.source_type or operation.kind,
            "reference": operation.public_reference,
        },
        "actor_id": movement.actor_id,
        "quantity_in": _quantity(movement.quantity_in),
        "quantity_out": _quantity(movement.quantity_out),
        "quantity_before": _quantity(movement.quantity_before),
        "quantity_after": _quantity(movement.quantity_after),
        "presentation": {
            "code": snapshot.get("code"),
            "name": snapshot.get("name"),
            "content_quantity": snapshot.get("content_quantity"),
            "unit_name": snapshot.get("unit_name"),
            "unit_symbol": snapshot.get("unit_symbol"),
        },
    }
    if include_valuation:
        row.update(
            {
                "applied_unit_cost": _money(movement.applied_unit_cost),
                "value_delta": _money(movement.value_delta),
                "value_before": _money(movement.value_before),
                "value_after": _money(movement.value_after),
                "average_after": _money(movement.average_after),
                "rounding_adjustment": _money(movement.rounding_adjustment),
            }
        )
    return row


def _read_cut(token: str, *, product_id: int, filters: str) -> int:
    stale = InventoryApplicationError(
        "stale_record",
        "El corte de consulta venció o no corresponde a estos filtros. Consulte nuevamente.",
        {"cut_token": ["Solicite un corte nuevo."]},
    )
    try:
        data = signing.loads(token, salt=CUT_SALT, max_age=CUT_MAX_AGE_SECONDS)
    except signing.BadSignature:
        raise stale from None
    if data.get("p") != product_id or data.get("f") != filters:
        raise stale
    return int(data["o"])


def kardex(
    *,
    product_id: int,
    include_valuation: bool,
    date_from: date | None = None,
    date_to: date | None = None,
    movement_type: str | None = None,
    source_type: str | None = None,
    source_id: int | None = None,
    actor_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    cut_token: str | None = None,
) -> dict[str, Any]:
    """Historia de un producto con saldos reales, totales del período y corte estable."""
    _validate_kardex(
        date_from=date_from,
        date_to=date_to,
        movement_type=movement_type,
        source_type=source_type,
        source_id=source_id,
        page=page,
        page_size=page_size,
    )
    filters = canonical_fingerprint(
        {
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "movement_type": movement_type,
            "source_type": source_type,
            "source_id": source_id,
            "actor_id": actor_id,
        }
    )
    with read_snapshot():
        if get_stock_catalog_row(product_id) is None:
            raise not_found()
        position = InventoryPosition.objects.filter(product_id=product_id).first()
        current_ordinal = position.last_ordinal if position else 0
        cut_ordinal = (
            _read_cut(cut_token, product_id=product_id, filters=filters)
            if cut_token
            else current_ordinal
        )
        base = InventoryMovement.objects.filter(product_id=product_id, ordinal__lte=cut_ordinal)
        start = _day_start(date_from) if date_from else None
        end = _day_start(date_to + timedelta(days=1)) if date_to else None
        period = base
        if start:
            period = period.filter(effective_at__gte=start)
        if end:
            period = period.filter(effective_at__lt=end)
        matching = period
        if movement_type:
            matching = matching.filter(movement_type=movement_type)
        if source_type is not None:
            matching = matching.filter(
                operation__source_type=source_type, operation__source_id=source_id
            )
        if actor_id is not None:
            matching = matching.filter(actor_id=actor_id)

        opening = (
            base.filter(effective_at__lt=start).order_by("-ordinal").first() if start else None
        )
        closing_source = base.filter(effective_at__lt=end) if end else base
        closing = closing_source.order_by("-ordinal").first()
        offset = (page - 1) * page_size
        rows = list(
            matching.select_related("operation").order_by("ordinal")[offset : offset + page_size]
        )
        count = matching.count()
        period_totals = _totals(period, include_valuation)
        matching_totals = _totals(matching, include_valuation)

    result: dict[str, Any] = {
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": -(-count // page_size) if count else 0,
        "results": [_row(m, include_valuation) for m in rows],
        "cut": {
            "token": cut_token
            or signing.dumps(
                {"p": product_id, "f": filters, "o": cut_ordinal, "t": timezone.now().timestamp()},
                salt=CUT_SALT,
            ),
            "ordinal": cut_ordinal,
            "expires_in_seconds": CUT_MAX_AGE_SECONDS,
        },
        "opening_quantity": _quantity(opening.quantity_after) if opening else "0",
        "closing_quantity": _quantity(closing.quantity_after) if closing else "0",
        "period_totals": period_totals,
        "matching_totals": matching_totals,
        "page_opening_quantity": _quantity(rows[0].quantity_before) if rows else None,
    }
    if include_valuation:
        result["opening_value"] = _money(opening.value_after) if opening else _money(Decimal(0))
        result["closing_value"] = _money(closing.value_after) if closing else _money(Decimal(0))
    return result


# ---------------------------------------------------------------------------
# Proyección de operaciones (operativa y económica por lista blanca)
# ---------------------------------------------------------------------------


def get_operation(
    operation_id: int, *, include_valuation: bool, can_open_origin: bool
) -> dict[str, Any]:
    """Operación de inventario; la valoración y el origen de compra dependen del permiso.

    La proyección operativa nunca incluye costos, valores, ajustes de redondeo, proveedor ni
    el motivo de operaciones originadas en compras. ``origin_url`` exige poder abrir el origen.
    """
    operation = (
        InventoryOperation.objects.select_related("reverses")
        .prefetch_related("lines", "movements")
        .filter(pk=operation_id)
        .first()
    )
    if operation is None:
        raise not_found()
    lines = sorted(operation.lines.all(), key=lambda line: line.position)
    line = lines[0] if lines else None
    ref = get_stock_catalog_row(line.product_id) if line else None
    from_purchase = operation.source_type.startswith("PURCHASE")
    from_commercial = operation.source_type.startswith("SALE")
    origin: dict[str, Any] = {
        "type": operation.source_type or operation.kind,
        "reference": operation.public_reference,
    }
    if from_purchase and can_open_origin and operation.source_id:
        origin["origin_url"] = f"/purchases/{operation.source_id}"
    result: dict[str, Any] = {
        "id": operation.pk,
        "reference": operation.public_reference,
        "kind": operation.kind,
        "state": operation.state,
        "version": operation.version,
        "product": None
        if ref is None
        else {"id": ref.id, "code": ref.code, "name": ref.name, "is_active": ref.is_active},
        "quantity": _quantity(line.quantity) if line else None,
        "origin": origin,
        "reverses_reference": operation.reverses.public_reference if operation.reverses else None,
        "created_at": operation.created_at.isoformat(),
        "posted_at": operation.posted_at.isoformat() if operation.posted_at else None,
    }
    if not from_purchase and not from_commercial:
        result["reason"] = operation.reason
    if include_valuation:
        if line and line.entry_value is not None:
            result["entry_value"] = _money(line.entry_value)
            result["unit_cost"] = _money(line.entry_value / line.quantity)
        result["movements"] = [
            {
                "ordinal": m.ordinal,
                "product_id": m.product_id,
                "applied_unit_cost": _money(m.applied_unit_cost),
                "value_delta": _money(m.value_delta),
                "rounding_adjustment": _money(m.rounding_adjustment),
                "value_after": _money(m.value_after),
                "average_after": _money(m.average_after),
            }
            for m in sorted(operation.movements.all(), key=lambda m: m.ordinal)
        ]
    return result
