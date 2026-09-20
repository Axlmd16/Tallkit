"""Rutas de compras bajo /api/v1/purchases/. ``tax-options/`` precede a las rutas por ID."""

from django.urls import URLPattern, URLResolver, path

from purchasing.api import views as v

urlpatterns: list[URLPattern | URLResolver] = [
    path("tax-options/", v.PurchaseTaxOptionsView.as_view(), name="purchase-tax-options"),
    path("", v.PurchaseListCreateView.as_view(), name="purchase-list"),
    path("<int:pk>/", v.PurchaseDetailView.as_view(), name="purchase-detail"),
    path("<int:pk>/preview/", v.PurchasePreviewView.as_view(), name="purchase-preview"),
    path("<int:pk>/confirm/", v.PurchaseConfirmView.as_view(), name="purchase-confirm"),
    path(
        "<int:pk>/void-preview/", v.PurchaseVoidPreviewView.as_view(), name="purchase-void-preview"
    ),
    path("<int:pk>/void/", v.PurchaseVoidView.as_view(), name="purchase-void"),
    path("<int:pk>/replacement/", v.PurchaseReplacementView.as_view(), name="purchase-replacement"),
]
