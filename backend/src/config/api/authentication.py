from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from config.api.errors import problem_response


class LoginSerializer(serializers.Serializer[dict[str, object]]):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(trim_whitespace=False, write_only=True)


class SessionSerializer(serializers.Serializer[dict[str, object]]):
    authenticated = serializers.BooleanField()
    username = serializers.CharField(allow_null=True)


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
            return problem_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Solicitud inválida",
                code="invalid_credentials",
                detail="Las credenciales no son válidas.",
            )
        login(request, user)
        return Response({"authenticated": True, "username": user.get_username()})


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        request=None,
        responses={204: OpenApiResponse(description="Sesión cerrada")},
    )
    def post(self, request: Request) -> Response:
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(responses={200: SessionSerializer})
    def get(self, request: Request) -> Response:
        username = request.user.get_username() if request.user.is_authenticated else None
        return Response({"authenticated": request.user.is_authenticated, "username": username})
