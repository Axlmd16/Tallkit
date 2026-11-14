"""Adaptadores HTTP delgados de inventario y Kardex."""

from collections.abc import Callable
from datetime import date
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
from identity.application.authorization import BusinessPermissionDeniedError, has_permission
from identity.models import User
from inventory.api import serializers as sz
from inventory.application import operations, queries
from inventory.application.commands import CommandOutcome, IdempotencyConflictError
from inventory.application.errors import InventoryApplicationError
from shared.transactions import RetryableConflictError

_PROBLEMS = {400: ProblemSerializer, 403: ProblemSerializer, 409: ProblemSerializer}
_NOT_FOUND = {404: ProblemSerializer}
_PAGE = [
    OpenApiParameter("page", OpenApiTypes.INT, description="Desde 1."),
    OpenApiParameter("page_size", OpenApiTypes.INT, description="1 a 100; omisión 20."),
]
_VALUATION = "inventario.ver_valorizacion"


def _actor(request: Request) -> User:
    if not isinstance(request.user, User):
        raise RuntimeError("La autorización debe resolver un usuario autenticado.")
    return request.user


def _body(request: Request) -> dict[str, Any]:
    data = request.data
    if type(data) is not dict:
        raise InventoryApplicationError("validation_error", "El cuerpo debe ser un objeto JSON.")
    return data


def _query(request: Request, allowed: set[str]) -> dict[str, str]:
    """Parámetros de consulta permitidos; ninguno puede elevar la proyección."""
    unknown = sorted(set(request.query_params) - allowed)
    if unknown:
        raise InventoryApplicationError(
            "unknown_field",
            "La consulta contiene parámetros no admitidos.",
            {name: ["Parámetro no admitido."] for name in unknown},
        )
    return {k: request.query_params[k] for k in request.query_params}


def _int(params: dict[str, str], name: str, default: int | None = None) -> int | None:
    raw = params.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        raise InventoryApplicationError(
            "validation_error", f"Parámetro inválido: {name}.", {name: ["Valor inválido."]}
        ) from None


def _paging(params: dict[str, str]) -> dict[str, int]:
    page = _int(params, "page", 1)
    page_size = _int(params, "page_size", 20)
    return {
        "page": 1 if page is None else page,
        "page_size": 20 if page_size is None else page_size,
    }


def _date(params: dict[str, str], name: str) -> date | None:
    raw = params.get(name)
    if raw is None:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise InventoryApplicationError(
            "validation_error", f"Parámetro inválido: {name}.", {name: ["Use AAAA-MM-DD."]}
        ) from None


def _respond(
    request: Request, call: Callable[[], Response | CommandOutcome | dict[str, Any]]
) -> Response:
    try:
        result = call()
    except InventoryApplicationError as exc:
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
    if isinstance(result, dict):
        return Response(result, status=status.HTTP_200_OK)
    return result


class _InventoryView(APIView):
    permission_classes = (HasBusinessPermission,)


class StockListView(_InventoryView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "inventario.ver"}

    @extend_schema(
        tags=["Inventory"],
        operation_id="inventory_stock_list",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR),
            OpenApiParameter("category_id", OpenApiTypes.INT),
            OpenApiParameter("is_active", OpenApiTypes.STR, enum=["true", "false", "all"]),
            OpenApiParameter("stock", OpenApiTypes.STR, enum=["all", "positive", "zero"]),
            *_PAGE,
        ],
        responses={200: sz.StockPageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
        description="La valoración aparece solo con inventario.ver_valorizacion.",
    )
    def get(self, request: Request) -> Response:
        def call() -> dict[str, Any]:
            params = _query(
                request, {"search", "category_id", "is_active", "stock", "page", "page_size"}
            )
            return queries.list_stock(
                include_valuation=has_permission(_actor(request), _VALUATION),
                search=params.get("search", ""),
                category_id=_int(params, "category_id"),
                active=params.get("is_active"),
                stock=params.get("stock", "all"),
                **_paging(params),
            )

        return _respond(request, call)


class StockQuantitiesView(_InventoryView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "inventario.ver"}

    @extend_schema(
        tags=["Inventory"],
        operation_id="inventory_stock_quantities",
        parameters=[
            OpenApiParameter(
                "product_ids",
                OpenApiTypes.STR,
                required=True,
                description="Identificadores separados por coma; máximo 100.",
            )
        ],
        responses={
            200: sz.StockQuantitiesSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
        },
        description="Solo identificador y cantidad: sin costos, promedio ni valoración.",
    )
    def get(self, request: Request) -> Response:
        def call() -> dict[str, Any]:
            params = _query(request, {"product_ids"})
            raw = params.get("product_ids", "")
            try:
                ids = [int(part) for part in raw.split(",") if part.strip()]
            except ValueError:
                raise InventoryApplicationError(
                    "validation_error",
                    "Parámetro inválido: product_ids.",
                    {"product_ids": ["Use identificadores enteros separados por coma."]},
                ) from None
            if any(pid < 1 for pid in ids):
                raise InventoryApplicationError(
                    "validation_error",
                    "Parámetro inválido: product_ids.",
                    {"product_ids": ["Los identificadores deben ser positivos."]},
                )
            return queries.list_stock_quantities(ids)

        return _respond(request, call)


class StockItemView(_InventoryView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "inventario.ver"}

    @extend_schema(
        tags=["Inventory"],
        operation_id="inventory_stock_retrieve",
        responses={200: sz.StockItemSerializer, 403: ProblemSerializer, **_NOT_FOUND},
    )
    def get(self, request: Request, pk: int) -> Response:
        def call() -> dict[str, Any]:
            _query(request, set())
            return queries.get_stock_item(
                pk, include_valuation=has_permission(_actor(request), _VALUATION)
            )

        return _respond(request, call)


class KardexView(_InventoryView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "inventario.ver"}

    @extend_schema(
        tags=["Inventory"],
        operation_id="inventory_kardex",
        parameters=[
            OpenApiParameter("date_from", OpenApiTypes.DATE),
            OpenApiParameter("date_to", OpenApiTypes.DATE),
            OpenApiParameter("movement_type", OpenApiTypes.STR),
            OpenApiParameter("source_type", OpenApiTypes.STR),
            OpenApiParameter("source_id", OpenApiTypes.INT),
            OpenApiParameter("actor_id", OpenApiTypes.INT),
            OpenApiParameter("cut_token", OpenApiTypes.STR, description="Corte de 30 minutos."),
            *_PAGE,
        ],
        responses={
            200: sz.KardexSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            409: ProblemSerializer,
            **_NOT_FOUND,
        },
    )
    def get(self, request: Request, pk: int) -> Response:
        def call() -> dict[str, Any]:
            params = _query(
                request,
                {
                    "date_from",
                    "date_to",
                    "movement_type",
                    "source_type",
                    "source_id",
                    "actor_id",
                    "cut_token",
                    "page",
                    "page_size",
                },
            )
            return queries.kardex(
                product_id=pk,
                include_valuation=has_permission(_actor(request), _VALUATION),
                date_from=_date(params, "date_from"),
                date_to=_date(params, "date_to"),
                movement_type=params.get("movement_type"),
                source_type=params.get("source_type"),
                source_id=_int(params, "source_id"),
                actor_id=_int(params, "actor_id"),
                cut_token=params.get("cut_token"),
                **_paging(params),
            )

        return _respond(request, call)


class OperationListCreateView(_InventoryView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "inventario.ajustar",
        "POST": "inventario.ajustar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=["Inventory"],
        operation_id="inventory_operation_list",
        parameters=[
            OpenApiParameter("kind", OpenApiTypes.STR),
            OpenApiParameter("state", OpenApiTypes.STR),
            *_PAGE,
        ],
        responses={200: sz.OperationPageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        def call() -> dict[str, Any]:
            params = _query(request, {"kind", "state", "page", "page_size"})
            return operations.list_operations(
                actor=_actor(request),
                kind=params.get("kind"),
                state=params.get("state"),
                **_paging(params),
            )

        return _respond(request, call)

    @extend_schema(
        tags=["Inventory"],
        operation_id="inventory_operation_create",
        request=sz.OperationWriteSerializer,
        responses={201: sz.AdminOperationSerializer, **_PROBLEMS},
    )
    def post(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: operations.create_operation(
                actor=_actor(request), payload=_body(request), request_id=request_id_from(request)
            ),
        )


class OperationDetailView(_InventoryView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "inventario.ver",
        "PATCH": "inventario.ajustar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=["Inventory"],
        operation_id="inventory_operation_retrieve",
        responses={200: sz.OperationProjectionSerializer, 403: ProblemSerializer, **_NOT_FOUND},
        description="Proyección operativa; la económica exige inventario.ver_valorizacion.",
    )
    def get(self, request: Request, pk: int) -> Response:
        def call() -> dict[str, Any]:
            _query(request, set())
            actor = _actor(request)
            return queries.get_operation(
                pk,
                include_valuation=has_permission(actor, _VALUATION),
                can_open_origin=has_permission(actor, "ingresos.ver"),
            )

        return _respond(request, call)

    @extend_schema(
        tags=["Inventory"],
        operation_id="inventory_operation_update",
        request=sz.OperationPatchSerializer,
        responses={200: sz.AdminOperationSerializer, **_NOT_FOUND, **_PROBLEMS},
    )
    def patch(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: operations.update_operation(
                actor=_actor(request),
                operation_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


def _action_view(
    name: str,
    *,
    service: Callable[..., Any],
    request_serializer: type | None,
    response_serializer: type,
    is_command: bool,
    description: str,
) -> type[APIView]:
    class Action(_InventoryView):
        business_permissions: ClassVar[dict[str, str]] = {"POST": "inventario.ajustar"}
        audited_permission_denial_methods: ClassVar[frozenset[str]] = (
            frozenset({"POST"}) if is_command else frozenset()
        )

        @extend_schema(
            tags=["Inventory"],
            operation_id=f"inventory_operation_{name}",
            request=request_serializer,
            responses={200: response_serializer, **_NOT_FOUND, **_PROBLEMS},
            description=description,
        )
        def post(self, request: Request, pk: int) -> Response:
            extra = {"payload": _body(request)} if is_command else {}
            return _respond(
                request,
                lambda: service(
                    actor=_actor(request),
                    operation_id=pk,
                    request_id=request_id_from(request),
                    **extra,
                ),
            )

    Action.__name__ = f"Operation{name.title().replace('_', '')}View"
    return Action


OperationPreviewView = _action_view(
    "preview",
    service=operations.preview_operation,
    request_serializer=None,
    response_serializer=sz.OperationReviewSerializer,
    is_command=False,
    description="Revisión de solo lectura protegida por CSRF; sin recibo ni efectos.",
)
OperationConfirmView = _action_view(
    "confirm",
    service=operations.confirm_operation,
    request_serializer=sz.OperationConfirmSerializer,
    response_serializer=sz.AdminOperationSerializer,
    is_command=True,
    description="Contabiliza una operación preparada.",
)
OperationReversePreviewView = _action_view(
    "reverse_preview",
    service=operations.reverse_preview,
    request_serializer=None,
    response_serializer=sz.OperationReviewSerializer,
    is_command=False,
    description="Rechaza operaciones originadas en compras: use la anulación del ingreso.",
)
OperationReverseView = _action_view(
    "reverse",
    service=operations.reverse_manual_operation,
    request_serializer=sz.OperationReverseSerializer,
    response_serializer=sz.AdminOperationSerializer,
    is_command=True,
    description="Compensa exactamente el último efecto; rechaza operaciones originadas en compras.",
)
