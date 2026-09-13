import contextlib
from typing import Any, ClassVar

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from config.api.errors import ProblemSerializer, problem_response
from customer_registry.api.serializers import (
    CustomerCreateSerializer,
    CustomerMatchQuerySerializer,
    CustomerPageSerializer,
    CustomerReadSerializer,
    CustomerStateSerializer,
    CustomerUpdateSerializer,
    OwnershipPeriodPageSerializer,
    VehicleBrandCreateSerializer,
    VehicleBrandPageSerializer,
    VehicleBrandReadSerializer,
    VehicleBrandStateSerializer,
    VehicleBrandUpdateSerializer,
    VehicleChangeOwnerSerializer,
    VehicleCreateSerializer,
    VehiclePageSerializer,
    VehicleReadSerializer,
    VehicleStateSerializer,
    VehicleUpdateSerializer,
)
from customer_registry.application.brands import (
    BrandNotFoundError,
    BrandValidationError,
    StaleBrandRecordError,
    activate_brand,
    create_brand,
    deactivate_brand,
    get_brand,
    search_brands,
    update_brand,
)
from customer_registry.application.customers import (
    CustomerNotFoundError,
    DuplicateCustomerError,
    StaleCustomerRecordError,
    activate_customer,
    create_customer,
    deactivate_customer,
    update_customer,
)
from customer_registry.application.queries import (
    CustomerSummary,
    find_matching_customers,
    get_customer,
    search_customers,
)
from customer_registry.application.vehicles import (
    DuplicatePlateError,
    DuplicateVinError,
    InactiveReferenceError,
    StaleVehicleRecordError,
    VehicleApplicationError,
    VehicleNotFoundError,
    activate_vehicle,
    create_vehicle,
    deactivate_vehicle,
    get_customer_vehicles,
    get_vehicle,
    get_vehicle_ownership_periods,
    search_vehicles,
    transfer_vehicle_ownership,
    update_vehicle,
)
from customer_registry.domain.validation import CustomerValidationError, VehicleValidationError
from customer_registry.models import Customer, OwnershipPeriod, Vehicle, VehicleBrand
from identity.api.permissions import HasBusinessPermission
from identity.api.request_context import request_id_from
from identity.application.authorization import has_permission
from identity.models import User


def _actor(request: Request) -> User:
    if not isinstance(request.user, User):
        raise RuntimeError("La autorización debe resolver un usuario autenticado.")
    return request.user


def _serialize_customer(customer: Customer | CustomerSummary) -> dict[str, object]:
    return {
        "id": customer.id,
        "person_type": customer.person_type,
        "name": customer.name,
        "identification_type": customer.identification_type,
        "identification": customer.identification,
        "phone": customer.phone,
        "email": customer.email,
        "address": customer.address,
        "is_active": customer.is_active,
        "version": customer.version,
        "created_at": customer.created_at.isoformat(),
        "updated_at": customer.updated_at.isoformat(),
    }


class CustomerListCreateView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "clientes.ver",
        "POST": "clientes.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=["Customers"],
        summary="Buscar y listar clientes",
        parameters=[
            OpenApiParameter(
                "search",
                OpenApiTypes.STR,
                description="Término de búsqueda parcial (nombre, identificación, teléfono)",
            ),
            OpenApiParameter(
                "is_active",
                OpenApiTypes.BOOL,
                description="Filtrar por estado activo",
            ),
            OpenApiParameter("page", OpenApiTypes.INT, description="Número de página"),
            OpenApiParameter("page_size", OpenApiTypes.INT, description="Tamaño de página"),
        ],
        responses={
            200: CustomerPageSerializer,
            403: ProblemSerializer,
        },
    )
    def get(self, request: Request) -> Response:
        actor = _actor(request)
        search_term = request.query_params.get("search") or request.query_params.get("query", "")
        raw_is_active = request.query_params.get("is_active")
        is_active: bool | None = None
        if raw_is_active is not None:
            if raw_is_active.strip().lower() in ("true", "1"):
                is_active = True
            elif raw_is_active.strip().lower() in ("false", "0"):
                is_active = False

        try:
            page = int(request.query_params.get("page", 1))
            page_size = int(request.query_params.get("page_size", 20))
        except ValueError:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Parámetros inválidos",
                code="invalid_parameters",
                detail="Los parámetros de paginación deben ser números enteros.",
            )

        try:
            page_data = search_customers(
                actor=actor,
                query=search_term,
                is_active=is_active,
                page=page,
                page_size=page_size,
            )
        except ValueError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Parámetros inválidos",
                code="invalid_parameters",
                detail=str(exc),
            )

        return Response(
            {
                "count": page_data.total,
                "page": page_data.page,
                "page_size": page_data.page_size,
                "total_pages": page_data.total_pages,
                "results": [_serialize_customer(item) for item in page_data.items],
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Customers"],
        summary="Registrar cliente",
        request=CustomerCreateSerializer,
        responses={
            201: CustomerReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def post(self, request: Request) -> Response:
        actor = _actor(request)
        serializer = CustomerCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        try:
            customer = create_customer(
                actor=actor,
                data=serializer.validated_data,
                request_id=request_id_from(request),
            )
        except DuplicateCustomerError as exc:
            conflict: dict[str, object] | None = None
            if has_permission(actor, "clientes.ver"):
                conflict = {"type": "customer", "id": exc.customer_id}
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Identificación duplicada",
                code="duplicate_identification",
                detail=str(exc),
                conflict=conflict,
            )
        except CustomerValidationError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors=exc.errors,
            )

        return Response(_serialize_customer(customer), status=status.HTTP_201_CREATED)


class CustomerDetailView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "clientes.ver",
        "PATCH": "clientes.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=["Customers"],
        summary="Obtener ficha de cliente",
        responses={
            200: CustomerReadSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
        },
    )
    def get(self, request: Request, customer_id: int) -> Response:
        actor = _actor(request)
        try:
            customer = get_customer(actor=actor, customer_id=customer_id)
        except CustomerNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Cliente no encontrado",
                code="customer_not_found",
                detail=f"No existe el cliente con ID {customer_id}.",
            )
        return Response(_serialize_customer(customer), status=status.HTTP_200_OK)

    @extend_schema(
        tags=["Customers"],
        summary="Editar ficha de cliente",
        request=CustomerUpdateSerializer,
        responses={
            200: CustomerReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def patch(self, request: Request, customer_id: int) -> Response:
        actor = _actor(request)
        serializer = CustomerUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        data = dict(serializer.validated_data)
        expected_version = int(data.pop("expected_version"))

        try:
            customer = update_customer(
                actor=actor,
                customer_id=customer_id,
                expected_version=expected_version,
                data=data,
                request_id=request_id_from(request),
            )
        except CustomerNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Cliente no encontrado",
                code="customer_not_found",
                detail=f"No existe el cliente con ID {customer_id}.",
            )
        except StaleCustomerRecordError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Registro obsoleto",
                code="stale_record",
                detail=str(exc),
            )
        except DuplicateCustomerError as exc:
            conflict: dict[str, object] | None = None
            if has_permission(actor, "clientes.ver"):
                conflict = {"type": "customer", "id": exc.customer_id}
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Identificación duplicada",
                code="duplicate_identification",
                detail=str(exc),
                conflict=conflict,
            )
        except CustomerValidationError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors=exc.errors,
            )

        return Response(_serialize_customer(customer), status=status.HTTP_200_OK)


class CustomerActivateView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "clientes.desactivar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=["Customers"],
        summary="Reactivar cliente",
        request=CustomerStateSerializer,
        responses={
            200: CustomerReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def post(self, request: Request, customer_id: int) -> Response:
        actor = _actor(request)
        serializer = CustomerStateSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        try:
            customer = activate_customer(
                customer_id=customer_id,
                expected_version=int(serializer.validated_data["expected_version"]),
                actor=actor,
                request_id=request_id_from(request),
            )
        except CustomerNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Cliente no encontrado",
                code="not_found",
                detail=f"El cliente con ID {customer_id} no existe.",
            )
        except StaleCustomerRecordError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Registro obsoleto",
                code="stale_record",
                detail=str(exc),
            )

        return Response(_serialize_customer(customer), status=status.HTTP_200_OK)


class CustomerDeactivateView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "clientes.desactivar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=["Customers"],
        summary="Desactivar cliente",
        request=CustomerStateSerializer,
        responses={
            200: CustomerReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def post(self, request: Request, customer_id: int) -> Response:
        actor = _actor(request)
        serializer = CustomerStateSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        try:
            customer = deactivate_customer(
                customer_id=customer_id,
                expected_version=int(serializer.validated_data["expected_version"]),
                actor=actor,
                request_id=request_id_from(request),
            )
        except CustomerNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Cliente no encontrado",
                code="not_found",
                detail=f"El cliente con ID {customer_id} no existe.",
            )
        except StaleCustomerRecordError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Registro obsoleto",
                code="stale_record",
                detail=str(exc),
            )

        return Response(_serialize_customer(customer), status=status.HTTP_200_OK)


class CustomerMatchesView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "clientes.ver"

    @extend_schema(
        tags=["Customers"],
        summary="Consultar advertencias de coincidencia de clientes",
        request=CustomerMatchQuerySerializer,
        responses={
            200: CustomerReadSerializer(many=True),
            403: ProblemSerializer,
        },
    )
    def post(self, request: Request) -> Response:
        actor = _actor(request)
        serializer = CustomerMatchQuerySerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        name = str(serializer.validated_data.get("name", ""))
        phone = str(serializer.validated_data.get("phone", ""))
        raw_exclude = serializer.validated_data.get("exclude_customer_id")
        exclude_id: int | None = int(raw_exclude) if raw_exclude is not None else None

        matches = find_matching_customers(
            actor=actor,
            name=name,
            phone=phone,
            exclude_customer_id=exclude_id,
        )
        return Response([_serialize_customer(c) for c in matches], status=status.HTTP_200_OK)


def _serialize_brand(brand: VehicleBrand) -> dict[str, object]:
    return {
        "id": brand.id,
        "name": brand.name,
        "is_active": brand.is_active,
        "version": brand.version,
        "created_at": brand.created_at.isoformat(),
        "updated_at": brand.updated_at.isoformat(),
    }


class VehicleBrandListCreateView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "marcas_vehiculo.ver",
        "POST": "marcas_vehiculo.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=["Brands"],
        summary="Listar marcas de vehículo",
        parameters=[
            OpenApiParameter(
                "search",
                OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Término de búsqueda por nombre.",
            ),
            OpenApiParameter(
                "is_active",
                OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                description="Filtrar por estado activo/inactivo.",
            ),
            OpenApiParameter(
                "page",
                OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description="Número de página.",
            ),
            OpenApiParameter(
                "page_size",
                OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description="Tamaño de página.",
            ),
        ],
        responses={
            200: VehicleBrandPageSerializer,
            403: ProblemSerializer,
        },
    )
    def get(self, request: Request) -> Response:
        actor = _actor(request)
        search_term = request.query_params.get("search") or request.query_params.get("query", "")
        raw_is_active = request.query_params.get("is_active")
        is_active: bool | None = None
        if raw_is_active is not None:
            if raw_is_active.lower() in ("true", "1"):
                is_active = True
            elif raw_is_active.lower() in ("false", "0"):
                is_active = False

        try:
            page = int(request.query_params.get("page", 1))
        except ValueError:
            page = 1

        try:
            page_size = int(request.query_params.get("page_size", 20))
        except ValueError:
            page_size = 20

        brand_page = search_brands(
            actor=actor,
            query=search_term,
            is_active=is_active,
            page=page,
            page_size=page_size,
            request_id=request_id_from(request),
        )

        data = {
            "count": brand_page.total_count,
            "page": brand_page.page,
            "page_size": brand_page.page_size,
            "total_pages": brand_page.total_pages,
            "results": [_serialize_brand(b) for b in brand_page.items],
        }
        return Response(data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=["Brands"],
        summary="Crear marca de vehículo",
        request=VehicleBrandCreateSerializer,
        responses={
            201: VehicleBrandReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
        },
    )
    def post(self, request: Request) -> Response:
        actor = _actor(request)
        if not has_permission(actor, "marcas_vehiculo.gestionar"):
            return problem_response(
                request=request,
                status_code=status.HTTP_403_FORBIDDEN,
                title="Acceso denegado",
                code="permission_denied",
                detail="No tiene permiso para crear marcas de vehículo.",
            )

        serializer = VehicleBrandCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        try:
            brand = create_brand(
                name=str(serializer.validated_data.get("name", "")),
                actor=actor,
                request_id=request_id_from(request),
            )
        except BrandValidationError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Datos de marca inválidos",
                code="validation_error",
                detail=str(exc),
                errors=exc.errors,
            )

        return Response(_serialize_brand(brand), status=status.HTTP_201_CREATED)


class VehicleBrandDetailView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "marcas_vehiculo.ver",
        "PATCH": "marcas_vehiculo.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=["Brands"],
        summary="Consultar detalle de marca de vehículo",
        responses={
            200: VehicleBrandReadSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
        },
    )
    def get(self, request: Request, pk: int) -> Response:
        actor = _actor(request)
        try:
            brand = get_brand(brand_id=pk, actor=actor, request_id=request_id_from(request))
        except BrandNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Marca no encontrada",
                code="not_found",
                detail=f"La marca con ID {pk} no existe.",
            )
        return Response(_serialize_brand(brand), status=status.HTTP_200_OK)

    @extend_schema(
        tags=["Brands"],
        summary="Actualizar marca de vehículo",
        request=VehicleBrandUpdateSerializer,
        responses={
            200: VehicleBrandReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def patch(self, request: Request, pk: int) -> Response:
        actor = _actor(request)
        if not has_permission(actor, "marcas_vehiculo.gestionar"):
            return problem_response(
                request=request,
                status_code=status.HTTP_403_FORBIDDEN,
                title="Acceso denegado",
                code="permission_denied",
                detail="No tiene permiso para editar marcas de vehículo.",
            )

        if "is_active" in request.data:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="El estado is_active no puede modificarse mediante PATCH.",
                errors={"is_active": ["El estado is_active no puede modificarse mediante PATCH."]},
            )

        serializer = VehicleBrandUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        try:
            brand = update_brand(
                brand_id=pk,
                name=str(serializer.validated_data.get("name", "")),
                expected_version=int(serializer.validated_data["expected_version"]),
                actor=actor,
                request_id=request_id_from(request),
            )
        except BrandNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Marca no encontrada",
                code="not_found",
                detail=f"La marca con ID {pk} no existe.",
            )
        except StaleBrandRecordError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Registro obsoleto",
                code="stale_record",
                detail=str(exc),
            )
        except BrandValidationError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Datos de marca inválidos",
                code="validation_error",
                detail=str(exc),
                errors=exc.errors,
            )

        return Response(_serialize_brand(brand), status=status.HTTP_200_OK)


class VehicleBrandActivateView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "marcas_vehiculo.desactivar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=["Brands"],
        summary="Reactivar marca de vehículo",
        request=VehicleBrandStateSerializer,
        responses={
            200: VehicleBrandReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def post(self, request: Request, pk: int) -> Response:
        actor = _actor(request)
        serializer = VehicleBrandStateSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        try:
            brand = activate_brand(
                brand_id=pk,
                expected_version=int(serializer.validated_data["expected_version"]),
                actor=actor,
                request_id=request_id_from(request),
            )
        except BrandNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Marca no encontrada",
                code="not_found",
                detail=f"La marca con ID {pk} no existe.",
            )
        except StaleBrandRecordError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Registro obsoleto",
                code="stale_record",
                detail=str(exc),
            )

        return Response(_serialize_brand(brand), status=status.HTTP_200_OK)


class VehicleBrandDeactivateView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "marcas_vehiculo.desactivar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=["Brands"],
        summary="Desactivar marca de vehículo",
        request=VehicleBrandStateSerializer,
        responses={
            200: VehicleBrandReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def post(self, request: Request, pk: int) -> Response:
        actor = _actor(request)
        serializer = VehicleBrandStateSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        try:
            brand = deactivate_brand(
                brand_id=pk,
                expected_version=int(serializer.validated_data["expected_version"]),
                actor=actor,
                request_id=request_id_from(request),
            )
        except BrandNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Marca no encontrada",
                code="not_found",
                detail=f"La marca con ID {pk} no existe.",
            )
        except StaleBrandRecordError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Registro obsoleto",
                code="stale_record",
                detail=str(exc),
            )

        return Response(_serialize_brand(brand), status=status.HTTP_200_OK)


def _serialize_vehicle(vehicle: Vehicle) -> dict[str, Any]:
    owner = vehicle.current_owner
    return {
        "id": vehicle.id,
        "plate": vehicle.plate,
        "model": vehicle.model,
        "color": vehicle.color,
        "year": vehicle.year,
        "vin": vehicle.vin,
        "is_active": vehicle.is_active,
        "version": vehicle.version,
        "created_at": vehicle.created_at,
        "updated_at": vehicle.updated_at,
        "brand": {
            "id": vehicle.brand.id,
            "name": vehicle.brand.name,
            "is_active": vehicle.brand.is_active,
        },
        "current_owner": {
            "id": owner.id,
            "name": owner.name,
            "identification": owner.identification,
            "is_active": owner.is_active,
        }
        if owner is not None
        else None,
    }


class VehicleListCreateView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "vehiculos.ver",
        "POST": "vehiculos.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=["Vehicles"],
        summary="Listar y buscar vehículos",
        parameters=[
            OpenApiParameter(
                name="search",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Término de búsqueda por placa, modelo, VIN o nombre del propietario.",
            ),
            OpenApiParameter(
                name="is_active",
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filtrar por estado activo o inactivo.",
            ),
            OpenApiParameter(
                name="brand_id",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filtrar por ID de la marca de vehículo.",
            ),
            OpenApiParameter(
                name="page",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Número de página.",
            ),
            OpenApiParameter(
                name="page_size",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Tamaño de página.",
            ),
        ],
        responses={
            200: VehiclePageSerializer,
            403: ProblemSerializer,
        },
    )
    def get(self, request: Request) -> Response:
        actor = _actor(request)
        search_term = request.query_params.get("search") or request.query_params.get("query", "")
        raw_is_active = request.query_params.get("is_active")
        is_active: bool | None = None
        if raw_is_active is not None:
            if raw_is_active.lower() in ("true", "1"):
                is_active = True
            elif raw_is_active.lower() in ("false", "0"):
                is_active = False

        raw_brand_id = request.query_params.get("brand_id")
        brand_id: int | None = None
        if raw_brand_id:
            with contextlib.suppress(ValueError):
                brand_id = int(raw_brand_id)

        try:
            page = int(request.query_params.get("page", 1))
        except ValueError:
            page = 1

        try:
            page_size = int(request.query_params.get("page_size", 20))
        except ValueError:
            page_size = 20

        vehicle_page = search_vehicles(
            actor=actor,
            query=search_term,
            is_active=is_active,
            brand_id=brand_id,
            page=page,
            page_size=page_size,
            request_id=request_id_from(request),
        )

        data = {
            "count": vehicle_page.total_count,
            "page": vehicle_page.page,
            "page_size": vehicle_page.page_size,
            "total_pages": vehicle_page.total_pages,
            "results": [_serialize_vehicle(v) for v in vehicle_page.items],
        }
        return Response(data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=["Vehicles"],
        summary="Registrar vehículo",
        request=VehicleCreateSerializer,
        responses={
            201: VehicleReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def post(self, request: Request) -> Response:
        actor = _actor(request)
        if not has_permission(actor, "vehiculos.gestionar"):
            return problem_response(
                request=request,
                status_code=status.HTTP_403_FORBIDDEN,
                title="Acceso denegado",
                code="permission_denied",
                detail="No tiene permiso para registrar vehículos.",
            )

        serializer = VehicleCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        try:
            vehicle = create_vehicle(
                actor=actor,
                owner_id=int(serializer.validated_data["owner_id"]),
                brand_id=int(serializer.validated_data["brand_id"]),
                plate=str(serializer.validated_data["plate"]),
                model=str(serializer.validated_data["model"]),
                color=serializer.validated_data.get("color") or "",
                year=serializer.validated_data.get("year"),
                vin=serializer.validated_data.get("vin"),
                request_id=request_id_from(request),
            )
        except CustomerNotFoundError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Cliente no encontrado",
                code="not_found",
                detail=str(exc),
            )
        except BrandNotFoundError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Marca no encontrada",
                code="not_found",
                detail=str(exc),
            )
        except InactiveReferenceError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Referencia inactiva",
                code="inactive_reference",
                detail=str(exc),
            )
        except VehicleValidationError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Datos de vehículo inválidos",
                code="validation_error",
                detail=str(exc),
                errors=exc.errors,
            )
        except DuplicatePlateError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Placa duplicada",
                code="duplicate_plate",
                detail=str(exc),
                conflict={"type": "vehicle", "id": exc.vehicle_id},
            )
        except DuplicateVinError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="VIN duplicado",
                code="duplicate_vin",
                detail=str(exc),
                conflict={"type": "vehicle", "id": exc.vehicle_id},
            )

        return Response(_serialize_vehicle(vehicle), status=status.HTTP_201_CREATED)


class VehicleDetailView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "vehiculos.ver",
        "PATCH": "vehiculos.gestionar",
    }
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"PATCH"})

    @extend_schema(
        tags=["Vehicles"],
        summary="Consultar detalle de vehículo",
        responses={
            200: VehicleReadSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
        },
    )
    def get(self, request: Request, pk: int) -> Response:
        actor = _actor(request)
        try:
            vehicle = get_vehicle(vehicle_id=pk, actor=actor, request_id=request_id_from(request))
        except VehicleNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Vehículo no encontrado",
                code="not_found",
                detail=f"El vehículo con ID {pk} no existe.",
            )
        return Response(_serialize_vehicle(vehicle), status=status.HTTP_200_OK)

    @extend_schema(
        tags=["Vehicles"],
        summary="Actualizar datos de vehículo",
        request=VehicleUpdateSerializer,
        responses={
            200: VehicleReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def patch(self, request: Request, pk: int) -> Response:
        actor = _actor(request)
        if not has_permission(actor, "vehiculos.gestionar"):
            return problem_response(
                request=request,
                status_code=status.HTTP_403_FORBIDDEN,
                title="Acceso denegado",
                code="permission_denied",
                detail="No tiene permiso para editar vehículos.",
            )

        if "is_active" in request.data:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="El estado is_active no puede modificarse mediante PATCH.",
                errors={"is_active": ["El estado is_active no puede modificarse mediante PATCH."]},
            )

        if "owner_id" in request.data:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="El propietario no puede modificarse mediante PATCH.",
                errors={"owner_id": ["El propietario no puede modificarse mediante PATCH."]},
            )

        serializer = VehicleUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        expected_version = int(serializer.validated_data["expected_version"])
        update_data = {
            k: v for k, v in serializer.validated_data.items() if k != "expected_version"
        }

        try:
            vehicle = update_vehicle(
                vehicle_id=pk,
                data=update_data,
                expected_version=expected_version,
                actor=actor,
                request_id=request_id_from(request),
            )
        except VehicleNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Vehículo no encontrado",
                code="not_found",
                detail=f"El vehículo con ID {pk} no existe.",
            )
        except BrandNotFoundError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Marca no encontrada",
                code="not_found",
                detail=str(exc),
            )
        except InactiveReferenceError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Referencia inactiva",
                code="inactive_reference",
                detail=str(exc),
            )
        except StaleVehicleRecordError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Registro obsoleto",
                code="stale_record",
                detail=str(exc),
            )
        except VehicleValidationError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Datos de vehículo inválidos",
                code="validation_error",
                detail=str(exc),
                errors=exc.errors,
            )
        except DuplicatePlateError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Placa duplicada",
                code="duplicate_plate",
                detail=str(exc),
                conflict={"type": "vehicle", "id": exc.vehicle_id},
            )
        except DuplicateVinError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="VIN duplicado",
                code="duplicate_vin",
                detail=str(exc),
                conflict={"type": "vehicle", "id": exc.vehicle_id},
            )

        return Response(_serialize_vehicle(vehicle), status=status.HTTP_200_OK)


class CustomerVehiclesView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "vehiculos.ver"

    @extend_schema(
        tags=["Customers", "Vehicles"],
        summary="Listar vehículos de un cliente",
        parameters=[
            OpenApiParameter(
                name="page",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Número de página.",
            ),
            OpenApiParameter(
                name="page_size",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Tamaño de página.",
            ),
        ],
        responses={
            200: VehiclePageSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
        },
    )
    def get(self, request: Request, customer_id: int) -> Response:
        actor = _actor(request)
        if not has_permission(actor, "clientes.ver"):
            return problem_response(
                request=request,
                status_code=status.HTTP_403_FORBIDDEN,
                title="Acceso denegado",
                code="permission_denied",
                detail="No tiene permiso para consultar clientes.",
            )

        try:
            page = int(request.query_params.get("page", 1))
        except ValueError:
            page = 1

        try:
            page_size = int(request.query_params.get("page_size", 20))
        except ValueError:
            page_size = 20

        try:
            vehicle_page = get_customer_vehicles(
                actor=actor,
                customer_id=customer_id,
                page=page,
                page_size=page_size,
                request_id=request_id_from(request),
            )
        except CustomerNotFoundError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Cliente no encontrado",
                code="not_found",
                detail=str(exc),
            )

        data = {
            "count": vehicle_page.total_count,
            "page": vehicle_page.page,
            "page_size": vehicle_page.page_size,
            "total_pages": vehicle_page.total_pages,
            "results": [_serialize_vehicle(v) for v in vehicle_page.items],
        }
        return Response(data, status=status.HTTP_200_OK)


def _serialize_ownership_period(period: OwnershipPeriod) -> dict[str, Any]:
    return {
        "id": period.id,
        "vehicle_id": period.vehicle_id,
        "customer": {
            "id": period.customer.id,
            "name": period.customer.name,
            "identification": period.customer.identification,
            "is_active": period.customer.is_active,
        },
        "started_at": period.started_at,
        "ended_at": period.ended_at,
        "is_current": period.ended_at is None,
    }


class VehicleChangeOwnerView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "vehiculos.gestionar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=["Vehicles"],
        summary="Cambiar propietario del vehículo",
        request=VehicleChangeOwnerSerializer,
        responses={
            200: VehicleReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def post(self, request: Request, pk: int) -> Response:
        actor = _actor(request)
        serializer = VehicleChangeOwnerSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        owner_id = int(serializer.validated_data["owner_id"])
        expected_version = int(serializer.validated_data["expected_version"])

        try:
            vehicle = transfer_vehicle_ownership(
                vehicle_id=pk,
                new_owner_id=owner_id,
                expected_version=expected_version,
                actor=actor,
                request_id=request_id_from(request),
            )
        except VehicleNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Vehículo no encontrado",
                code="not_found",
                detail=f"El vehículo con ID {pk} no existe.",
            )
        except CustomerNotFoundError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Cliente no encontrado",
                code="not_found",
                detail=str(exc),
            )
        except InactiveReferenceError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Referencia inactiva",
                code="inactive_reference",
                detail=str(exc),
            )
        except StaleVehicleRecordError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Registro obsoleto",
                code="stale_record",
                detail=str(exc),
            )
        except VehicleApplicationError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Error en la operación",
                code="bad_request",
                detail=str(exc),
            )

        return Response(_serialize_vehicle(vehicle), status=status.HTTP_200_OK)


class VehicleOwnershipHistoryView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "vehiculos.ver"

    @extend_schema(
        tags=["Vehicles"],
        summary="Listar períodos de propiedad de un vehículo",
        parameters=[
            OpenApiParameter(
                name="page",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Número de página.",
            ),
            OpenApiParameter(
                name="page_size",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Tamaño de página.",
            ),
        ],
        responses={
            200: OwnershipPeriodPageSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
        },
    )
    def get(self, request: Request, pk: int) -> Response:
        actor = _actor(request)
        try:
            page = int(request.query_params.get("page", 1))
        except ValueError:
            page = 1

        try:
            page_size = int(request.query_params.get("page_size", 20))
        except ValueError:
            page_size = 20

        try:
            period_page = get_vehicle_ownership_periods(
                actor=actor,
                vehicle_id=pk,
                page=page,
                page_size=page_size,
                request_id=request_id_from(request),
            )
        except VehicleNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Vehículo no encontrado",
                code="not_found",
                detail=f"El vehículo con ID {pk} no existe.",
            )

        data = {
            "count": period_page.total_count,
            "page": period_page.page,
            "page_size": period_page.page_size,
            "total_pages": period_page.total_pages,
            "results": [_serialize_ownership_period(p) for p in period_page.items],
        }
        return Response(data, status=status.HTTP_200_OK)


class VehicleActivateView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "vehiculos.desactivar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=["Vehicles"],
        summary="Reactivar vehículo",
        request=VehicleStateSerializer,
        responses={
            200: VehicleReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def post(self, request: Request, pk: int) -> Response:
        actor = _actor(request)
        serializer = VehicleStateSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        try:
            vehicle = activate_vehicle(
                vehicle_id=pk,
                expected_version=int(serializer.validated_data["expected_version"]),
                actor=actor,
                request_id=request_id_from(request),
            )
        except VehicleNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Vehículo no encontrado",
                code="not_found",
                detail=f"El vehículo con ID {pk} no existe.",
            )
        except StaleVehicleRecordError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Registro obsoleto",
                code="stale_record",
                detail=str(exc),
            )

        return Response(_serialize_vehicle(vehicle), status=status.HTTP_200_OK)


class VehicleDeactivateView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "vehiculos.desactivar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        tags=["Vehicles"],
        summary="Desactivar vehículo",
        request=VehicleStateSerializer,
        responses={
            200: VehicleReadSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def post(self, request: Request, pk: int) -> Response:
        actor = _actor(request)
        serializer = VehicleStateSerializer(data=request.data)
        if not serializer.is_valid():
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail="La solicitud contiene errores de validación.",
                errors={k: [str(err) for err in v] for k, v in serializer.errors.items()},
            )

        try:
            vehicle = deactivate_vehicle(
                vehicle_id=pk,
                expected_version=int(serializer.validated_data["expected_version"]),
                actor=actor,
                request_id=request_id_from(request),
            )
        except VehicleNotFoundError:
            return problem_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                title="Vehículo no encontrado",
                code="not_found",
                detail=f"El vehículo con ID {pk} no existe.",
            )
        except StaleVehicleRecordError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_409_CONFLICT,
                title="Registro obsoleto",
                code="stale_record",
                detail=str(exc),
            )

        return Response(_serialize_vehicle(vehicle), status=status.HTTP_200_OK)
