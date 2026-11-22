from django.urls import URLPattern, path

from checkout.api.views import (
    CheckoutExecuteView,
    MaintenanceCheckoutPreviewView,
    SaleCheckoutPreviewView,
)

urlpatterns: list[URLPattern] = [
    path(
        "maintenance/<int:order_id>/",
        MaintenanceCheckoutPreviewView.as_view(),
        name="checkout-maintenance-preview",
    ),
    path(
        "sales/<int:sale_id>/",
        SaleCheckoutPreviewView.as_view(),
        name="checkout-sale-preview",
    ),
    path(
        "execute/",
        CheckoutExecuteView.as_view(),
        name="checkout-execute",
    ),
]
