from django.urls import URLPattern, URLResolver, include, path
from drf_spectacular.views import SpectacularAPIView

from config.api.health import HealthView
from identity.api.audit import AuditEventDetailView, AuditEventListView
from identity.api.authentication import (
    CsrfView,
    LoginView,
    LogoutView,
    PasswordChangeView,
    SessionView,
)
from identity.api.roles import RoleListView
from identity.api.users import (
    UserActivateView,
    UserDeactivateView,
    UserDetailView,
    UserListCreateView,
    UserPasswordResetView,
)

urlpatterns: list[URLPattern | URLResolver] = [
    path("health/", HealthView.as_view(), name="health"),
    path("auth/csrf/", CsrfView.as_view(), name="csrf"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/session/", SessionView.as_view(), name="session"),
    path(
        "auth/change-password/",
        PasswordChangeView.as_view(),
        name="change-password",
    ),
    path("users/", UserListCreateView.as_view(), name="user-list"),
    path("customers/", include("customer_registry.api.urls")),
    path("vehicle-brands/", include("customer_registry.api.brands_urls")),
    path("vehicles/", include("customer_registry.api.vehicles_urls")),
    path("workshop-configuration/", include("workshop_configuration.api.urls")),
    path("roles/", RoleListView.as_view(), name="role-list"),
    path("audit/", AuditEventListView.as_view(), name="audit-list"),
    path("audit/<int:event_id>/", AuditEventDetailView.as_view(), name="audit-detail"),
    path("users/<int:user_id>/", UserDetailView.as_view(), name="user-detail"),
    path(
        "users/<int:user_id>/activate/",
        UserActivateView.as_view(),
        name="user-activate",
    ),
    path(
        "users/<int:user_id>/deactivate/",
        UserDeactivateView.as_view(),
        name="user-deactivate",
    ),
    path(
        "users/<int:user_id>/reset-password/",
        UserPasswordResetView.as_view(),
        name="user-reset-password",
    ),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
]
