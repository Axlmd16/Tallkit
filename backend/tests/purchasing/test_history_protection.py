"""Una compra confirmada no cambia su contenido económico, solo puede anularse."""

from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from django.db import DatabaseError, connection, transaction
from django.utils import timezone

from purchasing.models import Purchase, PurchaseLine

from .test_models import make_identity, make_purchase

D = Decimal


def raw(sql: str, params: list[Any]) -> None:
    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(sql, params)


@pytest.fixture
def confirmed(supplier: Any, actor: Any, product: Any, tax_definition: Any) -> dict[str, Any]:
    purchase = make_purchase(make_identity(supplier), actor)
    line = PurchaseLine.objects.create(
        purchase=purchase,
        position=1,
        product=product,
        quantity=D(2),
        unit_cost=D("10.00"),
        tax_definition=tax_definition,
        tax_treatment="RECOVERABLE",
    )
    Purchase.objects.filter(pk=purchase.pk).update(
        state="CONFIRMED",
        internal_number="COM-ING-1",
        base_total=D("20.00"),
        confirmed_at=timezone.now(),
        confirmed_by=actor,
    )
    purchase.refresh_from_db()
    return {"purchase": purchase, "line": line}


@pytest.mark.django_db
class TestConfirmedLines:
    def test_lines_of_draft_purchases_are_editable(
        self, supplier: Any, actor: Any, product: Any, tax_definition: Any
    ) -> None:
        purchase = make_purchase(make_identity(supplier), actor)
        line = PurchaseLine.objects.create(
            purchase=purchase,
            position=1,
            product=product,
            quantity=D(1),
            unit_cost=D(1),
            tax_definition=tax_definition,
            tax_treatment="RECOVERABLE",
        )
        PurchaseLine.objects.filter(pk=line.pk).update(quantity=D(3))
        line.delete()

    def test_lines_cannot_be_updated_deleted_or_added_after_confirmation(
        self, confirmed: dict[str, Any], product: Any, tax_definition: Any
    ) -> None:
        pk = confirmed["line"].pk
        with pytest.raises(DatabaseError, match="confirmada"):
            raw("UPDATE purchasing_purchaseline SET quantity = 9 WHERE id = %s", [pk])
        with pytest.raises(DatabaseError, match="confirmada"):
            raw("DELETE FROM purchasing_purchaseline WHERE id = %s", [pk])
        with pytest.raises(DatabaseError, match="confirmada"), transaction.atomic():
            PurchaseLine.objects.create(
                purchase=confirmed["purchase"],
                position=2,
                product=product,
                quantity=D(1),
                unit_cost=D(1),
                tax_definition=tax_definition,
                tax_treatment="RECOVERABLE",
            )


@pytest.mark.django_db
class TestConfirmedPurchase:
    @pytest.mark.parametrize(
        "changes",
        [
            {"document_date": date(2026, 1, 1)},
            {"base_total": D("1.00")},
            {"observation": "cambio"},
            {"internal_number": "COM-ING-99"},
            {"supplier_snapshot": {"schema_version": 1}},
        ],
    )
    def test_economic_content_cannot_change(
        self, confirmed: dict[str, Any], changes: dict[str, Any]
    ) -> None:
        with pytest.raises(DatabaseError, match="confirmada"), transaction.atomic():
            Purchase.objects.filter(pk=confirmed["purchase"].pk).update(**changes)

    def test_confirmed_purchase_cannot_return_to_draft_or_be_deleted(
        self, confirmed: dict[str, Any]
    ) -> None:
        pk = confirmed["purchase"].pk
        with pytest.raises(DatabaseError, match="confirmada"), transaction.atomic():
            Purchase.objects.filter(pk=pk).update(state="DRAFT", internal_number=None)
        with pytest.raises(DatabaseError, match="confirmada"):
            raw("DELETE FROM purchasing_purchase WHERE id = %s", [pk])

    def test_void_metadata_is_the_only_permitted_change(
        self, confirmed: dict[str, Any], actor: Any
    ) -> None:
        purchase = confirmed["purchase"]
        Purchase.objects.filter(pk=purchase.pk).update(
            state="VOIDED",
            version=2,
            void_reason="Error de captura",
            voided_at=timezone.now(),
            voided_by=actor,
        )
        purchase.refresh_from_db()
        assert (purchase.state, purchase.version, purchase.void_reason) == (
            "VOIDED",
            2,
            "Error de captura",
        )
        assert purchase.base_total == D("20.00")

    def test_voided_purchase_is_final(self, confirmed: dict[str, Any]) -> None:
        pk = confirmed["purchase"].pk
        Purchase.objects.filter(pk=pk).update(state="VOIDED", void_reason="x")
        with pytest.raises(DatabaseError, match="confirmada"), transaction.atomic():
            Purchase.objects.filter(pk=pk).update(void_reason="otro")
        with pytest.raises(DatabaseError, match="confirmada"), transaction.atomic():
            Purchase.objects.filter(pk=pk).update(state="CONFIRMED")

    def test_draft_purchases_remain_editable(self, supplier: Any, actor: Any) -> None:
        purchase = make_purchase(make_identity(supplier), actor)
        Purchase.objects.filter(pk=purchase.pk).update(observation="editable")
