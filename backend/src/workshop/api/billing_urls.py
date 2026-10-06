"""Rutas de operaciones artesanales bajo /api/v1/service-operations/."""

from django.urls import URLPattern, URLResolver, path

from workshop.api import billing_views as v

urlpatterns: list[URLPattern | URLResolver] = [
    path("", v.ArtisanReceivablesView.as_view(), name="artisan-receivables"),
    path(
        "withholdings/pending/",
        v.ArtisanPendingWithholdingsView.as_view(),
        name="artisan-withholdings-pending",
    ),
    path("<int:pk>/", v.ServiceOperationDetailView.as_view(), name="service-operation-detail"),
    path(
        "<int:pk>/document/",
        v.ServiceOperationDocumentView.as_view(),
        name="service-operation-document",
    ),
    path(
        "<int:pk>/void-preview/",
        v.ServiceOperationVoidPreviewView.as_view(),
        name="service-operation-void-preview",
    ),
    path("<int:pk>/void/", v.ServiceOperationVoidView.as_view(), name="service-operation-void"),
    path(
        "<int:pk>/payments/",
        v.ArtisanPaymentListCreateView.as_view(),
        name="service-operation-payments",
    ),
    path(
        "<int:pk>/payments/<int:payment_id>/corrections/",
        v.ArtisanPaymentCorrectionView.as_view(),
        name="service-operation-payment-correction",
    ),
    path(
        "<int:pk>/withholdings/<int:withholding_id>/voucher/",
        v.ArtisanWithholdingVoucherView.as_view(),
        name="service-operation-withholding-voucher",
    ),
    path(
        "<int:pk>/withholdings/<int:withholding_id>/voucher-correction/",
        v.ArtisanWithholdingVoucherCorrectionView.as_view(),
        name="service-operation-withholding-voucher-correction",
    ),
    path(
        "<int:pk>/withholdings/<int:withholding_id>/void/",
        v.ArtisanWithholdingVoidView.as_view(),
        name="service-operation-withholding-void",
    ),
]
