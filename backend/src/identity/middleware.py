from collections.abc import Callable

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
