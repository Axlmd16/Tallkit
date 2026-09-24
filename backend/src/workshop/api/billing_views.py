"""Adaptadores HTTP de la integración económica del taller.

Repuestos (venta vinculada), resumen por RUC, vista comercial restringida, operación artesanal
ART-SER, sus pagos y las cuentas por cobrar artesanales. Delgados: solo traducen contratos.
"""

from typing import ClassVar

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from config.api.errors import ProblemSerializer
from identity.api.request_context import request_id_from
from workshop.api import serializers as sz
from workshop.api.views import (
    _PAGE_PARAMS,
    _PROBLEMS,
    _actor,
    _body,
    _int,
    _page_args,
    _respond,
    _WorkshopView,
)
from workshop.application import (
    artisan_payments,
    economic_summary,
    parts,
    queries,
    service_operations,
)

_TAG = "Maintenance billing"
_READ = {403: ProblemSerializer, 404: ProblemSerializer}


class PartListCreateView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "mantenimientos.ver",
        "POST": "mantenimientos.gestionar_repuestos",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_part_list",
        responses={200: sz.LinkedSaleSerializer(many=True), **_READ},
        description="Ventas vinculadas de la orden, sin costos. El borrador incluye `estimate`.",
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(request, lambda: parts.list_parts(actor=_actor(request), order_id=pk))

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_part_add",
        request=sz.MaintenancePartCreateSerializer,
        responses={201: sz.MaintenanceOrderSerializer, **_PROBLEMS},
        description=(
            "Agrega una línea a la única venta comercial abierta vinculada y reserva su "
            "cantidad; no descuenta existencia ni genera deuda. Exige además "
            "`ventas.preparar_vinculada`. Solo órdenes REGISTERED (`parts_not_allowed`)."
        ),
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: parts.add_part(
                actor=_actor(request),
                order_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class PartProductOptionsView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "mantenimientos.gestionar_repuestos"}

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_part_product_options",
        parameters=[OpenApiParameter("search", OpenApiTypes.STR), *_PAGE_PARAMS],
        responses={200: sz.PartProductOptionsSerializer, **_PROBLEMS},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: parts.list_part_product_options(
                actor=_actor(request),
                order_id=pk,
                search=request.query_params.get("search", ""),
                **_page_args(request),
            ),
        )


class PartDetailView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"PATCH": "mantenimientos.gestionar_repuestos"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_part_update",
        request=sz.MaintenancePartUpdateSerializer,
        responses={200: sz.MaintenanceOrderSerializer, **_PROBLEMS},
    )
    def patch(self, request: Request, pk: int, line_id: int) -> Response:
        return _respond(
            request,
            lambda: parts.change_part(
                actor=_actor(request),
                order_id=pk,
                line_id=line_id,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class PartRemoveView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "mantenimientos.gestionar_repuestos"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_part_remove",
        request=sz.MaintenanceVersionedCommandFields,
        responses={200: sz.MaintenanceOrderSerializer, **_PROBLEMS},
        description="Retira la línea pendiente y libera exactamente su reserva.",
    )
    def post(self, request: Request, pk: int, line_id: int) -> Response:
        return _respond(
            request,
            lambda: parts.remove_part(
                actor=_actor(request),
                order_id=pk,
                line_id=line_id,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class EconomicSummaryView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "mantenimientos.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_economic_summary",
        responses={200: sz.EconomicSummarySerializer, **_READ},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: economic_summary.order_economic_summary(
                actor=_actor(request), order_id=pk, request_id=request_id_from(request)
            ),
        )


class CommercialOrderView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "ventas.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_commercial_view",
        responses={200: sz.CommercialOrderViewSerializer, **_READ},
        description="Vista restringida de la orden de origen de una venta vinculada.",
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: economic_summary.commercial_view(
                actor=_actor(request), order_id=pk, request_id=request_id_from(request)
            ),
        )


class ServiceOperationPreviewView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "servicios_economicos.confirmar"}

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_service_operation_preview",
        request=sz.ServiceOperationPreviewRequestSerializer,
        responses={200: sz.ServiceOperationPreviewSerializer, **_PROBLEMS},
        description="Sin efectos: no numera, no crea deuda ni bloquea líneas.",
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: service_operations.preview_operation(
                actor=_actor(request),
                order_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class ServiceOperationCreateView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "servicios_economicos.confirmar"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_service_operation_confirm",
        request=sz.ServiceOperationConfirmSerializer,
        responses={201: sz.ServiceOperationSerializer, **_PROBLEMS},
        description=(
            "Confirma la operación ART-SER con las líneas iniciales pendientes; exige la "
            "huella de la vista previa. No afecta inventario ni registra pagos."
        ),
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: service_operations.confirm_operation(
                actor=_actor(request),
                order_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


_RECEIVABLE_PARAMS = [
    OpenApiParameter("customer_id", OpenApiTypes.INT),
    OpenApiParameter("order_id", OpenApiTypes.INT),
    OpenApiParameter("payment_state", OpenApiTypes.STR, enum=["PENDING", "PARTIAL", "PAID"]),
    *_PAGE_PARAMS,
]


class ArtisanReceivablesView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "pagos_artesanales.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="artisan_receivables",
        parameters=_RECEIVABLE_PARAMS,
        responses={200: sz.ArtisanReceivablePageSerializer, 400: ProblemSerializer, **_READ},
        description="Solo RUC artesanal. La antigüedad no expresa mora ni vencimiento.",
    )
    def get(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: queries.artisan_receivables(
                actor=_actor(request),
                customer_id=_int(request, "customer_id"),
                order_id=_int(request, "order_id"),
                payment_state=request.query_params.get("payment_state") or None,
                request_id=request_id_from(request),
                **_page_args(request),
            ),
        )


class ServiceOperationDetailView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "servicios_economicos.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="service_operation_retrieve",
        responses={200: sz.ServiceOperationSerializer, **_READ},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: service_operations.get_operation(
                actor=_actor(request), operation_id=pk, request_id=request_id_from(request)
            ),
        )


class ServiceOperationDocumentView(ServiceOperationDetailView):
    @extend_schema(
        tags=[_TAG],
        operation_id="service_operation_document",
        responses={200: sz.ServiceOperationSerializer, **_READ},
        description="Comprobante interno del RUC artesanal; no es factura autorizada por el SRI.",
    )
    def get(self, request: Request, pk: int) -> Response:
        return super().get(request, pk)


class ServiceOperationVoidPreviewView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "servicios_economicos.anular"}

    @extend_schema(
        tags=[_TAG],
        operation_id="service_operation_void_preview",
        responses={200: sz.ServiceOperationVoidPreviewSerializer, **_READ},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: service_operations.void_preview(actor=_actor(request), operation_id=pk),
        )


class ServiceOperationVoidView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "servicios_economicos.anular"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="service_operation_void",
        request=sz.ServiceOperationVoidSerializer,
        responses={200: sz.ServiceOperationSerializer, **_PROBLEMS},
        description="Solo sin pagos vigentes (`payments_block_void`); conserva número y líneas.",
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: service_operations.void_operation(
                actor=_actor(request),
                operation_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class ArtisanPaymentListCreateView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "pagos_artesanales.ver",
        "POST": "pagos_artesanales.registrar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="artisan_payment_list",
        responses={200: OpenApiTypes.OBJECT, **_READ},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: artisan_payments.list_payments(actor=_actor(request), operation_id=pk),
        )

    @extend_schema(
        tags=[_TAG],
        operation_id="artisan_payment_register",
        request=sz.ArtisanPaymentCreateSerializer,
        responses={201: sz.ServiceOperationSerializer, **_PROBLEMS},
        description=(
            "Cobro de una sola operación artesanal con EFECTIVO, TRANSFERENCIA o ambos. "
            "Contado exige el saldo completo; sin anticipos ni sobrepagos."
        ),
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: artisan_payments.register_payment(
                actor=_actor(request),
                operation_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class ArtisanPaymentCorrectionView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "pagos_artesanales.anular"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="artisan_payment_correct",
        request=sz.ArtisanPaymentCorrectionSerializer,
        responses={200: sz.ServiceOperationSerializer, **_PROBLEMS},
    )
    def post(self, request: Request, pk: int, payment_id: int) -> Response:
        return _respond(
            request,
            lambda: artisan_payments.correct_payment(
                actor=_actor(request),
                operation_id=pk,
                payment_id=payment_id,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )
