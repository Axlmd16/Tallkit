"""Rutas de la API para configuración operativa y fiscal del taller."""

from django.urls import path

from workshop_configuration.api.views import (
    EntityDetailView,
    EntityListView,
    InitializeView,
    ScheduleSuccessorView,
    SeriesDetailView,
    SeriesListView,
    SeriesReplaceView,
    StatusView,
    TaxDefinitionListCreateView,
    TaxPeriodDetailView,
    TaxPeriodListCreateView,
    WarehouseView,
)

urlpatterns = [
    path("status/", StatusView.as_view(), name="workshop-status"),
    path("initialize/", InitializeView.as_view(), name="workshop-initialize"),
    path("entities/", EntityListView.as_view(), name="entity-list"),
    path("entities/<int:entity_id>/", EntityDetailView.as_view(), name="entity-detail"),
    path("warehouse/", WarehouseView.as_view(), name="warehouse-detail"),
    path("taxes/", TaxDefinitionListCreateView.as_view(), name="tax-list"),
    path("taxes/<int:tax_def_id>/periods/", TaxPeriodListCreateView.as_view(), name="period-list"),
    path("periods/<int:period_id>/", TaxPeriodDetailView.as_view(), name="period-detail"),
    path(
        "periods/<int:period_id>/schedule-successor/",
        ScheduleSuccessorView.as_view(),
        name="schedule-successor",
    ),
    path("series/", SeriesListView.as_view(), name="series-list"),
    path("series/<int:series_id>/", SeriesDetailView.as_view(), name="series-detail"),
    path("series/<int:series_id>/replace/", SeriesReplaceView.as_view(), name="series-replace"),
]
