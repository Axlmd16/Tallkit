"""Confirmación atómica: recepción completa, número COM-ING, valoración y auditoría."""

from decimal import Decimal
from typing import Any

import pytest

from identity.models import AuditEvent
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition
from purchasing.application import purchases
from purchasing.application.commands import IdempotencyConflictError
from purchasing.application.errors import PurchaseApplicationError
from purchasing.models import Purchase, PurchaseCommand
from workshop_configuration.models import (
    ConfigurationUse,
    DocumentSeries,
    NumberAllocation,
    TaxPeriod,
    Warehouse,
)

from .test_drafts import create, no_side_effects

pytestmark = pytest.mark.django_db
D = Decimal


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Toda confirmación requiere contexto comercial, bodega y serie COM-ING."""


def confirm(admin: Any, draft: dict[str, Any], key: str = "confirm-key-001", **extra: Any) -> Any:
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    assert review["can_confirm"], review["issues"]
    payload = {
        "idempotency_key": key,
        "expected_version": draft["version"],
        "review_token": review["review_token"],
        **extra,
    }
    return purchases.confirm_purchase(actor=admin, purchase_id=draft["id"], payload=payload)


@pytest.fixture
def two_products(make_product: Any) -> tuple[Any, Any]:
    return make_product(), make_product()


def test_confirmation_receives_all_lines_and_records_linked_effects(
    admin: Any, commercial: Any, draft_payload: Any, two_products: Any, line: Any
) -> None:
    a, b = two_products
    draft = create(
        admin,
        draft_payload(
            [line(a, commercial["ten"], "2", "10.00"), line(b, commercial["zero"], "3", "5.00")]
        ),
    )
    outcome = confirm(admin, draft)
    body = outcome.body
    assert outcome.status == 200
    assert (body["state"], body["internal_number"]) == ("CONFIRMED", "COM-ING-000001")
    assert body["totals"]["total"] == "37.00"  # 22.00 + 15.00
    assert InventoryPosition.objects.get(product=a).quantity == D(2)
    assert InventoryPosition.objects.get(product=b).quantity == D(3)
    operation = InventoryOperation.objects.get()
    assert (operation.kind, operation.state, operation.source_id) == (
        "PURCHASE_RECEIPT",
        "POSTED",
        draft["id"],
    )
    assert body["inventory_operation_id"] == operation.pk
    assert InventoryMovement.objects.filter(operation=operation).count() == 2
    assert InventoryPosition.objects.get(product=a).average == D("10.000000")
    assert NumberAllocation.objects.count() == 1
    assert {u.tax_code_snapshot for u in ConfigurationUse.objects.all()} == {"IVA", "CERO"}
    assert (
        AuditEvent.objects.filter(action="purchasing.purchase_confirmed", result="SUCCESS").count()
        == 1
    )


def test_non_recoverable_tax_is_added_to_the_inventory_value_and_average(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(
        admin,
        draft_payload(
            [line(product, commercial["ten"], "2", "10.00", tax_recoverability="NON_RECOVERABLE")]
        ),
    )
    confirm(admin, draft)
    position = InventoryPosition.objects.get()
    assert (position.quantity, position.value, position.average) == (
        D(2),
        D("22.000000"),
        D("11.000000"),
    )


def test_two_lines_of_the_same_product_are_one_movement_with_detail_kept(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(
        admin,
        draft_payload(
            [
                line(product, commercial["ten"], "2", "4.00"),
                line(product, commercial["ten"], "3", "9.00"),
            ]
        ),
    )
    body = confirm(admin, draft).body
    assert InventoryMovement.objects.count() == 1
    assert len(body["lines"]) == 2
    assert InventoryPosition.objects.get().quantity == D(5)


def test_confirmed_data_is_frozen_from_snapshots_even_if_catalog_changes(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    from catalog.models import Product

    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    confirm(admin, draft)
    Product.objects.filter(pk=product.pk).update(name="Otro nombre", is_active=False)
    TaxPeriod.objects.filter(tax_definition=commercial["ten"]).update(rate=D("99"))
    from purchasing.application import queries

    body = queries.get_purchase(actor=admin, purchase_id=draft["id"])
    assert body["lines"][0]["product"]["name"] == product.name
    assert body["lines"][0]["tax"]["rate"] == "10.0000"
    assert body["lines"][0]["amounts"]["tax"] == "2.00"
    assert body["supplier"]["name"] == "Proveedor Uno"


def test_intermediate_failure_rolls_back_effects_number_receipt_and_success_audit(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any, monkeypatch: Any
) -> None:
    from inventory.application import posting

    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    before = no_side_effects()
    receipts = PurchaseCommand.objects.count()

    def boom(*args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("falla simulada")

    monkeypatch.setattr(posting, "post_operation", boom)
    with pytest.raises(RuntimeError):
        confirm(admin, draft)
    assert no_side_effects() == before
    assert PurchaseCommand.objects.count() == receipts
    assert Purchase.objects.get(pk=draft["id"]).state == "DRAFT"
    assert DocumentSeries.objects.get(code="COM-ING").last_number == 0
    assert not AuditEvent.objects.filter(
        action="purchasing.purchase_confirmed", result="SUCCESS"
    ).exists()


def test_a_price_or_rate_change_after_review_requires_a_new_review(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    TaxPeriod.objects.filter(tax_definition=commercial["ten"]).update(rate=D("12"))
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.confirm_purchase(
            actor=admin,
            purchase_id=draft["id"],
            payload={
                "idempotency_key": "confirm-key-002",
                "expected_version": draft["version"],
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "review_required"
    assert no_side_effects() == (0, 0, 0, 0, 0)


def test_edit_after_review_is_a_stale_record(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    purchases.update_draft(
        actor=admin,
        purchase_id=draft["id"],
        payload={"idempotency_key": "edit-key-000031", "expected_version": 1, "notes": "cambio"},
    )
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.confirm_purchase(
            actor=admin,
            purchase_id=draft["id"],
            payload={
                "idempotency_key": "confirm-key-003",
                "expected_version": 1,
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "stale_record"


def test_future_document_date_is_rejected_at_confirmation(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    from datetime import date

    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    Purchase.objects.filter(pk=draft["id"]).update(document_date=date(2999, 1, 1))
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.confirm_purchase(
            actor=admin,
            purchase_id=draft["id"],
            payload={
                "idempotency_key": "confirm-key-004",
                "expected_version": draft["version"],
                "review_token": review["review_token"],
            },
        )
    assert "document_date" in error.value.errors
    assert no_side_effects() == (0, 0, 0, 0, 0)


def test_totals_imposed_by_the_client_are_rejected(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    with pytest.raises(PurchaseApplicationError) as error:
        confirm(admin, draft, total="1.00")
    assert error.value.code == "unknown_field"
    assert Purchase.objects.get(pk=draft["id"]).state == "DRAFT"


@pytest.mark.parametrize("scenario", ["no_series", "artisanal_tax", "no_rate", "ambiguous_rate"])
def test_missing_or_wrong_configuration_rejects_everything(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any, scenario: str
) -> None:
    from datetime import date

    from workshop_configuration.models import FiscalEntity, TaxDefinition

    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    token = review["review_token"]
    expected = {
        "no_series": "configuration_missing",
        "artisanal_tax": "invalid_tax_scope",
        "no_rate": "configuration_missing",
        "ambiguous_rate": "configuration_ambiguous",
    }[scenario]
    if scenario == "no_series":
        commercial["series"].delete()
        commercial["scope"].delete()
    elif scenario == "artisanal_tax":
        artisan = FiscalEntity.objects.create(
            entity_type="ARTESANAL", legal_name="Art", ruc="1790000000002"
        )
        TaxDefinition.objects.filter(pk=commercial["ten"].pk).update(fiscal_entity=artisan)
    elif scenario == "no_rate":
        TaxPeriod.objects.filter(tax_definition=commercial["ten"]).delete()
    else:
        TaxPeriod.objects.create(
            tax_definition=commercial["ten"], rate=D("12"), starts_on=date(2025, 6, 1)
        )
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.confirm_purchase(
            actor=admin,
            purchase_id=draft["id"],
            payload={
                "idempotency_key": "confirm-key-005",
                "expected_version": draft["version"],
                "review_token": token,
            },
        )
    assert error.value.code == expected
    assert no_side_effects() == (0, 0, 0, 0, 0)
    assert Purchase.objects.get(pk=draft["id"]).state == "DRAFT"


def test_inactive_product_or_supplier_blocks_the_whole_confirmation(
    admin: Any, commercial: Any, draft_payload: Any, two_products: Any, line: Any, supplier: Any
) -> None:
    from catalog.models import Product
    from supplier_registry.models import Supplier

    a, b = two_products
    draft = create(admin, draft_payload([line(a, commercial["ten"]), line(b, commercial["ten"])]))
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    payload = {
        "idempotency_key": "confirm-key-006",
        "expected_version": draft["version"],
        "review_token": review["review_token"],
    }
    Product.objects.filter(pk=b.pk).update(is_active=False)
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.confirm_purchase(actor=admin, purchase_id=draft["id"], payload=payload)
    assert error.value.errors.keys() == {"lines.1.product_id"}
    Product.objects.filter(pk=b.pk).update(is_active=True)
    Supplier.objects.filter(pk=supplier.pk).update(is_active=False)
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.confirm_purchase(
            actor=admin,
            purchase_id=draft["id"],
            payload={**payload, "idempotency_key": "confirm-key-007"},
        )
    assert "supplier_id" in error.value.errors
    assert no_side_effects() == (0, 0, 0, 0, 0)


def test_compatible_repetition_with_the_same_key_replays(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    payload = {
        "idempotency_key": "confirm-key-008",
        "expected_version": draft["version"],
        "review_token": review["review_token"],
    }
    first = purchases.confirm_purchase(actor=admin, purchase_id=draft["id"], payload=payload)
    again = purchases.confirm_purchase(actor=admin, purchase_id=draft["id"], payload=payload)
    assert again.replayed
    assert again.body == first.body
    assert InventoryMovement.objects.count() == 1
    with pytest.raises(IdempotencyConflictError):
        purchases.confirm_purchase(
            actor=admin, purchase_id=draft["id"], payload={**payload, "expected_version": 5}
        )


def test_repetition_with_another_key_or_actor_returns_the_existing_confirmation(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    from django.contrib.auth import get_user_model

    from identity.models import UserRole

    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    first = confirm(admin, draft, key="confirm-key-009")
    other = get_user_model().objects.create_user(username="admin-3", password="x" * 14)
    UserRole.objects.create(user=other, role="ADMINISTRADOR")
    other_review = purchases.preview_confirmation(actor=other, purchase_id=draft["id"])
    assert other_review["state"] == "CONFIRMED"
    again = purchases.confirm_purchase(
        actor=admin,
        purchase_id=draft["id"],
        payload={
            "idempotency_key": "confirm-key-010",
            "expected_version": draft["version"],
            "review_token": review["review_token"],
        },
    )
    assert again.body["internal_number"] == first.body["internal_number"]
    assert InventoryMovement.objects.count() == 1
    assert NumberAllocation.objects.count() == 1
    assert ConfigurationUse.objects.count() == 1


def test_incompatible_confirmation_of_an_already_confirmed_purchase_conflicts(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any, make_product: Any
) -> None:
    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    confirm(admin, draft, key="confirm-key-011")
    other_draft = create(admin, draft_payload([line(make_product(), commercial["ten"], "9")]))
    foreign = purchases.preview_confirmation(actor=admin, purchase_id=other_draft["id"])
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.confirm_purchase(
            actor=admin,
            purchase_id=draft["id"],
            payload={
                "idempotency_key": "confirm-key-012",
                "expected_version": draft["version"],
                "review_token": foreign["review_token"],
            },
        )
    assert error.value.code in {"validation_error", "idempotency_conflict"}
    assert review["review_token"]


def test_a_repeated_confirmation_never_reactivates_a_voided_purchase(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    confirm(admin, draft, key="confirm-key-013")
    Purchase.objects.filter(pk=draft["id"]).update(state="VOIDED", void_reason="x")
    again = purchases.confirm_purchase(
        actor=admin,
        purchase_id=draft["id"],
        payload={
            "idempotency_key": "confirm-key-014",
            "expected_version": draft["version"],
            "review_token": review["review_token"],
        },
    )
    assert again.body["state"] == "VOIDED"
    assert InventoryMovement.objects.count() == 1


def test_quantities_count_presentations_never_the_content_of_each_one(
    admin: Any, commercial: Any, draft_payload: Any, make_product: Any, line: Any
) -> None:
    half_gallon = make_product(content_quantity=D("0.5"))
    draft = create(admin, draft_payload([line(half_gallon, commercial["ten"], "3", "4.00")]))
    body = confirm(admin, draft, key="confirm-key-101").body
    position = InventoryPosition.objects.get()
    assert position.quantity == D(3)  # 3 presentaciones, no 1.5 unidades de contenido
    assert body["lines"][0]["quantity"] == "3"
    from purchasing.models import PurchaseLine

    snapshot = PurchaseLine.objects.get().product_snapshot
    assert (snapshot or {})["content_quantity"] == "0.500000"


def test_an_old_document_uses_its_own_date_rate_and_is_recorded_after_existing_movements(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    from datetime import date

    TaxPeriod.objects.filter(tax_definition=commercial["ten"]).update(ends_on=date(2026, 1, 31))
    TaxPeriod.objects.create(
        tax_definition=commercial["ten"], rate=D("12"), starts_on=date(2026, 2, 1)
    )
    recent = create(
        admin,
        draft_payload([line(product, commercial["ten"], "1", "5.00")], document_date="2026-03-01"),
    )
    confirm(admin, recent, key="confirm-key-102")
    old = create(
        admin,
        draft_payload([line(product, commercial["ten"], "2", "10.00")], document_date="2026-01-10"),
    )
    body = confirm(admin, old, key="confirm-key-103").body
    assert body["lines"][0]["tax"]["rate"] == "10.0000"  # tarifa vigente el día del documento
    assert body["totals"]["tax"] == "2.00"
    movements = list(InventoryMovement.objects.order_by("ordinal"))
    assert [m.ordinal for m in movements] == [1, 2]  # entra después de los ya confirmados
    assert movements[1].effective_at >= movements[0].effective_at
    assert movements[1].effective_at.date() != date_of("2026-01-10")


def date_of(iso: str) -> Any:
    from datetime import date

    return date.fromisoformat(iso)


def test_missing_warehouse_rejects_the_confirmation_without_effects(
    admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
) -> None:
    draft = create(admin, draft_payload([line(product, commercial["ten"])]))
    review = purchases.preview_confirmation(actor=admin, purchase_id=draft["id"])
    Warehouse.objects.all().delete()
    with pytest.raises(PurchaseApplicationError) as error:
        purchases.confirm_purchase(
            actor=admin,
            purchase_id=draft["id"],
            payload={
                "idempotency_key": "confirm-key-104",
                "expected_version": draft["version"],
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "configuration_missing"
    assert no_side_effects() == (0, 0, 0, 0, 0)
