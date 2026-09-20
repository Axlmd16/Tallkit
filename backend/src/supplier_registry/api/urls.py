from django.urls import URLPattern, URLResolver, path

from supplier_registry.api import views

urlpatterns: list[URLPattern | URLResolver] = [
    path("", views.SupplierListCreateView.as_view(), name="supplier-list"),
    path("matches/", views.SupplierMatchesView.as_view(), name="supplier-matches"),
    path("<int:pk>/", views.SupplierDetailView.as_view(), name="supplier-detail"),
    path("<int:pk>/activate/", views.SupplierActivateView.as_view(), name="supplier-activate"),
    path(
        "<int:pk>/deactivate/", views.SupplierDeactivateView.as_view(), name="supplier-deactivate"
    ),
]
