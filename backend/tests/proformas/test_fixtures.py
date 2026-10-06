"""Las fixtures sintéticas representan el contexto comercial mínimo de una proforma."""

from decimal import Decimal
from typing import Any

import pytest

from inventory.application.reservations import read_availability
from workshop_configuration.application.numbering import get_numbering_scope_id

pytestmark = pytest.mark.django_db


def test_commercial_context_has_proforma_series(commercial: dict[str, Any]) -> None:
    scope_id = get_numbering_scope_id(entity_type="COMERCIAL", document_type="PROFORMA")
    assert scope_id == commercial["scope"].pk
    assert commercial["series"].code == "COM-PRO"
    assert commercial["series"].last_number == 0


def test_stock_fixture_publishes_availability(
    product: Any, stock: Any, commercial: dict[str, Any]
) -> None:
    stock(product, 5)
    availability = read_availability([product.pk], warehouse_id=commercial["warehouse"].pk)
    assert availability[product.pk].available == Decimal(5)
    assert product.sale_price == Decimal("11.50")
