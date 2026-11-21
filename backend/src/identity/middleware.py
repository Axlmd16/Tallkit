import time
from collections.abc import Callable

from django.conf import settings
from django.contrib.auth import logout
from django.http import HttpRequest, HttpResponse

from identity.models import User


class AuthorizationVersionMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        user = request.user
        if isinstance(user, User) and user.is_authenticated:
            session_version = request.session.get("authorization_version")
            if not user.is_active or session_version != user.authorization_version:
                logout(request)
        return self.get_response(request)


class SessionInactivityMiddleware:
    """Cierra la sesión autenticada cuando supera el umbral de inactividad configurado."""

    _REFRESH_INTERVAL_SECONDS = 60

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        timeout = int(getattr(settings, "SESSION_INACTIVITY_TIMEOUT_SECONDS", 0))
        if timeout > 0 and isinstance(request.user, User) and request.user.is_authenticated:
            now = int(time.time())
            last_activity = request.session.get("last_activity_ts")
            if isinstance(last_activity, int) and now - last_activity > timeout:
                logout(request)
            elif (
                not isinstance(last_activity, int)
                or now - last_activity >= self._REFRESH_INTERVAL_SECONDS
            ):
                request.session["last_activity_ts"] = now
        return self.get_response(request)
