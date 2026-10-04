"""Entrada de stock: revisión, registro directo, validaciones, idempotencia y duplicados."""

from datetime import date
from decimal import Decimal
from itertools import count
from typing import Any

import pytest

import inventory.application.posting as posting
from identity.application.authorization import BusinessPermissionDeniedError
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition
from purchasing.application import entries
from purchasing.application.commands import IdempotencyConflictError
from purchasing.application.errors import PurchaseApplicationError
from purchasing.models import Purchase, PurchaseCommand, PurchaseLine
from supplier_registry.models import Supplier
from workshop_configuration.application.numbering import allocate_number, get_numbering_scope_id
from workshop_configuration.models import DocumentSeries, NumberAllocation, Warehouse

pytestmark = pytest.mark.django_db
D = Decimal
_keys = count(1)


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Any) -> None:
    """Contexto comercial, bodega y serie COM-ING."""


def row(product: Any, quantity: str = "2", cost: str | None = None) -> dict[str, Any]:
    line: dict[str, Any] = {"product_id": product.pk, "quantity": quantity}
    if cost is not None:
        line["unit_cost"] = cost
    return line


def body(lines: list[dict[str, Any]], **extra: Any) -> dict[str, Any]:
    return {"idempotency_key": f"entry-key-{next(_keys):06d}", "lines": lines, **extra}


def register(actor: Any, lines: list[dict[str, Any]], **extra: Any) -> Any:
    return entries.register_entry(actor=actor, payload=body(lines, **extra))


def effects() -> tuple[int, int, int, int, int]:
    return (
        Purchase.objects.count(),
        InventoryOperation.objects.count(),
        InventoryMovement.objects.count(),
        NumberAllocation.objects.count(),
        PurchaseCommand.objects.count(),
    )


class TestMainFlow:
    def test_a_minimal_entry_needs_only_product_and_quantity(
        self, seller: Any, product: Any
    ) -> None:
        outcome = register(seller, [row(product, "4")])
        assert outcome.status == 201
        purchase = Purchase.objects.get()
        assert (purchase.flow, purchase.state) == ("SIMPLE", "CONFIRMED")
        assert purchase.internal_number == "COM-ING-000001"
        assert purchase.supplier_id is None
        assert purchase.confirmed_by_id == seller.pk
        assert purchase.document_identity_id is None
        assert purchase.document_date is None
        line = PurchaseLine.objects.get()
        assert (line.quantity, line.unit_cost, line.tax_definition_id) == (D(4), None, None)
        position = InventoryPosition.objects.get()
        assert (position.quantity, position.valued) == (D(4), False)
        assert outcome.body["internal_number"] == "COM-ING-000001"

    def test_an_entry_with_supplier_reference_note_and_costs(
        self, seller: Any, product: Any, supplier: Any
    ) -> None:
        register(
            seller,
            [row(product, "2", "4.50")],
            supplier_id=supplier.pk,
            reference=" F-001-123 ",
            observation="Llegó por la tarde",
        )
        purchase = Purchase.objects.get()
        assert (purchase.supplier_id, purchase.external_reference) == (supplier.pk, "F-001-123")
        assert purchase.observation == "Llegó por la tarde"
        assert purchase.supplier_snapshot is not None
        assert purchase.supplier_snapshot["name"] == supplier.name
        assert purchase.fiscal_snapshot is not None
        assert purchase.fiscal_snapshot["series_code"] == "COM-ING"
        position = InventoryPosition.objects.get()
        assert (position.value, position.average, position.valued) == (
            D("9.000000"),
            D("4.500000"),
            True,
        )

    def test_lines_with_and_without_cost_in_the_same_entry(
        self, seller: Any, product: Any, make_product: Any
    ) -> None:
        other = make_product()
        register(seller, [row(product, "2", "4.50"), row(other, "3")])
        assert InventoryPosition.objects.get(product=product).valued is True
        assert InventoryPosition.objects.get(product=other).valued is False
        assert InventoryMovement.objects.count() == 2

    def test_an_explicit_zero_cost_is_known_and_distinct_from_no_cost(
        self, seller: Any, product: Any
    ) -> None:
        register(seller, [row(product, "2", "0")])
        assert PurchaseLine.objects.get().unit_cost == D(0)
        position = InventoryPosition.objects.get()
        assert (position.valued, position.value) == (True, D(0))

    def test_numbering_continues_after_a_previous_purchase(
        self, seller: Any, product: Any, make_product: Any
    ) -> None:
        scope = get_numbering_scope_id(entity_type="COMERCIAL", document_type="INGRESO")
        allocate_number(
            scope_id=scope,
            consumer_type="purchase",
            consumer_id="legacy-1",
            request_key="legacy:1",
            request_fingerprint="f" * 64,
        )
        register(seller, [row(product)])
        assert Purchase.objects.get().internal_number == "COM-ING-000002"
        register(seller, [row(make_product())])
        assert set(Purchase.objects.values_list("internal_number", flat=True)) == {
            "COM-ING-000002",
            "COM-ING-000003",
        }

    def test_the_effective_moment_is_assigned_by_the_system(
        self, seller: Any, product: Any
    ) -> None:
        for forbidden in ("confirmed_at", "document_date", "confirmed_on"):
            with pytest.raises(PurchaseApplicationError) as error:
                register(seller, [row(product)], **{forbidden: "2020-01-01"})
            assert error.value.code == "unknown_field"
        assert effects() == (0, 0, 0, 0, 0)
        register(seller, [row(product)])
        purchase = Purchase.objects.get()
        assert purchase.confirmed_at is not None
        assert purchase.confirmed_on == entries.business_today()

    def test_the_administrator_may_register_too(self, admin: Any, product: Any) -> None:
        assert register(admin, [row(product)]).status == 201


class TestPermissions:
    def test_the_workshop_manager_cannot_review_or_register(
        self, manager: Any, product: Any
    ) -> None:
        with pytest.raises(BusinessPermissionDeniedError):
            entries.review_entry(actor=manager, payload={"lines": [row(product)]})
        with pytest.raises(BusinessPermissionDeniedError):
            register(manager, [row(product)])
        assert effects() == (0, 0, 0, 0, 0)

    def test_the_response_never_returns_costs_to_a_seller(self, seller: Any, product: Any) -> None:
        outcome = register(seller, [row(product, "2", "4.50")])
        text = str(outcome.body)
        for forbidden in ("4.50", "unit_cost", "9.00"):
            assert forbidden not in text

    def test_the_administrator_receives_the_cost_he_can_see(self, admin: Any, product: Any) -> None:
        outcome = register(admin, [row(product, "2", "4.50")])
        assert outcome.body["lines"][0]["unit_cost"] == "4.500000"


class TestValidation:
    @pytest.mark.parametrize(
        ("lines", "field"),
        [
            ([], "lines"),
            ([{"product_id": 0, "quantity": "1"}], "lines.0.product_id"),
            ([{"product_id": 1, "quantity": "0"}], "lines.0.quantity"),
            ([{"product_id": 1, "quantity": "1.5"}], "lines.0.quantity"),
            ([{"product_id": 1, "quantity": "-1"}], "lines.0.quantity"),
            ([{"product_id": 1, "quantity": "1", "unit_cost": "-1"}], "lines.0.unit_cost"),
            (
                [{"product_id": 1, "quantity": "1", "unit_cost": "1.1234567"}],
                "lines.0.unit_cost",
            ),
            (
                [{"product_id": 1, "quantity": "1", "tax_definition_id": 1}],
                "lines.0.tax_definition_id",
            ),
        ],
    )
    def test_invalid_lines_are_rejected_without_effects(
        self, seller: Any, product: Any, lines: list[dict[str, Any]], field: str
    ) -> None:
        for line in lines:
            if line.get("product_id") == 1:
                line["product_id"] = product.pk
        with pytest.raises(PurchaseApplicationError) as error:
            register(seller, lines)
        assert field in error.value.errors
        assert effects() == (0, 0, 0, 0, 0)

    def test_a_product_cannot_repeat(self, seller: Any, product: Any) -> None:
        with pytest.raises(PurchaseApplicationError) as error:
            register(seller, [row(product, "1"), row(product, "2")])
        assert "lines.1.product_id" in error.value.errors
        assert effects() == (0, 0, 0, 0, 0)

    def test_unknown_request_fields_are_rejected(self, seller: Any, product: Any) -> None:
        with pytest.raises(PurchaseApplicationError) as error:
            register(seller, [row(product)], total="1.00")
        assert error.value.code == "unknown_field"

    def test_inactive_and_missing_products_reject_the_whole_entry(
        self, seller: Any, product: Any, make_product: Any
    ) -> None:
        inactive = make_product(is_active=False)
        with pytest.raises(PurchaseApplicationError) as error:
            register(seller, [row(product), row(inactive)])
        assert error.value.code == "inactive_reference"
        assert "lines.1.product_id" in error.value.errors
        with pytest.raises(PurchaseApplicationError) as missing:
            register(seller, [{"product_id": 9_999_999, "quantity": "1"}])
        assert missing.value.code == "inactive_reference"
        assert effects() == (0, 0, 0, 0, 0)

    def test_a_supplier_is_optional_but_must_be_active_when_informed(
        self, seller: Any, product: Any, supplier: Any
    ) -> None:
        Supplier.objects.filter(pk=supplier.pk).update(is_active=False)
        with pytest.raises(PurchaseApplicationError) as error:
            register(seller, [row(product)], supplier_id=supplier.pk)
        assert "supplier_id" in error.value.errors
        with pytest.raises(PurchaseApplicationError) as missing:
            register(seller, [row(product)], supplier_id=9_999_999)
        assert "supplier_id" in missing.value.errors
        assert register(seller, [row(product)], supplier_id=None).status == 201

    def test_free_text_limits_are_enforced(self, seller: Any, product: Any) -> None:
        with pytest.raises(PurchaseApplicationError) as error:
            register(seller, [row(product)], reference="x" * 129)
        assert "reference" in error.value.errors

    def test_missing_series_or_warehouse_reject_the_entry_without_effects(
        self, seller: Any, product: Any
    ) -> None:
        DocumentSeries.objects.all().delete()
        with pytest.raises(PurchaseApplicationError) as error:
            register(seller, [row(product)])
        assert error.value.code == "configuration_missing"
        assert effects() == (0, 0, 0, 0, 0)

    def test_a_missing_warehouse_is_a_configuration_error(self, seller: Any, product: Any) -> None:
        Warehouse.objects.all().delete()
        with pytest.raises(PurchaseApplicationError) as error:
            register(seller, [row(product)])
        assert error.value.code == "configuration_missing"
        assert effects() == (0, 0, 0, 0, 0)


class TestIdempotencyAndAtomicity:
    def test_a_compatible_retry_returns_the_same_entry_without_new_effects(
        self, seller: Any, product: Any
    ) -> None:
        payload = body([row(product, "3", "2.00")])
        first = entries.register_entry(actor=seller, payload=payload)
        before = effects()
        again = entries.register_entry(actor=seller, payload=payload)
        assert again.replayed is True
        assert again.body == first.body
        assert effects() == before

    def test_the_same_key_with_other_content_conflicts(self, seller: Any, product: Any) -> None:
        payload = body([row(product, "3")])
        entries.register_entry(actor=seller, payload=payload)
        before = effects()
        with pytest.raises(IdempotencyConflictError):
            entries.register_entry(actor=seller, payload={**payload, "lines": [row(product, "4")]})
        assert effects() == before

    def test_a_failure_after_numbering_leaves_no_partial_effect(
        self, seller: Any, product: Any, monkeypatch: Any
    ) -> None:
        def boom(*args: Any, **kwargs: Any) -> Any:
            raise RuntimeError("falla simulada")

        monkeypatch.setattr(posting, "post_operation", boom)
        with pytest.raises(RuntimeError):
            register(seller, [row(product, "3", "2.00")])
        assert effects() == (0, 0, 0, 0, 0)
        assert not InventoryPosition.objects.filter(quantity__gt=0).exists()

    def test_a_rejection_is_audited_as_a_failure(self, seller: Any, product: Any) -> None:
        from identity.models import AuditEvent

        with pytest.raises(PurchaseApplicationError):
            register(seller, [])
        assert AuditEvent.objects.filter(
            action="purchasing.entry_registered", result="FAILURE"
        ).exists()

    def test_success_is_audited_with_the_responsible_user(self, seller: Any, product: Any) -> None:
        from identity.models import AuditEvent

        register(seller, [row(product)])
        event = AuditEvent.objects.get(action="purchasing.entry_registered", result="SUCCESS")
        assert event.actor_id == seller.pk


class TestPossibleDuplicates:
    def test_the_same_content_the_same_day_requires_an_explicit_acknowledgement(
        self, seller: Any, product: Any, make_product: Any
    ) -> None:
        other = make_product()
        first = register(seller, [row(product, "2"), row(other, "3")])
        before = effects()
        with pytest.raises(PurchaseApplicationError) as error:
            register(seller, [row(other, "3"), row(product, "2")])
        assert error.value.code == "possible_duplicate"
        assert "acknowledged_entry_ids" in error.value.errors
        assert effects()[:4] == before[:4]
        confirmed = register(
            seller,
            [row(product, "2"), row(other, "3")],
            acknowledged_entry_ids=[first.body["id"]],
        )
        assert confirmed.status == 201
        assert Purchase.objects.count() == 2

    def test_different_quantities_do_not_match(self, seller: Any, product: Any) -> None:
        register(seller, [row(product, "2")])
        assert register(seller, [row(product, "3")]).status == 201

    def test_other_days_and_voided_entries_do_not_match(
        self, seller: Any, product: Any, monkeypatch: Any
    ) -> None:
        first = register(seller, [row(product, "2")])
        monkeypatch.setattr(entries, "business_today", lambda: date(2030, 1, 1))
        assert register(seller, [row(product, "2")]).status == 201
        monkeypatch.undo()
        Purchase.objects.filter(pk=first.body["id"]).update(state="VOIDED")
        # La anulada de hoy ya no cuenta y la de otro día tampoco: se puede registrar otra.
        assert register(seller, [row(product, "2")]).status == 201

    def test_an_acknowledgement_of_other_entries_is_not_enough(
        self, seller: Any, product: Any
    ) -> None:
        register(seller, [row(product, "2")])
        with pytest.raises(PurchaseApplicationError) as error:
            register(seller, [row(product, "2")], acknowledged_entry_ids=[999_999])
        assert error.value.code == "possible_duplicate"

    def test_the_review_reports_the_match_without_revealing_costs(
        self, seller: Any, product: Any
    ) -> None:
        first = register(seller, [row(product, "2", "4.50")])
        review = entries.review_entry(actor=seller, payload={"lines": [row(product, "2")]})
        assert review["requires_acknowledgement"] is True
        assert [m["purchase_id"] for m in review["duplicates"]] == [first.body["id"]]
        assert review["duplicates"][0]["internal_number"] == "COM-ING-000001"
        assert "4.50" not in str(review)
        assert "cost" not in str(review)


class TestReview:
    def test_the_review_summarizes_products_and_units_without_effects(
        self, seller: Any, product: Any, make_product: Any, supplier: Any
    ) -> None:
        other = make_product()
        review = entries.review_entry(
            actor=seller,
            payload={
                "lines": [row(product, "4", "2.00"), row(other, "6")],
                "supplier_id": supplier.pk,
                "reference": "F-9",
            },
        )
        assert review["can_confirm"] is True
        assert review["summary"] == {"products": 2, "units": 10}
        assert review["supplier"] == {"id": supplier.pk, "name": supplier.name}
        assert review["reference"] == "F-9"
        assert [line["quantity"] for line in review["lines"]] == ["4", "6"]
        assert "unit_cost" not in str(review)
        assert effects() == (0, 0, 0, 0, 0)

    def test_the_review_lists_issues_instead_of_raising_for_references(
        self, seller: Any, make_product: Any
    ) -> None:
        inactive = make_product(is_active=False)
        review = entries.review_entry(actor=seller, payload={"lines": [row(inactive)]})
        assert review["can_confirm"] is False
        assert review["issues"][0]["field"] == "lines.0.product_id"

    def test_the_review_rejects_malformed_requests(self, seller: Any, product: Any) -> None:
        with pytest.raises(PurchaseApplicationError) as error:
            entries.review_entry(actor=seller, payload={"lines": []})
        assert "lines" in error.value.errors
