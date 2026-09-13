from django.urls import path

from customer_registry.api.views import (
    VehicleBrandActivateView,
    VehicleBrandDeactivateView,
    VehicleBrandDetailView,
    VehicleBrandListCreateView,
)

urlpatterns = [
    path("", VehicleBrandListCreateView.as_view(), name="vehicle-brand-list-create"),
    path("<int:pk>/", VehicleBrandDetailView.as_view(), name="vehicle-brand-detail"),
    path("<int:pk>/activate/", VehicleBrandActivateView.as_view(), name="vehicle-brand-activate"),
    path(
        "<int:pk>/deactivate/",
        VehicleBrandDeactivateView.as_view(),
        name="vehicle-brand-deactivate",
    ),
]
