"""Contrato fiscal artesanal limitado a la operación de servicios."""

from dataclasses import FrozenInstanceError
from typing import Any

import pytest
from django.db import transaction
from tests.workshop.workshop_helpers import add_line, confirm_services, create

from workshop.models import ServiceOperation

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(manager: Any, artisan_billing: Any, customer: Any, vehicle: Any) -> dict[str, Any]:
    return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)


def test_artisan_source_contains_services_and_no_commercial_parts(
    manager: Any, order: dict[str, Any], make_service: Any
) -> None:
    from workshop.application.fiscal_source import read_fiscal_source

    add_line(
        manager,
        order["id"],
        service_id=make_service(name="Alineación").pk,
        applied_price="25.00",
    )
    operation_id = confirm_services(manager, order["id"], "CREDITO")["id"]
    source = read_fiscal_source(operation_id)

    assert source.state == "CONFIRMED"
    assert source.grand_total == "25.00"
    assert source.issuer_snapshot["entity"]["type"] == "ARTESANAL"
    assert [(line.description, line.quantity) for line in source.lines] == [("Alineación", "1")]
    assert not hasattr(source, "parts")
    assert not hasattr(source.lines[0], "product_id")
    with pytest.raises(FrozenInstanceError):
        source.state = "VOIDED"  # type: ignore[misc]


def test_locking_read_does_not_change_artisan_operation(
    manager: Any, order: dict[str, Any], make_service: Any
) -> None:
    from workshop.application.fiscal_source import lock_fiscal_source, read_fiscal_source

    add_line(manager, order["id"], service_id=make_service().pk, applied_price="25.00")
    operation_id = confirm_services(manager, order["id"])["id"]
    before = ServiceOperation.objects.get(pk=operation_id)
    with transaction.atomic():
        locked = lock_fiscal_source(operation_id)
    current = ServiceOperation.objects.get(pk=operation_id)

    assert locked == read_fiscal_source(operation_id)
    assert (current.state, current.version, current.internal_number) == (
        before.state,
        before.version,
        before.internal_number,
    )


def test_artisan_collected_by_method_excludes_corrected_payments(
    manager: Any, order: dict[str, Any], make_service: Any
) -> None:
    from datetime import date
    from decimal import Decimal
    from uuid import uuid4

    from django.utils import timezone

    from workshop.application.fiscal_source import read_fiscal_source
    from workshop.models import ArtisanPayment, ArtisanPaymentCorrection, ArtisanPaymentPart

    add_line(
        manager, order["id"], service_id=make_service(name="Balanceo").pk, applied_price="40.00"
    )
    operation = ServiceOperation.objects.get(
        pk=confirm_services(manager, order["id"], "CREDITO")["id"]
    )

    def pay(parts: dict[str, str]) -> ArtisanPayment:
        payment = ArtisanPayment.objects.create(
            operation_id=uuid4(),
            service_operation=operation,
            amount=sum((Decimal(v) for v in parts.values()), Decimal("0")),
            effective_at=timezone.now(),
            effective_date=date(2026, 9, 26),
            created_by=manager,
        )
        for method, amount in parts.items():
            ArtisanPaymentPart.objects.create(
                payment=payment, method=method, amount=Decimal(amount)
            )
        return payment

    corrected = pay({"TRANSFERENCIA": "15.00"})
    pay({"EFECTIVO": "5.00"})
    ArtisanPaymentCorrection.objects.create(
        operation_id=uuid4(),
        service_operation=operation,
        original_payment=corrected,
        reason="Registro duplicado",
        created_by=manager,
    )
    collected = read_fiscal_source(operation.pk).collected_by_method
    assert {method: str(amount) for method, amount in collected.items()} == {"EFECTIVO": "5.00"}


def test_artisan_source_line_carries_the_service_code_and_not_the_database_id(
    manager: Any, order: dict[str, Any], make_service: Any
) -> None:
    from workshop.application.fiscal_source import read_fiscal_source

    service = make_service(name="Alineación", code="SRV-000042")
    add_line(manager, order["id"], service_id=service.pk, applied_price="25.00")
    operation_id = confirm_services(manager, order["id"], "CREDITO")["id"]
    [line] = read_fiscal_source(operation_id).lines

    assert line.service_code == "SRV-000042"
    assert line.service_code != str(service.pk)


def test_artisan_withholding_is_never_a_payment_form(
    manager: Any, order: dict[str, Any], make_service: Any
) -> None:
    from uuid import uuid4

    from tests.workshop.workshop_helpers import key

    from fiscal.domain.payment_suggestion import suggest_payment_forms
    from fiscal.models import FiscalPreparation
    from workshop.application import artisan_payments
    from workshop.application.fiscal_source import read_fiscal_source

    add_line(manager, order["id"], service_id=make_service(name="Motor").pk, applied_price="250.00")
    operation = confirm_services(manager, order["id"], "CONTADO")
    artisan_payments.register_payment(
        actor=manager,
        operation_id=operation["id"],
        payload={
            "operation_id": str(uuid4()),
            "parts": [{"method": "EFECTIVO", "amount": "245.00"}],
            "withholding": {"amount": "5.00"},
            "idempotency_key": key(),
        },
    )
    assert not FiscalPreparation.objects.exists()

    source = read_fiscal_source(operation["id"])
    assert {m: str(a) for m, a in source.collected_by_method.items()} == {"EFECTIVO": "245.00"}
    suggestion = suggest_payment_forms(
        total=source.grand_total,
        collected=source.collected_by_method,
        enabled_forms={"EFECTIVO": "01", "TRANSFERENCIA": "20"},
        default_code="20",
    )
    assert {form.payment_code: form.amount for form in suggestion.forms} == {
        "01": "245.00",
        "20": "5.00",
    }


# --- Saldo pendiente y detalle de servicio (DP-035, diseño 6 y 8) --------------------------------


def _pay(manager: Any, operation_id: int, cash: str, withheld: str | None = None) -> None:
    from uuid import uuid4

    from tests.workshop.workshop_helpers import key

    from workshop.application import artisan_payments

    payload: dict[str, Any] = {
        "operation_id": str(uuid4()),
        "parts": [{"method": "EFECTIVO", "amount": cash}],
        "idempotency_key": key(),
    }
    if withheld is not None:
        payload["withholding"] = {"amount": withheld}
    artisan_payments.register_payment(actor=manager, operation_id=operation_id, payload=payload)


def test_artisan_pending_balance_without_collections_is_the_whole_total(
    manager: Any, order: dict[str, Any], make_service: Any
) -> None:
    from workshop.application.fiscal_source import read_fiscal_source

    add_line(manager, order["id"], service_id=make_service().pk, applied_price="25.00")
    operation_id = confirm_services(manager, order["id"], "CREDITO")["id"]
    source = read_fiscal_source(operation_id)
    assert (source.grand_total, source.pending_balance) == ("25.00", "25.00")


def test_artisan_pending_balance_subtracts_payments_and_withholdings(
    manager: Any, order: dict[str, Any], make_service: Any
) -> None:
    from workshop.application.fiscal_source import read_fiscal_source

    add_line(manager, order["id"], service_id=make_service().pk, applied_price="250.00")
    operation_id = confirm_services(manager, order["id"], "CREDITO")["id"]
    _pay(manager, operation_id, "100.00")
    assert read_fiscal_source(operation_id).pending_balance == "150.00"
    _pay(manager, operation_id, "145.00", withheld="5.00")
    assert read_fiscal_source(operation_id).pending_balance == "0.00"


def test_artisan_pending_balance_of_a_voided_operation_is_zero(
    manager: Any, admin: Any, order: dict[str, Any], make_service: Any
) -> None:
    from tests.workshop.workshop_helpers import key

    from workshop.application import service_operations
    from workshop.application.fiscal_source import read_fiscal_source

    add_line(manager, order["id"], service_id=make_service().pk, applied_price="25.00")
    operation_id = confirm_services(manager, order["id"], "CREDITO")["id"]
    service_operations.void_operation(
        actor=admin,
        operation_id=operation_id,
        payload={"reason": "Error", "expected_version": 1, "idempotency_key": key()},
    )
    assert read_fiscal_source(operation_id).pending_balance == "0.00"


def test_artisan_source_line_carries_the_detail_of_the_operation(
    manager: Any, order: dict[str, Any], make_service: Any
) -> None:
    from workshop.application.fiscal_source import read_fiscal_source

    add_line(manager, order["id"], service_id=make_service().pk, detail="frenos delanteros")
    add_line(manager, order["id"], service_id=make_service().pk)
    operation_id = confirm_services(manager, order["id"], "CREDITO")["id"]
    lines = read_fiscal_source(operation_id).lines
    assert [line.detail for line in lines] == ["frenos delanteros", ""]
