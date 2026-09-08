from collections.abc import Callable
from uuid import uuid4

import structlog.contextvars
from django.http import HttpRequest, HttpResponse


class RequestIdMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request_id = str(uuid4())
        request.request_id = request_id  # type: ignore[attr-defined]
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        response = self.get_response(request)
        response["X-Request-ID"] = request_id
        structlog.contextvars.clear_contextvars()
        return response
