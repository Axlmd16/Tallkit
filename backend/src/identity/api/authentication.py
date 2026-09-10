from typing import cast

from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.core.exceptions import ValidationError
from django.http import HttpRequest
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from config.api.errors import problem_response
from identity.api.request_context import request_id_from
from identity.api.throttles import AuditedLoginRateThrottle
from identity.application.audit import record_audit_event
from identity.application.credentials import IncorrectCurrentPasswordError, change_password
from identity.domain.authorization import Role, effective_permissions
from identity.models import AuditResult, User


class LoginSerializer(serializers.Serializer[dict[str, object]]):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(trim_whitespace=False, write_only=True)


class SessionSerializer(serializers.Serializer[dict[str, object]]):
    authenticated = serializers.BooleanField()
    username = serializers.CharField(allow_null=True)
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=[role.value for role in Role])
    )
    permissions = serializers.ListField(child=serializers.CharField())
    must_change_password = serializers.BooleanField()


class PasswordChangeSerializer(serializers.Serializer[dict[str, object]]):
    current_password = serializers.CharField(trim_whitespace=False, write_only=True)
    new_password = serializers.CharField(trim_whitespace=False, write_only=True)


def session_payload(user: object) -> dict[str, object]:
    if not isinstance(user, User) or not user.is_authenticated:
        return {
            "authenticated": False,
            "username": None,
            "roles": [],
            "permissions": [],
            "must_change_password": False,
        }

    roles = tuple(
        sorted(
            (Role(value) for value in user.role_assignments.values_list("role", flat=True)),
            key=lambda role: role.value,
        )
    )
    return {
        "authenticated": True,
        "username": user.get_username(),
        "roles": [role.value for role in roles],
        "permissions": sorted(effective_permissions(roles)),
        "must_change_password": user.must_change_password,
    }


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    @extend_schema(responses={204: OpenApiResponse(description="Cookie CSRF emitida")})
    def get(self, request: Request) -> Response:
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (AuditedLoginRateThrottle,)
    throttle_scope = "login"

    @extend_schema(request=LoginSerializer, responses={200: SessionSerializer})
    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request=request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if user is None or not user.is_active:
            record_audit_event(
                actor=None,
                action="authentication.login_failed",
                target_type="authentication",
                target_id="unconfirmed",
                result=AuditResult.FAILURE,
                reason="invalid_credentials",
                request_id=request_id_from(request),
            )
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="invalid_credentials",
                detail="Las credenciales no son válidas.",
            )
        login(request, user)
        request.session["authorization_version"] = user.authorization_version
        if isinstance(user, User):
            record_audit_event(
                actor=user,
                action="authentication.login_succeeded",
                target_type="user",
                target_id=str(user.pk),
                result=AuditResult.SUCCESS,
                request_id=request_id_from(request),
            )
        return Response(session_payload(user))


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        request=None,
        responses={204: OpenApiResponse(description="Sesión cerrada")},
    )
    def post(self, request: Request) -> Response:
        if isinstance(request.user, User):
            record_audit_event(
                actor=request.user,
                action="authentication.logout",
                target_type="user",
                target_id=str(request.user.pk),
                result=AuditResult.SUCCESS,
                request_id=request_id_from(request),
            )
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(responses={200: SessionSerializer})
    def get(self, request: Request) -> Response:
        return Response(session_payload(request.user))


class PasswordChangeView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        request=PasswordChangeSerializer,
        responses={204: OpenApiResponse(description="Contraseña actualizada")},
    )
    def post(self, request: Request) -> Response:
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not isinstance(request.user, User):
            return problem_response(
                request=request,
                status_code=status.HTTP_401_UNAUTHORIZED,
                title="Autenticación requerida",
                code="authentication_required",
                detail="Debe iniciar sesión.",
            )
        try:
            user = change_password(
                user=request.user,
                current_password=serializer.validated_data["current_password"],
                new_password=serializer.validated_data["new_password"],
                request_id=request_id_from(request),
            )
        except IncorrectCurrentPasswordError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="incorrect_current_password",
                detail=str(exc),
            )
        except ValidationError as exc:
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="invalid_new_password",
                detail=" ".join(exc.messages),
            )
        update_session_auth_hash(cast(HttpRequest, request), user)
        request.session["authorization_version"] = user.authorization_version
        return Response(status=status.HTTP_204_NO_CONTENT)
