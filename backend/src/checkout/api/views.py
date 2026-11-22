from __future__ import annotations

from collections.abc import Callable
from typing import Any
from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from checkout.api import serializers as sz
from checkout.application.errors import CheckoutError
from checkout.application.execute import execute_checkout
from checkout.application.preview import preview_maintenance_checkout, preview_sale_checkout
from config.api.errors import ProblemSerializer, problem_response
from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import User
from sales.application.errors import SalesApplicationError
from workshop.application.errors import WorkshopError

_TAG = "Checkout"
_PROBLEMS = {
    400: ProblemSerializer,
    403: ProblemSerializer,
    404: ProblemSerializer,
    409: ProblemSerializer,
}


def _actor(request: Request) -> User:
    if not isinstance(request.user, User):
        raise RuntimeError("La sesión no resolvió un usuario.")
    return request.user


def _request_id(request: Request) -> UUID | None:
    raw = getattr(request, "request_id", None)
    if isinstance(raw, UUID):
        return raw
    if isinstance(raw, str):
        try:
            return UUID(raw)
        except ValueError:
            return None
    return None


def _respond(request: Request, fn: Callable[[], Response]) -> Response:
    try:
        return fn()
    except CheckoutError as exc:
        return problem_response(
            request=request,
            status_code=exc.status,
            code=exc.code,
            title="Cobrar y facturar",
            detail=exc.message,
            errors=exc.errors,
            details=exc.details,
        )
    except BusinessPermissionDeniedError as exc:
        return problem_response(
            request=request,
            status_code=403,
            code="permission_denied",
            title="Acceso denegado",
            detail=str(exc),
        )
    except (SalesApplicationError, WorkshopError) as exc:
        status_code = 404 if exc.code == "not_found" else 409
        return problem_response(
            request=request,
            status_code=status_code,
            code=exc.code,
            title="Error de operación",
            detail=exc.message,
            errors=getattr(exc, "errors", None),
        )


class MaintenanceCheckoutPreviewView(APIView):
    @extend_schema(
        tags=[_TAG],
        operation_id="checkout_maintenance_preview",
        responses={200: sz.CheckoutPreviewResponseSerializer, **_PROBLEMS},
    )
    def get(self, request: Request, order_id: int) -> Response:
        return _respond(
            request,
            lambda: Response(
                preview_maintenance_checkout(
                    actor=_actor(request),
                    order_id=order_id,
                    request_id=_request_id(request),
                )
            ),
        )


class SaleCheckoutPreviewView(APIView):
    @extend_schema(
        tags=[_TAG],
        operation_id="checkout_sale_preview",
        responses={200: sz.CheckoutPreviewResponseSerializer, **_PROBLEMS},
    )
    def get(self, request: Request, sale_id: int) -> Response:
        return _respond(
            request,
            lambda: Response(
                preview_sale_checkout(
                    actor=_actor(request),
                    sale_id=sale_id,
                    request_id=_request_id(request),
                )
            ),
        )


class CheckoutExecuteView(APIView):
    @extend_schema(
        tags=[_TAG],
        operation_id="checkout_execute",
        request=sz.CheckoutExecuteInputSerializer,
        responses={200: sz.CheckoutExecuteResponseSerializer, **_PROBLEMS},
    )
    def post(self, request: Request) -> Response:
        def op() -> Response:
            key = request.headers.get("Idempotency-Key", "").strip()
            if not key:
                raise CheckoutError(
                    "missing_idempotency_key",
                    "Falta el encabezado Idempotency-Key.",
                    status=400,
                )
            serializer = sz.CheckoutExecuteInputSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            data: dict[str, Any] = dict(serializer.validated_data)
            # Convertir Decimal a str para huella JSON determinista.
            for field in ("commercial_payment", "artisan_payment"):
                block = data.get(field)
                if not block:
                    continue
                if block.get("parts") is not None:
                    block["parts"] = [
                        {"method": p["method"], "amount": f"{p['amount']:.2f}"}
                        for p in block["parts"]
                    ]
                if block.get("withholding") is not None:
                    block["withholding"] = {"amount": f"{block['withholding']['amount']:.2f}"}
            status_code, body = execute_checkout(
                actor=_actor(request),
                payload=data,
                idempotency_key=key,
                request_id=_request_id(request),
            )
            return Response(body, status=status_code)

        return _respond(request, op)
