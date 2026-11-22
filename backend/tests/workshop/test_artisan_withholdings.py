"""Retenciones recibidas del RUC artesanal: cobro, saldo, comprobante, anulación y seguimiento."""

import uuid
from typing import Any

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    confirm_services,
    create,
    error_of,
    key,
)

from identity.application.authorization import BusinessPermissionDeniedError
from workshop.application import (
    artisan_payments,
    artisan_withholdings,
    queries,
    service_operations,
)
from workshop.application.support import business_today
from workshop.models import (
    ArtisanPayment,
    ArtisanWithholding,
    ArtisanWithholdingVoucherChange,
)
from workshop_configuration.application import withholding_settings

pytestmark = pytest.mark.django_db
NUMBER = "001-001-000028564"


@pytest.fixture
def make_operation(manager, artisan_billing, customer, make_vehicle, make_service):  # type: ignore[no-untyped-def]
    def build(condition: str = "CREDITO", price: str = "250.00") -> dict[str, Any]:
        # Un vehículo por operación: cada vehículo admite una sola orden abierta.
        vehicle = make_vehicle(customer)
        order = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=5)
        add_line(manager, order["id"], service_id=make_service().pk, applied_price=price)
        return confirm_services(manager, order["id"], condition)

    return build


def settle(
    actor: Any,
    target: int,
    *parts: tuple[str, str],
    withheld: str | None = None,
    acknowledged: bool | None = None,
    **payload: Any,
) -> Any:
    payload.setdefault("operation_id", str(uuid.uuid4()))
    payload.setdefault("idempotency_key", key())
    if parts:
        payload.setdefault("parts", [{"method": m, "amount": a} for m, a in parts])
    if withheld is not None:
        payload["withholding"] = {"amount": withheld}
        if acknowledged is not None:
            payload["withholding"]["acknowledged"] = acknowledged
    return artisan_payments.register_payment(actor=actor, operation_id=target, payload=payload)


def configure(admin: Any, artisan: dict[str, Any], **changes: Any) -> None:
    entity = artisan["entity"]
    current = withholding_settings.settings_for_entity(entity_id=entity.pk)
    withholding_settings.set_withholding_settings(
        actor=admin,
        entity_id=entity.pk,
        expected_version=current.version,
        idempotency_key=str(uuid.uuid4()),
        **changes,
    )


def voucher(**changes: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "voucher_number": NUMBER,
        "voucher_date": business_today().isoformat(),
        "income_tax_amount": "5.00",
        "vat_amount": "0.00",
        "idempotency_key": key(),
    }
    data.update(changes)
    return {name: value for name, value in data.items() if value is not ...}


@pytest.fixture
def held(manager, make_operation) -> dict[str, Any]:  # type: ignore[no-untyped-def]
    """Operación de 250.00 cerrada con 245.00 en dinero y 5.00 retenidos."""
    operation = make_operation()
    settle(manager, operation["id"], ("TRANSFERENCIA", "245.00"), withheld="5.00")
    return {"operation_id": operation["id"], "id": ArtisanWithholding.objects.get().pk}


def complete(actor: Any, held: dict[str, Any], **changes: Any) -> Any:
    return artisan_withholdings.complete_voucher(
        actor=actor,
        operation_id=held["operation_id"],
        withholding_id=held["id"],
        payload=voucher(**changes),
    )


def void(actor: Any, held: dict[str, Any], reason: Any = "Registrada por error") -> Any:
    return artisan_withholdings.void_withholding(
        actor=actor,
        operation_id=held["operation_id"],
        withholding_id=held["id"],
        payload={"reason": reason, "idempotency_key": key()},
    )


# --- Cobro y saldo ---------------------------------------------------------------------------


def test_cash_operation_is_settled_with_money_plus_withholding(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation("CONTADO")
    outcome = settle(manager, operation["id"], ("TRANSFERENCIA", "245.00"), withheld="5.00")
    body = outcome.body
    assert outcome.status == 201
    assert (body["paid"], body["withheld"], body["balance"]) == ("245.00", "5.00", "0.00")
    assert body["payment_state"] == "PAID"
    [withholding] = body["withholdings"]
    assert withholding["amount"] == "5.00"
    assert withholding["voucher_pending"] is True
    assert withholding["payment_id"] == body["payments"][0]["id"]
    record = ArtisanWithholding.objects.get()
    assert record.customer_id == record.service_operation.customer_id
    assert record.payment is not None
    assert record.operation_id == record.payment.operation_id


def test_withholding_alone_and_partial_state(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation(price="100.00")
    body = settle(manager, operation["id"], withheld="2.00").body
    assert (body["paid"], body["withheld"], body["balance"]) == ("0.00", "2.00", "98.00")
    assert body["payment_state"] == "PARTIAL"
    assert not ArtisanPayment.objects.exists()
    assert "void" not in body["allowed_actions"]


def test_cash_operation_not_covered_is_rejected_entirely(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation("CONTADO")
    error = error_of(
        lambda: settle(manager, operation["id"], ("EFECTIVO", "200.00"), withheld="5.00")
    )
    assert error.code == "validation_error"
    assert "operación" in error.message
    assert not ArtisanPayment.objects.exists()
    assert not ArtisanWithholding.objects.exists()


@pytest.mark.parametrize("amount", ["250.01", "0.00", "-1.00", "1.005", "abc"])
def test_invalid_withholding_amount_is_rejected(manager, make_operation, amount: str) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation()
    error = error_of(lambda: settle(manager, operation["id"], withheld=amount))
    assert error.code == "validation_error"
    assert not ArtisanWithholding.objects.exists()


def test_action_needs_money_or_withholding_and_rejects_unknown_fields(  # type: ignore[no-untyped-def]
    manager, make_operation
) -> None:
    operation = make_operation()
    assert error_of(lambda: settle(manager, operation["id"])).code == "validation_error"
    error = error_of(
        lambda: settle(
            manager,
            operation["id"],
            withholding={"amount": "1.00", "voucher_number": NUMBER},
        )
    )
    assert error.code == "validation_error"


def test_voided_operation_rejects_withholdings(manager, admin, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation()
    service_operations.void_operation(
        actor=admin,
        operation_id=operation["id"],
        payload={"reason": "Error", "expected_version": 1, "idempotency_key": key()},
    )
    assert error_of(lambda: settle(manager, operation["id"], withheld="1.00")).code == (
        "invalid_state"
    )


def test_entity_with_registration_disabled_rejects_new_withholdings(  # type: ignore[no-untyped-def]
    manager, admin, artisan, make_operation
) -> None:
    kept = make_operation(price="100.00")
    settle(manager, kept["id"], ("EFECTIVO", "98.00"), withheld="2.00")
    configure(admin, artisan, registration_enabled=False)
    operation = make_operation(price="100.00")
    error = error_of(
        lambda: settle(manager, operation["id"], ("EFECTIVO", "98.00"), withheld="2.00")
    )
    assert "no registra retenciones" in error.message
    body = settle(manager, operation["id"], ("EFECTIVO", "98.00")).body
    assert body["balance"] == "2.00"
    assert (
        service_operations.get_operation(actor=manager, operation_id=kept["id"])["balance"]
        == "0.00"
    )


def test_unusual_amount_requires_acknowledgement(manager, admin, artisan, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation(price="100.00")
    error = error_of(
        lambda: settle(manager, operation["id"], ("EFECTIVO", "75.00"), withheld="25.00")
    )
    assert error.code == "withholding_warning"
    assert error.errors["threshold"] == ["20.00"]
    assert not ArtisanPayment.objects.exists()
    body = settle(
        manager, operation["id"], ("EFECTIVO", "75.00"), withheld="25.00", acknowledged=True
    ).body
    assert body["withheld"] == "25.00"

    configure(admin, artisan, warning_percentage=None)
    other = make_operation(price="100.00")
    assert settle(manager, other["id"], withheld="60.00").body["withheld"] == "60.00"


def test_same_operation_id_is_idempotent_and_detects_conflicts(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation()
    fact = str(uuid.uuid4())
    first = settle(
        manager, operation["id"], ("EFECTIVO", "240.00"), withheld="5.00", operation_id=fact
    )
    again = settle(
        manager, operation["id"], ("EFECTIVO", "240.00"), withheld="5.00", operation_id=fact
    )
    assert (first.status, again.status) == (201, 200)
    assert ArtisanWithholding.objects.count() == 1
    assert ArtisanPayment.objects.count() == 1
    for changed in (
        lambda: settle(
            manager, operation["id"], ("EFECTIVO", "240.00"), withheld="6.00", operation_id=fact
        ),
        lambda: settle(manager, operation["id"], ("EFECTIVO", "240.00"), operation_id=fact),
        lambda: settle(manager, operation["id"], withheld="5.00", operation_id=fact),
    ):
        assert error_of(changed).code == "idempotency_conflict"


def test_failure_saving_the_withholding_leaves_no_payment(  # type: ignore[no-untyped-def]
    manager, make_operation, monkeypatch: pytest.MonkeyPatch
) -> None:
    operation = make_operation("CONTADO")

    def boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("fallo simulado")

    monkeypatch.setattr(ArtisanWithholding.objects, "create", boom)
    with pytest.raises(RuntimeError):
        settle(manager, operation["id"], ("EFECTIVO", "245.00"), withheld="5.00")
    assert not ArtisanPayment.objects.exists()


def test_roles_and_scope(manager, admin, seller, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation(price="100.00")
    with pytest.raises(BusinessPermissionDeniedError):
        settle(seller, operation["id"], withheld="2.00")
    settle(admin, operation["id"], withheld="2.00")
    held = {"operation_id": operation["id"], "id": ArtisanWithholding.objects.get().pk}
    with pytest.raises(BusinessPermissionDeniedError):
        complete(seller, held, income_tax_amount="2.00")
    with pytest.raises(BusinessPermissionDeniedError):
        void(manager, held)
    with pytest.raises(BusinessPermissionDeniedError):
        artisan_withholdings.pending_vouchers(actor=seller)


def test_payment_replacement_respects_active_withholdings(manager, admin, make_operation) -> None:  # type: ignore[no-untyped-def]
    operation = make_operation(price="100.00")
    body = settle(manager, operation["id"], ("EFECTIVO", "90.00"), withheld="5.00").body
    payment_id = body["payments"][0]["id"]

    def replace(amount: str) -> Any:
        return artisan_payments.correct_payment(
            actor=admin,
            operation_id=operation["id"],
            payment_id=payment_id,
            payload={
                "operation_id": str(uuid.uuid4()),
                "reason": "Importe mal digitado",
                "replacement": {
                    "operation_id": str(uuid.uuid4()),
                    "parts": [{"method": "EFECTIVO", "amount": amount}],
                },
                "idempotency_key": key(),
            },
        )

    assert error_of(lambda: replace("96.00")).code == "validation_error"
    assert replace("95.00").body["balance"] == "0.00"


# --- Comprobante, corrección y anulación ------------------------------------------------------


def test_voucher_is_completed_without_changing_amount_or_balance(manager, held) -> None:  # type: ignore[no-untyped-def]
    body = complete(manager, held).body
    [withholding] = body["withholdings"]
    assert withholding["voucher_pending"] is False
    assert withholding["voucher_number"] == NUMBER
    assert (withholding["income_tax_amount"], withholding["vat_amount"]) == ("5.00", "0.00")
    assert (body["withheld"], body["balance"]) == ("5.00", "0.00")


@pytest.mark.parametrize(
    "changes",
    [
        {"income_tax_amount": "3.00", "vat_amount": "1.00"},
        {"voucher_number": "1-1-28564"},
        {"voucher_date": "2999-01-01"},
        {"vat_amount": ...},
    ],
)
def test_invalid_voucher_data_is_rejected(manager, held, changes: dict[str, Any]) -> None:  # type: ignore[no-untyped-def]
    assert error_of(lambda: complete(manager, held, **changes)).code == "validation_error"
    assert ArtisanWithholding.objects.get().voucher_number is None


def test_voucher_number_is_unique_per_customer(manager, make_operation, held) -> None:  # type: ignore[no-untyped-def]
    complete(manager, held)
    other = make_operation(price="100.00")
    settle(manager, other["id"], withheld="2.00")
    second = ArtisanWithholding.objects.exclude(pk=held["id"]).get()
    error = error_of(
        lambda: complete(
            manager, {"operation_id": other["id"], "id": second.pk}, income_tax_amount="2.00"
        )
    )
    assert "voucher_number" in error.errors


def test_completed_voucher_is_corrected_only_by_the_administrator(manager, admin, held) -> None:  # type: ignore[no-untyped-def]
    complete(manager, held)
    assert error_of(lambda: complete(manager, held)).code == "invalid_state"
    payload = {
        **voucher(voucher_number="001-001-000000002"),
        "operation_id": str(uuid.uuid4()),
        "reason": "Número mal digitado",
    }

    def correct(actor: Any, **changes: Any) -> Any:
        return artisan_withholdings.correct_voucher(
            actor=actor,
            operation_id=held["operation_id"],
            withholding_id=held["id"],
            payload={**payload, "idempotency_key": key(), **changes},
        )

    with pytest.raises(BusinessPermissionDeniedError):
        correct(manager)
    assert error_of(lambda: correct(admin, reason=" ")).code == "validation_error"
    body = correct(admin).body
    assert body["withholdings"][0]["voucher_number"] == "001-001-000000002"
    change = ArtisanWithholdingVoucherChange.objects.get()
    assert (change.previous_voucher_number, change.created_by_id) == (NUMBER, admin.pk)
    correct(admin)
    assert ArtisanWithholdingVoucherChange.objects.count() == 1


def test_void_returns_the_amount_to_the_balance_and_frees_the_number(  # type: ignore[no-untyped-def]
    manager, admin, held
) -> None:
    complete(manager, held)
    assert error_of(lambda: void(admin, held, reason="")).code == "validation_error"
    body = void(admin, held).body
    assert (body["paid"], body["withheld"], body["balance"]) == ("245.00", "0.00", "5.00")
    assert body["payment_state"] == "PARTIAL"
    [withholding] = body["withholdings"]
    assert (withholding["state"], withholding["void_reason"]) == (
        "VOIDED",
        "Registrada por error",
    )
    assert error_of(lambda: void(admin, held)).code == "invalid_state"
    assert error_of(lambda: complete(manager, held)).code == "invalid_state"

    settle(manager, held["operation_id"], withheld="5.00")
    fresh = ArtisanWithholding.objects.filter(voided_at__isnull=True).get()
    again = complete(manager, {"operation_id": held["operation_id"], "id": fresh.pk}).body
    assert [w["voucher_number"] for w in again["withholdings"]] == [NUMBER, NUMBER]


def test_operation_with_active_withholdings_cannot_be_voided(
    manager: Any, admin: Any, make_operation: Any
) -> None:
    operation = make_operation(price="100.00")
    settle(manager, operation["id"], withheld="2.00")
    held = {"operation_id": operation["id"], "id": ArtisanWithholding.objects.get().pk}
    preview = service_operations.void_preview(actor=admin, operation_id=operation["id"])
    assert preview["can_void"] is False
    assert any("retenciones" in blocker for blocker in preview["blockers"])

    def void_operation() -> Any:
        current = service_operations.get_operation(actor=admin, operation_id=operation["id"])
        return service_operations.void_operation(
            actor=admin,
            operation_id=operation["id"],
            payload={
                "reason": "Error",
                "expected_version": current["version"],
                "idempotency_key": key(),
            },
        )

    error = error_of(void_operation)
    assert error.code == "withholdings_block_void"
    assert str(held["id"]) in error.errors["withholdings"][0]
    void(admin, held)
    assert void_operation().body["state"] == "VOIDED"


# --- Seguimiento y cuentas por cobrar --------------------------------------------------------


def test_pending_list_shows_only_active_withholdings_without_voucher(  # type: ignore[no-untyped-def]
    manager, admin, make_operation, held
) -> None:
    second = make_operation(price="100.00")
    settle(manager, second["id"], withheld="2.00")
    third = make_operation(price="50.00")
    settle(manager, third["id"], withheld="1.00")
    voided = ArtisanWithholding.objects.get(service_operation_id=third["id"])
    void(admin, {"operation_id": third["id"], "id": voided.pk})

    page = artisan_withholdings.pending_vouchers(actor=manager)
    assert [row["service_operation_id"] for row in page["items"]] == [
        held["operation_id"],
        second["id"],
    ]
    assert (page["total_count"], page["pending_total"]) == (2, "7.00")
    first = page["items"][0]
    assert first["fiscal_scope"] == "ARTESANAL"
    assert first["operation_number"].startswith("ART-SER-")
    assert first["order_number"].startswith("ART-OT-")
    assert first["customer"]["name"]
    assert first["age_days"] == 0

    small = artisan_withholdings.pending_vouchers(actor=manager, page=2, page_size=1)
    assert [row["service_operation_id"] for row in small["items"]] == [second["id"]]
    complete(manager, held)
    after = artisan_withholdings.pending_vouchers(actor=manager)
    assert [row["service_operation_id"] for row in after["items"]] == [second["id"]]


def test_receivables_exclude_operations_settled_with_a_withholding(  # type: ignore[no-untyped-def]
    manager, make_operation, held
) -> None:
    pending = make_operation(price="100.00")
    settle(manager, pending["id"], withheld="2.00")
    body = queries.artisan_receivables(actor=manager)
    assert [row["id"] for row in body["results"]] == [pending["id"]]
    assert (body["results"][0]["withheld"], body["results"][0]["balance"]) == ("2.00", "98.00")
    assert body["results"][0]["payment_state"] == "PARTIAL"
    assert body["totals"] == {
        "grand_total": "100.00",
        "paid": "0.00",
        "withheld": "2.00",
        "balance": "98.00",
    }
    paid = queries.artisan_receivables(actor=manager, payment_state="PAID")
    assert [row["id"] for row in paid["results"]] == [held["operation_id"]]
    assert paid["results"][0]["paid"] == "245.00"


def test_database_rejects_incoherent_withholdings(manager, make_operation) -> None:  # type: ignore[no-untyped-def]
    from decimal import Decimal

    from django.db import IntegrityError, transaction
    from django.utils import timezone

    from workshop.models import ServiceOperation

    operation = ServiceOperation.objects.get(pk=make_operation()["id"])

    def create_row(**fields: Any) -> None:
        defaults: dict[str, Any] = {
            "operation_id": uuid.uuid4(),
            "service_operation": operation,
            "customer_id": operation.customer_id,
            "amount": Decimal("5.00"),
            "effective_at": timezone.now(),
            "effective_date": business_today(),
            "created_by": manager,
        }
        ArtisanWithholding.objects.create(**{**defaults, **fields})

    for invalid in (
        {"amount": Decimal("0.00")},
        {"voucher_number": NUMBER},
        {"voucher_number": "1-1-1", "voucher_date": business_today()},
        {"income_tax_amount": Decimal("3.00"), "vat_amount": Decimal("1.00")},
        {"income_tax_amount": Decimal("5.00")},
        {"voided_at": timezone.now()},
        {"void_reason": "motivo sin anulación"},
    ):
        with pytest.raises(IntegrityError), transaction.atomic():
            create_row(**invalid)
    create_row(voucher_number=NUMBER, voucher_date=business_today())
    with pytest.raises(IntegrityError), transaction.atomic():
        create_row(voucher_number=NUMBER, voucher_date=business_today())


def test_operation_detail_tells_the_charge_screen_what_to_offer(  # type: ignore[no-untyped-def]
    manager, admin, artisan, customer, make_operation
) -> None:
    operation = make_operation()
    detail = service_operations.get_operation(actor=manager, operation_id=operation["id"])
    assert detail["withholding_context"] == {"enabled": True, "customer_is_agent": False}
    customer.is_withholding_agent = True
    customer.save(update_fields=["is_withholding_agent"])
    configure(admin, artisan, registration_enabled=False)
    detail = service_operations.get_operation(actor=manager, operation_id=operation["id"])
    assert detail["withholding_context"] == {"enabled": False, "customer_is_agent": True}


@pytest.mark.parametrize("rate", ["0", "15"])
def test_the_same_rule_applies_with_any_artisan_tax_rate(  # type: ignore[no-untyped-def]
    manager, artisan, make_operation, rate: str
) -> None:
    """La tarifa configurada del RUC artesanal no cambia el comportamiento de la retención."""
    from decimal import Decimal

    from workshop_configuration.models import TaxPeriod

    TaxPeriod.objects.filter(tax_definition=artisan["tax"]).update(rate=Decimal(rate))
    operation = make_operation("CONTADO")
    body = settle(manager, operation["id"], ("TRANSFERENCIA", "245.00"), withheld="5.00").body
    assert (body["paid"], body["withheld"], body["balance"]) == ("245.00", "5.00", "0.00")
    assert body["payment_state"] == "PAID"


def test_existing_withholdings_survive_disabling_and_actions_are_audited(  # type: ignore[no-untyped-def]
    manager, admin, artisan, held
) -> None:
    from identity.models import AuditEvent

    configure(admin, artisan, registration_enabled=False)
    assert complete(manager, held).body["withholdings"][0]["voucher_number"] == NUMBER
    assert void(admin, held).body["withholdings"][0]["state"] == "VOIDED"
    actions = set(
        AuditEvent.objects.filter(
            result="SUCCESS", action__startswith="maintenance.artisan_withholding"
        ).values_list("action", flat=True)
    )
    assert actions == {
        "maintenance.artisan_withholding_voucher_complete",
        "maintenance.artisan_withholding_void",
    }
