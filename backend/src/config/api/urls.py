from django.urls import URLPattern, URLResolver, path
from drf_spectacular.views import SpectacularAPIView

from config.api.authentication import CsrfView, LoginView, LogoutView, SessionView
from config.api.health import HealthView

urlpatterns: list[URLPattern | URLResolver] = [
    path("health/", HealthView.as_view(), name="health"),
    path("auth/csrf/", CsrfView.as_view(), name="csrf"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/session/", SessionView.as_view(), name="session"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
]
