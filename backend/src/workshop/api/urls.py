"""Rutas del taller bajo /api/v1/maintenance-orders/. Las rutas fijas preceden a las de ID."""

from django.urls import URLPattern, URLResolver, path

from workshop.api import views as v

urlpatterns: list[URLPattern | URLResolver] = [
    path("customer-options/", v.CustomerOptionsView.as_view(), name="maintenance-customer-options"),
    path("vehicle-options/", v.VehicleOptionsView.as_view(), name="maintenance-vehicle-options"),
    path("service-options/", v.ServiceOptionsView.as_view(), name="maintenance-service-options"),
    path("", v.OrderListCreateView.as_view(), name="maintenance-order-list"),
    path("<int:pk>/", v.OrderDetailView.as_view(), name="maintenance-order-detail"),
    path(
        "<int:pk>/current-intervention/",
        v.CurrentInterventionView.as_view(),
        name="maintenance-current-intervention",
    ),
    path("<int:pk>/service-lines/", v.ServiceLineCreateView.as_view(), name="maintenance-lines"),
    path(
        "<int:pk>/service-lines/<int:line_id>/",
        v.ServiceLineDetailView.as_view(),
        name="maintenance-line-detail",
    ),
    path(
        "<int:pk>/service-lines/<int:line_id>/remove/",
        v.ServiceLineRemoveView.as_view(),
        name="maintenance-line-remove",
    ),
    path("<int:pk>/finalize/", v.FinalizeView.as_view(), name="maintenance-finalize"),
    path("<int:pk>/reopen/", v.ReopenView.as_view(), name="maintenance-reopen"),
    path("<int:pk>/photos/", v.PhotoCreateView.as_view(), name="maintenance-photos"),
    path(
        "<int:pk>/photos/<int:photo_id>/remove/",
        v.PhotoRemoveView.as_view(),
        name="maintenance-photo-remove",
    ),
    path(
        "<int:pk>/photos/<int:photo_id>/file/",
        v.PhotoFileView.as_view(),
        name="maintenance-photo-file",
    ),
    path(
        "<int:pk>/photos/<int:photo_id>/thumbnail/",
        v.PhotoThumbnailView.as_view(),
        name="maintenance-photo-thumbnail",
    ),
]
