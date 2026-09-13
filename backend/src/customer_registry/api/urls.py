from django.urls import path

from customer_registry.api.views import (
    CustomerActivateView,
    CustomerDeactivateView,
    CustomerDetailView,
    CustomerListCreateView,
    CustomerMatchesView,
    CustomerVehiclesView,
)

urlpatterns = [
    path("", CustomerListCreateView.as_view(), name="customer-list-create"),
    path("matches/", CustomerMatchesView.as_view(), name="customer-matches"),
    path("<int:customer_id>/", CustomerDetailView.as_view(), name="customer-detail"),
    path("<int:customer_id>/vehicles/", CustomerVehiclesView.as_view(), name="customer-vehicles"),
    path("<int:customer_id>/activate/", CustomerActivateView.as_view(), name="customer-activate"),
    path(
        "<int:customer_id>/deactivate/",
        CustomerDeactivateView.as_view(),
        name="customer-deactivate",
    ),
]
