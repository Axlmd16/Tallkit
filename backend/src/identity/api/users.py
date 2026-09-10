from typing import ClassVar

from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from config.api.errors import ProblemSerializer, problem_response
from identity.api.permissions import HasBusinessPermission
from identity.api.request_context import request_id_from
from identity.application.audit import record_audit_event
from identity.application.credentials import OperationAlreadyProcessedError, reset_password
from identity.application.user_queries import UserSummary, list_users
from identity.application.users import (
    DuplicateUsernameError,
    InvalidRolesError,
    LastActiveAdministratorError,
    create_user,
    set_user_active,
    update_user,
)
from identity.domain.authorization import Role
from identity.models import AuditResult, User


class UserWriteSerializer(serializers.Serializer[dict[str, object]]):
    username = serializers.CharField(max_length=150)
    first_name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    last_name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    email = serializers.EmailField(allow_blank=True, required=False)
    is_active = serializers.BooleanField(required=False)
    roles = serializers.ListField(
        child=serializers.CharField(max_length=32),
        allow_empty=True,
    )


class UserReadSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    username = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.EmailField()
    is_active = serializers.BooleanField()
    roles = serializers.ListField(child=serializers.CharField())


class UserPageSerializer(serializers.Serializer[dict[str, object]]):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = UserReadSerializer(many=True)


def _user_data(user: User) -> dict[str, object]:
    return {
        "id": user.pk,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "is_active": user.is_active,
        "roles": sorted(user.role_assignments.values_list("role", flat=True)),
    }


def _summary_data(user: UserSummary) -> dict[str, object]:
    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "is_active": user.is_active,
        "roles": [role.value for role in user.roles],
    }


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


def _actor(request: Request) -> User:
    if not isinstance(request.user, User):
        raise RuntimeError("La autorización debe resolver un usuario autenticado.")
    return request.user


def _record_rejected_request(
    request: Request,
    *,
    action: str,
    target_id: str,
    reason: str,
) -> None:
    record_audit_event(
        actor=_actor(request),
        action=action,
        target_type="user",
        target_id=target_id,
        result=AuditResult.FAILURE,
        reason=reason,
        request_id=request_id_from(request),
    )


class UserListCreateView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "usuarios.ver",
        "POST": "usuarios.crear",
    }
    audited_permission_denial_methods = frozenset({"POST"})

    @extend_schema(
        operation_id="identity_users_list",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR),
            OpenApiParameter("is_active", OpenApiTypes.BOOL),
            OpenApiParameter("role", OpenApiTypes.STR, enum=[role.value for role in Role]),
            OpenApiParameter("page", OpenApiTypes.INT),
            OpenApiParameter("page_size", OpenApiTypes.INT),
        ],
        responses={200: UserPageSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request) -> Response:
        try:
            page = list_users(
                search=request.query_params.get("search", ""),
                is_active=_optional_bool(request.query_params.get("is_active")),
                role=request.query_params.get("role"),
                page=int(request.query_params.get("page", "1")),
                page_size=min(int(request.query_params.get("page_size", "20")), 100),
            )
        except (TypeError, ValueError) as exc:
            return _business_error(request, exc, "invalid_filters")
        return Response(
            {
                "count": page.total,
                "page": page.page,
                "page_size": page.page_size,
                "total_pages": page.total_pages,
                "results": [_summary_data(item) for item in page.items],
            }
        )

    @extend_schema(
        operation_id="identity_users_create",
        request=UserWriteSerializer,
        responses={201: UserReadSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
    )
    def post(self, request: Request) -> Response:
        serializer = UserWriteSerializer(data=request.data)
        if not serializer.is_valid():
            _record_rejected_request(
                request,
                action="identity.user_create_rejected",
                target_id="uncreated",
                reason="invalid_user",
            )
            return _business_error(
                request, ValueError("Datos de usuario inválidos."), "invalid_user"
            )
        data = serializer.validated_data
        try:
            user = create_user(
                actor=_actor(request),
                username=str(data["username"]),
                first_name=str(data.get("first_name", "")),
                last_name=str(data.get("last_name", "")),
                email=str(data.get("email", "")),
                is_active=bool(data.get("is_active", True)),
                roles=data["roles"],
                request_id=request_id_from(request),
            )
        except InvalidRolesError as exc:
            return _business_error(request, exc, "invalid_roles")
        except DuplicateUsernameError as exc:
            return _business_error(request, exc, "duplicate_username")
        return Response(_user_data(user), status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    permission_classes = (HasBusinessPermission,)
    business_permissions: ClassVar[dict[str, str]] = {
        "GET": "usuarios.ver",
        "PATCH": "usuarios.editar",
    }
    audited_permission_denial_methods = frozenset({"PATCH"})

    @extend_schema(
        operation_id="identity_users_retrieve",
        responses={200: UserReadSerializer, 403: ProblemSerializer},
    )
    def get(self, request: Request, user_id: int) -> Response:
        return Response(_user_data(get_object_or_404(User, pk=user_id)))

    @extend_schema(
        operation_id="identity_users_update",
        request=UserWriteSerializer,
        responses={200: UserReadSerializer, 400: ProblemSerializer, 403: ProblemSerializer},
    )
    def patch(self, request: Request, user_id: int) -> Response:
        if "is_active" in request.data:
            _record_rejected_request(
                request,
                action="identity.user_update_rejected",
                target_id=str(user_id),
                reason="explicit_state_action_required",
            )
            return _business_error(
                request,
                ValueError("Use la acción explícita de activar o desactivar."),
                "explicit_state_action_required",
            )
        user = get_object_or_404(User, pk=user_id)
        serializer = UserWriteSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            _record_rejected_request(
                request,
                action="identity.user_update_rejected",
                target_id=str(user_id),
                reason="invalid_user",
            )
            return _business_error(
                request, ValueError("Datos de usuario inválidos."), "invalid_user"
            )
        data = serializer.validated_data
        try:
            updated = update_user(
                actor=_actor(request),
                user_id=user.pk,
                username=str(data.get("username", user.username)),
                first_name=str(data.get("first_name", user.first_name)),
                last_name=str(data.get("last_name", user.last_name)),
                email=str(data.get("email", user.email)),
                roles=data.get(
                    "roles",
                    list(user.role_assignments.values_list("role", flat=True)),
                ),
                request_id=request_id_from(request),
            )
        except InvalidRolesError as exc:
            return _business_error(request, exc, "invalid_roles")
        except DuplicateUsernameError as exc:
            return _business_error(request, exc, "duplicate_username")
        return Response(_user_data(updated))


class UserStateActionView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "usuarios.desactivar"
    audited_permission_denial_methods = frozenset({"POST"})
    target_active: bool

    @extend_schema(
        request=None,
        responses={200: UserReadSerializer, 403: ProblemSerializer, 409: ProblemSerializer},
    )
    def post(self, request: Request, user_id: int) -> Response:
        get_object_or_404(User, pk=user_id)
        try:
            user = set_user_active(
                actor=_actor(request),
                user_id=user_id,
                is_active=self.target_active,
                request_id=request_id_from(request),
            )
        except LastActiveAdministratorError as exc:
            return _conflict_error(request, exc, "last_active_administrator")
        return Response(_user_data(user))


class UserActivateView(UserStateActionView):
    target_active = True


class UserDeactivateView(UserStateActionView):
    target_active = False


class PasswordResetSerializer(serializers.Serializer[dict[str, object]]):
    operation_id = serializers.UUIDField()


class TemporaryPasswordSerializer(serializers.Serializer[dict[str, object]]):
    temporary_password = serializers.CharField()


class UserPasswordResetView(APIView):
    permission_classes = (HasBusinessPermission,)
    required_business_permission = "usuarios.restablecer_clave"
    audited_permission_denial_methods = frozenset({"POST"})

    @extend_schema(
        operation_id="identity_users_reset_password",
        request=PasswordResetSerializer,
        responses={
            200: TemporaryPasswordSerializer,
            400: ProblemSerializer,
            403: ProblemSerializer,
            409: ProblemSerializer,
        },
    )
    def post(self, request: Request, user_id: int) -> Response:
        get_object_or_404(User, pk=user_id)
        serializer = PasswordResetSerializer(data=request.data)
        if not serializer.is_valid():
            _record_rejected_request(
                request,
                action="identity.password_reset_rejected",
                target_id=str(user_id),
                reason="invalid_operation_id",
            )
            return _business_error(
                request, ValueError("Identificador de operación inválido."), "invalid_operation_id"
            )
        try:
            temporary_password = reset_password(
                actor=_actor(request),
                user_id=user_id,
                operation_id=serializer.validated_data["operation_id"],
                request_id=request_id_from(request),
            )
        except OperationAlreadyProcessedError as exc:
            _record_rejected_request(
                request,
                action="identity.password_reset_rejected",
                target_id=str(user_id),
                reason="operation_already_processed",
            )
            return _conflict_error(request, exc, "operation_already_processed")
        return Response({"temporary_password": temporary_password})


def _optional_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    if value == "true":
        return True
    if value == "false":
        return False
    raise ValueError("El filtro de estado debe ser true o false.")
