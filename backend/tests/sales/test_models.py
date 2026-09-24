"""Restricciones de persistencia comercial."""

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.db import IntegrityError, connection, transaction
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
    SalesCommand,
    SaleVoid,
)

D = Decimal


def make_sale(customer: Any, commercial: Any, warehouse: Any, actor: Any, **overrides: Any) -> Sale:
    values: dict[str, Any] = {
        "customer": customer,
        "fiscal_entity": commercial["entity"],
        "warehouse": warehouse,
        "condition": "CREDITO",
        "created_by": actor,
    }
    values.update(overrides)
    return Sale.objects.create(**values)


def confirmed_values(**overrides: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "state": "CONFIRMED",
        "internal_number": "COM-VEN-000001",
        "operational_date": timezone.localdate(),
        "base_total": D("20.00"),
        "tax_total": D("3.00"),
        "grand_total": D("23.00"),
        "confirmed_at": timezone.now(),
    }
    values.update(overrides)
    return values


@pytest.fixture
def sale(customer: Any, commercial: Any, warehouse: Any, actor: Any) -> Sale:
    return make_sale(customer, commercial, warehouse, actor)


def make_line(sale: Sale, product: Any, position: int = 1, **overrides: Any) -> SaleLine:
    values: dict[str, Any] = {
        "sale": sale,
        "position": position,
        "product": product,
        "quantity": D(2),
    }
    values.update(overrides)
    return SaleLine.objects.create(**values)


@pytest.mark.django_db
class TestSale:
    def test_origin_defaults_to_direct(self, sale: Sale) -> None:
        assert (sale.origin_type, sale.origin_order_id, sale.origin_reference) == (
            "DIRECT",
            None,
            "",
        )

    def test_origin_type_and_order_are_coherent(
        self,
        customer: Any,
        commercial: Any,
        warehouse: Any,
        actor: Any,
        maintenance_order: Any,
    ) -> None:
        linked = make_sale(
            customer,
            commercial,
            warehouse,
            actor,
            origin_type="MAINTENANCE",
            origin_order=maintenance_order,
            origin_reference=maintenance_order.number,
        )
        assert linked.origin_order_id == maintenance_order.pk
        with pytest.raises(IntegrityError), transaction.atomic():
            make_sale(
                customer,
                commercial,
                warehouse,
                actor,
                origin_type="MAINTENANCE",
            )
        with pytest.raises(IntegrityError), transaction.atomic():
            make_sale(
                customer,
                commercial,
                warehouse,
                actor,
                origin_order=maintenance_order,
            )

    def test_only_one_draft_can_exist_per_maintenance_order(
        self,
        customer: Any,
        commercial: Any,
        warehouse: Any,
        actor: Any,
        maintenance_order: Any,
    ) -> None:
        linked = {
            "origin_type": "MAINTENANCE",
            "origin_order": maintenance_order,
            "origin_reference": maintenance_order.number,
        }
        make_sale(customer, commercial, warehouse, actor, **linked)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_sale(customer, commercial, warehouse, actor, **linked)
        make_sale(
            customer,
            commercial,
            warehouse,
            actor,
            **linked,
            **confirmed_values(internal_number="COM-VEN-000099"),
        )

    def test_draft_has_no_number_and_confirmed_requires_one(
        self, customer: Any, commercial: Any, warehouse: Any, actor: Any
    ) -> None:
        make_sale(customer, commercial, warehouse, actor)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_sale(customer, commercial, warehouse, actor, internal_number="COM-VEN-000009")
        with pytest.raises(IntegrityError), transaction.atomic():
            make_sale(
                customer, commercial, warehouse, actor, **confirmed_values(internal_number=None)
            )

    def test_number_is_unique_when_present(
        self, customer: Any, commercial: Any, warehouse: Any, actor: Any
    ) -> None:
        make_sale(customer, commercial, warehouse, actor, **confirmed_values())
        with pytest.raises(IntegrityError), transaction.atomic():
            make_sale(customer, commercial, warehouse, actor, **confirmed_values())

    @pytest.mark.parametrize("field", ["state", "condition"])
    def test_unknown_state_or_condition_is_rejected(
        self, customer: Any, commercial: Any, warehouse: Any, actor: Any, field: str
    ) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_sale(customer, commercial, warehouse, actor, **{field: "OTRO"})

    def test_version_starts_at_one_and_cannot_be_zero(self, sale: Sale) -> None:
        assert sale.version == 1
        with pytest.raises(IntegrityError), transaction.atomic():
            Sale.objects.filter(pk=sale.pk).update(version=0)

    def test_confirmed_amounts_cannot_be_negative_or_missing(
        self, customer: Any, commercial: Any, warehouse: Any, actor: Any
    ) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_sale(
                customer, commercial, warehouse, actor, **confirmed_values(grand_total=D("-1.00"))
            )
        with pytest.raises(IntegrityError), transaction.atomic():
            make_sale(customer, commercial, warehouse, actor, **confirmed_values(grand_total=None))

    def test_snapshots_require_a_schema_version(
        self, customer: Any, commercial: Any, warehouse: Any, actor: Any
    ) -> None:
        make_sale(customer, commercial, warehouse, actor, customer_snapshot={"schema_version": 1})
        with pytest.raises(IntegrityError), transaction.atomic():
            make_sale(customer, commercial, warehouse, actor, customer_snapshot={"name": "x"})

    def test_referenced_customer_cannot_be_deleted(self, sale: Sale, customer: Any) -> None:
        from django.db.models import ProtectedError

        with pytest.raises(ProtectedError):
            customer.delete()


@pytest.mark.django_db
class TestSaleLine:
    def test_position_is_unique_per_sale(self, sale: Sale, product: Any) -> None:
        make_line(sale, product)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_line(sale, product)
        make_line(sale, product, position=2)

    @pytest.mark.parametrize("quantity", ["0", "-1", "1.5"])
    def test_quantity_is_a_positive_whole_number(
        self, sale: Sale, product: Any, quantity: str
    ) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_line(sale, product, quantity=D(quantity))

    def test_historical_amounts_are_all_or_nothing_and_not_negative(
        self, sale: Sale, product: Any
    ) -> None:
        make_line(
            sale,
            product,
            unit_price=D("11.50"),
            tax_rate=D("15"),
            base_amount=D("20.00"),
            tax_amount=D("3.00"),
            total_amount=D("23.00"),
            position=1,
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            make_line(sale, product, position=2, unit_price=D("11.50"))
        with pytest.raises(IntegrityError), transaction.atomic():
            make_line(
                sale,
                product,
                position=3,
                unit_price=D("-1"),
                tax_rate=D("15"),
                base_amount=D(0),
                tax_amount=D(0),
                total_amount=D(0),
            )


@pytest.mark.django_db
class TestCostAllocation:
    def test_link_line_movement_is_unique_and_sum_is_verifiable(
        self, sale: Sale, product: Any, make_movement: Any
    ) -> None:
        movement = make_movement(product)
        first = make_line(sale, product, position=1, quantity=D(1))
        second = make_line(sale, product, position=2, quantity=D(1))
        for line, value in ((first, "4.000001"), (second, "3.999999")):
            SaleCostAllocation.objects.create(
                sale_line=line,
                movement=movement,
                quantity=D(1),
                published_unit_cost=D("4.000000"),
                applied_value=D(value),
            )
        total = sum(a.applied_value for a in SaleCostAllocation.objects.filter(movement=movement))
        assert total == D("8.000000")
        with pytest.raises(IntegrityError), transaction.atomic():
            SaleCostAllocation.objects.create(
                sale_line=first,
                movement=movement,
                quantity=D(1),
                published_unit_cost=D(0),
                applied_value=D(0),
            )

    def test_quantity_is_whole_and_values_not_negative(
        self, sale: Sale, product: Any, make_movement: Any
    ) -> None:
        movement = make_movement(product)
        line = make_line(sale, product)
        with pytest.raises(IntegrityError), transaction.atomic():
            SaleCostAllocation.objects.create(
                sale_line=line,
                movement=movement,
                quantity=D("1.5"),
                published_unit_cost=D(1),
                applied_value=D(1),
            )
        with pytest.raises(IntegrityError), transaction.atomic():
            SaleCostAllocation.objects.create(
                sale_line=line,
                movement=movement,
                quantity=D(1),
                published_unit_cost=D(1),
                applied_value=D(-1),
            )


def make_payment(
    sale: Sale, actor: Any, amount: str = "10.00", *, parts: bool = True, **overrides: Any
) -> CommercialPayment:
    values: dict[str, Any] = {
        "operation_id": uuid.uuid4(),
        "sale": sale,
        "amount": D(amount),
        "effective_at": timezone.now(),
        "effective_date": timezone.localdate(),
        "created_by": actor,
    }
    values.update(overrides)
    payment = CommercialPayment.objects.create(**values)
    if parts:
        PaymentPart.objects.create(payment=payment, method="EFECTIVO", amount=payment.amount)
    return payment


def create_underfunded_payment(sale: Sale, actor: Any) -> None:
    payment = make_payment(sale, actor, amount="10.00", parts=False)
    PaymentPart.objects.create(payment=payment, method="EFECTIVO", amount=D("9.00"))
    with connection.cursor() as cursor:
        cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")


@pytest.mark.django_db
class TestPayments:
    def test_operation_uuid_is_unique_and_amount_positive(self, sale: Sale, actor: Any) -> None:
        payment = make_payment(sale, actor)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_payment(sale, actor, operation_id=payment.operation_id)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_payment(sale, actor, amount="0.00")

    def test_uuid_cannot_be_reused_on_another_sale(
        self, sale: Sale, customer: Any, commercial: Any, warehouse: Any, actor: Any
    ) -> None:
        payment = make_payment(sale, actor)
        other = make_sale(customer, commercial, warehouse, actor)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_payment(other, actor, operation_id=payment.operation_id)

    def test_one_part_per_method_and_positive_amounts(self, sale: Sale, actor: Any) -> None:
        payment = make_payment(sale, actor, amount="10.00", parts=False)
        PaymentPart.objects.create(payment=payment, method="EFECTIVO", amount=D("6.00"))
        PaymentPart.objects.create(payment=payment, method="TRANSFERENCIA", amount=D("4.00"))
        with pytest.raises(IntegrityError), transaction.atomic():
            PaymentPart.objects.create(payment=payment, method="EFECTIVO", amount=D("1.00"))
        with pytest.raises(IntegrityError), transaction.atomic():
            PaymentPart.objects.create(
                payment=make_payment(sale, actor), method="CREDITO", amount=D(1)
            )
        with pytest.raises(IntegrityError), transaction.atomic():
            PaymentPart.objects.create(
                payment=make_payment(sale, actor), method="EFECTIVO", amount=D(0)
            )

    def test_parts_must_sum_to_the_payment_amount_at_commit(self, sale: Sale, actor: Any) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            create_underfunded_payment(sale, actor)


@pytest.mark.django_db
class TestPaymentCorrection:
    def test_one_correction_per_original_with_reason_and_optional_replacement(
        self, sale: Sale, actor: Any
    ) -> None:
        original = make_payment(sale, actor)
        replacement = make_payment(sale, actor, amount="8.00")
        PaymentCorrection.objects.create(
            operation_id=uuid.uuid4(),
            sale=sale,
            original_payment=original,
            replacement_payment=replacement,
            reason="Monto mal digitado",
            created_by=actor,
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            PaymentCorrection.objects.create(
                operation_id=uuid.uuid4(),
                sale=sale,
                original_payment=original,
                reason="Otra",
                created_by=actor,
            )
        original.refresh_from_db()
        assert original.amount == D("10.00")

    def test_reason_cannot_be_blank(self, sale: Sale, actor: Any) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            PaymentCorrection.objects.create(
                operation_id=uuid.uuid4(),
                sale=sale,
                original_payment=make_payment(sale, actor),
                reason="   ",
                created_by=actor,
            )


def make_return(sale: Sale, actor: Any, **overrides: Any) -> SaleReturn:
    values: dict[str, Any] = {
        "operation_id": uuid.uuid4(),
        "sale": sale,
        "reason": "Producto equivocado",
        "effective_at": timezone.now(),
        "effective_date": timezone.localdate(),
        "base_total": D("10.00"),
        "tax_total": D("1.50"),
        "grand_total": D("11.50"),
        "created_by": actor,
    }
    values.update(overrides)
    return SaleReturn.objects.create(**values)


def create_foreign_return_line(sale_return: SaleReturn, foreign_line: SaleLine) -> None:
    SaleReturnLine.objects.create(
        sale_return=sale_return,
        sale_line=foreign_line,
        fit_quantity=D(1),
        unfit_quantity=D(0),
        base_amount=D(1),
        tax_amount=D(0),
        total_amount=D(1),
    )
    with connection.cursor() as cursor:
        cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")


@pytest.mark.django_db
class TestReturns:
    def test_uuid_unique_and_reason_required(self, sale: Sale, actor: Any) -> None:
        sale_return = make_return(sale, actor)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_return(sale, actor, operation_id=sale_return.operation_id)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_return(sale, actor, reason=" ")

    def test_line_quantities_are_whole_non_negative_and_sum_positive(
        self, sale: Sale, actor: Any, product: Any
    ) -> None:
        line = make_line(sale, product)
        sale_return = make_return(sale, actor)
        good = {"base_amount": D(1), "tax_amount": D(0), "total_amount": D(1)}
        SaleReturnLine.objects.create(
            sale_return=sale_return, sale_line=line, fit_quantity=D(1), unfit_quantity=D(0), **good
        )
        for fit, unfit in ((0, 0), (-1, 2), (D("0.5"), 1)):
            with pytest.raises(IntegrityError), transaction.atomic():
                SaleReturnLine.objects.create(
                    sale_return=make_return(sale, actor),
                    sale_line=line,
                    fit_quantity=D(fit),
                    unfit_quantity=D(unfit),
                    **good,
                )

    def test_a_line_appears_once_per_return(self, sale: Sale, actor: Any, product: Any) -> None:
        line = make_line(sale, product)
        sale_return = make_return(sale, actor)
        values = {
            "fit_quantity": D(1),
            "unfit_quantity": D(0),
            "base_amount": D(1),
            "tax_amount": D(0),
            "total_amount": D(1),
        }
        SaleReturnLine.objects.create(sale_return=sale_return, sale_line=line, **values)
        with pytest.raises(IntegrityError), transaction.atomic():
            SaleReturnLine.objects.create(sale_return=sale_return, sale_line=line, **values)

    def test_return_line_must_belong_to_the_same_sale(
        self, sale: Sale, actor: Any, product: Any, customer: Any, commercial: Any, warehouse: Any
    ) -> None:
        other = make_sale(customer, commercial, warehouse, actor)
        foreign_line = make_line(other, product)
        with pytest.raises(IntegrityError), transaction.atomic():
            create_foreign_return_line(make_return(sale, actor), foreign_line)


@pytest.mark.django_db
class TestRefundsVoidAndCommands:
    def test_refund_origin_is_coherent_and_parts_are_unique_per_method(
        self, sale: Sale, actor: Any
    ) -> None:
        sale_return = make_return(sale, actor)
        base: dict[str, Any] = {
            "sale": sale,
            "amount": D("5.00"),
            "effective_at": timezone.now(),
            "effective_date": timezone.localdate(),
            "created_by": actor,
        }
        refund = CommercialRefund.objects.create(
            operation_id=uuid.uuid4(), origin="RETURN", sale_return=sale_return, **base
        )
        RefundPart.objects.create(refund=refund, method="EFECTIVO", amount=D("5.00"))
        with pytest.raises(IntegrityError), transaction.atomic():
            RefundPart.objects.create(refund=refund, method="EFECTIVO", amount=D("1.00"))
        with pytest.raises(IntegrityError), transaction.atomic():
            CommercialRefund.objects.create(operation_id=uuid.uuid4(), origin="RETURN", **base)
        with pytest.raises(IntegrityError), transaction.atomic():
            CommercialRefund.objects.create(
                operation_id=uuid.uuid4(), origin="VOID", sale_return=sale_return, **base
            )

    def test_only_one_void_per_sale(
        self, sale: Sale, actor: Any, make_movement: Any, product: Any
    ) -> None:
        operation = make_movement(product).operation
        values: dict[str, Any] = {
            "sale": sale,
            "reason": "Error de captura",
            "voided_at": timezone.now(),
            "voided_by": actor,
            "reversal_operation": operation,
        }
        SaleVoid.objects.create(**values)
        with pytest.raises(IntegrityError), transaction.atomic():
            SaleVoid.objects.create(**values)

    def test_command_receipt_is_unique_per_actor_action_key_and_key_is_well_formed(
        self, actor: Any, admin: Any
    ) -> None:
        values: dict[str, Any] = {
            "actor": actor,
            "action": "sale.confirm",
            "idempotency_key": "key-00000001",
            "input_fingerprint": "a" * 64,
        }
        SalesCommand.objects.create(**values)
        with pytest.raises(IntegrityError), transaction.atomic():
            SalesCommand.objects.create(**values)
        SalesCommand.objects.create(**{**values, "actor": admin})
        SalesCommand.objects.create(**{**values, "action": "sale.void"})
        with pytest.raises(IntegrityError), transaction.atomic():
            SalesCommand.objects.create(**{**values, "idempotency_key": "corta"})
