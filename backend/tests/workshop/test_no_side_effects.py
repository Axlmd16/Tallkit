"""Las acciones operativas de la orden no producen efectos económicos ni de inventario.

Sustituye al requisito eliminado «Ausencia de efectos económicos e inventario»: crear, editar,
finalizar, reabrir y gestionar servicios o fotografías siguen sin crear ventas, reservas,
movimientos, operaciones artesanales ni pagos. Esos efectos solo nacen con las acciones
explícitas de repuestos, confirmación de venta, documentación de servicios y cobro.
"""

from typing import Any

import pytest
from django.apps import apps
from tests.workshop.workshop_helpers import (
    add_line,
    create,
    finalize,
    image_bytes,
    key,
    reopen,
    update_intervention,
    upload,
    version,
)

from workshop.application import orders, photos
from workshop.models import (
    ArtisanPayment,
    ArtisanPaymentCorrection,
    ServiceOperation,
    ServiceOperationLine,
)

pytestmark = pytest.mark.django_db

FOREIGN_APPS = (
    "sales",
    "inventory",
    "purchasing",
    "workshop_configuration",
    "catalog",
    "customer_registry",
    "supplier_registry",
)


def snapshot() -> dict[str, list[tuple[Any, ...]]]:
    state: dict[str, list[tuple[Any, ...]]] = {}
    for label in FOREIGN_APPS:
        for model in apps.get_app_config(label).get_models():
            rows = model._default_manager.order_by("pk").values_list()
            state[model._meta.label] = [tuple(map(str, row)) for row in rows]
    return state


def test_full_cycle_has_no_side_effects(manager, artisan, customer, vehicle, make_service) -> None:  # type: ignore[no-untyped-def]
    service = make_service()
    before = snapshot()
    order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=10)
    add_line(manager, order["id"], service_id=service.pk, applied_price="40.00")
    photos.upload_photo(
        actor=manager,
        order_id=order["id"],
        file=upload(image_bytes()),
        description="Antes",
        idempotency_key=key(),
    )
    orders.update_order(
        actor=manager,
        order_id=order["id"],
        payload={
            "diagnosis": "Frenos",
            "expected_version": version(order["id"]),
            "idempotency_key": key(),
        },
    )
    finalize(manager, order["id"])
    reopen(manager, order["id"])
    add_line(manager, order["id"], service_id=service.pk)
    update_intervention(manager, order["id"], work_performed="Ajuste")
    finalize(manager, order["id"])
    assert snapshot() == before
    for model in (
        ServiceOperation,
        ServiceOperationLine,
        ArtisanPayment,
        ArtisanPaymentCorrection,
    ):
        assert not model.objects.exists()
