"""Borradores de compra: crear, editar y recuperar sin efectos de stock, fiscales ni numéricos."""

from typing import Any

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition
from purchasing.application import purchases, queries
from purchasing.application.commands import IdempotencyConflictError
from purchasing.application.errors import PurchaseApplicationError
from purchasing.models import Purchase, PurchaseCommand
from supplier_registry.models import Supplier
from workshop_configuration.models import ConfigurationUse, NumberAllocation

pytestmark = pytest.mark.django_db


def no_side_effects() -> tuple[int, ...]:
    return (
        InventoryMovement.objects.count(),
        InventoryOperation.objects.count(),
        InventoryPosition.objects.count(),
        ConfigurationUse.objects.count(),
        NumberAllocation.objects.count(),
    )


def create(admin: Any, payload: dict[str, Any]) -> dict[str, Any]:
    return purchases.create_draft(actor=admin, payload=payload).body


class TestCreateAndRecover:
    def test_draft_without_lines_can_be_saved_and_reopened(
        self, admin: Any, commercial: Any, draft_payload: Any
    ) -> None:
        before = no_side_effects()
        outcome = purchases.create_draft(actor=admin, payload=draft_payload())
        assert outcome.status == 201
        body = outcome.body
        assert (body["state"], body["version"], body["internal_number"]) == ("DRAFT", 1, None)
        assert body["lines"] == []
        reopened = queries.get_purchase(actor=admin, purchase_id=body["id"])
        assert reopened["id"] == body["id"]
        assert reopened["state"] == "DRAFT"
        assert no_side_effects() == before

    def test_draft_with_lines_computes_amounts_without_effects(
        self, admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
    ) -> None:
        before = no_side_effects()
        body = create(admin, draft_payload([line(product, commercial["ten"])]))
        row = body["lines"][0]
        assert row["amounts"] == {
            "base": "20.00",
            "tax": "2.00",
            "total": "22.00",
            "inventory_value": "20.00",
        }
        assert body["totals"] == {
            "base": "20.00",
            "tax": "2.00",
            "total": "22.00",
            "inventory_value": "20.00",
        }
        assert body["totals_status"] == "calculated"
        assert row["product"]["code"] == product.code
        assert no_side_effects() == before

    def test_tax_without_valid_rate_is_kept_as_not_calculable_never_zero(
        self, admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
    ) -> None:
        from workshop_configuration.models import TaxDefinition

        no_rate = TaxDefinition.objects.create(
            fiscal_entity=commercial["entity"], code="SINV", name="Sin vigencia"
        )
        body = create(admin, draft_payload([line(product, no_rate)]))
        assert body["totals"] is None
        assert body["totals_status"] == "not_calculable"
        assert body["lines"][0]["amounts"] is None
        assert body["lines"][0]["tax"]["status"] == "missing"

    def test_edit_replaces_lines_and_recomputes(
        self,
        admin: Any,
        commercial: Any,
        draft_payload: Any,
        product: Any,
        line: Any,
        make_product: Any,
    ) -> None:
        body = create(admin, draft_payload([line(product, commercial["ten"])]))
        other = make_product()
        outcome = purchases.update_draft(
            actor=admin,
            purchase_id=body["id"],
            payload={
                "idempotency_key": "edit-key-000001",
                "expected_version": body["version"],
                "lines": [line(other, commercial["zero"], quantity="3", cost="1.50")],
            },
        )
        edited = outcome.body
        assert edited["version"] == 2
        assert [row["product"]["id"] for row in edited["lines"]] == [other.pk]
        assert edited["totals"]["total"] == "4.50"

    def test_omitting_a_field_keeps_it_while_lines_are_replaced_as_a_whole(
        self, admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
    ) -> None:
        body = create(admin, draft_payload([line(product, commercial["ten"])], notes="nota"))
        edited = purchases.update_draft(
            actor=admin,
            purchase_id=body["id"],
            payload={"idempotency_key": "edit-key-000002", "expected_version": 1, "notes": ""},
        ).body
        assert edited["notes"] == ""
        assert len(edited["lines"]) == 1  # omitir no vacía


class TestConcurrentEdits:
    def test_stale_version_is_rejected_and_the_first_change_is_kept(
        self, admin: Any, commercial: Any, draft_payload: Any
    ) -> None:
        body = create(admin, draft_payload())
        purchases.update_draft(
            actor=admin,
            purchase_id=body["id"],
            payload={"idempotency_key": "edit-key-000010", "expected_version": 1, "notes": "A"},
        )
        with pytest.raises(PurchaseApplicationError) as error:
            purchases.update_draft(
                actor=admin,
                purchase_id=body["id"],
                payload={"idempotency_key": "edit-key-000011", "expected_version": 1, "notes": "B"},
            )
        assert error.value.code == "stale_record"
        assert Purchase.objects.get(pk=body["id"]).observation == "A"


class TestReferences:
    def test_inactive_or_unknown_supplier_is_rejected_on_save(
        self, admin: Any, commercial: Any, draft_payload: Any, supplier: Any
    ) -> None:
        Supplier.objects.filter(pk=supplier.pk).update(is_active=False)
        with pytest.raises(PurchaseApplicationError) as error:
            create(admin, draft_payload())
        assert error.value.code == "inactive_reference"
        assert "supplier_id" in error.value.errors

    def test_occasional_supplier_with_only_a_name_is_valid(
        self, admin: Any, commercial: Any, draft_payload: Any
    ) -> None:
        occasional = Supplier.objects.create(name="Ocasional")
        body = create(admin, draft_payload(supplier_id=occasional.pk))
        assert body["supplier"]["identification"] is None

    def test_inactive_product_is_rejected_on_save_with_the_line_field(
        self,
        admin: Any,
        commercial: Any,
        draft_payload: Any,
        product: Any,
        line: Any,
        make_product: Any,
    ) -> None:
        inactive = make_product(is_active=False)
        with pytest.raises(PurchaseApplicationError) as error:
            create(
                admin,
                draft_payload(
                    [line(product, commercial["ten"]), line(inactive, commercial["ten"])]
                ),
            )
        assert error.value.code == "inactive_reference"
        assert "lines.1.product_id" in error.value.errors
        assert not Purchase.objects.exists()

    def test_a_service_id_is_not_an_inventory_product(
        self, admin: Any, commercial: Any, draft_payload: Any, line: Any, product: Any
    ) -> None:
        from catalog.models import Service

        service = Service.objects.create(
            name="Alineación",
            reference_price="25.00",
            tax_definition=product.tax_definition,
        )
        bad = line(product, commercial["ten"])
        bad["product_id"] = service.pk + 100_000  # no existe como producto
        with pytest.raises(PurchaseApplicationError) as error:
            create(admin, draft_payload([bad]))
        assert "lines.0.product_id" in error.value.errors

    def test_artisanal_tax_scope_is_rejected(
        self, admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
    ) -> None:
        from workshop_configuration.models import FiscalEntity, TaxDefinition

        artisan = FiscalEntity.objects.create(
            entity_type="ARTESANAL", legal_name="Art", ruc="1790000000002"
        )
        foreign = TaxDefinition.objects.create(fiscal_entity=artisan, code="ART", name="Art")
        with pytest.raises(PurchaseApplicationError) as error:
            create(admin, draft_payload([line(product, foreign)]))
        assert error.value.code == "invalid_tax_scope"
        assert "lines.0.tax_definition_id" in error.value.errors


class TestValidationAndSafety:
    @pytest.mark.parametrize(
        ("mutation", "field"),
        [
            ({"quantity": "0"}, "lines.0.quantity"),
            ({"quantity": "1.5"}, "lines.0.quantity"),
            ({"unit_cost": "-1"}, "lines.0.unit_cost"),
            ({"unit_cost": "1.0000001"}, "lines.0.unit_cost"),
            ({"tax_recoverability": "PARTIAL"}, "lines.0.tax_recoverability"),
            ({"tax_recoverability": None}, "lines.0.tax_recoverability"),
        ],
    )
    def test_invalid_line_fields_are_reported_by_path(
        self,
        admin: Any,
        commercial: Any,
        draft_payload: Any,
        product: Any,
        line: Any,
        mutation: dict[str, Any],
        field: str,
    ) -> None:
        bad = {**line(product, commercial["ten"]), **mutation}
        with pytest.raises(PurchaseApplicationError) as error:
            create(admin, draft_payload([bad]))
        assert error.value.code == "validation_error"
        assert field in error.value.errors

    def test_client_supplied_totals_and_unknown_fields_are_rejected(
        self, admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
    ) -> None:
        with pytest.raises(PurchaseApplicationError) as top:
            create(admin, draft_payload(total="1.00"))
        assert top.value.code == "unknown_field"
        with pytest.raises(PurchaseApplicationError) as nested:
            create(admin, draft_payload([line(product, commercial["ten"], total="1.00")]))
        assert "lines.0.total" in nested.value.errors

    def test_future_document_date_is_rejected(
        self, admin: Any, commercial: Any, draft_payload: Any
    ) -> None:
        with pytest.raises(PurchaseApplicationError) as error:
            create(admin, draft_payload(document_date="2999-01-01"))
        assert "document_date" in error.value.errors
        assert not Purchase.objects.exists()

    def test_more_than_two_hundred_lines_are_rejected(
        self, admin: Any, commercial: Any, draft_payload: Any, product: Any, line: Any
    ) -> None:
        with pytest.raises(PurchaseApplicationError) as error:
            create(admin, draft_payload([line(product, commercial["ten"])] * 201))
        assert "lines" in error.value.errors

    def test_status_cannot_be_edited_or_history_deleted_through_the_service(
        self, admin: Any, commercial: Any, draft_payload: Any
    ) -> None:
        body = create(admin, draft_payload())
        with pytest.raises(PurchaseApplicationError) as error:
            purchases.update_draft(
                actor=admin,
                purchase_id=body["id"],
                payload={
                    "idempotency_key": "edit-key-000020",
                    "expected_version": 1,
                    "state": "CONFIRMED",
                },
            )
        assert error.value.code == "unknown_field"
        assert not hasattr(purchases, "delete_purchase")
        assert Purchase.objects.get(pk=body["id"]).state == "DRAFT"

    def test_only_confirmed_or_voided_purchases_are_not_editable(
        self, admin: Any, commercial: Any, draft_payload: Any
    ) -> None:
        body = create(admin, draft_payload())
        Purchase.objects.filter(pk=body["id"]).update(state="VOIDED", internal_number="COM-ING-9")
        with pytest.raises(PurchaseApplicationError) as error:
            purchases.update_draft(
                actor=admin,
                purchase_id=body["id"],
                payload={"idempotency_key": "edit-key-000021", "expected_version": 1, "notes": "x"},
            )
        assert error.value.code == "not_editable"


class TestPermissionsAndIdempotency:
    def test_non_administrators_get_no_access_even_to_direct_reads(
        self, seller: Any, admin: Any, commercial: Any, draft_payload: Any
    ) -> None:
        body = create(admin, draft_payload())
        with pytest.raises(BusinessPermissionDeniedError):
            purchases.create_draft(actor=seller, payload=draft_payload())
        with pytest.raises(BusinessPermissionDeniedError):
            queries.get_purchase(actor=seller, purchase_id=body["id"])
        with pytest.raises(BusinessPermissionDeniedError):
            queries.list_purchases(actor=seller)

    def test_unknown_purchase_is_not_found_after_authorizing(
        self, admin: Any, commercial: Any
    ) -> None:
        with pytest.raises(PurchaseApplicationError) as error:
            queries.get_purchase(actor=admin, purchase_id=999_999)
        assert error.value.code == "not_found"

    def test_compatible_retry_replays_and_incompatible_reuse_conflicts(
        self, admin: Any, commercial: Any, draft_payload: Any
    ) -> None:
        payload = draft_payload()
        first = purchases.create_draft(actor=admin, payload=payload)
        again = purchases.create_draft(actor=admin, payload=payload)
        assert again.replayed
        assert again.body["id"] == first.body["id"]
        assert Purchase.objects.count() == 1
        with pytest.raises(IdempotencyConflictError):
            purchases.create_draft(actor=admin, payload={**payload, "notes": "otra cosa"})
        assert PurchaseCommand.objects.count() == 1

    def test_listing_is_paginated_and_filterable(
        self, admin: Any, commercial: Any, draft_payload: Any
    ) -> None:
        for _ in range(3):
            create(admin, draft_payload())
        page = queries.list_purchases(actor=admin, page=1, page_size=2)
        assert (page["count"], len(page["results"]), page["total_pages"]) == (3, 2, 2)
        assert queries.list_purchases(actor=admin, state="CONFIRMED")["count"] == 0
