"""Tiempo de respuesta del resumen comercial con un volumen sintético (RNF-REN-001).

La documentación no fija todavía el volumen objetivo. Se usa uno deliberadamente holgado para un
taller: 5 000 ventas confirmadas con saldo y 5 000 cobros repartidos en los últimos siete días.
"""

import time
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

import pytest
from django.utils import timezone

from sales.application import home_summary, reviews
from sales.models import CommercialPayment, PaymentPart, Sale
from workshop_configuration.models import Warehouse

pytestmark = pytest.mark.django_db
VOLUME = 5000
BUDGET_SECONDS = 2.0


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


def test_summary_stays_within_the_response_budget(
    seller: Any, confirmed_sale: Any, capsys: pytest.CaptureFixture[str]
) -> None:
    template = Sale.objects.get(pk=confirmed_sale(price="100.00", condition="CONTADO")["id"])
    fields = [
        field.attname
        for field in Sale._meta.concrete_fields
        if field.attname not in {"id", "internal_number", "created_at", "updated_at"}
    ]
    values = {name: getattr(template, name) for name in fields}
    Sale.objects.bulk_create(
        Sale(**values, internal_number=f"COM-VOL-{index:06d}") for index in range(VOLUME)
    )
    today = reviews.today()
    now = timezone.now()
    CommercialPayment.objects.bulk_create(
        CommercialPayment(
            operation_id=uuid.uuid4(),
            sale_id=sale_id,
            amount=Decimal("40.00"),
            effective_at=now,
            effective_date=today - timedelta(days=index % 7),
            created_by=seller,
        )
        for index, sale_id in enumerate(
            Sale.objects.exclude(pk=template.pk).values_list("id", flat=True)
        )
    )
    PaymentPart.objects.bulk_create(
        PaymentPart(payment_id=payment_id, method="EFECTIVO", amount=Decimal("40.00"))
        for payment_id in CommercialPayment.objects.values_list("id", flat=True)
    )

    timings: dict[str, float] = {}
    for name, call in (
        ("cash_sales_unpaid", lambda: home_summary.cash_sales_unpaid(seller)),
        ("receivable_balance", lambda: home_summary.receivable_balance(seller)),
        ("collections_by_day", lambda: home_summary.collections_by_day(seller, today=today)),
    ):
        started = time.perf_counter()
        result = call()
        timings[name] = time.perf_counter() - started
        assert result is not None

    assert home_summary.cash_sales_unpaid(seller) == VOLUME + 1
    balance = home_summary.receivable_balance(seller)
    assert balance is not None
    assert balance.balance == Decimal("60.00") * VOLUME + Decimal("100.00")
    with capsys.disabled():
        print("\nRNF-REN-001 · resumen comercial:", {k: f"{v:.3f}s" for k, v in timings.items()})
    assert sum(timings.values()) < BUDGET_SECONDS, timings
