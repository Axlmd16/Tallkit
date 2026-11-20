from django.urls import URLPattern, path

from home.api import views

urlpatterns: list[URLPattern] = [
    path("pending/", views.PendingView.as_view(), name="home-pending"),
    path("receivables/", views.ReceivablesView.as_view(), name="home-receivables"),
    path("collections/", views.CollectionsView.as_view(), name="home-collections"),
    path("customers/debtors/", views.DebtorsView.as_view(), name="home-customer-debtors"),
    path(
        "customers/<int:customer_id>/summary/",
        views.CustomerSummaryView.as_view(),
        name="home-customer-summary",
    ),
]
