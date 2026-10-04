"""Adaptadores HTTP delgados de compras: permisos por método, CSRF de sesión y errores."""

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
from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import User
from purchasing.api import serializers as sz
from purchasing.application import entries, purchases, queries
from purchasing.application.commands import CommandOutcome, IdempotencyConflictError
from purchasing.application.errors import PurchaseApplicationError
from shared.transactions import RetryableConflictError

_PROBLEMS = {400: ProblemSerializer, 403: ProblemSerializer, 409: ProblemSerializer}
_TAG = "Purchases"
_STATES = ("DRAFT", "CONFIRMED", "VOIDED")
_LIST_PARAMS = [
    OpenApiParameter(
        "search", OpenApiTypes.STR, description="Número interno, referencia o proveedor."
    ),
    OpenApiParameter("supplier_id", OpenApiTypes.INT),
    OpenApiParameter("state", OpenApiTypes.STR, enum=list(_STATES)),
    OpenApiParameter("registered_by", OpenApiTypes.INT, description="Usuario que registró."),
    OpenApiParameter("date_from", OpenApiTypes.DATE, description="Día de confirmación inicial."),
    OpenApiParameter("date_to", OpenApiTypes.DATE, description="Día de confirmación final."),
    OpenApiParameter("page", OpenApiTypes.INT, description="Desde 1."),
    OpenApiParameter("page_size", OpenApiTypes.INT, description="1 a 100; omisión 20."),
]


def _actor(request: Request) -> User:
    if not isinstance(request.user, User):
        raise RuntimeError("La autorización debe resolver un usuario autenticado.")
    return request.user


def _body(request: Request) -> dict[str, Any]:
    data = request.data
    if type(data) is not dict:
        raise PurchaseApplicationError("validation_error", "El cuerpo debe ser un objeto JSON.")
    return data


def _int(
    request: Request, name: str, default: int | None = None, *, minimum: int = 1
) -> int | None:
    raw = request.query_params.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        value = minimum - 1
    if value < minimum:
        raise PurchaseApplicationError(
            "validation_error", f"Parámetro inválido: {name}.", {name: ["Valor inválido."]}
        )
    return value


def _date(request: Request, name: str, *, required: bool = False) -> date | None:
    raw = request.query_params.get(name)
    if raw is None:
        if required:
            raise PurchaseApplicationError(
                "validation_error",
                f"{name} es obligatorio.",
                {name: ["Este campo es obligatorio."]},
            )
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise PurchaseApplicationError(
            "validation_error", f"Parámetro inválido: {name}.", {name: ["Use AAAA-MM-DD."]}
        ) from None


def _page_args(request: Request) -> dict[str, int]:
    page_size = _int(request, "page_size", 20) or 20
    if page_size > 100:
        raise PurchaseApplicationError(
            "validation_error", "Parámetro inválido: page_size.", {"page_size": ["Máximo 100."]}
        )
    return {"page": _int(request, "page", 1) or 1, "page_size": page_size}


def _respond(
    request: Request, call: Callable[[], Response | CommandOutcome | dict[str, Any]]
) -> Response:
    try:
        result = call()
    except PurchaseApplicationError as exc:
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


class _PurchaseView(APIView):
    permission_classes = (HasBusinessPermission,)


class PurchaseListView(_PurchaseView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "ingresos.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="purchasing_purchase_list",
        parameters=_LIST_PARAMS,
        responses={200: sz.PurchasePageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
        description="Entradas y compras anteriores; sin costos para quien no los puede ver.",
    )
    def get(self, request: Request) -> Response:
        def call() -> dict[str, Any]:
            state = request.query_params.get("state")
            if state is not None and state not in _STATES:
                raise PurchaseApplicationError(
                    "validation_error",
                    "Estado inválido.",
                    {"state": ["Use DRAFT, CONFIRMED o VOIDED."]},
                )
            return queries.list_purchases(
                actor=_actor(request),
                search=request.query_params.get("search", ""),
                supplier_id=_int(request, "supplier_id"),
                state=state,
                date_from=_date(request, "date_from"),
                date_to=_date(request, "date_to"),
                registered_by=_int(request, "registered_by"),
                **_page_args(request),
            )

        return _respond(request, call)


class EntryCreateView(_PurchaseView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "ingresos.crear"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="purchasing_entry_create",
        request=sz.EntryWriteSerializer,
        responses={201: sz.PurchaseSerializer, **_PROBLEMS},
        description=(
            "Registra y confirma la entrada en una sola acción. Proveedor, referencia y costo "
            "son opcionales; fecha, impuestos y totales no se aceptan. Una entrada igual de "
            "hoy exige reconocerla en acknowledged_entry_ids (409 possible_duplicate)."
        ),
    )
    def post(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: entries.register_entry(
                actor=_actor(request), payload=_body(request), request_id=request_id_from(request)
            ),
        )


class EntryReviewView(_PurchaseView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "ingresos.crear"}

    @extend_schema(
        tags=[_TAG],
        operation_id="purchasing_entry_review",
        request=sz.EntryReviewWriteSerializer,
        responses={200: sz.EntryReviewSerializer, **_PROBLEMS},
        description="Revisión de solo lectura: no guarda, no numera y no devuelve costos.",
    )
    def post(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: entries.review_entry(
                actor=_actor(request), payload=_body(request), request_id=request_id_from(request)
            ),
        )


class PurchaseDetailView(_PurchaseView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "ingresos.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="purchasing_purchase_retrieve",
        responses={200: sz.PurchaseSerializer, 403: ProblemSerializer, 404: ProblemSerializer},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(
            request, lambda: queries.get_purchase(actor=_actor(request), purchase_id=pk)
        )


class PurchaseVoidPreviewView(_PurchaseView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "ingresos.anular"}

    @extend_schema(
        tags=[_TAG],
        operation_id="purchasing_purchase_void_preview",
        request=None,
        responses={200: sz.VoidReviewSerializer, 404: ProblemSerializer, 403: ProblemSerializer},
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: purchases.void_preview(
                actor=_actor(request), purchase_id=pk, request_id=request_id_from(request)
            ),
        )


class PurchaseVoidView(_PurchaseView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "ingresos.anular"}
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="purchasing_purchase_void",
        request=sz.VoidSerializer,
        responses={200: sz.PurchaseSerializer, 404: ProblemSerializer, **_PROBLEMS},
    )
    def post(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: purchases.void_purchase(
                actor=_actor(request),
                purchase_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )
