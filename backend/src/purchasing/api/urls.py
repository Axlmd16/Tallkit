"""Rutas de entradas y compras bajo /api/v1/purchases/."""

from django.urls import URLPattern, URLResolver, path

from purchasing.api import views as v

urlpatterns: list[URLPattern | URLResolver] = [
    path("", v.PurchaseListView.as_view(), name="purchase-list"),
    path("entries/", v.EntryCreateView.as_view(), name="purchase-entry-create"),
    path("entries/review/", v.EntryReviewView.as_view(), name="purchase-entry-review"),
    path("<int:pk>/", v.PurchaseDetailView.as_view(), name="purchase-detail"),
    path(
        "<int:pk>/void-preview/", v.PurchaseVoidPreviewView.as_view(), name="purchase-void-preview"
    ),
    path("<int:pk>/void/", v.PurchaseVoidView.as_view(), name="purchase-void"),
]
