"""Adaptadores HTTP delgados de ventas: permisos por método, CSRF de sesión y errores.

No calculan importes ni escriben persistencia ajena; traducen contratos y errores.
"""

from collections.abc import Callable
from datetime import date
from typing import Any, ClassVar
from uuid import UUID

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from config.api.errors import ProblemSerializer, application_error_response, problem_response
from identity.api.permissions import HasBusinessPermission
from identity.api.request_context import request_id_from
from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import User
from sales.api import serializers as sz
from sales.application import (
    operations,
    options,
    payments,
    reads,
    refunds,
    returns,
    reviews,
    sales,
    voids,
    withholdings,
)
from sales.application.commands import CommandOutcome, IdempotencyConflictError
from sales.application.errors import SalesApplicationError
from shared.transactions import RetryableConflictError

_PROBLEMS = {400: ProblemSerializer, 403: ProblemSerializer, 409: ProblemSerializer}
_NOT_FOUND = {404: ProblemSerializer}
_TAG = "Sales"
_STATES = ("DRAFT", "CONFIRMED", "VOIDED")
_PAYMENT_STATES = ("PENDING", "PARTIAL", "PAID")
_ORIGINS = ("DIRECT", "MAINTENANCE", "PROFORMA")
_PAGE_PARAMS = [
    OpenApiParameter("page", OpenApiTypes.INT, description="Desde 1; omisión 1."),
    OpenApiParameter("page_size", OpenApiTypes.INT, description="1 a 100; omisión 20."),
]
_LIST_PARAMS = [
    OpenApiParameter("customer_id", OpenApiTypes.INT),
    OpenApiParameter("state", OpenApiTypes.STR, enum=list(_STATES)),
    OpenApiParameter("payment_state", OpenApiTypes.STR, enum=list(_PAYMENT_STATES)),
    OpenApiParameter("origin", OpenApiTypes.STR, enum=list(_ORIGINS)),
    OpenApiParameter("date_from", OpenApiTypes.DATE, description="Inclusiva, zona del negocio."),
    OpenApiParameter("date_to", OpenApiTypes.DATE, description="Inclusiva, zona del negocio."),
    *_PAGE_PARAMS,
]
_RECEIVABLE_PARAMS = [
    OpenApiParameter("customer_id", OpenApiTypes.INT),
    OpenApiParameter("payment_state", OpenApiTypes.STR, enum=["PENDING", "PARTIAL"]),
    OpenApiParameter("origin", OpenApiTypes.STR, enum=list(_ORIGINS)),
    OpenApiParameter(
        "min_age_days", OpenApiTypes.INT, description="Días desde la confirmación, fechas locales."
    ),
    *_PAGE_PARAMS,
]
_SEARCH = OpenApiParameter("search", OpenApiTypes.STR)


def _actor(request: Request) -> User:
    if not isinstance(request.user, User):
        raise RuntimeError("La autorización debe resolver un usuario autenticado.")
    return request.user


def _body(request: Request) -> dict[str, Any]:
    data = request.data
    if type(data) is not dict:
        raise SalesApplicationError("validation_error", "El cuerpo debe ser un objeto JSON.")
    return data


def _bad(name: str, message: str) -> SalesApplicationError:
    return SalesApplicationError(
        "validation_error", f"Parámetro inválido: {name}.", {name: [message]}
    )


def _int(
    request: Request, name: str, default: int | None = None, *, minimum: int = 0
) -> int | None:
    raw = request.query_params.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise _bad(name, "Valor inválido.") from None
    if value < minimum:
        raise _bad(name, "Valor inválido.")
    return value


def _date(request: Request, name: str) -> date | None:
    raw = request.query_params.get(name)
    if raw is None:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise _bad(name, "Use AAAA-MM-DD.") from None


def _page_args(request: Request) -> dict[str, int]:
    return {
        "page": _int(request, "page", 1, minimum=1) or 1,
        "page_size": _int(request, "page_size", 20, minimum=1) or 20,
    }


def _envelope(result: dict[str, Any]) -> dict[str, Any]:
    """Traduce ``items``/``total_count`` a la envoltura pública ``results``/``count``."""
    count = result["total_count"]
    size = result["page_size"]
    body = {
        "count": count,
        "page": result["page"],
        "page_size": size,
        "total_pages": (count + size - 1) // size if count else 0,
        "results": result["items"],
    }
    for extra in ("receivable_total", "refund_due_total"):
        if extra in result:
            body[extra] = result[extra]
    return body


def _respond(
    request: Request, call: Callable[[], Response | CommandOutcome | dict[str, Any] | list[Any]]
) -> Response:
    try:
        result = call()
    except SalesApplicationError as exc:
        return application_error_response(
            request=request, code=exc.code, message=exc.message, errors=exc.errors
        )
    except IdempotencyConflictError:
        return application_error_response(
            request=request,
            code="idempotency_conflict",
            message="La clave de idempotencia ya se usó con otra solicitud.",
            errors={"idempotency_key": ["Clave reutilizada con datos distintos."]},
        )
    except RetryableConflictError:
        return application_error_response(
            request=request,
            code="concurrent_operation",
            message="Otra operación modificó los mismos datos. Reintente la unidad completa.",
        )
    except BusinessPermissionDeniedError:
        return problem_response(
            request=request,
            status_code=status.HTTP_403_FORBIDDEN,
            title="Acceso denegado",
            code="permission_denied",
            detail="No tiene permiso para realizar esta acción.",
        )
    if isinstance(result, CommandOutcome):
        return Response(result.body, status=result.status)
    if isinstance(result, dict | list):
        return Response(result, status=status.HTTP_200_OK)
    return result


class _SalesView(APIView):
    permission_classes = (HasBusinessPermission,)


class SaleListCreateView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "ventas.ver", "POST": "ventas.crear"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_sale_list",
        parameters=_LIST_PARAMS,
        responses={200: sz.SalePageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: _envelope(
                reads.list_sales(
                    actor=_actor(request),
                    customer_id=_int(request, "customer_id", minimum=1),
                    state=request.query_params.get("state"),
                    payment_state=request.query_params.get("payment_state"),
                    origin=request.query_params.get("origin"),
                    date_from=_date(request, "date_from"),
                    date_to=_date(request, "date_to"),
                    request_id=request_id_from(request),
                    **_page_args(request),
                )
            ),
        )

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_sale_create",
        request=sz.SaleWriteSerializer,
        responses={201: sz.SaleSerializer, **_PROBLEMS},
        description=(
            "Hasta 200 líneas. El precio, impuesto, total y costo los determina el servidor: "
            "cualquier campo de precio, descuento, impuesto, total, costo o saldo se rechaza "
            "con `unknown_field`."
        ),
    )
    def post(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: sales.create_draft(
                actor=_actor(request), payload=_body(request), request_id=request_id_from(request)
            ),
        )


class SaleDetailView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "ventas.ver", "PATCH": "ventas.crear"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_sale_retrieve",
        responses={200: sz.SaleSerializer, 403: ProblemSerializer, **_NOT_FOUND},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: reads.sale_detail(
                actor=_actor(request), sale_id=pk, request_id=request_id_from(request)
            ),
        )

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_sale_update",
        request=sz.SalePatchSerializer,
        responses={200: sz.SaleSerializer, **_NOT_FOUND, **_PROBLEMS},
    )
    def patch(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: sales.update_draft(
                actor=_actor(request),
                sale_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class DraftPreviewView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "ventas.crear"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_draft_preview",
        request=sz.DraftPreviewSerializer,
        responses={200: sz.DraftPreviewResultSerializer, **_PROBLEMS},
        description=(
            "Proyección documental de la captura sin persistir: no guarda borrador, recibo, "
            "reserva, número ni uso fiscal. No habilita confirmar."
        ),
    )
    def post(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: reviews.preview_draft_capture(
                actor=_actor(request), payload=_body(request), request_id=request_id_from(request)
            ),
        )


class SalePreviewView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "ventas.confirmar"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_sale_preview",
        request=None,
        responses={200: sz.SaleReviewSerializer, 403: ProblemSerializer, **_NOT_FOUND},
        description="Revisión de solo lectura protegida por CSRF; no crea recibo ni efectos.",
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: reviews.preview_confirmation(
                actor=_actor(request), sale_id=pk, request_id=request_id_from(request)
            ),
        )


class SaleConfirmView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "ventas.confirmar"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_sale_confirm",
        request=sz.SaleConfirmSerializer,
        responses={200: sz.SaleSerializer, **_NOT_FOUND, **_PROBLEMS},
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: sales.confirm_sale(
                actor=_actor(request),
                sale_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class SaleDocumentView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "ventas.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_sale_document",
        responses={200: sz.DocumentSerializer, 403: ProblemSerializer, **_NOT_FOUND},
        description="Comprobante interno con datos históricos y sin costos.",
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: reads.sale_document(
                actor=_actor(request), sale_id=pk, request_id=request_id_from(request)
            ),
        )


class PaymentListCreateView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "pagos_comerciales.ver",
        "POST": "pagos_comerciales.registrar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_payment_list",
        responses={200: sz.PaymentSerializer(many=True), 403: ProblemSerializer, **_NOT_FOUND},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(
            request, lambda: payments.payment_history(actor=_actor(request), sale_id=pk)
        )

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_payment_create",
        request=sz.PaymentWriteSerializer,
        responses={201: sz.PaymentSerializer, **_NOT_FOUND, **_PROBLEMS},
        description="Hasta dos partes, una por medio. La fecha efectiva la asigna el servidor.",
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: payments.register_payment(
                actor=_actor(request),
                sale_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class PaymentPreviewView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "pagos_comerciales.registrar"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_payment_preview",
        request=sz.PaymentPreviewSerializer,
        responses={200: sz.MoneyReviewSerializer, 403: ProblemSerializer, **_NOT_FOUND},
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: payments.preview_payment(
                actor=_actor(request),
                sale_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class CorrectionPreviewView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "pagos_comerciales.anular"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_payment_correction_preview",
        request=sz.CorrectionPreviewSerializer,
        responses={200: sz.MoneyReviewSerializer, 403: ProblemSerializer, **_NOT_FOUND},
    )
    def post(self, request: Request, pk: int, payment_id: int) -> Response:
        return _respond(
            request,
            lambda: payments.preview_correction(
                actor=_actor(request),
                sale_id=pk,
                payment_id=payment_id,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class CorrectionView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "pagos_comerciales.anular"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_payment_correct",
        request=sz.CorrectionWriteSerializer,
        responses={200: sz.PaymentSerializer, **_NOT_FOUND, **_PROBLEMS},
        description="Anula lógicamente el pago y, opcionalmente, lo sustituye en una acción.",
    )
    def post(self, request: Request, pk: int, payment_id: int) -> Response:
        return _respond(
            request,
            lambda: payments.correct_payment(
                actor=_actor(request),
                sale_id=pk,
                payment_id=payment_id,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class WithholdingListView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "pagos_comerciales.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_withholding_list",
        responses={
            200: sz.WithholdingSerializer(many=True),
            403: ProblemSerializer,
            **_NOT_FOUND,
        },
        description="Retenciones recibidas de la venta, vigentes y anuladas.",
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(
            request, lambda: withholdings.withholding_history(actor=_actor(request), sale_id=pk)
        )


class PendingWithholdingsView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "pagos_comerciales.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_withholdings_pending",
        parameters=[OpenApiParameter("customer_id", OpenApiTypes.INT), *_PAGE_PARAMS],
        responses={
            200: sz.PendingWithholdingsPageSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
        },
        description="Retenciones comerciales vigentes cuyo comprobante falta completar.",
    )
    def get(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: withholdings.pending_vouchers(
                actor=_actor(request),
                customer_id=_int(request, "customer_id", minimum=1),
                request_id=request_id_from(request),
                **_page_args(request),
            ),
        )


class WithholdingVoucherView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "pagos_comerciales.registrar"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_withholding_voucher_complete",
        request=sz.WithholdingVoucherSerializer,
        responses={200: sz.WithholdingSerializer, **_NOT_FOUND, **_PROBLEMS},
        description="Completa por primera vez el comprobante; no cambia importe ni saldo.",
    )
    def post(self, request: Request, pk: int, withholding_id: int) -> Response:
        return _respond(
            request,
            lambda: withholdings.complete_voucher(
                actor=_actor(request),
                sale_id=pk,
                withholding_id=withholding_id,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class WithholdingVoucherCorrectionView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "pagos_comerciales.anular"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_withholding_voucher_correct",
        request=sz.WithholdingVoucherCorrectionSerializer,
        responses={200: sz.WithholdingSerializer, **_NOT_FOUND, **_PROBLEMS},
        description="Corrige un comprobante ya completado y conserva los valores anteriores.",
    )
    def post(self, request: Request, pk: int, withholding_id: int) -> Response:
        return _respond(
            request,
            lambda: withholdings.correct_voucher(
                actor=_actor(request),
                sale_id=pk,
                withholding_id=withholding_id,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class WithholdingVoidView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "pagos_comerciales.anular"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_withholding_void",
        request=sz.WithholdingVoidSerializer,
        responses={200: sz.WithholdingSerializer, **_NOT_FOUND, **_PROBLEMS},
        description="Anula la retención con motivo; su importe vuelve al saldo.",
    )
    def post(self, request: Request, pk: int, withholding_id: int) -> Response:
        return _respond(
            request,
            lambda: withholdings.void_withholding(
                actor=_actor(request),
                sale_id=pk,
                withholding_id=withholding_id,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class ReturnListCreateView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "ventas.ver",
        "POST": "ventas.devolver",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_return_list",
        responses={200: sz.ReturnSerializer(many=True), 403: ProblemSerializer, **_NOT_FOUND},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(request, lambda: returns.return_history(actor=_actor(request), sale_id=pk))

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_return_create",
        request=sz.ReturnWriteSerializer,
        responses={201: sz.ReturnSerializer, **_NOT_FOUND, **_PROBLEMS},
        description="Hasta 200 líneas; cada cantidad devuelta se clasifica como apta o no apta.",
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: returns.register_return(
                actor=_actor(request),
                sale_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class ReturnPreviewView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "ventas.devolver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_return_preview",
        request=sz.ReturnPreviewSerializer,
        responses={200: sz.MoneyReviewSerializer, 403: ProblemSerializer, **_NOT_FOUND},
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: returns.preview_return(
                actor=_actor(request),
                sale_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class RefundListCreateView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "ventas.ver",
        "POST": "ventas.devolver",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_refund_list",
        responses={200: sz.RefundSerializer(many=True), 403: ProblemSerializer, **_NOT_FOUND},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(request, lambda: refunds.refund_history(actor=_actor(request), sale_id=pk))

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_refund_create",
        request=sz.RefundWriteSerializer,
        responses={201: sz.RefundSerializer, **_NOT_FOUND, **_PROBLEMS},
        description="Registra un desembolso ya realizado; el reembolso por anulación va en `void`.",
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: refunds.register_refund(
                actor=_actor(request),
                sale_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class RefundPreviewView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "ventas.devolver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_refund_preview",
        request=sz.RefundPreviewSerializer,
        responses={200: sz.MoneyReviewSerializer, 403: ProblemSerializer, **_NOT_FOUND},
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: refunds.preview_refund(
                actor=_actor(request),
                sale_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class VoidPreviewView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "ventas.anular"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_sale_void_preview",
        request=sz.VoidPreviewSerializer,
        responses={200: sz.MoneyReviewSerializer, 403: ProblemSerializer, **_NOT_FOUND},
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: voids.preview_void(
                actor=_actor(request),
                sale_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class VoidView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "ventas.anular"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_sale_void",
        request=sz.VoidWriteSerializer,
        responses={200: sz.SaleSerializer, **_NOT_FOUND, **_PROBLEMS},
        description="Con dinero aplicado exige el desembolso ya realizado y su UUID.",
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: voids.void_sale(
                actor=_actor(request),
                sale_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class ReceivablesView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "pagos_comerciales.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_receivables",
        parameters=_RECEIVABLE_PARAMS,
        responses={
            200: sz.ReceivablesPageSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
        },
        description="Deuda cobrable y exceso por reembolsar se muestran por separado.",
    )
    def get(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: _envelope(
                reads.receivables(
                    actor=_actor(request),
                    customer_id=_int(request, "customer_id", minimum=1),
                    payment_state=request.query_params.get("payment_state"),
                    origin=request.query_params.get("origin"),
                    min_age_days=_int(request, "min_age_days"),
                    request_id=request_id_from(request),
                    **_page_args(request),
                )
            ),
        )


class OperationStatusView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "ventas.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_operation_status",
        responses={200: sz.OperationStatusSerializer, 403: ProblemSerializer, **_NOT_FOUND},
        description="Consulta un hecho ya registrado por su UUID tras un resultado incierto.",
    )
    def get(self, request: Request, operation_id: UUID) -> Response:
        return _respond(
            request,
            lambda: operations.operation_status(
                actor=_actor(request),
                operation_id=operation_id,
                request_id=request_id_from(request),
            ),
        )


class CustomerOptionsView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "ventas.crear"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_customer_options",
        parameters=[_SEARCH, *_PAGE_PARAMS],
        responses={200: sz.OptionPageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: _envelope(
                options.customer_options(
                    actor=_actor(request),
                    search=request.query_params.get("search", ""),
                    request_id=request_id_from(request),
                    **_page_args(request),
                )
            ),
        )


class ProductOptionsView(_SalesView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "ventas.crear"}

    @extend_schema(
        tags=[_TAG],
        operation_id="sales_product_options",
        parameters=[_SEARCH, *_PAGE_PARAMS],
        responses={200: sz.OptionPageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
        description="Productos activos con su precio final vigente; nunca costos.",
    )
    def get(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: _envelope(
                options.product_options(
                    actor=_actor(request),
                    search=request.query_params.get("search", ""),
                    request_id=request_id_from(request),
                    **_page_args(request),
                )
            ),
        )
