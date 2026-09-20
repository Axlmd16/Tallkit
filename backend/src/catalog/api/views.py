"""Adaptadores HTTP delgados: permisos por método, CSRF de sesión y traducción de errores."""

from collections.abc import Callable
from typing import Any, ClassVar

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.api import serializers as sz
from catalog.application import auxiliaries, products, queries, services
from catalog.application.commands import CommandOutcome, IdempotencyConflictError
from catalog.application.errors import CatalogApplicationError
from config.api.errors import ProblemSerializer, application_error_response, problem_response
from identity.api.permissions import HasBusinessPermission
from identity.api.request_context import request_id_from
from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import User

_PROBLEMS = {400: ProblemSerializer, 403: ProblemSerializer, 409: ProblemSerializer}
_LIST_PARAMS = [
    OpenApiParameter("search", OpenApiTypes.STR, description="Búsqueda parcial."),
    OpenApiParameter(
        "is_active", OpenApiTypes.STR, enum=["true", "false", "all"], description="Omisión: true."
    ),
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
        raise CatalogApplicationError("validation_error", "El cuerpo debe ser un objeto JSON.")
    return data


def _query(request: Request) -> dict[str, Any]:
    return {k: request.query_params.get(k) for k in request.query_params}


def _respond(request: Request, call: Callable[[], Response | CommandOutcome]) -> Response:
    try:
        result = call()
    except CatalogApplicationError as exc:
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


class _CatalogView(APIView):
    permission_classes = (HasBusinessPermission,)


def _page(page: queries.Page) -> Response:
    return Response(page.as_dict(), status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Auxiliares: categorías, unidades y marcas de producto
# ---------------------------------------------------------------------------

_AUX_DOCS: dict[str, tuple[str, type, type, type, type]] = {
    "category": (
        "Product categories",
        sz.CategorySerializer,
        sz.CategoryPageSerializer,
        sz.CategoryWriteSerializer,
        sz.CategoryPatchSerializer,
    ),
    "unit": (
        "Measurement units",
        sz.UnitSerializer,
        sz.UnitPageSerializer,
        sz.UnitWriteSerializer,
        sz.UnitPatchSerializer,
    ),
    "brand": (
        "Product brands",
        sz.BrandSerializer,
        sz.BrandPageSerializer,
        sz.BrandWriteSerializer,
        sz.BrandPatchSerializer,
    ),
}


def _aux_views(kind: str) -> tuple[type[APIView], type[APIView], type[APIView], type[APIView]]:
    tag, record, page_sz, write_sz, patch_sz = _AUX_DOCS[kind]

    class ListCreate(_CatalogView):
        business_permissions: ClassVar[dict[str, str]] = {
            "GET": "productos.ver",
            "POST": "productos.gestionar",
        }
        audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

        @extend_schema(
            tags=[tag],
            operation_id=f"catalog_{kind}_list",
            parameters=_LIST_PARAMS,
            responses={200: page_sz, 403: ProblemSerializer},
        )
        def get(self, request: Request) -> Response:
            return _respond(request, lambda: _page(queries.list_auxiliaries(kind, _query(request))))

        @extend_schema(
            tags=[tag],
            operation_id=f"catalog_{kind}_create",
            request=write_sz,
            responses={201: record, **_PROBLEMS},
        )
        def post(self, request: Request) -> Response:
            return _respond(
                request,
                lambda: auxiliaries.create_auxiliary(
                    kind,
                    actor=_actor(request),
                    payload=_body(request),
                    request_id=request_id_from(request),
                ),
            )

    class Detail(_CatalogView):
        business_permissions: ClassVar[dict[str, str]] = {
            "GET": "productos.ver",
            "PATCH": "productos.gestionar",
        }
        audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

        @extend_schema(
            tags=[tag],
            operation_id=f"catalog_{kind}_retrieve",
            responses={200: record, 403: ProblemSerializer, 404: ProblemSerializer},
        )
        def get(self, request: Request, pk: int) -> Response:
            return _respond(request, lambda: Response(queries.get_auxiliary(kind, pk)))

        @extend_schema(
            tags=[tag],
            operation_id=f"catalog_{kind}_update",
            request=patch_sz,
            responses={200: record, 404: ProblemSerializer, **_PROBLEMS},
        )
        def patch(self, request: Request, pk: int) -> Response:
            return _respond(
                request,
                lambda: auxiliaries.update_auxiliary(
                    kind,
                    pk,
                    actor=_actor(request),
                    payload=_body(request),
                    request_id=request_id_from(request),
                ),
            )

    def state_view(active: bool) -> type[APIView]:
        verb = "activate" if active else "deactivate"

        class State(_CatalogView):
            business_permissions: ClassVar[dict[str, str]] = {"POST": "productos.gestionar"}
            audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

            @extend_schema(
                tags=[tag],
                operation_id=f"catalog_{kind}_{verb}",
                request=sz.StateCommandSerializer,
                responses={200: record, 404: ProblemSerializer, **_PROBLEMS},
            )
            def post(self, request: Request, pk: int) -> Response:
                return _respond(
                    request,
                    lambda: auxiliaries.set_auxiliary_active(
                        kind,
                        pk,
                        active=active,
                        actor=_actor(request),
                        payload=_body(request),
                        request_id=request_id_from(request),
                    ),
                )

        State.__name__ = f"{kind.title()}{verb.title()}View"
        return State

    ListCreate.__name__ = f"{kind.title()}ListCreateView"
    Detail.__name__ = f"{kind.title()}DetailView"
    return ListCreate, Detail, state_view(True), state_view(False)


CategoryListCreateView, CategoryDetailView, CategoryActivateView, CategoryDeactivateView = (
    _aux_views("category")
)
UnitListCreateView, UnitDetailView, UnitActivateView, UnitDeactivateView = _aux_views("unit")
BrandListCreateView, BrandDetailView, BrandActivateView, BrandDeactivateView = _aux_views("brand")


# ---------------------------------------------------------------------------
# Productos
# ---------------------------------------------------------------------------

_PRODUCT_TAG = "Products"


class ProductListCreateView(_CatalogView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "productos.ver",
        "POST": "productos.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_PRODUCT_TAG],
        operation_id="catalog_product_list",
        parameters=[
            *_LIST_PARAMS,
            OpenApiParameter("category_id", OpenApiTypes.INT),
            OpenApiParameter("product_brand_id", OpenApiTypes.INT),
            OpenApiParameter("vehicle_brand_id", OpenApiTypes.INT),
        ],
        responses={200: sz.ProductPageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        return _respond(request, lambda: _page(queries.list_products(_query(request))))

    @extend_schema(
        tags=[_PRODUCT_TAG],
        operation_id="catalog_product_create",
        request=sz.ProductWriteSerializer,
        responses={201: sz.ProductSerializer, **_PROBLEMS},
    )
    def post(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: products.create_product(
                actor=_actor(request), payload=_body(request), request_id=request_id_from(request)
            ),
        )


class ProductDetailView(_CatalogView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "productos.ver",
        "PATCH": "productos.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=[_PRODUCT_TAG],
        operation_id="catalog_product_retrieve",
        responses={200: sz.ProductSerializer, 403: ProblemSerializer, 404: ProblemSerializer},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(request, lambda: Response(queries.get_product(pk)))

    @extend_schema(
        tags=[_PRODUCT_TAG],
        operation_id="catalog_product_update",
        request=sz.ProductPatchSerializer,
        responses={200: sz.ProductSerializer, 404: ProblemSerializer, **_PROBLEMS},
    )
    def patch(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: products.update_product(
                pk,
                actor=_actor(request),
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


def _product_state(active: bool) -> type[APIView]:
    verb = "activate" if active else "deactivate"

    class State(_CatalogView):
        business_permissions: ClassVar[dict[str, str]] = {"POST": "productos.desactivar"}
        audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

        @extend_schema(
            tags=[_PRODUCT_TAG],
            operation_id=f"catalog_product_{verb}",
            request=sz.StateCommandSerializer,
            responses={200: sz.ProductSerializer, 404: ProblemSerializer, **_PROBLEMS},
        )
        def post(self, request: Request, pk: int) -> Response:
            return _respond(
                request,
                lambda: products.set_product_active(
                    pk,
                    active=active,
                    actor=_actor(request),
                    payload=_body(request),
                    request_id=request_id_from(request),
                ),
            )

    State.__name__ = f"Product{verb.title()}View"
    return State


ProductActivateView = _product_state(True)
ProductDeactivateView = _product_state(False)


class ProductTaxOptionsView(_CatalogView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "productos.gestionar"}

    @extend_schema(
        tags=[_PRODUCT_TAG],
        operation_id="catalog_product_tax_options",
        parameters=[_LIST_PARAMS[0], _LIST_PARAMS[2], _LIST_PARAMS[3]],
        responses={200: sz.TaxOptionPageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
        description="Opciones tributarias del ámbito COMERCIAL; el ámbito no es configurable.",
    )
    def get(self, request: Request) -> Response:
        return _respond(
            request, lambda: _page(queries.list_tax_options("COMERCIAL", _query(request)))
        )


# ---------------------------------------------------------------------------
# Servicios
# ---------------------------------------------------------------------------

_SERVICE_TAG = "Services"


class ServiceListCreateView(_CatalogView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "servicios.ver",
        "POST": "servicios.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=[_SERVICE_TAG],
        operation_id="catalog_service_list",
        parameters=_LIST_PARAMS,
        responses={200: sz.ServicePageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        return _respond(request, lambda: _page(queries.list_services(_query(request))))

    @extend_schema(
        tags=[_SERVICE_TAG],
        operation_id="catalog_service_create",
        request=sz.ServiceWriteSerializer,
        responses={201: sz.ServiceSerializer, **_PROBLEMS},
    )
    def post(self, request: Request) -> Response:
        return _respond(
            request,
            lambda: services.create_service(
                actor=_actor(request), payload=_body(request), request_id=request_id_from(request)
            ),
        )


class ServiceDetailView(_CatalogView):
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "servicios.ver",
        "PATCH": "servicios.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=[_SERVICE_TAG],
        operation_id="catalog_service_retrieve",
        responses={200: sz.ServiceSerializer, 403: ProblemSerializer, 404: ProblemSerializer},
    )
    def get(self, request: Request, pk: int) -> Response:
        return _respond(request, lambda: Response(queries.get_service(pk)))

    @extend_schema(
        tags=[_SERVICE_TAG],
        operation_id="catalog_service_update",
        request=sz.ServicePatchSerializer,
        responses={200: sz.ServiceSerializer, 404: ProblemSerializer, **_PROBLEMS},
    )
    def patch(self, request: Request, pk: int) -> Response:
        return _respond(
            request,
            lambda: services.update_service(
                pk,
                actor=_actor(request),
                payload=_body(request),
                request_id=request_id_from(request),
            ),
        )


def _service_state(active: bool) -> type[APIView]:
    verb = "activate" if active else "deactivate"

    class State(_CatalogView):
        business_permissions: ClassVar[dict[str, str]] = {"POST": "servicios.gestionar"}
        audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

        @extend_schema(
            tags=[_SERVICE_TAG],
            operation_id=f"catalog_service_{verb}",
            request=sz.StateCommandSerializer,
            responses={200: sz.ServiceSerializer, 404: ProblemSerializer, **_PROBLEMS},
        )
        def post(self, request: Request, pk: int) -> Response:
            return _respond(
                request,
                lambda: services.set_service_active(
                    pk,
                    active=active,
                    actor=_actor(request),
                    payload=_body(request),
                    request_id=request_id_from(request),
                ),
            )

    State.__name__ = f"Service{verb.title()}View"
    return State


ServiceActivateView = _service_state(True)
ServiceDeactivateView = _service_state(False)


class ServiceTaxOptionsView(_CatalogView):
    business_permissions: ClassVar[dict[str, str]] = {"GET": "servicios.gestionar"}

    @extend_schema(
        tags=[_SERVICE_TAG],
        operation_id="catalog_service_tax_options",
        parameters=[_LIST_PARAMS[0], _LIST_PARAMS[2], _LIST_PARAMS[3]],
        responses={200: sz.TaxOptionPageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
        description="Opciones tributarias del ámbito ARTESANAL; el ámbito no es configurable.",
    )
    def get(self, request: Request) -> Response:
        return _respond(
            request, lambda: _page(queries.list_tax_options("ARTESANAL", _query(request)))
        )
