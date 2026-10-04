"""Lecturas autorizadas: listas, cuentas por cobrar, detalle con historial y comprobante.

Cada respuesta usa una transacción de solo lectura con snapshot consistente para filas, recuento
y totales, sin bloquear escrituras. Los agregados por venta se calculan con subconsultas
independientes para no multiplicar filas por joins entre líneas, pagos y partes. Ninguna
proyección incluye costos; el permiso de valoración es el único que los añade y lo hace un
módulo aparte de esta lista blanca.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db import connection, transaction
from django.db.models import (
    Case,
    DecimalField,
    ExpressionWrapper,
    F,
    OuterRef,
    Q,
    QuerySet,
    Subquery,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce, Greatest, TruncDate

from identity.application.authorization import has_permission, require_permission
from identity.models import User
from sales.application import queries, reviews
from sales.application.errors import SalesApplicationError, field_error, not_found
from sales.domain.balances import compute_balance
from sales.models import (
    CommercialPayment,
    CommercialRefund,
    Sale,
    SaleCostAllocation,
    SaleReturn,
)

ZERO = Value(Decimal("0.00"))
MONEY: Any = DecimalField(max_digits=38, decimal_places=2)
PAGE_SIZE_MAX = 100
PAYMENT_STATES = {"PENDING", "PARTIAL", "PAID"}
DOCUMENT_STATES = {"DRAFT", "CONFIRMED", "VOIDED"}
ORIGIN_TYPES = {"DIRECT", "MAINTENANCE"}


@contextmanager
def read_snapshot() -> Iterator[None]:
    """Transacción corta REPEATABLE READ; dentro de una exterior no puede cambiarse el nivel."""
    if connection.in_atomic_block:
        yield
        return
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        yield


def _total(model: Any, field: str, **filters: Any) -> Any:
    rows = (
        model.objects.filter(sale=OuterRef("pk"), **filters)
        .order_by()
        .values("sale")
        .annotate(total=Sum(field))
        .values("total")
    )
    return Coalesce(Subquery(rows, output_field=MONEY), ZERO, output_field=MONEY)


def annotated_sales() -> QuerySet[Any]:
    """Ventas con E, P, R, saldo y exceso calculados en la base, sin joins multiplicadores."""
    return (
        Sale.objects.select_related("customer")
        .annotate(
            returned=_total(SaleReturn, "grand_total"),
            paid=_total(CommercialPayment, "amount", correction__isnull=True),
            refunded=_total(CommercialRefund, "amount"),
            sale_date=Coalesce("operational_date", TruncDate("created_at")),
        )
        .annotate(
            exigible=Case(
                When(
                    state="CONFIRMED",
                    then=ExpressionWrapper(F("grand_total") - F("returned"), output_field=MONEY),
                ),
                default=ZERO,
                output_field=MONEY,
            ),
            applied=ExpressionWrapper(F("paid") - F("refunded"), output_field=MONEY),
        )
        .annotate(
            balance=Greatest(
                ExpressionWrapper(F("exigible") - F("applied"), output_field=MONEY),
                ZERO,
                output_field=MONEY,
            ),
            excess=Greatest(
                ExpressionWrapper(F("applied") - F("exigible"), output_field=MONEY),
                ZERO,
                output_field=MONEY,
            ),
        )
    )


def _row(sale: Any) -> dict[str, Any]:
    result = queries.sale_base(sale)
    balance = compute_balance(sale.exigible, sale.paid, sale.refunded)
    result.update(
        sale_date=sale.sale_date.isoformat(),
        money={
            "exigible": queries.money(sale.exigible),
            "paid_total": queries.money(sale.paid),
            "refunded_total": queries.money(sale.refunded),
            "returned_total": queries.money(sale.returned),
            "applied": queries.money(balance.applied),
            "balance": queries.money(balance.balance),
            "refund_due": queries.money(balance.excess),
            "payment_state": balance.state.value if sale.state != "DRAFT" else None,
        },
    )
    return result


def _page(page: int, page_size: int) -> tuple[int, int]:
    if page < 1:
        raise field_error("validation_error", "page", "La página debe ser al menos 1.")
    if not 1 <= page_size <= PAGE_SIZE_MAX:
        raise field_error(
            "validation_error", "page_size", f"El tamaño debe estar entre 1 y {PAGE_SIZE_MAX}."
        )
    return page, page_size


def _filters(
    queryset: QuerySet[Any],
    *,
    customer_id: int | None,
    state: str | None,
    payment_state: str | None,
    origin: str | None,
    date_from: date | None,
    date_to: date | None,
) -> QuerySet[Any]:
    if state:
        if state not in DOCUMENT_STATES:
            raise field_error("validation_error", "state", "Estado de documento no válido.")
        queryset = queryset.filter(state=state)
    if customer_id:
        queryset = queryset.filter(customer_id=customer_id)
    if origin:
        if origin not in ORIGIN_TYPES:
            raise field_error("validation_error", "origin", "Origen de venta no válido.")
        queryset = queryset.filter(origin_type=origin)
    if date_from:
        queryset = queryset.filter(sale_date__gte=date_from)
    if date_to:
        queryset = queryset.filter(sale_date__lte=date_to)
    if payment_state:
        if payment_state not in PAYMENT_STATES:
            raise field_error("validation_error", "payment_state", "Estado de pago no válido.")
        queryset = queryset.filter(state__in=["CONFIRMED", "VOIDED"])
        if payment_state == "PAID":
            queryset = queryset.filter(balance=0)
        elif payment_state == "PARTIAL":
            queryset = queryset.filter(balance__gt=0, applied__gt=0)
        else:
            queryset = queryset.filter(balance__gt=0, applied__lte=0)
    return queryset


def list_sales(
    *,
    actor: User,
    customer_id: int | None = None,
    state: str | None = None,
    payment_state: str | None = None,
    origin: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> dict[str, Any]:
    require_permission(
        actor=actor,
        permission="ventas.ver",
        request_id=request_id,
        denial_action="sales.sale_listed",
        target_type="sale",
        target_id="list",
    )
    page, page_size = _page(page, page_size)
    with read_snapshot():
        queryset = _filters(
            annotated_sales(),
            customer_id=customer_id,
            state=state,
            payment_state=payment_state,
            origin=origin,
            date_from=date_from,
            date_to=date_to,
        ).order_by("-sale_date", "-id")
        total = queryset.count()
        offset = (page - 1) * page_size
        items = [_row(sale) for sale in queryset[offset : offset + page_size]]
    return {"items": items, "total_count": total, "page": page, "page_size": page_size}


def receivables(
    *,
    actor: User,
    customer_id: int | None = None,
    payment_state: str | None = None,
    origin: str | None = None,
    min_age_days: int | None = None,
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> dict[str, Any]:
    """Cuentas por cobrar comerciales: deuda cobrable y exceso por reembolsar, por separado."""
    require_permission(
        actor=actor,
        permission="pagos_comerciales.ver",
        request_id=request_id,
        denial_action="sales.receivables_viewed",
        target_type="sale",
        target_id="receivables",
    )
    page, page_size = _page(page, page_size)
    today = reviews.today()
    with read_snapshot():
        queryset = _filters(
            annotated_sales().filter(state="CONFIRMED"),
            customer_id=customer_id,
            state=None,
            payment_state=payment_state,
            origin=origin,
            date_from=None,
            date_to=None,
        ).filter(Q(balance__gt=0) | Q(excess__gt=0))
        if min_age_days is not None:
            queryset = queryset.filter(sale_date__lte=today - timedelta(days=min_age_days))
        totals = queryset.aggregate(receivable=Sum("balance"), refund=Sum("excess"))
        count = queryset.count()
        offset = (page - 1) * page_size
        rows = []
        for sale in queryset.order_by("sale_date", "id")[offset : offset + page_size]:
            row = _row(sale)
            row["age_days"] = (today - sale.sale_date).days
            rows.append(row)
    return {
        "items": rows,
        "total_count": count,
        "page": page,
        "page_size": page_size,
        "receivable_total": queries.money(totals["receivable"] or Decimal("0.00")),
        "refund_due_total": queries.money(totals["refund"] or Decimal("0.00")),
    }


def sale_detail(*, actor: User, sale_id: int, request_id: UUID | None = None) -> dict[str, Any]:
    """Detalle con historial; pagos y devoluciones se muestran según los permisos del actor."""
    require_permission(
        actor=actor,
        permission="ventas.ver",
        request_id=request_id,
        denial_action="sales.sale_viewed",
        target_type="sale",
        target_id=str(sale_id),
    )
    with read_snapshot():
        sale = Sale.objects.select_related("customer").filter(pk=sale_id).first()
        if sale is None:
            raise not_found()
        detail = queries.sale_detail(sale)
        detail["links"] = {"document": f"/sales/{sale.pk}/document"}
        if has_permission(actor, "inventario.ver_valorizacion"):
            detail["costs"] = _costs(sale)
        if has_permission(actor, "pagos_comerciales.ver"):
            payments = list(
                CommercialPayment.objects.filter(sale=sale)
                .select_related("correction")
                .prefetch_related("parts")
                .order_by("effective_at", "id")
            )
            detail["payments"] = [
                {
                    "id": p.pk,
                    "operation_id": str(p.operation_id),
                    "amount": queries.money(p.amount),
                    "effective_date": p.effective_date.isoformat(),
                    "parts": [
                        {"method": part.method, "amount": queries.money(part.amount)}
                        for part in sorted(p.parts.all(), key=lambda part: part.method)
                    ],
                    "state": "CORRECTED" if hasattr(p, "correction") else "ACTIVE",
                    "correction": None
                    if not hasattr(p, "correction")
                    else {
                        "reason": p.correction.reason,
                        "replacement_payment_id": p.correction.replacement_payment_id,
                    },
                }
                for p in payments
            ]
            detail["refunds"] = [
                {
                    "id": r.pk,
                    "operation_id": str(r.operation_id),
                    "origin": r.origin,
                    "sale_return_id": r.sale_return_id,
                    "amount": queries.money(r.amount),
                    "effective_date": r.effective_date.isoformat(),
                }
                for r in CommercialRefund.objects.filter(sale=sale).order_by("effective_at", "id")
            ]
        detail["returns"] = [
            {
                "id": r.pk,
                "operation_id": str(r.operation_id),
                "reason": r.reason,
                "grand_total": queries.money(r.grand_total),
                "effective_date": r.effective_date.isoformat(),
            }
            for r in SaleReturn.objects.filter(sale=sale).order_by("effective_at", "id")
        ]
    return detail


def _costs(sale: Sale) -> dict[str, Any]:
    """Único lugar que añade costos; exige el permiso de valoración del llamador."""
    rows = list(
        SaleCostAllocation.objects.filter(sale_line__sale=sale)
        .select_related("sale_line")
        .order_by("sale_line__position", "id")
    )
    total = sum((r.applied_value for r in rows if r.cost_known), Decimal("0.000000"))
    return {
        "total_cost": f"{total:.6f}",
        "has_missing_cost": any(not r.cost_known for r in rows),
        "lines": [
            {
                "position": r.sale_line.position,
                "quantity": f"{r.quantity:.0f}",
                "cost_known": r.cost_known,
                "published_unit_cost": f"{r.published_unit_cost:.6f}" if r.cost_known else None,
                "applied_value": f"{r.applied_value:.6f}" if r.cost_known else None,
            }
            for r in rows
        ],
    }


def sale_document(*, actor: User, sale_id: int, request_id: UUID | None = None) -> dict[str, Any]:
    """Comprobante interno imprimible con datos históricos y sin costos."""
    require_permission(
        actor=actor,
        permission="ventas.ver",
        request_id=request_id,
        denial_action="sales.document_viewed",
        target_type="sale",
        target_id=str(sale_id),
    )
    with read_snapshot():
        sale = Sale.objects.select_related("customer").filter(pk=sale_id).first()
        if sale is None:
            raise not_found()
        if sale.state == "DRAFT":
            raise SalesApplicationError(
                "invalid_state", "Un borrador no tiene comprobante confirmado."
            )
        detail = queries.sale_detail(sale)
    snapshot = sale.fiscal_snapshot or {}
    return {
        "notice": reviews.INTERNAL_NOTICE,
        "number": sale.internal_number,
        "state": sale.state,
        "voided": sale.state == "VOIDED",
        "void_reason": sale.void_reason if sale.state == "VOIDED" else "",
        "voided_at": detail["voided_at"],
        "issuer": snapshot.get("entity"),
        "series_code": snapshot.get("series_code"),
        "customer": detail["customer"],
        "origin": detail["origin"],
        "condition": sale.condition,
        "operational_date": detail["operational_date"],
        "lines": [
            {k: v for k, v in line.items() if k not in {"id", "product_id"}}
            for line in detail["lines"]
        ],
        "base_total": detail["base_total"],
        "tax_total": detail["tax_total"],
        "grand_total": detail["grand_total"],
    }
