from typing import Any

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ProblemSerializer(serializers.Serializer[dict[str, object]]):
    type = serializers.CharField()
    title = serializers.CharField()
    status = serializers.IntegerField()
    detail = serializers.CharField()
    code = serializers.CharField()
    request_id = serializers.CharField(allow_null=True)


def problem_response(
    *, request: Request, status_code: int, title: str, code: str, detail: str
) -> Response:
    return Response(
        {
            "type": "about:blank",
            "title": title,
            "status": status_code,
            "detail": detail,
            "code": code,
            "request_id": getattr(request, "request_id", None),
        },
        status=status_code,
        content_type="application/problem+json",
    )


def problem_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = exception_handler(exc, context)
    if response is None:
        return None

    request = context["request"]
    detail = "La solicitud no pudo completarse."
    if isinstance(response.data, dict) and isinstance(response.data.get("detail"), str):
        detail = response.data["detail"]
    response.data = {
        "type": "about:blank",
        "title": "Solicitud rechazada",
        "status": response.status_code,
        "detail": detail,
        "code": getattr(exc, "default_code", "request_rejected"),
        "request_id": getattr(request, "request_id", None),
    }
    response.content_type = "application/problem+json"
    return response
