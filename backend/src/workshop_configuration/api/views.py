"""Vistas de la API para configuración operativa y fiscal del taller."""

from collections.abc import Callable
from typing import ClassVar

from django.http import FileResponse
from django.urls import reverse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from config.api.errors import ProblemSerializer, problem_response
from identity.api.permissions import HasBusinessPermission
from identity.api.request_context import request_id_from
from identity.application.authorization import BusinessPermissionDeniedError, require_permission
from identity.models import User
from shared.command_values import InvalidIdempotencyKeyError
from workshop_configuration.application import entity_logos, logo_storage
from workshop_configuration.application.entity_warehouse import (
    FiscalEntityNotFoundError,
    FiscalEntityTypeImmutableError,
    StaleRecordError,
    WarehouseNotFoundError,
    get_fiscal_entity,
    get_warehouse,
    list_fiscal_entities,
    update_fiscal_entity,
    update_warehouse,
)
from workshop_configuration.application.initialization import (
    IdempotencyConflictError,
    WorkshopAlreadyInitializedError,
    initialize_workshop,
)
from workshop_configuration.application.series import (
    DocumentSeriesNotFoundError,
    SeriesAlreadyUsedError,
    SeriesScopeConflictError,
    get_document_series,
    list_document_series,
    replace_series,
    update_series_code,
)
from workshop_configuration.application.series import (
    StaleRecordError as SeriesStaleRecordError,
)
from workshop_configuration.application.taxes import (
    StaleRecordError as TaxStaleRecordError,
)
from workshop_configuration.application.taxes import (
    SuccessionDateError,
    TaxDefinitionNotFoundError,
    TaxPeriodNotFoundError,
    TaxPeriodOverlapError,
    TaxPeriodUsedError,
    create_tax_definition,
    create_tax_period,
    get_tax_definition,
    list_tax_definitions,
    schedule_successor,
    update_tax_period,
)
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import (
    DocumentSeries,
    FiscalEntity,
    FiscalEntityLogo,
    TaxDefinition,
    TaxPeriod,
    Warehouse,
    WorkshopConfiguration,
)

# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------


def _actor(request: Request) -> User:
    if not isinstance(request.user, User):
        raise RuntimeError("La autorización debe resolver un usuario autenticado.")
    return request.user


def _idempotency_key(request: Request) -> str:
    key = request.headers.get("Idempotency-Key", "").strip()
    if not key:
        raise ValueError("Idempotency-Key header is required")
    return key


def _business_error(request: Request, exc: Exception, code: str) -> Response:
    return problem_response(
        request=request,
        status_code=status.HTTP_400_BAD_REQUEST,
        title="Solicitud inválida",
        code=code,
        detail=str(exc),
    )


def _conflict_error(request: Request, exc: Exception, code: str) -> Response:
    return problem_response(
        request=request,
        status_code=status.HTTP_409_CONFLICT,
        title="Conflicto con el estado actual",
        code=code,
        detail=str(exc),
    )


def _not_found_error(request: Request, exc: Exception, code: str) -> Response:
    return problem_response(
        request=request,
        status_code=status.HTTP_404_NOT_FOUND,
        title="Recurso no encontrado",
        code=code,
        detail=str(exc),
    )


def _validation_error(request: Request, exc: ConfigurationValidationError) -> Response:
    return problem_response(
        request=request,
        status_code=status.HTTP_400_BAD_REQUEST,
        title="Solicitud inválida",
        code="validation_error",
        detail=str(exc),
        errors=exc.errors,
    )


def _unprocessable_error(request: Request, exc: Exception, code: str) -> Response:
    return problem_response(
        request=request,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        title="Entidad no procesable",
        code=code,
        detail=str(exc),
    )


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------


class StatusSerializer(serializers.Serializer[dict[str, object]]):
    is_initialized = serializers.BooleanField()


class InitializeSerializer(serializers.Serializer[dict[str, object]]):
    commercial_ruc = serializers.CharField(max_length=13)
    commercial_legal_name = serializers.CharField(max_length=200)
    artisanal_ruc = serializers.CharField(max_length=13)
    artisanal_legal_name = serializers.CharField(max_length=200)
    warehouse_name = serializers.CharField(max_length=120)
    idempotency_key = serializers.CharField(max_length=128)


class InitializeResponseSerializer(serializers.Serializer[dict[str, object]]):
    installation_id = serializers.IntegerField()


class EntityLogoSerializer(serializers.Serializer[dict[str, object]]):
    url = serializers.CharField()
    revision = serializers.IntegerField()
    content_type = serializers.CharField()
    width = serializers.IntegerField()
    height = serializers.IntegerField()
    size_bytes = serializers.IntegerField()
    uploaded_at = serializers.DateTimeField()


class FiscalEntitySerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    entity_type = serializers.CharField()
    ruc = serializers.CharField()
    legal_name = serializers.CharField()
    trade_name = serializers.CharField(allow_null=True)
    address = serializers.CharField(allow_null=True)
    phone = serializers.CharField(allow_null=True)
    email = serializers.CharField(allow_null=True)
    version = serializers.IntegerField()
    logo = EntityLogoSerializer(allow_null=True)


class FiscalEntityUpdateSerializer(serializers.Serializer[dict[str, object]]):
    legal_name = serializers.CharField(max_length=200, required=False)
    ruc = serializers.CharField(max_length=13, required=False)
    trade_name = serializers.CharField(
        max_length=200, required=False, allow_blank=True, allow_null=True
    )
    address = serializers.CharField(
        max_length=300, required=False, allow_blank=True, allow_null=True
    )
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    entity_type = serializers.CharField(required=False)
    expected_version = serializers.IntegerField(required=True)


class WarehouseSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    name = serializers.CharField()
    is_active = serializers.BooleanField()
    version = serializers.IntegerField()


class WarehouseUpdateSerializer(serializers.Serializer[dict[str, object]]):
    name = serializers.CharField(max_length=120)
    expected_version = serializers.IntegerField(required=True)


class TaxDefinitionSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    code = serializers.CharField()
    name = serializers.CharField()
    fiscal_entity_id = serializers.IntegerField(required=False)
    entity_type = serializers.CharField(required=False, allow_null=True)
    current_rate = serializers.CharField(required=False, allow_null=True)
    starts_on = serializers.CharField(required=False, allow_null=True)
    ends_on = serializers.CharField(required=False, allow_null=True)


class TaxDefinitionCreateSerializer(serializers.Serializer[dict[str, object]]):
    entity_id = serializers.IntegerField()
    code = serializers.CharField(max_length=20)
    name = serializers.CharField(max_length=120)


class TaxPeriodSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    rate = serializers.CharField()
    starts_on = serializers.DateField()
    ends_on = serializers.DateField(allow_null=True)
    version = serializers.IntegerField()


class TaxPeriodCreateSerializer(serializers.Serializer[dict[str, object]]):
    rate = serializers.CharField()
    starts_on = serializers.DateField()
    ends_on = serializers.DateField(required=False, allow_null=True)


class TaxPeriodUpdateSerializer(serializers.Serializer[dict[str, object]]):
    rate = serializers.CharField(required=False)
    starts_on = serializers.DateField(required=False)
    ends_on = serializers.DateField(required=False, allow_null=True)
    expected_version = serializers.IntegerField(required=True)


class ScheduleSuccessorSerializer(serializers.Serializer[dict[str, object]]):
    new_rate = serializers.CharField()
    successor_starts_on = serializers.DateField()
    expected_version = serializers.IntegerField(required=True)


class DocumentSeriesSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    code = serializers.CharField()
    is_active = serializers.BooleanField()
    last_number = serializers.IntegerField()
    version = serializers.IntegerField()
    document_type = serializers.CharField(required=False, allow_null=True)
    entity_type = serializers.CharField(required=False, allow_null=True)


class SeriesCodeUpdateSerializer(serializers.Serializer[dict[str, object]]):
    code = serializers.CharField(max_length=20)
    expected_version = serializers.IntegerField(required=True)


class SeriesReplaceSerializer(serializers.Serializer[dict[str, object]]):
    new_code = serializers.CharField(max_length=20)
    expected_version = serializers.IntegerField(required=True)


# ---------------------------------------------------------------------------
# Vistas
# ---------------------------------------------------------------------------


class StatusView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "parametros.gestionar"

    @extend_schema(
        operation_id="workshop_configuration_status",
        responses={200: StatusSerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        initialized = WorkshopConfiguration.objects.filter(pk=1, is_initialized=True).exists()
        return Response({"is_initialized": initialized}, status=status.HTTP_200_OK)


class InitializeView(APIView):
    permission_classes = (HasBusinessPermission,)
    # Usamos parametros.gestionar como base; el servicio exige también entidades_fiscales.editar
    required_business_permission = "parametros.gestionar"

    @extend_schema(
        operation_id="workshop_configuration_initialize",
        request=InitializeSerializer,
        responses={
            200: InitializeResponseSerializer,
            400: ProblemSerializer,
            409: ProblemSerializer,
            403: ProblemSerializer,
        },
    )
    def post(self, request: Request) -> Response:
        serializer = InitializeSerializer(data=request.data)
        if not serializer.is_valid():
            return _business_error(
                request, ValueError("Datos de inicialización inválidos"), "invalid_request"
            )

        data = serializer.validated_data
        try:
            result = initialize_workshop(
                actor=_actor(request),
                commercial_ruc=str(data["commercial_ruc"]),
                commercial_legal_name=str(data["commercial_legal_name"]),
                artisanal_ruc=str(data["artisanal_ruc"]),
                artisanal_legal_name=str(data["artisanal_legal_name"]),
                warehouse_name=str(data["warehouse_name"]),
                idempotency_key=str(data["idempotency_key"]),
                request_id=request_id_from(request),
            )
            return Response({"installation_id": result.installation_id}, status=status.HTTP_200_OK)
        except ConfigurationValidationError as exc:
            return _validation_error(request, exc)
        except WorkshopAlreadyInitializedError as exc:
            return _conflict_error(request, exc, "already_initialized")
        except IdempotencyConflictError as exc:
            return _conflict_error(request, exc, "idempotency_conflict")


def _logo_url(entity_type: str, revision: int) -> str:
    return reverse("entity-logo-file", kwargs={"entity_type": entity_type, "revision": revision})


def _logo_data(entity: FiscalEntity) -> dict[str, object] | None:
    summary = entity_logos.logo_summary(entity_logos.current_logo(entity.pk))
    if summary is None:
        return None
    return {"url": _logo_url(entity.entity_type, int(summary["revision"])), **summary}


def _entity_display_name(entity: FiscalEntity) -> str:
    return (entity.trade_name or "").strip() or entity.legal_name


def _entity_data(entity: FiscalEntity) -> dict[str, object]:
    return {
        "id": entity.pk,
        "entity_type": entity.entity_type,
        "ruc": entity.ruc,
        "legal_name": entity.legal_name,
        "trade_name": entity.trade_name,
        "address": entity.address,
        "phone": entity.phone,
        "email": entity.email,
        "version": entity.version,
        "logo": _logo_data(entity),
    }


class EntityListView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "entidades_fiscales.ver"

    @extend_schema(
        operation_id="workshop_configuration_entities_list",
        responses={200: FiscalEntitySerializer(many=True), 403: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        entities = list_fiscal_entities(actor=_actor(request), request_id=request_id_from(request))
        return Response([_entity_data(e) for e in entities], status=status.HTTP_200_OK)


class EntityDetailView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "entidades_fiscales.ver",
        "PATCH": "entidades_fiscales.editar",
    }

    @extend_schema(
        operation_id="workshop_configuration_entities_get",
        responses={200: FiscalEntitySerializer, 404: ProblemSerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request, entity_id: int) -> Response:
        try:
            entity = get_fiscal_entity(
                actor=_actor(request), entity_id=entity_id, request_id=request_id_from(request)
            )
            return Response(_entity_data(entity), status=status.HTTP_200_OK)
        except FiscalEntityNotFoundError as exc:
            return _not_found_error(request, exc, "entity_not_found")

    @extend_schema(
        operation_id="workshop_configuration_entities_update",
        request=FiscalEntityUpdateSerializer,
        responses={
            200: FiscalEntitySerializer,
            400: ProblemSerializer,
            409: ProblemSerializer,
            404: ProblemSerializer,
        },
    )
    def patch(self, request: Request, entity_id: int) -> Response:
        serializer = FiscalEntityUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return _business_error(request, ValueError("Datos inválidos"), "invalid_request")

        data = serializer.validated_data
        kwargs = {k: v for k, v in data.items() if k != "expected_version"}

        try:
            entity = update_fiscal_entity(
                actor=_actor(request),
                entity_id=entity_id,
                expected_version=int(data["expected_version"]),
                request_id=request_id_from(request),
                **kwargs,
            )
            return Response(_entity_data(entity), status=status.HTTP_200_OK)
        except FiscalEntityNotFoundError as exc:
            return _not_found_error(request, exc, "entity_not_found")
        except FiscalEntityTypeImmutableError as exc:
            return _conflict_error(request, exc, "entity_type_immutable")
        except StaleRecordError as exc:
            return _conflict_error(request, exc, "stale_record")
        except ConfigurationValidationError as exc:
            return _validation_error(request, exc)


def _warehouse_data(wh: Warehouse) -> dict[str, object]:
    return {
        "id": wh.pk,
        "name": wh.name,
        "is_active": wh.is_active,
        "version": wh.version,
    }


class WarehouseView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "parametros.gestionar"

    @extend_schema(
        operation_id="workshop_configuration_warehouse_get",
        responses={200: WarehouseSerializer, 404: ProblemSerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        try:
            wh = get_warehouse(actor=_actor(request), request_id=request_id_from(request))
            return Response(_warehouse_data(wh), status=status.HTTP_200_OK)
        except WarehouseNotFoundError as exc:
            return _not_found_error(request, exc, "warehouse_not_found")

    @extend_schema(
        operation_id="workshop_configuration_warehouse_update",
        request=WarehouseUpdateSerializer,
        responses={
            200: WarehouseSerializer,
            400: ProblemSerializer,
            409: ProblemSerializer,
            404: ProblemSerializer,
        },
    )
    def patch(self, request: Request) -> Response:
        serializer = WarehouseUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return _business_error(request, ValueError("Datos inválidos"), "invalid_request")

        try:
            wh = update_warehouse(
                actor=_actor(request),
                expected_version=int(serializer.validated_data["expected_version"]),
                name=str(serializer.validated_data["name"]),
                request_id=request_id_from(request),
            )
            return Response(_warehouse_data(wh), status=status.HTTP_200_OK)
        except WarehouseNotFoundError as exc:
            return _not_found_error(request, exc, "warehouse_not_found")
        except StaleRecordError as exc:
            return _conflict_error(request, exc, "stale_record")
        except ConfigurationValidationError as exc:
            return _validation_error(request, exc)


def _tax_def_data(td: TaxDefinition) -> dict[str, object]:
    latest_period = td.periods.order_by("-starts_on").first() if hasattr(td, "periods") else None
    return {
        "id": td.pk,
        "code": td.code,
        "name": td.name,
        "fiscal_entity_id": td.fiscal_entity_id,
        "entity_type": td.fiscal_entity.entity_type
        if hasattr(td, "fiscal_entity") and td.fiscal_entity
        else None,
        "current_rate": str(latest_period.rate) if latest_period else None,
        "starts_on": latest_period.starts_on.isoformat() if latest_period else None,
        "ends_on": latest_period.ends_on.isoformat()
        if (latest_period and latest_period.ends_on)
        else None,
    }


class TaxDefinitionListCreateView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "parametros.gestionar"

    @extend_schema(
        operation_id="workshop_configuration_taxes_list",
        parameters=[OpenApiParameter("entity_id", OpenApiTypes.INT, required=False)],
        responses={200: TaxDefinitionSerializer(many=True), 403: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        entity_id_str = request.query_params.get("entity_id")
        if entity_id_str:
            taxes = list_tax_definitions(
                actor=_actor(request),
                entity_id=int(entity_id_str),
                request_id=request_id_from(request),
            )
        else:
            require_permission(
                actor=_actor(request),
                permission="parametros.gestionar",
                request_id=request_id_from(request),
                denial_action="workshop_configuration.taxes_list_denied",
                target_type="tax_definition",
                target_id="all",
            )
            taxes = list(
                TaxDefinition.objects.select_related("fiscal_entity")
                .prefetch_related("periods")
                .order_by("id")
            )
        return Response([_tax_def_data(t) for t in taxes], status=status.HTTP_200_OK)

    @extend_schema(
        operation_id="workshop_configuration_taxes_create",
        request=TaxDefinitionCreateSerializer,
        responses={
            201: TaxDefinitionSerializer,
            400: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def post(self, request: Request) -> Response:
        serializer = TaxDefinitionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return _business_error(request, ValueError("Datos inválidos"), "invalid_request")

        data = serializer.validated_data
        try:
            td = create_tax_definition(
                actor=_actor(request),
                entity_id=int(data["entity_id"]),
                code=str(data["code"]),
                name=str(data["name"]),
                request_id=request_id_from(request),
            )
            return Response(_tax_def_data(td), status=status.HTTP_201_CREATED)
        except FiscalEntityNotFoundError as exc:
            return _not_found_error(request, exc, "entity_not_found")
        except ConfigurationValidationError as exc:
            return _validation_error(request, exc)
        except Exception as exc:  # IntegrityError from constraint
            return _conflict_error(request, exc, "code_conflict")


def _tax_period_data(tp: TaxPeriod) -> dict[str, object]:
    return {
        "id": tp.pk,
        "rate": str(tp.rate),
        "starts_on": tp.starts_on.isoformat(),
        "ends_on": tp.ends_on.isoformat() if tp.ends_on else None,
        "version": tp.version,
    }


class TaxPeriodListCreateView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "parametros.gestionar"

    @extend_schema(
        operation_id="workshop_configuration_periods_list",
        responses={200: TaxPeriodSerializer(many=True), 404: ProblemSerializer},
    )
    def get(self, request: Request, tax_def_id: int) -> Response:
        try:
            td = get_tax_definition(
                actor=_actor(request),
                tax_definition_id=tax_def_id,
                request_id=request_id_from(request),
            )
        except TaxDefinitionNotFoundError as exc:
            return _not_found_error(request, exc, "tax_not_found")

        periods = TaxPeriod.objects.filter(tax_definition=td).order_by("-starts_on")
        return Response([_tax_period_data(p) for p in periods], status=status.HTTP_200_OK)

    @extend_schema(
        operation_id="workshop_configuration_periods_create",
        request=TaxPeriodCreateSerializer,
        responses={201: TaxPeriodSerializer, 400: ProblemSerializer, 409: ProblemSerializer},
    )
    def post(self, request: Request, tax_def_id: int) -> Response:
        serializer = TaxPeriodCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return _business_error(request, ValueError("Datos inválidos"), "invalid_request")

        data = serializer.validated_data
        try:
            tp = create_tax_period(
                actor=_actor(request),
                tax_definition_id=tax_def_id,
                rate=str(data["rate"]),
                starts_on=data["starts_on"],
                ends_on=data.get("ends_on"),
                request_id=request_id_from(request),
            )
            return Response(_tax_period_data(tp), status=status.HTTP_201_CREATED)
        except TaxDefinitionNotFoundError as exc:
            return _not_found_error(request, exc, "tax_not_found")
        except ConfigurationValidationError as exc:
            return _validation_error(request, exc)
        except TaxPeriodOverlapError as exc:
            return _conflict_error(request, exc, "period_overlap")


class TaxPeriodDetailView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "parametros.gestionar"

    @extend_schema(
        operation_id="workshop_configuration_periods_update",
        request=TaxPeriodUpdateSerializer,
        responses={
            200: TaxPeriodSerializer,
            400: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def patch(self, request: Request, period_id: int) -> Response:
        serializer = TaxPeriodUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return _business_error(request, ValueError("Datos inválidos"), "invalid_request")

        data = serializer.validated_data
        kwargs = {k: v for k, v in data.items() if k != "expected_version"}
        try:
            tp = update_tax_period(
                actor=_actor(request),
                period_id=period_id,
                expected_version=int(data["expected_version"]),
                request_id=request_id_from(request),
                **kwargs,
            )
            return Response(_tax_period_data(tp), status=status.HTTP_200_OK)
        except TaxPeriodNotFoundError as exc:
            return _not_found_error(request, exc, "period_not_found")
        except TaxStaleRecordError as exc:
            return _conflict_error(request, exc, "stale_record")
        except TaxPeriodUsedError as exc:
            return _conflict_error(request, exc, "period_used")
        except TaxPeriodOverlapError as exc:
            return _conflict_error(request, exc, "period_overlap")
        except ConfigurationValidationError as exc:
            return _validation_error(request, exc)


class ScheduleSuccessorView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "parametros.gestionar"

    @extend_schema(
        operation_id="workshop_configuration_periods_schedule_successor",
        request=ScheduleSuccessorSerializer,
        responses={
            201: TaxPeriodSerializer,
            400: ProblemSerializer,
            409: ProblemSerializer,
            422: ProblemSerializer,
        },
    )
    def post(self, request: Request, period_id: int) -> Response:
        serializer = ScheduleSuccessorSerializer(data=request.data)
        if not serializer.is_valid():
            return _business_error(request, ValueError("Datos inválidos"), "invalid_request")

        data = serializer.validated_data
        try:
            successor = schedule_successor(
                actor=_actor(request),
                period_id=period_id,
                expected_version=int(data["expected_version"]),
                new_rate=str(data["new_rate"]),
                successor_starts_on=data["successor_starts_on"],
                request_id=request_id_from(request),
            )
            return Response(_tax_period_data(successor), status=status.HTTP_201_CREATED)
        except TaxPeriodNotFoundError as exc:
            return _not_found_error(request, exc, "period_not_found")
        except TaxStaleRecordError as exc:
            return _conflict_error(request, exc, "stale_record")
        except SuccessionDateError as exc:
            return _unprocessable_error(request, exc, "succession_date_invalid")
        except ConfigurationValidationError as exc:
            return _validation_error(request, exc)


def _series_data(series: DocumentSeries) -> dict[str, object]:
    doc_type = None
    ent_type = None
    if hasattr(series, "numbering_scope") and series.numbering_scope:
        doc_type = series.numbering_scope.document_type
        if (
            hasattr(series.numbering_scope, "fiscal_entity")
            and series.numbering_scope.fiscal_entity
        ):
            ent_type = series.numbering_scope.fiscal_entity.entity_type
    return {
        "id": series.pk,
        "code": series.code,
        "is_active": series.is_active,
        "last_number": series.last_number,
        "version": series.version,
        "document_type": doc_type,
        "entity_type": ent_type,
    }


class SeriesListView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "parametros.gestionar"

    @extend_schema(
        operation_id="workshop_configuration_series_list",
        parameters=[OpenApiParameter("scope_id", OpenApiTypes.INT, required=False)],
        responses={200: DocumentSeriesSerializer(many=True), 400: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        scope_id_str = request.query_params.get("scope_id")
        if scope_id_str:
            series_list = list_document_series(
                actor=_actor(request),
                scope_id=int(scope_id_str),
                request_id=request_id_from(request),
            )
        else:
            require_permission(
                actor=_actor(request),
                permission="parametros.gestionar",
                request_id=request_id_from(request),
                denial_action="workshop_configuration.series_list_denied",
                target_type="document_series",
                target_id="all",
            )
            series_list = list(
                DocumentSeries.objects.select_related("numbering_scope__fiscal_entity").order_by(
                    "id"
                )
            )
        return Response([_series_data(s) for s in series_list], status=status.HTTP_200_OK)


class SeriesDetailView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "parametros.gestionar",
        "PATCH": "parametros.gestionar",
    }

    @extend_schema(
        operation_id="workshop_configuration_series_get",
        responses={200: DocumentSeriesSerializer, 404: ProblemSerializer},
    )
    def get(self, request: Request, series_id: int) -> Response:
        try:
            series = get_document_series(
                actor=_actor(request), series_id=series_id, request_id=request_id_from(request)
            )
            return Response(_series_data(series), status=status.HTTP_200_OK)
        except DocumentSeriesNotFoundError as exc:
            return _not_found_error(request, exc, "series_not_found")

    @extend_schema(
        operation_id="workshop_configuration_series_update",
        request=SeriesCodeUpdateSerializer,
        responses={
            200: DocumentSeriesSerializer,
            400: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def patch(self, request: Request, series_id: int) -> Response:
        serializer = SeriesCodeUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return _business_error(request, ValueError("Datos inválidos"), "invalid_request")

        data = serializer.validated_data
        try:
            series = update_series_code(
                actor=_actor(request),
                series_id=series_id,
                expected_version=int(data["expected_version"]),
                code=str(data["code"]),
                request_id=request_id_from(request),
            )
            return Response(_series_data(series), status=status.HTTP_200_OK)
        except DocumentSeriesNotFoundError as exc:
            return _not_found_error(request, exc, "series_not_found")
        except SeriesStaleRecordError as exc:
            return _conflict_error(request, exc, "stale_record")
        except SeriesAlreadyUsedError as exc:
            return _conflict_error(request, exc, "series_used")
        except SeriesScopeConflictError as exc:
            return _conflict_error(request, exc, "code_conflict")
        except ConfigurationValidationError as exc:
            return _validation_error(request, exc)


class SeriesReplaceView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "parametros.gestionar"

    @extend_schema(
        operation_id="workshop_configuration_series_replace",
        request=SeriesReplaceSerializer,
        responses={
            201: DocumentSeriesSerializer,
            400: ProblemSerializer,
            404: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def post(self, request: Request, series_id: int) -> Response:
        serializer = SeriesReplaceSerializer(data=request.data)
        if not serializer.is_valid():
            return _business_error(request, ValueError("Datos inválidos"), "invalid_request")

        data = serializer.validated_data
        try:
            successor = replace_series(
                actor=_actor(request),
                series_id=series_id,
                expected_version=int(data["expected_version"]),
                new_code=str(data["new_code"]),
                request_id=request_id_from(request),
            )
            return Response(_series_data(successor), status=status.HTTP_201_CREATED)
        except DocumentSeriesNotFoundError as exc:
            return _not_found_error(request, exc, "series_not_found")
        except SeriesStaleRecordError as exc:
            return _conflict_error(request, exc, "stale_record")
        except SeriesScopeConflictError as exc:
            return _conflict_error(request, exc, "code_conflict")
        except ConfigurationValidationError as exc:
            return _validation_error(request, exc)


# ---------------------------------------------------------------------------
# Logotipo de entidad fiscal (diseño D5)
# ---------------------------------------------------------------------------

_LOGO_HEADERS = {
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
}


class EntityLogoUploadSerializer(serializers.Serializer[dict[str, object]]):
    file = serializers.FileField()
    idempotency_key = serializers.CharField(max_length=128)


class EntityLogoRemoveSerializer(serializers.Serializer[dict[str, object]]):
    idempotency_key = serializers.CharField(max_length=128)


class EntityLogoSummaryItemSerializer(serializers.Serializer[dict[str, object]]):
    entity_id = serializers.IntegerField()
    legal_name = serializers.CharField()
    display_name = serializers.CharField()
    logo = EntityLogoSerializer(allow_null=True)


class EntityLogoSummarySerializer(serializers.Serializer[dict[str, object]]):
    COMERCIAL = EntityLogoSummaryItemSerializer(allow_null=True)
    ARTESANAL = EntityLogoSummaryItemSerializer(allow_null=True)


_LOGO_COMMAND_RESPONSES = {
    200: FiscalEntitySerializer,
    400: ProblemSerializer,
    403: ProblemSerializer,
    404: ProblemSerializer,
    409: ProblemSerializer,
}


def _logo_command(request: Request, entity_id: int, command: Callable[[], object]) -> Response:
    try:
        command()
    except logo_storage.LogoImageError as exc:
        return problem_response(
            request=request,
            status_code=status.HTTP_400_BAD_REQUEST,
            title="Solicitud inválida",
            code=exc.code,
            detail=exc.message,
            errors={"file": [exc.message]},
        )
    except InvalidIdempotencyKeyError as exc:
        return problem_response(
            request=request,
            status_code=status.HTTP_400_BAD_REQUEST,
            title="Solicitud inválida",
            code="validation_error",
            detail=str(exc),
            errors={"idempotency_key": [str(exc)]},
        )
    except IdempotencyConflictError as exc:
        return _conflict_error(request, exc, "idempotency_conflict")
    except FiscalEntityNotFoundError as exc:
        return _not_found_error(request, exc, "entity_not_found")
    except BusinessPermissionDeniedError as exc:
        return problem_response(
            request=request,
            status_code=status.HTTP_403_FORBIDDEN,
            title="Acceso denegado",
            code="forbidden",
            detail=str(exc),
        )
    entity = FiscalEntity.objects.get(pk=entity_id)
    return Response(_entity_data(entity), status=status.HTTP_200_OK)


class EntityLogoView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "entidades_fiscales.editar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})
    parser_classes = (MultiPartParser,)

    @extend_schema(
        operation_id="workshop_configuration_entity_logo_upload",
        request={"multipart/form-data": EntityLogoUploadSerializer},
        responses=_LOGO_COMMAND_RESPONSES,
    )
    def post(self, request: Request, entity_id: int) -> Response:
        upload = request.FILES.get("file")
        if upload is None:
            message = "Seleccione una imagen."
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="validation_error",
                detail=message,
                errors={"file": [message]},
            )
        return _logo_command(
            request,
            entity_id,
            lambda: entity_logos.upload_entity_logo(
                actor=_actor(request),
                entity_id=entity_id,
                file=upload,
                idempotency_key=request.data.get("idempotency_key"),
                request_id=request_id_from(request),
            ),
        )


class EntityLogoRemoveView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "entidades_fiscales.editar"
    audited_permission_denial_methods: ClassVar[frozenset[str]] = frozenset({"POST"})

    @extend_schema(
        operation_id="workshop_configuration_entity_logo_remove",
        request=EntityLogoRemoveSerializer,
        responses=_LOGO_COMMAND_RESPONSES,
    )
    def post(self, request: Request, entity_id: int) -> Response:
        return _logo_command(
            request,
            entity_id,
            lambda: entity_logos.remove_entity_logo(
                actor=_actor(request),
                entity_id=entity_id,
                idempotency_key=request.data.get("idempotency_key"),
                request_id=request_id_from(request),
            ),
        )


class EntityLogoSummaryView(APIView):
    """Resumen para los comprobantes: cualquier usuario con sesión vigente."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        operation_id="workshop_configuration_entity_logos_summary",
        responses={200: EntityLogoSummarySerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        data: dict[str, object] = {"COMERCIAL": None, "ARTESANAL": None}
        for entity in FiscalEntity.objects.all():
            data[entity.entity_type] = {
                "entity_id": entity.pk,
                "legal_name": entity.legal_name,
                "display_name": _entity_display_name(entity),
                "logo": _logo_data(entity),
            }
        return Response(data, status=status.HTTP_200_OK)


class EntityLogoFileView(APIView):
    """Entrega la revisión vigente del logotipo; cualquier otra responde 404."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        operation_id="workshop_configuration_entity_logo_file",
        responses={
            200: OpenApiResponse(response=OpenApiTypes.BINARY, description="Imagen privada."),
            403: ProblemSerializer,
            404: ProblemSerializer,
        },
    )
    def get(self, request: Request, entity_type: str, revision: int) -> FileResponse | Response:
        logo = (
            FiscalEntityLogo.objects.filter(
                fiscal_entity__entity_type=entity_type, revision=revision
            )
            .only("storage_name", "content_type")
            .first()
        )
        if logo is None:
            return _not_found_error(
                request, LookupError("Logotipo no encontrado."), "logo_not_found"
            )
        try:
            handle = logo_storage.open_file(logo.storage_name)
        except FileNotFoundError:
            return _not_found_error(
                request, LookupError("Logotipo no encontrado."), "logo_not_found"
            )
        response = FileResponse(handle, content_type=logo.content_type)
        for header, value in _LOGO_HEADERS.items():
            response[header] = value
        return response
