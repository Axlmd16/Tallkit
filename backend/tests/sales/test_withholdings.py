"""Retenciones recibidas comerciales: reducen el saldo sin ser dinero cobrado."""

import uuid
from itertools import count
from typing import Any

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from sales.application import payments, queries, sales
from sales.application.errors import SalesApplicationError
from sales.models import CommercialPayment, CommercialWithholding, Sale
from workshop_configuration.application import withholding_settings
from workshop_configuration.models import Warehouse

pytestmark = pytest.mark.django_db
_keys = count(1)


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


def parts(cash: str | None = None, transfer: str | None = None) -> list[dict[str, str]]:
    items = []
    if cash is not None:
        items.append({"method": "EFECTIVO", "amount": cash})
    if transfer is not None:
        items.append({"method": "TRANSFERENCIA", "amount": transfer})
    return items


def body(items: list[dict[str, Any]] | None, withheld: str | None, **extra: Any) -> dict[str, Any]:
    data: dict[str, Any] = {"operation_id": str(uuid.uuid4()), **extra}
    if items is not None:
        data["parts"] = items
    if withheld is not None:
        data["withholding"] = {"amount": withheld}
    return data


def register(actor: Any, sale_id: int, data: dict[str, Any]) -> Any:
    review = payments.preview_payment(actor=actor, sale_id=sale_id, payload=data)
    assert review["can_register"], review["issues"]
    return payments.register_payment(
        actor=actor,
        sale_id=sale_id,
        payload={
            **data,
            "idempotency_key": f"wh-key-{next(_keys):06d}",
            "review_token": review["review_token"],
        },
    )


def settle(
    actor: Any, sale_id: int, items: list[dict[str, Any]] | None, withheld: str | None
) -> Any:
    return register(actor, sale_id, body(items, withheld))


def summary(sale_id: int) -> dict[str, Any]:
    money: dict[str, Any] = queries.sale_detail(Sale.objects.get(pk=sale_id))["money"]
    return money


def configure(admin: Any, commercial: Any, **changes: Any) -> None:
    entity = commercial["entity"]
    current = withholding_settings.settings_for_entity(entity_id=entity.pk)
    withholding_settings.set_withholding_settings(
        actor=admin,
        entity_id=entity.pk,
        expected_version=current.version,
        idempotency_key=str(uuid.uuid4()),
        **changes,
    )


def test_cash_sale_is_settled_with_money_plus_withholding(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="250.00", condition="CONTADO")
    outcome = settle(seller, sale["id"], parts(transfer="245.00"), "5.00")
    assert outcome.status == 201
    assert outcome.body["amount"] == "245.00"
    assert outcome.body["withholding"]["amount"] == "5.00"
    assert outcome.body["withholding"]["voucher_pending"] is True
    money = summary(sale["id"])
    assert money["paid_total"] == "245.00"
    assert money["withheld_total"] == "5.00"
    assert money["balance"] == "0.00"
    assert money["payment_state"] == "PAID"
    assert money["refund_due"] == "0.00"
    withholding = CommercialWithholding.objects.get()
    assert withholding.payment_id == CommercialPayment.objects.get().pk
    assert withholding.operation_id == withholding.payment.operation_id
    assert withholding.customer_id == Sale.objects.get(pk=sale["id"]).customer_id
    assert withholding.created_by_id == seller.pk


def test_withholding_alone_closes_a_credit_balance_without_a_payment(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="250.00")
    settle(seller, sale["id"], parts(cash="245.00"), None)
    outcome = settle(seller, sale["id"], None, "5.00")
    assert outcome.status == 201
    assert outcome.body["amount"] == "5.00"
    assert outcome.body["payment_id"] is None
    assert CommercialPayment.objects.count() == 1
    money = summary(sale["id"])
    assert (money["balance"], money["payment_state"]) == ("0.00", "PAID")
    assert (money["paid_total"], money["withheld_total"]) == ("245.00", "5.00")


def test_withholding_without_money_is_a_partial_state(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="100.00")
    settle(seller, sale["id"], None, "2.00")
    money = summary(sale["id"])
    assert (money["paid_total"], money["withheld_total"]) == ("0.00", "2.00")
    assert (money["balance"], money["payment_state"]) == ("98.00", "PARTIAL")


def test_cash_sale_not_covered_is_rejected_entirely(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="250.00", condition="CONTADO")
    review = payments.preview_payment(
        actor=seller, sale_id=sale["id"], payload=body(parts(cash="200.00"), "5.00")
    )
    assert review["can_register"] is False
    assert review["issues"][0]["field"] == "amount"
    assert not CommercialPayment.objects.exists()
    assert not CommercialWithholding.objects.exists()


@pytest.mark.parametrize("amount", ["5.01", "0.00", "-1.00", "1.005", "abc"])
def test_invalid_withholding_amount_is_rejected(
    seller: Any, confirmed_sale: Any, amount: str
) -> None:
    sale = confirmed_sale(price="250.00")
    settle(seller, sale["id"], parts(cash="245.00"), None)
    data = body(None, amount)

    def attempt() -> None:
        payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
        payments.register_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={**data, "idempotency_key": f"wh-bad-{next(_keys):06d}"},
        )

    with pytest.raises(SalesApplicationError) as error:
        attempt()
    assert error.value.code == "validation_error"
    assert not CommercialWithholding.objects.exists()


def test_action_needs_money_or_withholding(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="100.00")
    with pytest.raises(SalesApplicationError):
        payments.preview_payment(actor=seller, sale_id=sale["id"], payload=body(None, None))


def test_unknown_withholding_fields_are_rejected(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="100.00")
    data = body(None, "2.00")
    data["withholding"]["voucher_number"] = "001-001-000000001"
    with pytest.raises(SalesApplicationError):
        payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)


def test_draft_and_voided_sales_reject_withholdings(
    seller: Any, admin: Any, customer: Any, product: Any, confirmed_sale: Any
) -> None:
    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": "wh-draft-000001",
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [{"product_id": product.pk, "quantity": "1"}],
        },
    ).body
    review = payments.preview_payment(actor=seller, sale_id=draft["id"], payload=body(None, "1.00"))
    assert review["can_register"] is False
    assert review["issues"][0]["code"] == "invalid_state"


def test_entity_with_registration_disabled_rejects_withholdings(
    seller: Any, admin: Any, commercial: Any, confirmed_sale: Any
) -> None:
    configure(admin, commercial, registration_enabled=False)
    sale = confirmed_sale(price="100.00")
    review = payments.preview_payment(
        actor=seller, sale_id=sale["id"], payload=body(parts(cash="98.00"), "2.00")
    )
    assert review["can_register"] is False
    assert review["issues"][0]["field"] == "withholding"
    assert "no registra retenciones" in review["issues"][0]["message"]
    # el cobro sin retención sigue funcionando igual
    settle(seller, sale["id"], parts(cash="98.00"), None)
    assert summary(sale["id"])["balance"] == "2.00"


def test_disabling_keeps_existing_withholdings_counting(
    seller: Any, admin: Any, commercial: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    settle(seller, sale["id"], parts(cash="98.00"), "2.00")
    configure(admin, commercial, registration_enabled=False)
    assert summary(sale["id"])["balance"] == "0.00"


def test_unusual_amount_requires_acknowledgement(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="100.00")
    data = body(parts(cash="75.00"), "25.00")
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
    assert review["can_register"] is False
    issue = review["issues"][0]
    assert (issue["code"], issue["field"]) == ("withholding_warning", "withholding")
    assert review["warning"] == {"percentage": "20.00", "threshold": "20.00"}
    with pytest.raises(SalesApplicationError) as error:
        payments.register_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={**data, "idempotency_key": "wh-warn-000001"},
        )
    assert error.value.code == "withholding_warning"
    assert not CommercialWithholding.objects.exists()
    assert not CommercialPayment.objects.exists()

    data["withholding"]["acknowledged"] = True
    register(seller, sale["id"], data)
    assert summary(sale["id"])["withheld_total"] == "25.00"


def test_warning_counts_previous_withholdings(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="100.00")
    settle(seller, sale["id"], None, "15.00")
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=body(None, "6.00"))
    assert review["issues"][0]["code"] == "withholding_warning"


def test_disabled_warning_never_fires(
    seller: Any, admin: Any, commercial: Any, confirmed_sale: Any
) -> None:
    configure(admin, commercial, warning_percentage=None)
    sale = confirmed_sale(price="100.00")
    settle(seller, sale["id"], parts(cash="75.00"), "25.00")
    assert summary(sale["id"])["balance"] == "0.00"


def test_failure_saving_the_withholding_leaves_no_payment(
    seller: Any, confirmed_sale: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    sale = confirmed_sale(price="250.00", condition="CONTADO")
    data = body(parts(cash="245.00"), "5.00")
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)

    def boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("fallo simulado")

    monkeypatch.setattr(CommercialWithholding.objects, "create", boom)
    with pytest.raises(RuntimeError):
        payments.register_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={
                **data,
                "idempotency_key": "wh-fail-000001",
                "review_token": review["review_token"],
            },
        )
    assert not CommercialPayment.objects.exists()
    assert summary(sale["id"])["balance"] == "250.00"


def test_review_is_invalidated_by_a_concurrent_withholding(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    data = body(parts(cash="50.00"), None)
    review = payments.preview_payment(actor=seller, sale_id=sale["id"], payload=data)
    settle(seller, sale["id"], None, "2.00")
    with pytest.raises(SalesApplicationError) as error:
        payments.register_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={
                **data,
                "idempotency_key": "wh-stale-000001",
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "review_required"


def test_same_operation_id_returns_the_existing_result(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="250.00", condition="CONTADO")
    data = body(parts(transfer="245.00"), "5.00")
    first = register(seller, sale["id"], data)
    again = payments.register_payment(
        actor=seller,
        sale_id=sale["id"],
        payload={**data, "idempotency_key": "wh-retry-000001"},
    )
    assert again.status == 200
    assert again.body["id"] == first.body["id"]
    assert CommercialWithholding.objects.count() == 1
    assert CommercialPayment.objects.count() == 1


def test_same_operation_id_with_another_withheld_amount_conflicts(
    seller: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="250.00")
    data = body(parts(transfer="240.00"), "5.00")
    register(seller, sale["id"], data)
    changed = {**data, "withholding": {"amount": "6.00"}}
    with pytest.raises(SalesApplicationError) as error:
        payments.register_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={**changed, "idempotency_key": "wh-conflict-000001"},
        )
    assert error.value.code == "idempotency_conflict"
    only = {"operation_id": data["operation_id"], "withholding": {"amount": "5.00"}}
    with pytest.raises(SalesApplicationError) as other:
        payments.register_payment(
            actor=seller,
            sale_id=sale["id"],
            payload={**only, "idempotency_key": "wh-conflict-000002"},
        )
    assert other.value.code == "idempotency_conflict"


def test_withholding_alone_is_idempotent(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="100.00")
    data = body(None, "2.00")
    first = register(seller, sale["id"], data)
    again = payments.register_payment(
        actor=seller, sale_id=sale["id"], payload={**data, "idempotency_key": "wh-solo-000001"}
    )
    assert again.status == 200
    assert again.body["id"] == first.body["id"]
    assert CommercialWithholding.objects.count() == 1


def test_only_roles_that_charge_can_register_a_withholding(actor: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="100.00")
    with pytest.raises(BusinessPermissionDeniedError):
        payments.preview_payment(actor=actor, sale_id=sale["id"], payload=body(None, "2.00"))
    with pytest.raises(BusinessPermissionDeniedError):
        payments.register_payment(
            actor=actor,
            sale_id=sale["id"],
            payload={**body(None, "2.00"), "idempotency_key": "wh-denied-000001"},
        )
    assert not CommercialWithholding.objects.exists()


def test_plain_payments_keep_their_shape(seller: Any, confirmed_sale: Any) -> None:
    sale = confirmed_sale(price="100.00")
    outcome = settle(seller, sale["id"], parts(cash="100.00"), None)
    assert outcome.body["withholding"] is None
    money = summary(sale["id"])
    assert (money["withheld_total"], money["withheld_excess"]) == ("0.00", "0.00")


def test_administrator_charges_with_withholding_and_workshop_manager_cannot(
    admin: Any, role_manager: Any, confirmed_sale: Any
) -> None:
    sale = confirmed_sale(price="100.00")
    settle(admin, sale["id"], parts(cash="98.00"), "2.00")
    other = confirmed_sale(price="50.00")
    with pytest.raises(BusinessPermissionDeniedError):
        payments.preview_payment(
            actor=role_manager, sale_id=other["id"], payload=body(None, "1.00")
        )
    assert CommercialWithholding.objects.count() == 1


def test_lists_and_receivables_use_the_balance_net_of_withholdings(
    seller: Any, confirmed_sale: Any
) -> None:
    from sales.application import reads

    settled = confirmed_sale(price="250.00")
    settle(seller, settled["id"], parts(cash="245.00"), "5.00")
    pending = confirmed_sale(price="100.00")
    settle(seller, pending["id"], None, "2.00")

    receivable = reads.receivables(actor=seller)
    assert [row["id"] for row in receivable["items"]] == [pending["id"]]
    assert receivable["items"][0]["money"]["withheld_total"] == "2.00"
    assert receivable["items"][0]["money"]["balance"] == "98.00"

    listed = {row["id"]: row["money"] for row in reads.list_sales(actor=seller)["items"]}
    assert listed[settled["id"]]["payment_state"] == "PAID"
    assert listed[settled["id"]]["paid_total"] == "245.00"
    assert listed[settled["id"]]["withheld_total"] == "5.00"
    paid = reads.list_sales(actor=seller, payment_state="PAID")["items"]
    assert [row["id"] for row in paid] == [settled["id"]]
    partial = reads.list_sales(actor=seller, payment_state="PARTIAL")["items"]
    assert [row["id"] for row in partial] == [pending["id"]]


def test_database_rejects_incoherent_withholdings(seller: Any, confirmed_sale: Any) -> None:
    from datetime import date
    from decimal import Decimal

    from django.db import IntegrityError, transaction
    from django.utils import timezone

    sale = Sale.objects.get(pk=confirmed_sale(price="100.00")["id"])

    def create(**fields: Any) -> None:
        defaults: dict[str, Any] = {
            "operation_id": uuid.uuid4(),
            "sale": sale,
            "customer_id": sale.customer_id,
            "amount": Decimal("5.00"),
            "effective_at": timezone.now(),
            "effective_date": date(2026, 10, 5),
            "created_by": seller,
        }
        CommercialWithholding.objects.create(**{**defaults, **fields})

    for invalid in (
        {"amount": Decimal("0.00")},
        {"voucher_number": "001-001-000000001"},
        {"voucher_number": "1-1-1", "voucher_date": date(2026, 10, 5)},
        {"income_tax_amount": Decimal("3.00"), "vat_amount": Decimal("1.00")},
        {"income_tax_amount": Decimal("5.00")},
        {"voided_at": timezone.now()},
        {"void_reason": "motivo sin anulación"},
    ):
        with pytest.raises(IntegrityError), transaction.atomic():
            create(**invalid)

    create(voucher_number="001-001-000000001", voucher_date=date(2026, 10, 5))
    with pytest.raises(IntegrityError), transaction.atomic():
        create(voucher_number="001-001-000000001", voucher_date=date(2026, 10, 5))
    # una retención anulada libera su número
    create(
        voucher_number="001-001-000000001",
        voucher_date=date(2026, 10, 5),
        voided_at=timezone.now(),
        voided_by=seller,
        void_reason="Registrada por error",
    )
