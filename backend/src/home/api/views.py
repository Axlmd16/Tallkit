"""Resumen de inicio: tres lecturas, una por bloque, sin permisos propios.

Basta una sesión vigente. Qué indicadores recibe cada persona lo decide la capa de aplicación
con sus permisos efectivos, sin registrar denegaciones: abrir el inicio no es un intento de
acceso.
"""

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from config.api.errors import ProblemSerializer
from home.api import serializers as sz
from home.application import summary
from identity.models import User

_TAG = "Inicio"
_DENIED = {401: ProblemSerializer, 403: ProblemSerializer}


def _actor(request: Request) -> User:
    if not isinstance(request.user, User):
        raise RuntimeError("La autenticación debe resolver un usuario.")
    return request.user


class PendingView(APIView):
    @extend_schema(
        tags=[_TAG],
        operation_id="home_pending",
        responses={200: sz.PendingSerializer, **_DENIED},
        description=(
            "Pendientes que el usuario puede consultar. Un indicador sin permiso no se incluye. "
            "Cada conteo coincide con su lista de destino filtrada."
        ),
    )
    def get(self, request: Request) -> Response:
        return Response(summary.pending(_actor(request)))


class ReceivablesView(APIView):
    @extend_schema(
        tags=[_TAG],
        operation_id="home_receivables",
        responses={200: sz.ReceivablesSerializer, **_DENIED},
        description="Saldo por cobrar y clientes con deuda por entidad fiscal; nunca se suman.",
    )
    def get(self, request: Request) -> Response:
        return Response(summary.receivables(_actor(request)))


class CollectionsView(APIView):
    @extend_schema(
        tags=[_TAG],
        operation_id="home_collections",
        responses={200: sz.CollectionsSerializer, **_DENIED},
        description=(
            "Dinero cobrado por día en los últimos siete días del negocio, por entidad fiscal. "
            "No incluye retenciones ni pagos corregidos, no resta reembolsos y no es un cierre "
            "de caja."
        ),
    )
    def get(self, request: Request) -> Response:
        return Response(summary.collections(_actor(request)))
