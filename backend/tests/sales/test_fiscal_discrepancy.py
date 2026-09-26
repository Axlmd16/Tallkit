"""Los cambios económicos se muestran sin reescribir la preparación fiscal."""

import uuid
from decimal import Decimal
from typing import Any

from django.utils import timezone

from sales.models import CommercialPayment, PaymentPart, Sale, SaleReturn


def test_payment_does_not_change_fiscal_source_discrepancy(
    confirmed_sale: Any, seller: Any
) -> None:
    from fiscal.application.preparations import create_draft, query_discrepancy

    sale = Sale.objects.get(pk=confirmed_sale()["id"])
    result = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=sale.pk,
        idempotency_key="fiscal:create:001",
    )
    now = timezone.now()
    payment = CommercialPayment.objects.create(
        operation_id=uuid.uuid4(),
        sale=sale,
        amount=Decimal("10.00"),
        effective_at=now,
        effective_date=now.date(),
        created_by=seller,
    )
    PaymentPart.objects.create(payment=payment, method="EFECTIVO", amount=Decimal("10.00"))

    discrepancy = query_discrepancy(actor=seller, preparation_id=result.preparation_id)
    assert not discrepancy.source_changed
    assert not discrepancy.state_changed
    assert not discrepancy.corrections_changed


def test_return_after_draft_is_reported_without_changing_snapshot(
    confirmed_sale: Any, seller: Any
) -> None:
    from fiscal.application.preparations import create_draft, query_discrepancy
    from fiscal.models import FiscalPreparation

    sale = Sale.objects.get(pk=confirmed_sale()["id"])
    result = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=sale.pk,
        idempotency_key="fiscal:create:001",
    )
    now = timezone.now()
    sale_return = SaleReturn.objects.create(
        operation_id=uuid.uuid4(),
        sale=sale,
        reason="Devolución posterior",
        effective_at=now,
        effective_date=now.date(),
        base_total=Decimal("8.70"),
        tax_total=Decimal("1.30"),
        grand_total=Decimal("10.00"),
        created_by=seller,
    )

    discrepancy = query_discrepancy(actor=seller, preparation_id=result.preparation_id)
    preparation = FiscalPreparation.objects.get(pk=result.preparation_id)
    assert discrepancy.corrections_changed
    assert discrepancy.current_correction_ids == (sale_return.pk,)
    assert preparation.state == "DRAFT"
    assert preparation.snapshot is None


def test_voided_origin_is_reported_without_automatic_cancellation(
    confirmed_sale: Any, seller: Any
) -> None:
    from fiscal.application.preparations import create_draft, query_discrepancy
    from fiscal.models import FiscalPreparation

    sale = Sale.objects.get(pk=confirmed_sale()["id"])
    result = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=sale.pk,
        idempotency_key="fiscal:create:001",
    )
    Sale.objects.filter(pk=sale.pk).update(state="VOIDED", version=sale.version + 1)

    discrepancy = query_discrepancy(actor=seller, preparation_id=result.preparation_id)
    assert discrepancy.source_changed
    assert discrepancy.state_changed
    assert discrepancy.current_state == "VOIDED"
    assert FiscalPreparation.objects.get(pk=result.preparation_id).state == "DRAFT"
