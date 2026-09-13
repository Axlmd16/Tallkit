from django.urls import path

from customer_registry.api.views import (
    VehicleActivateView,
    VehicleChangeOwnerView,
    VehicleDeactivateView,
    VehicleDetailView,
    VehicleListCreateView,
    VehicleOwnershipHistoryView,
)

urlpatterns = [
    path("", VehicleListCreateView.as_view(), name="vehicle-list-create"),
    path("<int:pk>/", VehicleDetailView.as_view(), name="vehicle-detail"),
    path("<int:pk>/change-owner/", VehicleChangeOwnerView.as_view(), name="vehicle-change-owner"),
    path(
        "<int:pk>/ownership/",
        VehicleOwnershipHistoryView.as_view(),
        name="vehicle-ownership-history",
    ),
    path("<int:pk>/activate/", VehicleActivateView.as_view(), name="vehicle-activate"),
    path("<int:pk>/deactivate/", VehicleDeactivateView.as_view(), name="vehicle-deactivate"),
]
