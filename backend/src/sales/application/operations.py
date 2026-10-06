"""Consulta autorizada del estado de un hecho comercial por su UUID estable.

Permite resolver un resultado incierto (respuesta perdida, recarga) antes de iniciar otra
intención de dinero. Solo revela hechos ya registrados a quien puede ver su venta.
"""

from typing import Any
from uuid import UUID

from identity.application.authorization import require_permission
from identity.models import User
from sales.application.errors import not_found
from sales.application.projection import project
from sales.models import (
    CommercialPayment,
    CommercialRefund,
    CommercialWithholding,
    PaymentCorrection,
    SaleReturn,
)


def operation_status(
    *, actor: User, operation_id: UUID, request_id: UUID | None = None
) -> dict[str, Any]:
    """Estado del hecho comercial con esa identidad; 404 si no existe."""
    payment = CommercialPayment.objects.filter(operation_id=operation_id).first()
    if payment is not None:
        _authorize(actor, "pagos_comerciales.ver", str(operation_id), request_id)
        return {"kind": "payment", "id": payment.pk, "result": project("payment", payment.pk)}
    held = CommercialWithholding.objects.filter(operation_id=operation_id).first()
    if held is not None:
        # Retención registrada sin dinero: el hecho de esa identidad es la propia retención.
        _authorize(actor, "pagos_comerciales.ver", str(operation_id), request_id)
        return {"kind": "withholding", "id": held.pk, "result": project("withholding", held.pk)}
    correction = PaymentCorrection.objects.filter(operation_id=operation_id).first()
    if correction is not None:
        _authorize(actor, "pagos_comerciales.ver", str(operation_id), request_id)
        return {
            "kind": "payment",
            "id": correction.original_payment_id,
            "result": project("payment", correction.original_payment_id),
        }
    sale_return = SaleReturn.objects.filter(operation_id=operation_id).first()
    if sale_return is not None:
        _authorize(actor, "ventas.ver", str(operation_id), request_id)
        return {"kind": "return", "id": sale_return.pk, "result": project("return", sale_return.pk)}
    refund = CommercialRefund.objects.filter(operation_id=operation_id).first()
    if refund is not None:
        _authorize(actor, "ventas.ver", str(operation_id), request_id)
        return {"kind": "refund", "id": refund.pk, "result": project("refund", refund.pk)}
    require_permission(
        actor=actor,
        permission="ventas.ver",
        request_id=request_id,
        denial_action="sales.operation_status_viewed",
        target_type="operation",
        target_id=str(operation_id),
    )
    raise not_found("Operación")


def _authorize(actor: User, permission: str, target: str, request_id: UUID | None) -> None:
    require_permission(
        actor=actor,
        permission=permission,
        request_id=request_id,
        denial_action="sales.operation_status_viewed",
        target_type="operation",
        target_id=target,
    )
