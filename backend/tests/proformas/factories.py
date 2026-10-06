"""Constructores directos de persistencia para pruebas de modelos y de historia."""

from datetime import date
from decimal import Decimal
from typing import Any

from django.utils import timezone

from proformas.models import Proforma, ProformaLine

ISSUED_ON = date(2026, 10, 6)
UNTIL = date(2026, 10, 13)


def make_proforma(customer: Any, commercial: dict[str, Any], actor: Any, **values: Any) -> Proforma:
    return Proforma.objects.create(
        customer=customer, fiscal_entity=commercial["entity"], created_by=actor, **values
    )


def make_line(proforma: Proforma, product: Any, **values: Any) -> ProformaLine:
    values.setdefault("position", proforma.lines.count() + 1)
    values.setdefault("quantity", Decimal(2))
    return ProformaLine.objects.create(proforma=proforma, product=product, **values)


def issued_values(actor: Any, number: str = "COM-PRO-000001", **extra: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "state": "ISSUED",
        "internal_number": number,
        "issue_date": ISSUED_ON,
        "valid_until": UNTIL,
        "issued_at": timezone.now(),
        "issued_by": actor,
        "base_total": Decimal("20.00"),
        "tax_total": Decimal("3.00"),
        "grand_total": Decimal("23.00"),
        "header_snapshot": {"schema_version": 1},
        "applied_review": "a" * 64,
    }
    values.update(extra)
    return values


def line_amounts(**extra: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "product_snapshot": {"schema_version": 1, "code": "X", "name": "X"},
        "tax_snapshot": {"schema_version": 1},
        "unit_price": Decimal("11.50"),
        "tax_rate": Decimal("15"),
        "base_amount": Decimal("20.00"),
        "tax_amount": Decimal("3.00"),
        "total_amount": Decimal("23.00"),
        "availability_at_issue": Decimal(1),
    }
    values.update(extra)
    return values
