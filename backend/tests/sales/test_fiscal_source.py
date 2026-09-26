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
