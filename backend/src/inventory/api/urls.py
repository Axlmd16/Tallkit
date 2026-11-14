"""Rutas de inventario bajo /api/v1/inventory/."""

from django.urls import URLPattern, URLResolver, path

from inventory.api import views as v

urlpatterns: list[URLPattern | URLResolver] = [
    path("", v.StockListView.as_view(), name="inventory-stock-list"),
    path("stock/quantities/", v.StockQuantitiesView.as_view(), name="inventory-stock-quantities"),
    path("products/<int:pk>/", v.StockItemView.as_view(), name="inventory-stock-item"),
    path("products/<int:pk>/kardex/", v.KardexView.as_view(), name="inventory-kardex"),
    path("operations/", v.OperationListCreateView.as_view(), name="inventory-operation-list"),
    path(
        "operations/<int:pk>/", v.OperationDetailView.as_view(), name="inventory-operation-detail"
    ),
    path(
        "operations/<int:pk>/preview/",
        v.OperationPreviewView.as_view(),
        name="inventory-operation-preview",
    ),
    path(
        "operations/<int:pk>/confirm/",
        v.OperationConfirmView.as_view(),
        name="inventory-operation-confirm",
    ),
    path(
        "operations/<int:pk>/reverse-preview/",
        v.OperationReversePreviewView.as_view(),
        name="inventory-operation-reverse-preview",
    ),
    path(
        "operations/<int:pk>/reverse/",
        v.OperationReverseView.as_view(),
        name="inventory-operation-reverse",
    ),
]
