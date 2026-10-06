"""Adaptadores HTTP delgados de proformas: permisos por método, CSRF de sesión y errores.

No calculan importes, estados ni permisos definitivos; traducen contratos y errores. Los
servicios de aplicación vuelven a autorizar cada acción, también al repetir una solicitud.
"""

from collections.abc import Callable
from typing import Any, ClassVar

from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from config.api.errors import ProblemSerializer, application_error_response, problem_response
from identity.api.permissions import HasBusinessPermission
from identity.api.request_context import request_id_from
from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import User
from proformas.api import serializers as sz
from proformas.application import conversion, drafts, issuing, options, queries, reviews
from proformas.application.commands import CommandOutcome
from proformas.application.errors import ProformaApplicationError
from shared.transactions import RetryableConflictError

_PROBLEMS = {400: ProblemSerializer, 403: ProblemSerializer, 409: ProblemSerializer}
_NOT_FOUND = {404: ProblemSerializer}
_TAG = "Proformas"
_PAGE_PARAMS = [
    OpenApiParameter("page", OpenApiTypes.INT, description="Desde 1; omisión 1."),
    OpenApiParameter("page_size", OpenApiTypes.INT, description="1 a 100; omisión 20."),
]
_SEARCH = OpenApiParameter(
    "search", OpenApiTypes.STR, description="Número de proforma, nombre o identificación."
)
_LOGO_HEADERS = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
}
_CONFLICT_EXAMPLES = [
    OpenApiExample(
        "Oferta ya convertida",
        value={
            "type": "about:blank",
            "title": "Proforma ya convertida",
            "status": 409,
            "detail": "La proforma ya fue convertida en venta.",
            "code": "proforma_converted",
            "request_id": None,
            "conflict": {"type": "sale", "id": 42},
            "details": {"sale": {"id": 42, "internal_number": None, "state": "DRAFT"}},
        },
        response_only=True,
        status_codes=["409"],
    ),
    OpenApiExample(
        "Revisión cambiada o vencida",
        value={
            "type": "about:blank",
            "title": "Revisión requerida",
            "status": 409,
            "detail": "Los valores o datos relevantes cambiaron desde la revisión.",
            "code": "review_required",
            "request_id": None,
        },
        response_only=True,
        status_codes=["409"],
    ),
    OpenApiExample(
        "Versión obsoleta",
        value={
            "type": "about:blank",
            "title": "Registro desactualizado",
            "status": 409,
            "detail": "La proforma cambió desde que la consultó.",
            "code": "stale_record",
            "request_id": None,
            "errors": {"expected_version": ["La versión esperada no coincide con la vigente."]},
        },
        response_only=True,
        status_codes=["409"],
    ),
    OpenApiExample(
        "Oferta vencida",
        value={
            "type": "about:blank",
            "title": "Proforma vencida",
            "status": 409,
            "detail": "La proforma está vencida; cree una nueva vinculada con valores actuales.",
            "code": "proforma_expired",
            "request_id": None,
        },
        response_only=True,
        status_codes=["409"],
    ),
]
_DRAFT_EXAMPLE = OpenApiExample(
    "Borrador con vigencia predeterminada",
    value={
        "idempotency_key": "proforma-2026-000001",
        "customer_id": 7,
        "lines": [{"product_id": 12, "quantity": "2"}],
    },
    request_only=True,
)


def _actor(request: Request) -> User:
    if not isinstance(request.user, User):
        raise RuntimeError("La autorización debe resolver un usuario autenticado.")
    return request.user


def _body(request: Request) -> dict[str, Any]:
    data = request.data
    if type(data) is not dict:
        raise ProformaApplicationError("validation_error", "El cuerpo debe ser un objeto JSON.")
    return data


def _int(
    request: Request, name: str, default: int | None = None, *, minimum: int = 0
) -> int | None:
    raw = request.query_params.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        value = minimum - 1
    if value < minimum:
        raise ProformaApplicationError(
            "validation_error", f"Parámetro inválido: {name}.", {name: ["Valor inválido."]}
        )
    return value


def _page_args(request: Request) -> dict[str, int]:
    return {
        "page": _int(request, "page", 1, minimum=1) or 1,
        "page_size": _int(request, "page_size", 20, minimum=1) or 20,
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


def _respond(
    request: Request, call: Callable[[], Response | HttpResponse | CommandOutcome | dict[str, Any]]
) -> Response | HttpResponse:
    try:
        result = call()
    except ProformaApplicationError as exc:
        sale = (exc.conflict or {}).get("sale")
        return application_error_response(
            request=request,
            code=exc.code,
            message=exc.message,
            errors=exc.errors,
            conflict={"type": "sale", "id": sale["id"]} if sale else None,
            details=exc.conflict,
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


class _ProformaView(APIView):
    permission_classes = (HasBusinessPermission,)


class ProformaListCreateView(_ProformaView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "proformas.ver",
        "POST": "proformas.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_proforma_list",
        parameters=[
            _SEARCH,
            OpenApiParameter("state", OpenApiTypes.STR, enum=sz.STATES),
            OpenApiParameter("customer_id", OpenApiTypes.INT),
            *_PAGE_PARAMS,
        ],
        responses={200: sz.ProformaPageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
        description="El filtro `state` usa el estado efectivo del mismo día local que el detalle.",
    )
    def get(self, request: Request) -> Response | HttpResponse:
        return _respond(
            request,
            lambda: _envelope(
                queries.list_proformas(
                    actor=_actor(request),
                    search=request.query_params.get("search", ""),
                    state=request.query_params.get("state"),
                    customer_id=_int(request, "customer_id", minimum=1),
                    request_id=request_id_from(request),
                    **_page_args(request),
                )
            ),
        )

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_proforma_create",
        request=sz.ProformaWriteSerializer,
        responses={201: sz.ProformaSerializer, **_PROBLEMS},
        examples=[_DRAFT_EXAMPLE],
        description=(
            "Crea un borrador sin número, reserva ni saldo. El precio, impuesto y total los "
            "determina el servidor: cualquier campo de precio, descuento, impuesto, total, "
            "condición de venta o servicio se rechaza con `unknown_field`."
        ),
    )
    def post(self, request: Request) -> Response | HttpResponse:
        return _respond(
            request,
            lambda: drafts.create_draft(
                actor=_actor(request), payload=_body(request), request_id=request_id_from(request)
            ),
        )


class ProformaDetailView(_ProformaView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "proformas.ver",
        "PATCH": "proformas.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_proforma_retrieve",
        responses={200: sz.ProformaSerializer, 403: ProblemSerializer, **_NOT_FOUND},
    )
    def get(self, request: Request, pk: int) -> Response | HttpResponse:
        return _respond(
            request,
            lambda: queries.get_proforma(
                actor=_actor(request), proforma_id=pk, request_id=request_id_from(request)
            ),
        )

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_proforma_update",
        request=sz.ProformaPatchSerializer,
        responses={200: sz.ProformaSerializer, **_NOT_FOUND, **_PROBLEMS},
        examples=_CONFLICT_EXAMPLES,
        description="Solo un borrador se edita; una oferta emitida responde `proforma_issued`.",
    )
    def patch(self, request: Request, pk: int) -> Response | HttpResponse:
        return _respond(
            request,
            lambda: drafts.update_draft(
                actor=_actor(request),
                proforma_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class DraftPreviewView(_ProformaView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "proformas.gestionar"}

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_draft_preview",
        request=sz.DraftPreviewSerializer,
        responses={200: sz.DraftPreviewResultSerializer, **_PROBLEMS},
        description="Cálculo de la captura sin persistir: no guarda borrador, recibo ni número.",
    )
    def post(self, request: Request) -> Response | HttpResponse:
        return _respond(
            request,
            lambda: reviews.preview_draft(
                actor=_actor(request), payload=_body(request), request_id=request_id_from(request)
            ),
        )


class IssuePreviewView(_ProformaView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "proformas.gestionar"}

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_issue_preview",
        responses={200: sz.IssuePreviewSerializer, 403: ProblemSerializer, **_NOT_FOUND},
        description=(
            "Revisión sin efectos: valores vigentes, impedimentos, avisos de disponibilidad y "
            "token firmado de 15 minutos. La disponibilidad insuficiente es un aviso."
        ),
    )
    def get(self, request: Request, pk: int) -> Response | HttpResponse:
        return _respond(
            request,
            lambda: reviews.preview_issue(
                actor=_actor(request), proforma_id=pk, request_id=request_id_from(request)
            ),
        )


class _CommandView(_ProformaView):
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})


class IssueView(_CommandView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "proformas.gestionar"}

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_proforma_issue",
        request=sz.ReviewedCommandSerializer,
        responses={200: sz.ProformaSerializer, **_NOT_FOUND, **_PROBLEMS},
        examples=_CONFLICT_EXAMPLES,
        description=(
            "Emite con número de la serie comercial de proformas. Repetir la emisión del mismo "
            "documento con su revisión original recupera el resultado sin otro número."
        ),
    )
    def post(self, request: Request, pk: int) -> Response | HttpResponse:
        return _respond(
            request,
            lambda: issuing.issue_proforma(
                actor=_actor(request),
                proforma_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class VoidView(_CommandView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "proformas.anular"}

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_proforma_void",
        request=sz.VersionedCommandSerializer,
        responses={200: sz.ProformaSerializer, **_NOT_FOUND, **_PROBLEMS},
        examples=_CONFLICT_EXAMPLES,
        description="Anula una oferta no convertida; conserva número, contenido e historia.",
    )
    def post(self, request: Request, pk: int) -> Response | HttpResponse:
        return _respond(
            request,
            lambda: issuing.void_proforma(
                actor=_actor(request),
                proforma_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class CopyView(_CommandView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "proformas.gestionar"}

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_proforma_copy",
        request=sz.CommandFields,
        responses={201: sz.ProformaSerializer, **_NOT_FOUND, **_PROBLEMS},
        description="Crea un borrador nuevo vinculado al original, que no se reactiva.",
    )
    def post(self, request: Request, pk: int) -> Response | HttpResponse:
        return _respond(
            request,
            lambda: drafts.copy_proforma(
                actor=_actor(request),
                proforma_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class ConversionPreviewView(_ProformaView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "proformas.convertir"}

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_conversion_preview",
        responses={200: sz.ConversionPreviewSerializer, 403: ProblemSerializer, **_NOT_FOUND},
        description="Diferencias actuales respecto de lo cotizado; no crea venta ni recibo.",
    )
    def get(self, request: Request, pk: int) -> Response | HttpResponse:
        return _respond(
            request,
            lambda: conversion.preview_conversion(
                actor=_actor(request), proforma_id=pk, request_id=request_id_from(request)
            ),
        )


class ConvertView(_CommandView):
    business_permissions: ClassVar[dict[str, str]] = {"POST": "proformas.convertir"}

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_proforma_convert",
        request=sz.ReviewedCommandSerializer,
        responses={200: sz.ProformaSerializer, **_NOT_FOUND, **_PROBLEMS},
        examples=_CONFLICT_EXAMPLES,
        description=(
            "Crea una única venta en borrador y marca la oferta convertida, atómicamente. Exige "
            "también permiso para crear ventas. Un intento nuevo sobre una oferta convertida "
            "responde `proforma_converted` con la venta existente."
        ),
    )
    def post(self, request: Request, pk: int) -> Response | HttpResponse:
        return _respond(
            request,
            lambda: conversion.convert_proforma(
                actor=_actor(request),
                proforma_id=pk,
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


class DocumentView(_ProformaView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "proformas.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_document_retrieve",
        responses={
            200: sz.DocumentSerializer,
            403: ProblemSerializer,
            409: ProblemSerializer,
            **_NOT_FOUND,
        },
        description="Datos históricos de la cotización; no genera PDF en el servidor.",
    )
    def get(self, request: Request, pk: int) -> Response | HttpResponse:
        return _respond(
            request,
            lambda: queries.document(
                actor=_actor(request), proforma_id=pk, request_id=request_id_from(request)
            ),
        )


class DocumentLogoView(_ProformaView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "proformas.ver"}

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_document_logo",
        responses={
            (200, "image/*"): OpenApiTypes.BINARY,
            204: None,
            403: ProblemSerializer,
            409: ProblemSerializer,
            **_NOT_FOUND,
        },
        description=(
            "Bytes del logo conservado al emitir; `204` si la oferta se emitió sin logo. Nunca "
            "sirve el logo vigente de la configuración."
        ),
    )
    def get(self, request: Request, pk: int) -> Response | HttpResponse:
        def call() -> Response | HttpResponse:
            logo = queries.document_logo(
                actor=_actor(request), proforma_id=pk, request_id=request_id_from(request)
            )
            if logo is None:
                return Response(status=status.HTTP_204_NO_CONTENT)
            content, mime_type = logo
            response = HttpResponse(content, content_type=mime_type)
            for header, value in _LOGO_HEADERS.items():
                response[header] = value
            return response

        return _respond(request, call)


class CustomerOptionsView(_ProformaView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "proformas.gestionar"}

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_customer_options",
        parameters=[_SEARCH, *_PAGE_PARAMS],
        responses={
            200: sz.CustomerOptionPageSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
        },
    )
    def get(self, request: Request) -> Response | HttpResponse:
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


class ProductOptionsView(_ProformaView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "proformas.gestionar"}

    @extend_schema(
        tags=[_TAG],
        operation_id="proformas_product_options",
        parameters=[_SEARCH, *_PAGE_PARAMS],
        responses={
            200: sz.ProductOptionPageSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
        },
        description="Productos activos con precio final y disponibilidad informativa; sin costos.",
    )
    def get(self, request: Request) -> Response | HttpResponse:
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
