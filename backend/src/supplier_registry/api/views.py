"""Adaptadores HTTP delgados de proveedores; la consulta es exclusiva del Administrador."""

from collections.abc import Callable
from typing import Any, ClassVar

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
from supplier_registry.api import serializers as sz
from supplier_registry.application import queries, suppliers
from supplier_registry.application.commands import CommandOutcome, IdempotencyConflictError
from supplier_registry.application.errors import SupplierApplicationError

_TAG = "Suppliers"
_PROBLEMS = {400: ProblemSerializer, 403: ProblemSerializer, 409: ProblemSerializer}


def _actor(request: Request) -> User:
    if not isinstance(request.user, User):
        raise RuntimeError("La autorización debe resolver un usuario autenticado.")
    return request.user


def _body(request: Request) -> dict[str, Any]:
    data = request.data
    if type(data) is not dict:
        raise SupplierApplicationError("validation_error", "El cuerpo debe ser un objeto JSON.")
    return data


def _respond(request: Request, call: Callable[[], Response | CommandOutcome]) -> Response:
    try:
        result = call()
    except SupplierApplicationError as exc:
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
    return result


class SupplierListCreateView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "proveedores.ver",
        "POST": "proveedores.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="suppliers_list",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR, description="Nombre o documento."),
            OpenApiParameter("is_active", OpenApiTypes.STR, enum=["true", "false", "all"]),
            OpenApiParameter("page", OpenApiTypes.INT),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="1 a 100; omisión 20."),
        ],
        responses={200: sz.SupplierPageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        params = {k: request.query_params.get(k) for k in request.query_params}
        return _respond(request, lambda: Response(queries.list_suppliers(params).as_dict()))

    @extend_schema(
        tags=[_TAG],
        operation_id="suppliers_create",
        request=sz.SupplierWriteSerializer,
        responses={201: sz.SupplierSerializer, **_PROBLEMS},
    )
    def post(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: suppliers.create_supplier(
                actor=_actor(request), payload=_body(request), request_id=request_id_from(request)
            ),
        )


class SupplierOptionsView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {"GET": "ingresos.crear"}

    @extend_schema(
        tags=[_TAG],
        operation_id="suppliers_options",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR, description="Solo por nombre."),
            OpenApiParameter("page", OpenApiTypes.INT),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="1 a 100; omisión 20."),
        ],
        responses={
            200: sz.SupplierOptionPageSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
        },
        description=(
            "Proveedores activos para elegir uno al registrar una entrada; solo id y nombre. "
            "Lo usa quien puede registrar entradas, sin acceso al catálogo completo."
        ),
    )
    def get(self, request: Request) -> Response:
        params = {k: request.query_params.get(k) for k in request.query_params}
        return _respond(request, lambda: Response(queries.list_supplier_options(params).as_dict()))


class SupplierMatchesView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {"POST": "proveedores.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="suppliers_matches",
        request=sz.SupplierMatchQuerySerializer,
        responses={
            200: sz.SupplierMatchesSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
        },
        description="Consulta consultiva de nombres coincidentes; no muta ni exige clave.",
    )
    def post(self, request: Request) -> Response:
        return _respond(request, lambda: Response(queries.find_name_matches(_body(request))))


class SupplierDetailView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "proveedores.ver",
        "PATCH": "proveedores.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=[_TAG],
        operation_id="suppliers_retrieve",
        responses={200: sz.SupplierSerializer, 403: ProblemSerializer, 404: ProblemSerializer},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(request, lambda: Response(queries.get_supplier(pk)))

    @extend_schema(
        tags=[_TAG],
        operation_id="suppliers_update",
        request=sz.SupplierPatchSerializer,
        responses={200: sz.SupplierSerializer, 404: ProblemSerializer, **_PROBLEMS},
    )
    def patch(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: suppliers.update_supplier(
                pk,
                actor=_actor(request),
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


def _state_view(active: bool) -> type[APIView]:
    verb = "activate" if active else "deactivate"

    class State(APIView):
        permission_classes = (HasBusinessPermission,)
        business_permissions: ClassVar[dict[str, str]] = {"POST": "proveedores.gestionar"}
        audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

        @extend_schema(
            tags=[_TAG],
            operation_id=f"suppliers_{verb}",
            request=sz.SupplierStateSerializer,
            responses={200: sz.SupplierSerializer, 404: ProblemSerializer, **_PROBLEMS},
        )
        def post(self, request: Request, pk: int) -> Response:
            return _respond(
                request,
                lambda: suppliers.set_supplier_active(
                    pk,
                    active=active,
                    actor=_actor(request),
                    payload=_body(request),
                    request_id=request_id_from(request),
                ),
            )

    State.__name__ = f"Supplier{verb.title()}View"
    return State


SupplierActivateView = _state_view(True)
SupplierDeactivateView = _state_view(False)
