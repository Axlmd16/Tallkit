"""Adaptadores HTTP delgados del taller: permisos por método, CSRF de sesión y errores.

No calculan importes, estados ni requisitos; traducen contratos y errores. Los archivos de
fotografías solo se entregan aquí, con sesión y permiso de consulta de la orden.
"""

from collections.abc import Callable
from datetime import date
from typing import Any, ClassVar

from django.http import FileResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from config.api.errors import ProblemSerializer, application_error_response, problem_response
from identity.api.permissions import HasBusinessPermission
from identity.api.request_context import request_id_from
from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import User
from shared.transactions import RetryableConflictError
from workshop.api import serializers as sz
from workshop.application import orders, photos, queries, service_lines, transitions
from workshop.application.commands import CommandOutcome
from workshop.application.errors import WorkshopError

_TAG = "Maintenance"
_PROBLEMS = {
    400: ProblemSerializer,
    403: ProblemSerializer,
    404: ProblemSerializer,
    409: ProblemSerializer,
}
_READ_PROBLEMS = {400: ProblemSerializer, 403: ProblemSerializer}
_PAGE_PARAMS = [
    OpenApiParameter("page", OpenApiTypes.INT, description="Desde 1; omisión 1."),
    OpenApiParameter("page_size", OpenApiTypes.INT, description="1 a 100; omisión 20."),
]
_SEARCH = OpenApiParameter("search", OpenApiTypes.STR)
_LIST_PARAMS = [
    OpenApiParameter("search", OpenApiTypes.STR, description="Número, cliente o placa."),
    OpenApiParameter(
        "state",
        OpenApiTypes.STR,
        enum=["REGISTERED", "FINALIZED", "REOPENED", "OPEN"],
        description="OPEN reúne las registradas y las reabiertas.",
    ),
    OpenApiParameter("date_from", OpenApiTypes.DATE, description="Apertura inclusiva."),
    OpenApiParameter("date_to", OpenApiTypes.DATE, description="Apertura inclusiva."),
    OpenApiParameter("customer_id", OpenApiTypes.INT, description="Historial por cliente."),
    OpenApiParameter("vehicle_id", OpenApiTypes.INT, description="Historial por vehículo."),
    *_PAGE_PARAMS,
]
_PRIVATE_HEADERS = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
    "Content-Disposition": "inline",
}


def _actor(request: Request) -> User:
    if not isinstance(request.user, User):
        raise RuntimeError("La autorización debe resolver un usuario autenticado.")
    return request.user


def _body(request: Request) -> dict[str, Any]:
    data = request.data
    if type(data) is not dict:
        raise WorkshopError("validation_error", "El cuerpo debe ser un objeto JSON.")
    return data


def _bad(name: str, message: str) -> WorkshopError:
    return WorkshopError("validation_error", f"Parámetro inválido: {name}.", {name: [message]})


def _int(request: Request, name: str, default: int | None = None) -> int | None:
    raw = request.query_params.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        raise _bad(name, "Valor inválido.") from None


def _date(request: Request, name: str) -> date | None:
    raw = request.query_params.get(name)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise _bad(name, "Use AAAA-MM-DD.") from None


def _page_args(request: Request) -> dict[str, int]:
    return {
        "page": _int(request, "page", 1) or 1,
        "page_size": _int(request, "page_size", 20) or 20,
    }


def _envelope(result: dict[str, Any]) -> dict[str, Any]:
    count = result["total_count"]
    size = result["page_size"]
    return {
        "count": count,
        "page": result["page"],
        "page_size": size,
        "total_pages": (count + size - 1) // size if count else 0,
        "results": result["items"],
    }


def _error_response(request: Request, exc: Exception) -> Response:
    if isinstance(exc, WorkshopError):
        return application_error_response(
            request=request,
            code=exc.code,
            message=exc.message,
            errors=exc.errors,
            conflict=exc.conflict,
            details=exc.details,
        )
    if isinstance(exc, RetryableConflictError):
        return application_error_response(
            request=request,
            code="concurrent_operation",
            message="Otra operación modificó los mismos datos. Reintente la acción.",
        )
    return problem_response(
        request=request,
        status_code=status.HTTP_403_FORBIDDEN,
        title="Acceso denegado",
        code="permission_denied",
        detail="No tiene permiso para realizar esta acción.",
    )


_HANDLED = (WorkshopError, RetryableConflictError, BusinessPermissionDeniedError)


def _respond(
    request: Request, call: Callable[[], CommandOutcome | dict[str, Any] | list[Any]]
) -> Response:
    try:
        result = call()
    except _HANDLED as exc:
        return _error_response(request, exc)
    if isinstance(result, CommandOutcome):
        return Response(result.body, status=result.status)
    return Response(result, status=status.HTTP_200_OK)


class _WorkshopView(APIView):
    permission_classes = (HasBusinessPermission,)


class OrderListCreateView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "mantenimientos.ver",
        "POST": "mantenimientos.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_order_list",
        parameters=_LIST_PARAMS,
        responses={200: sz.MaintenanceOrderPageSerializer, **_READ_PROBLEMS},
    )
    def get(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: _envelope(
                queries.list_orders(
                    actor=_actor(request),
                    search=request.query_params.get("search", ""),
                    state=request.query_params.get("state") or None,
                    date_from=_date(request, "date_from"),
                    date_to=_date(request, "date_to"),
                    customer_id=_int(request, "customer_id"),
                    vehicle_id=_int(request, "vehicle_id"),
                    request_id=request_id_from(request),
                    **_page_args(request),
                )
            ),
        )

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_order_create",
        request=sz.MaintenanceOrderCreateSerializer,
        responses={201: sz.MaintenanceOrderSerializer, **_PROBLEMS},
        description=(
            "El número ART-OT, el estado, el creador y las fechas los asigna el servidor. Un "
            "kilometraje menor al último conocido responde `odometer_confirmation_required` con "
            "`details` hasta enviar `odometer_confirmed: true`."
        ),
    )
    def post(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: orders.create_order(
                actor=_actor(request), payload=_body(request), request_id=request_id_from(request)
            ),
        )


class OrderDetailView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "mantenimientos.ver",
        "PATCH": "mantenimientos.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_order_retrieve",
        responses={
            200: sz.MaintenanceOrderSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
        },
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: queries.get_order(
                actor=_actor(request), order_id=pk, request_id=request_id_from(request)
            ),
        )

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_order_update",
        request=sz.MaintenanceOrderUpdateSerializer,
        responses={200: sz.MaintenanceOrderSerializer, **_PROBLEMS},
        description="Solo órdenes REGISTERED. El estado cambia únicamente con finalize/reopen.",
    )
    def patch(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: orders.update_order(
                actor=_actor(request),
                order_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class CurrentInterventionView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"PATCH": "mantenimientos.gestionar"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_intervention_update",
        request=sz.MaintenanceInterventionUpdateSerializer,
        responses={200: sz.MaintenanceOrderSerializer, **_PROBLEMS},
    )
    def patch(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: transitions.update_current_intervention(
                actor=_actor(request),
                order_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class ServiceLineCreateView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "mantenimientos.gestionar"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_service_line_create",
        request=sz.MaintenanceLineCreateSerializer,
        responses={201: sz.MaintenanceOrderSerializer, **_PROBLEMS},
        description="Solo servicios activos del catálogo; sin descuentos ni servicios libres.",
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: service_lines.add_line(
                actor=_actor(request),
                order_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class ServiceLineDetailView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"PATCH": "mantenimientos.gestionar"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_service_line_update",
        request=sz.MaintenanceLineUpdateSerializer,
        responses={200: sz.MaintenanceOrderSerializer, **_PROBLEMS},
    )
    def patch(self, request: Request, pk: int, line_id: int) -> Response:
        return _respond(
            request,
            lambda: service_lines.update_line(
                actor=_actor(request),
                order_id=pk,
                line_id=line_id,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class ServiceLineRemoveView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "mantenimientos.gestionar"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_service_line_remove",
        request=sz.MaintenanceVersionedCommandFields,
        responses={200: sz.MaintenanceOrderSerializer, **_PROBLEMS},
    )
    def post(self, request: Request, pk: int, line_id: int) -> Response:
        return _respond(
            request,
            lambda: service_lines.remove_line(
                actor=_actor(request),
                order_id=pk,
                line_id=line_id,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class FinalizeView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "mantenimientos.finalizar"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_order_finalize",
        request=sz.MaintenanceVersionedCommandFields,
        responses={200: sz.MaintenanceOrderSerializer, **_PROBLEMS},
        description=(
            "Requisitos pendientes: `finalize_requirements` con `errors.requirements` y "
            "`details.pending`. No crea ventas, pagos, deuda ni movimientos de inventario."
        ),
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: transitions.finalize_order(
                actor=_actor(request),
                order_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class ReopenView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "mantenimientos.reabrir"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_order_reopen",
        request=sz.MaintenanceReopenSerializer,
        responses={200: sz.MaintenanceOrderSerializer, **_PROBLEMS},
        description="Agrega una intervención correctiva sin cargo; conserva cierres anteriores.",
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: transitions.reopen_order(
                actor=_actor(request),
                order_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class PhotoCreateView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "mantenimientos.gestionar_fotos"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})
    parser_classes = (MultiPartParser,)

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_photo_create",
        request={"multipart/form-data": sz.MaintenancePhotoUploadSerializer},
        responses={201: sz.MaintenanceOrderSerializer, **_PROBLEMS},
    )
    def post(self, request: Request, pk: int) -> Response:
        def call() -> CommandOutcome:
            upload = request.FILES.get("file")
            if upload is None:
                raise WorkshopError(
                    "validation_error", "Adjunte una imagen.", {"file": ["Adjunte una imagen."]}
                )
            return photos.upload_photo(
                actor=_actor(request),
                order_id=pk,
                file=upload,
                description=request.data.get("description"),
                idempotency_key=request.data.get("idempotency_key"),
                request_id=request_id_from(request),
            )

        return _respond(request, call)


class PhotoRemoveView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "mantenimientos.gestionar_fotos"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_photo_remove",
        request=sz.MaintenanceCommandFields,
        responses={200: sz.MaintenanceOrderSerializer, **_PROBLEMS},
    )
    def post(self, request: Request, pk: int, photo_id: int) -> Response:
        return _respond(
            request,
            lambda: photos.remove_photo(
                actor=_actor(request),
                order_id=pk,
                photo_id=photo_id,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


def _file_response(
    request: Request, pk: int, photo_id: int, *, thumbnail: bool
) -> FileResponse | Response:
    try:
        handle, content_type = photos.open_photo(
            actor=_actor(request),
            order_id=pk,
            photo_id=photo_id,
            thumbnail=thumbnail,
            request_id=request_id_from(request),
        )
    except _HANDLED as exc:
        return _error_response(request, exc)
    response = FileResponse(handle, content_type=content_type)
    for header, value in _PRIVATE_HEADERS.items():
        response[header] = value
    return response


_BINARY = {
    200: OpenApiResponse(response=OpenApiTypes.BINARY, description="Imagen privada."),
    403: ProblemSerializer,
    404: ProblemSerializer,
}


class PhotoFileView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "mantenimientos.ver"}

    @extend_schema(tags=[_TAG], operation_id="maintenance_photo_file", responses=_BINARY)
    def get(self, request: Request, pk: int, photo_id: int) -> FileResponse | Response:
        return _file_response(request, pk, photo_id, thumbnail=False)


class PhotoThumbnailView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "mantenimientos.ver"}

    @extend_schema(tags=[_TAG], operation_id="maintenance_photo_thumbnail", responses=_BINARY)
    def get(self, request: Request, pk: int, photo_id: int) -> FileResponse | Response:
        return _file_response(request, pk, photo_id, thumbnail=True)


class CustomerOptionsView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "mantenimientos.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_customer_options",
        parameters=[_SEARCH, *_PAGE_PARAMS],
        responses={200: sz.MaintenanceCustomerOptionPageSerializer, **_READ_PROBLEMS},
    )
    def get(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: _envelope(
                queries.customer_options(
                    actor=_actor(request),
                    search=request.query_params.get("search", ""),
                    request_id=request_id_from(request),
                    **_page_args(request),
                )
            ),
        )


class VehicleOptionsView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "mantenimientos.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_vehicle_options",
        parameters=[OpenApiParameter("customer_id", OpenApiTypes.INT, required=True)],
        responses={200: sz.MaintenanceVehicleOptionPageSerializer, **_READ_PROBLEMS},
        description="Vehículos activos cuyo propietario vigente es el cliente.",
    )
    def get(self, request: Request) -> Response:
        def call() -> dict[str, Any]:
            customer_id = _int(request, "customer_id")
            if customer_id is None or customer_id < 1:
                raise _bad("customer_id", "Seleccione un cliente.")
            return _envelope(
                queries.vehicle_options(
                    actor=_actor(request),
                    customer_id=customer_id,
                    request_id=request_id_from(request),
                )
            )

        return _respond(request, call)


class ServiceOptionsView(_WorkshopView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "mantenimientos.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="maintenance_service_options",
        parameters=[_SEARCH, *_PAGE_PARAMS],
        responses={200: sz.MaintenanceServiceOptionPageSerializer, **_READ_PROBLEMS},
    )
    def get(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: _envelope(
                queries.service_options(
                    actor=_actor(request),
                    search=request.query_params.get("search", ""),
                    request_id=request_id_from(request),
                    **_page_args(request),
                )
            ),
        )
