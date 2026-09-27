"""Rutas de catálogo bajo /api/v1/. ``tax-options/`` precede a las rutas por ID."""

from django.urls import URLPattern, URLResolver, path
from rest_framework.views import APIView

from catalog.api import views as v

urlpatterns: list[URLPattern | URLResolver] = []


def _crud(
    prefix: str,
    name: str,
    list_view: type[APIView],
    detail: type[APIView],
    on: type[APIView],
    off: type[APIView],
) -> None:
    urlpatterns.extend(
        [
            path(f"{prefix}/", list_view.as_view(), name=f"{name}-list"),
            path(f"{prefix}/<int:pk>/", detail.as_view(), name=f"{name}-detail"),
            path(f"{prefix}/<int:pk>/activate/", on.as_view(), name=f"{name}-activate"),
            path(f"{prefix}/<int:pk>/deactivate/", off.as_view(), name=f"{name}-deactivate"),
        ]
    )


urlpatterns += [
    path("products/tax-options/", v.ProductTaxOptionsView.as_view(), name="product-tax-options"),
    path("products/label-data/", v.ProductLabelDataView.as_view(), name="product-label-data"),
    path("services/tax-options/", v.ServiceTaxOptionsView.as_view(), name="service-tax-options"),
]
_crud(
    "products",
    "product",
    v.ProductListCreateView,
    v.ProductDetailView,
    v.ProductActivateView,
    v.ProductDeactivateView,
)
_crud(
    "services",
    "service",
    v.ServiceListCreateView,
    v.ServiceDetailView,
    v.ServiceActivateView,
    v.ServiceDeactivateView,
)
_crud(
    "product-categories",
    "product-category",
    v.CategoryListCreateView,
    v.CategoryDetailView,
    v.CategoryActivateView,
    v.CategoryDeactivateView,
)
_crud(
    "measurement-units",
    "measurement-unit",
    v.UnitListCreateView,
    v.UnitDetailView,
    v.UnitActivateView,
    v.UnitDeactivateView,
)
_crud(
    "product-brands",
    "product-brand",
    v.BrandListCreateView,
    v.BrandDetailView,
    v.BrandActivateView,
    v.BrandDeactivateView,
)
