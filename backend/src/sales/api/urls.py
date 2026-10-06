"""Rutas comerciales bajo /api/v1/sales/. Las rutas fijas preceden a las rutas por ID."""

from django.urls import URLPattern, URLResolver, path

from sales.api import views as v

urlpatterns: list[URLPattern | URLResolver] = [
    path("draft-preview/", v.DraftPreviewView.as_view(), name="sale-draft-preview"),
    path("receivables/", v.ReceivablesView.as_view(), name="sale-receivables"),
    path(
        "withholdings/pending/",
        v.PendingWithholdingsView.as_view(),
        name="sale-withholdings-pending",
    ),
    path("customer-options/", v.CustomerOptionsView.as_view(), name="sale-customer-options"),
    path("product-options/", v.ProductOptionsView.as_view(), name="sale-product-options"),
    path(
        "operations/<uuid:operation_id>/",
        v.OperationStatusView.as_view(),
        name="sale-operation-status",
    ),
    path("", v.SaleListCreateView.as_view(), name="sale-list"),
    path("<int:pk>/", v.SaleDetailView.as_view(), name="sale-detail"),
    path("<int:pk>/preview/", v.SalePreviewView.as_view(), name="sale-preview"),
    path("<int:pk>/confirm/", v.SaleConfirmView.as_view(), name="sale-confirm"),
    path("<int:pk>/document/", v.SaleDocumentView.as_view(), name="sale-document"),
    path("<int:pk>/payments/", v.PaymentListCreateView.as_view(), name="sale-payments"),
    path("<int:pk>/payments/preview/", v.PaymentPreviewView.as_view(), name="sale-payment-preview"),
    path(
        "<int:pk>/payments/<int:payment_id>/correction-preview/",
        v.CorrectionPreviewView.as_view(),
        name="sale-correction-preview",
    ),
    path(
        "<int:pk>/payments/<int:payment_id>/correct/",
        v.CorrectionView.as_view(),
        name="sale-correct",
    ),
    path("<int:pk>/withholdings/", v.WithholdingListView.as_view(), name="sale-withholdings"),
    path(
        "<int:pk>/withholdings/<int:withholding_id>/voucher/",
        v.WithholdingVoucherView.as_view(),
        name="sale-withholding-voucher",
    ),
    path(
        "<int:pk>/withholdings/<int:withholding_id>/voucher-correction/",
        v.WithholdingVoucherCorrectionView.as_view(),
        name="sale-withholding-voucher-correction",
    ),
    path(
        "<int:pk>/withholdings/<int:withholding_id>/void/",
        v.WithholdingVoidView.as_view(),
        name="sale-withholding-void",
    ),
    path("<int:pk>/returns/", v.ReturnListCreateView.as_view(), name="sale-returns"),
    path("<int:pk>/returns/preview/", v.ReturnPreviewView.as_view(), name="sale-return-preview"),
    path("<int:pk>/refunds/", v.RefundListCreateView.as_view(), name="sale-refunds"),
    path("<int:pk>/refunds/preview/", v.RefundPreviewView.as_view(), name="sale-refund-preview"),
    path("<int:pk>/void-preview/", v.VoidPreviewView.as_view(), name="sale-void-preview"),
    path("<int:pk>/void/", v.VoidView.as_view(), name="sale-void"),
]
