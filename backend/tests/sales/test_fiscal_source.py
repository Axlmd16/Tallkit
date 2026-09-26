"""Contrato público de lectura fiscal del origen comercial."""

from dataclasses import FrozenInstanceError
from typing import Any

import pytest
from django.db import transaction

from sales.models import Sale


def test_confirmed_sale_source_uses_historical_snapshots_and_decimal_strings(
    confirmed_sale: Any,
) -> None:
    from sales.application.fiscal_source import read_fiscal_source

    built = confirmed_sale(price="11.50", quantity=2)
    source = read_fiscal_source(built["id"])

    assert source.source_id == built["id"]
    assert source.state == "CONFIRMED"
    assert source.grand_total == "23.00"
    assert source.customer_snapshot["schema_version"] == 1
    assert source.issuer_snapshot["entity"]["type"] == "COMERCIAL"
    assert len(source.lines) == 1
    assert source.lines[0].quantity == "2"
    assert source.lines[0].total_amount == "23.00"
    assert source.return_ids == ()
    assert not source.has_void
    with pytest.raises(FrozenInstanceError):
        source.state = "VOIDED"


def test_locking_read_returns_same_source_without_mutating_sale(confirmed_sale: Any) -> None:
    from sales.application.fiscal_source import lock_fiscal_source, read_fiscal_source

    built = confirmed_sale()
    before = Sale.objects.get(pk=built["id"])
    with transaction.atomic():
        locked = lock_fiscal_source(built["id"])
    current = Sale.objects.get(pk=built["id"])

    assert locked == read_fiscal_source(built["id"])
    assert (current.state, current.version, current.internal_number) == (
        before.state,
        before.version,
        before.internal_number,
    )


def _payment(sale: Sale, user: Any, parts: dict[str, str]) -> Any:
    from datetime import date
    from decimal import Decimal
    from uuid import uuid4

    from django.utils import timezone

    from sales.models import CommercialPayment, PaymentPart

    payment = CommercialPayment.objects.create(
        operation_id=uuid4(),
        sale=sale,
        amount=sum((Decimal(v) for v in parts.values()), Decimal("0")),
        effective_at=timezone.now(),
        effective_date=date(2026, 9, 26),
        created_by=user,
    )
    for method, amount in parts.items():
        PaymentPart.objects.create(payment=payment, method=method, amount=Decimal(amount))
    return payment


def test_collected_by_method_counts_only_current_payments(confirmed_sale: Any, seller: Any) -> None:
    from uuid import uuid4

    from sales.application.fiscal_source import read_fiscal_source
    from sales.models import PaymentCorrection

    built = confirmed_sale(price="50.00", quantity=2)
    sale = Sale.objects.get(pk=built["id"])
    assert read_fiscal_source(sale.pk).collected_by_method == {}

    original = _payment(sale, seller, {"EFECTIVO": "30.00"})
    _payment(sale, seller, {"EFECTIVO": "10.00", "TRANSFERENCIA": "20.00"})
    replacement = _payment(sale, seller, {"TRANSFERENCIA": "25.00"})
    PaymentCorrection.objects.create(
        operation_id=uuid4(),
        sale=sale,
        original_payment=original,
        replacement_payment=replacement,
        reason="Medio equivocado",
        created_by=seller,
    )
    collected = read_fiscal_source(sale.pk).collected_by_method
    assert {method: str(amount) for method, amount in collected.items()} == {
        "EFECTIVO": "10.00",
        "TRANSFERENCIA": "45.00",
    }
    with pytest.raises(TypeError):
        collected["EFECTIVO"] = 0  # type: ignore[index]
