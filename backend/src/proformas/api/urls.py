"""Rutas de proformas bajo /api/v1/proformas/. Las rutas fijas preceden a las rutas por ID."""

from django.urls import URLPattern, URLResolver, path

from proformas.api import views as v

urlpatterns: list[URLPattern | URLResolver] = [
    path("draft-preview/", v.DraftPreviewView.as_view(), name="proforma-draft-preview"),
    path("customer-options/", v.CustomerOptionsView.as_view(), name="proforma-customer-options"),
    path("product-options/", v.ProductOptionsView.as_view(), name="proforma-product-options"),
    path("", v.ProformaListCreateView.as_view(), name="proforma-list"),
    path("<int:pk>/", v.ProformaDetailView.as_view(), name="proforma-detail"),
    path("<int:pk>/issue-preview/", v.IssuePreviewView.as_view(), name="proforma-issue-preview"),
    path("<int:pk>/issue/", v.IssueView.as_view(), name="proforma-issue"),
    path("<int:pk>/void/", v.VoidView.as_view(), name="proforma-void"),
    path("<int:pk>/copy/", v.CopyView.as_view(), name="proforma-copy"),
    path(
        "<int:pk>/conversion-preview/",
        v.ConversionPreviewView.as_view(),
        name="proforma-conversion-preview",
    ),
    path("<int:pk>/convert/", v.ConvertView.as_view(), name="proforma-convert"),
    path("<int:pk>/document/", v.DocumentView.as_view(), name="proforma-document"),
    path("<int:pk>/document/logo/", v.DocumentLogoView.as_view(), name="proforma-document-logo"),
]
