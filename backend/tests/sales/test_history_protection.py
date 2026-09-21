"""La historia comercial confirmada es inmutable, tanto por ORM como por SQL directo."""

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.db import DatabaseError, connection, transaction
from django.utils import timezone

from sales.models import (
    CommercialPayment,
    CommercialRefund,
    PaymentCorrection,
    PaymentPart,
    RefundPart,
    Sale,
    SaleCostAllocation,
    SaleLine,
    SaleReturn,
    SaleReturnLine,
    SaleVoid,
)

from .test_models import confirmed_values, make_line, make_payment, make_return, make_sale

D = Decimal


def raw(sql: str, params: list[Any]) -> None:
    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(sql, params)


@pytest.fixture
def confirmed(
    customer: Any, commercial: Any, warehouse: Any, actor: Any, product: Any, make_movement: Any
) -> dict[str, Any]:
    sale = make_sale(customer, commercial, warehouse, actor)
    line = make_line(sale, product, quantity=D(2))
    movement = make_movement(product)
    allocation = SaleCostAllocation.objects.create(
        sale_line=line,
        movement=movement,
        quantity=D(2),
        published_unit_cost=D("4.000000"),
        applied_value=D("8.000000"),
    )
    Sale.objects.filter(pk=sale.pk).update(**confirmed_values(confirmed_by=actor))
    sale.refresh_from_db()
    payment = make_payment(sale, actor, amount="10.00", parts=False)
    part = PaymentPart.objects.create(payment=payment, method="EFECTIVO", amount=D("10.00"))
    sale_return = make_return(sale, actor)
    return_line = SaleReturnLine.objects.create(
        sale_return=sale_return,
        sale_line=line,
        fit_quantity=D(1),
        unfit_quantity=D(0),
        base_amount=D(10),
        tax_amount=D("1.50"),
        total_amount=D("11.50"),
    )
    refund = CommercialRefund.objects.create(
        operation_id=uuid.uuid4(),
        sale=sale,
        origin="RETURN",
        sale_return=sale_return,
        amount=D("1.00"),
        effective_at=timezone.now(),
        effective_date=timezone.localdate(),
        created_by=actor,
    )
    refund_part = RefundPart.objects.create(refund=refund, method="EFECTIVO", amount=D("1.00"))
    correction = PaymentCorrection.objects.create(
        operation_id=uuid.uuid4(),
        sale=sale,
        original_payment=make_payment(sale, actor, amount="2.00"),
        reason="Error",
        created_by=actor,
    )
    void = SaleVoid.objects.create(
        sale=make_sale(customer, commercial, warehouse, actor),
        reason="x",
        voided_at=timezone.now(),
        voided_by=actor,
        reversal_operation=movement.operation,
    )
    return {
        "sale": sale,
        "line": line,
        "allocation": allocation,
        "payment": payment,
        "part": part,
        "return": sale_return,
        "return_line": return_line,
        "refund": refund,
        "refund_part": refund_part,
        "correction": correction,
        "void": void,
    }


IMMUTABLE = [
    ("payment", CommercialPayment, "amount", D("99.00"), "sales_commercialpayment"),
    ("part", PaymentPart, "amount", D("99.00"), "sales_paymentpart"),
    ("allocation", SaleCostAllocation, "applied_value", D("1.000000"), "sales_salecostallocation"),
    ("return", SaleReturn, "reason", "otro", "sales_salereturn"),
    ("return_line", SaleReturnLine, "total_amount", D("1.00"), "sales_salereturnline"),
    ("refund", CommercialRefund, "amount", D("9.00"), "sales_commercialrefund"),
    ("refund_part", RefundPart, "amount", D("9.00"), "sales_refundpart"),
    ("correction", PaymentCorrection, "reason", "otro", "sales_paymentcorrection"),
    ("void", SaleVoid, "reason", "otro", "sales_salevoid"),
]


@pytest.mark.django_db
class TestImmutableFacts:
    @pytest.mark.parametrize(("key", "model", "field", "value", "table"), IMMUTABLE)
    def test_orm_update_is_rejected(
        self, confirmed: dict[str, Any], key: str, model: Any, field: str, value: Any, table: str
    ) -> None:
        with pytest.raises(DatabaseError), transaction.atomic():
            model.objects.filter(pk=confirmed[key].pk).update(**{field: value})

    @pytest.mark.parametrize(("key", "model", "field", "value", "table"), IMMUTABLE)
    def test_orm_delete_is_rejected(
        self, confirmed: dict[str, Any], key: str, model: Any, field: str, value: Any, table: str
    ) -> None:
        with pytest.raises(DatabaseError), transaction.atomic():
            model.objects.filter(pk=confirmed[key].pk).delete()

    @pytest.mark.parametrize(("key", "model", "field", "value", "table"), IMMUTABLE)
    def test_direct_sql_update_and_delete_are_rejected(
        self, confirmed: dict[str, Any], key: str, model: Any, field: str, value: Any, table: str
    ) -> None:
        pk = confirmed[key].pk
        with pytest.raises(DatabaseError):
            raw(f"UPDATE {table} SET {field} = {field} WHERE id = %s", [pk])  # noqa: S608
        with pytest.raises(DatabaseError):
            raw(f"DELETE FROM {table} WHERE id = %s", [pk])  # noqa: S608


@pytest.mark.django_db
class TestConfirmedSaleAndLines:
    def test_draft_lines_are_editable_and_deletable(
        self, customer: Any, commercial: Any, warehouse: Any, actor: Any, product: Any
    ) -> None:
        sale = make_sale(customer, commercial, warehouse, actor)
        line = make_line(sale, product)
        SaleLine.objects.filter(pk=line.pk).update(quantity=D(5))
        SaleLine.objects.filter(pk=line.pk).delete()
        Sale.objects.filter(pk=sale.pk).delete()

    def test_confirmed_lines_cannot_change_or_be_removed(self, confirmed: dict[str, Any]) -> None:
        line = confirmed["line"]
        with pytest.raises(DatabaseError), transaction.atomic():
            SaleLine.objects.filter(pk=line.pk).update(quantity=D(9))
        with pytest.raises(DatabaseError), transaction.atomic():
            SaleLine.objects.filter(pk=line.pk).delete()
        with pytest.raises(DatabaseError):
            raw("UPDATE sales_saleline SET unit_price = 1 WHERE id = %s", [line.pk])
        with pytest.raises(DatabaseError), transaction.atomic():
            make_line(confirmed["sale"], line.product, position=2)

    @pytest.mark.parametrize(
        "changes",
        [
            {"grand_total": D("1.00")},
            {"base_total": D("1.00")},
            {"tax_total": D("9.00")},
            {"internal_number": "COM-VEN-000777"},
            {"customer_snapshot": {"schema_version": 1, "name": "otro"}},
            {"condition": "CONTADO"},
            {"notes": "cambiada"},
            {"operational_date": "2020-01-01"},
        ],
    )
    def test_confirmed_sale_original_data_cannot_change(
        self, confirmed: dict[str, Any], changes: dict[str, Any]
    ) -> None:
        with pytest.raises(DatabaseError), transaction.atomic():
            Sale.objects.filter(pk=confirmed["sale"].pk).update(**changes)

    def test_confirmed_sale_cannot_be_deleted(self, confirmed: dict[str, Any]) -> None:
        with pytest.raises(DatabaseError), transaction.atomic():
            Sale.objects.filter(pk=confirmed["sale"].pk).delete()
        with pytest.raises(DatabaseError):
            raw("DELETE FROM sales_sale WHERE id = %s", [confirmed["sale"].pk])

    def test_version_can_increase_while_confirmed(self, confirmed: dict[str, Any]) -> None:
        Sale.objects.filter(pk=confirmed["sale"].pk).update(version=2)
        assert Sale.objects.get(pk=confirmed["sale"].pk).version == 2

    def test_only_the_authorized_void_transition_is_allowed(
        self, confirmed: dict[str, Any], actor: Any, make_movement: Any, product: Any
    ) -> None:
        operation = make_movement(product).operation
        Sale.objects.filter(pk=confirmed["sale"].pk).update(
            state="VOIDED",
            version=3,
            void_reason="Error",
            voided_at=timezone.now(),
            voided_by=actor,
            void_operation=operation,
        )
        sale = Sale.objects.get(pk=confirmed["sale"].pk)
        assert sale.state == "VOIDED"
        assert sale.grand_total == D("23.00")
        with pytest.raises(DatabaseError), transaction.atomic():
            Sale.objects.filter(pk=sale.pk).update(state="CONFIRMED")
        with pytest.raises(DatabaseError), transaction.atomic():
            Sale.objects.filter(pk=sale.pk).update(void_reason="otra")

    def test_void_transition_cannot_alter_original_amounts(self, confirmed: dict[str, Any]) -> None:
        with pytest.raises(DatabaseError), transaction.atomic():
            Sale.objects.filter(pk=confirmed["sale"].pk).update(
                state="VOIDED", grand_total=D("1.00")
            )

    def test_confirmed_state_cannot_carry_void_metadata(self, confirmed: dict[str, Any]) -> None:
        with pytest.raises(DatabaseError), transaction.atomic():
            Sale.objects.filter(pk=confirmed["sale"].pk).update(void_reason="x")


def check_now() -> None:
    with connection.cursor() as cursor:
        cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")


def refund_for(sale: Sale, sale_return: Any, actor: Any) -> None:
    refund = CommercialRefund.objects.create(
        operation_id=uuid.uuid4(),
        sale=sale,
        origin="RETURN",
        sale_return=sale_return,
        amount=D("1.00"),
        effective_at=timezone.now(),
        effective_date=timezone.localdate(),
        created_by=actor,
    )
    RefundPart.objects.create(refund=refund, method="EFECTIVO", amount=D("1.00"))
    check_now()


def cross_sale_correction(sale: Sale, original: Any, replacement: Any, actor: Any) -> None:
    PaymentCorrection.objects.create(
        operation_id=uuid.uuid4(),
        sale=sale,
        original_payment=original,
        replacement_payment=replacement,
        reason="Cruzado",
        created_by=actor,
    )
    check_now()


@pytest.mark.django_db
class TestDeferredConsistency:
    def test_refund_return_must_belong_to_the_same_sale(
        self, confirmed: dict[str, Any], customer: Any, commercial: Any, warehouse: Any, actor: Any
    ) -> None:
        other = make_sale(customer, commercial, warehouse, actor)
        with pytest.raises(DatabaseError), transaction.atomic():
            refund_for(other, confirmed["return"], actor)

    def test_correction_replacement_must_belong_to_the_same_sale(
        self, confirmed: dict[str, Any], customer: Any, commercial: Any, warehouse: Any, actor: Any
    ) -> None:
        other = make_sale(customer, commercial, warehouse, actor)
        foreign = make_payment(other, actor, amount="1.00")
        with pytest.raises(DatabaseError), transaction.atomic():
            cross_sale_correction(confirmed["sale"], confirmed["payment"], foreign, actor)
