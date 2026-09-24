"""Coordinación de repuestos entre la orden y la venta comercial vinculada.

Orden de bloqueos: recibo → orden → venta → producto → posición. La venta y la
reserva pertenecen a sus módulos; taller solo coordina sus interfaces públicas.
"""

from typing import Any
from uuid import UUID

from identity.application.authorization import (
    BusinessPermissionDeniedError,
    require_permission,
)
from identity.models import User
from sales.application.workshop_links import (
    LinkedSaleError,
    add_linked_line,
    change_linked_line,
    linked_product_options,
    linked_sales_summary,
    lock_open_linked_sale,
    remove_linked_line,
)
from workshop.application import projection
from workshop.application.commands import CommandOutcome, CommandResult, execute_write
from workshop.application.errors import WorkshopError, not_found
from workshop.application.orders import parsed
from workshop.application.support import ensure_version, lock_order
from workshop.domain.input import InputError, parse_version_only
from workshop.domain.states import OrderState
from workshop.models import MaintenanceOrder

PART_PERMISSIONS = (
    "mantenimientos.gestionar_repuestos",
    "ventas.preparar_vinculada",
)


def _authenticated(actor: Any) -> User:
    if not getattr(actor, "is_authenticated", False) or not isinstance(actor, User):
        raise BusinessPermissionDeniedError("Debe iniciar sesión para realizar esta acción.")
    return actor


def _product_id(payload: dict[str, Any]) -> int:
    value = payload.get("product_id")
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise WorkshopError(
            "validation_error",
            "Seleccione un producto del catálogo.",
            {"product_id": ["Seleccione un producto del catálogo."]},
        )
    return value


def _translate(call: Any) -> Any:
    try:
        return call()
    except LinkedSaleError as error:
        raise WorkshopError(error.code, error.message, error.errors) from None


def _parts_state(order: MaintenanceOrder) -> None:
    if order.state == OrderState.REGISTERED.value:
        return
    if order.state == OrderState.FINALIZED.value:
        message = "La orden está finalizada; no se pueden gestionar repuestos."
    else:
        message = (
            "El trabajo correctivo no genera cobro. La reposición por corrección es una "
            "operación futura del Administrador, no una venta."
        )
    raise WorkshopError("parts_not_allowed", message)


def _version(payload: dict[str, Any], *, allowed: frozenset[str]) -> int:
    unknown = sorted(set(payload) - allowed - {"expected_version", "idempotency_key"})
    if unknown:
        raise WorkshopError(
            "unknown_field",
            "La solicitud contiene campos no admitidos.",
            {name: ["Campo no admitido."] for name in unknown},
        )
    try:
        return parse_version_only(
            {
                "expected_version": payload.get("expected_version"),
                "idempotency_key": payload.get("idempotency_key"),
            }
        )
    except InputError as error:
        raise WorkshopError(
            error.code,
            "La solicitud contiene datos inválidos.",
            error.errors,
        ) from None


def _touch(order: MaintenanceOrder, actor: User) -> None:
    order.version += 1
    order.updated_by = actor
    order.save(update_fields=["version", "updated_by", "updated_at"])


def add_part(
    *,
    actor: User,
    order_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    actor = _authenticated(actor)

    def work() -> CommandResult:
        expected = _version(payload, allowed=frozenset({"product_id", "quantity"}))
        order = lock_order(order_id)
        _parts_state(order)
        ensure_version(order, expected)
        product_id = _product_id(payload)
        quantity = payload.get("quantity")
        _translate(
            lambda: add_linked_line(
                actor=actor,
                order_ref=order,
                product_id=product_id,
                quantity=quantity,
            )
        )
        _touch(order, actor)
        return CommandResult(201, order.pk, ("parts",))

    return execute_write(
        actor=actor,
        permissions=PART_PERMISSIONS,
        action="maintenance.part_add",
        target_id=str(order_id),
        payload=payload,
        work=work,
        project=lambda pk: projection.order_detail(pk, actor),
        request_id=request_id,
    )


def change_part(
    *,
    actor: User,
    order_id: int,
    line_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    actor = _authenticated(actor)

    def work() -> CommandResult:
        expected = _version(payload, allowed=frozenset({"quantity"}))
        order = lock_order(order_id)
        _parts_state(order)
        ensure_version(order, expected)
        sale = lock_open_linked_sale(order.pk)
        sale_version = sale.version if sale is not None else 0
        _translate(
            lambda: change_linked_line(
                actor=actor,
                order_ref=order,
                line_id=line_id,
                quantity=payload.get("quantity"),
                expected_sale_version=sale_version,
            )
        )
        _touch(order, actor)
        return CommandResult(200, order.pk, ("parts",))

    return execute_write(
        actor=actor,
        permissions=PART_PERMISSIONS,
        action="maintenance.part_change",
        target_id=str(order_id),
        payload={**payload, "line_id": line_id},
        fingerprint_payload={**payload, "line_id": line_id},
        work=work,
        project=lambda pk: projection.order_detail(pk, actor),
        request_id=request_id,
    )


def remove_part(
    *,
    actor: User,
    order_id: int,
    line_id: int,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    actor = _authenticated(actor)

    def work() -> CommandResult:
        expected = parsed(lambda: parse_version_only(payload))
        order = lock_order(order_id)
        _parts_state(order)
        ensure_version(order, expected)
        sale = lock_open_linked_sale(order.pk)
        sale_version = sale.version if sale is not None else 0
        _translate(
            lambda: remove_linked_line(
                actor=actor,
                order_ref=order,
                line_id=line_id,
                expected_sale_version=sale_version,
            )
        )
        _touch(order, actor)
        return CommandResult(200, order.pk, ("parts",))

    return execute_write(
        actor=actor,
        permissions=PART_PERMISSIONS,
        action="maintenance.part_remove",
        target_id=str(order_id),
        payload={**payload, "line_id": line_id},
        fingerprint_payload={**payload, "line_id": line_id},
        work=work,
        project=lambda pk: projection.order_detail(pk, actor),
        request_id=request_id,
    )


def list_parts(*, actor: User, order_id: int) -> list[dict[str, Any]]:
    actor = _authenticated(actor)
    require_permission(
        actor=actor,
        permission="mantenimientos.ver",
        denial_action="maintenance.parts_list",
        target_type="maintenance_order",
        target_id=str(order_id),
    )
    if not MaintenanceOrder.objects.filter(pk=order_id).exists():
        raise not_found()
    return linked_sales_summary(order_id)


def list_part_product_options(
    *,
    actor: User,
    order_id: int,
    search: str = "",
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    actor = _authenticated(actor)
    for permission in PART_PERMISSIONS:
        require_permission(
            actor=actor,
            permission=permission,
            denial_action="maintenance.part_product_options",
            target_type="maintenance_order",
            target_id=str(order_id),
        )
    order = MaintenanceOrder.objects.filter(pk=order_id).first()
    if order is None:
        raise not_found()
    _parts_state(order)
    options: dict[str, Any] = _translate(
        lambda: linked_product_options(search=search, page=page, page_size=page_size)
    )
    return options
