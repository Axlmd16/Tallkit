"""Restricciones de persistencia de compras e identidad documental."""

from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from django.db import IntegrityError, connection, transaction

from purchasing.domain.identity import normalize_reference
from purchasing.models import (
    Purchase,
    PurchaseCommand,
    PurchaseDocumentIdentity,
    PurchaseLine,
)

D = Decimal


def make_identity(supplier: Any, **overrides: Any) -> PurchaseDocumentIdentity:
    values: dict[str, Any] = {
        "supplier": supplier,
        "document_type": "FACTURA",
        "reference": "001-001-000000123",
        "normalized_reference": "001-001-000000123",
    }
    values.update(overrides)
    return PurchaseDocumentIdentity.objects.create(**values)


def make_purchase(identity: Any, actor: Any, **overrides: Any) -> Purchase:
    values: dict[str, Any] = {
        "document_identity": identity,
        "document_date": date(2026, 9, 1),
        "created_by": actor,
    }
    values.update(overrides)
    return Purchase.objects.create(**values)


@pytest.mark.django_db
class TestDocumentIdentity:
    @pytest.mark.parametrize("document_type", ["FACTURA", "NOTA_DE_VENTA", "OTRO"])
    def test_supplier_type_and_reference_are_unique(
        self, supplier: Any, document_type: str
    ) -> None:
        make_identity(supplier, document_type=document_type)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_identity(supplier, document_type=document_type)

    def test_same_reference_with_other_type_or_supplier_is_a_different_identity(
        self, supplier: Any
    ) -> None:
        from supplier_registry.models import Supplier

        make_identity(supplier)
        make_identity(supplier, document_type="OTRO")
        make_identity(Supplier.objects.create(name="Otro"))

    def test_documented_types_require_a_reference(self, supplier: Any) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_identity(supplier, reference="  ", normalized_reference="")

    def test_unknown_type_is_rejected(self, supplier: Any) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_identity(supplier, document_type="RECIBO")

    def test_undocumented_purchases_have_no_reference_and_own_identity_each(
        self, supplier: Any, actor: Any
    ) -> None:
        first = make_identity(
            supplier, document_type="SIN_DOCUMENTO", reference="", normalized_reference=""
        )
        second = make_identity(
            supplier, document_type="SIN_DOCUMENTO", reference="", normalized_reference=""
        )
        make_purchase(first, actor, no_document_explanation="Compra de mostrador")
        make_purchase(second, actor, no_document_explanation="Otra compra")
        with pytest.raises(IntegrityError), transaction.atomic():
            make_purchase(first, actor, no_document_explanation="Segunda raíz")

    def test_undocumented_identity_cannot_carry_a_reference(self, supplier: Any) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_identity(
                supplier,
                document_type="SIN_DOCUMENTO",
                reference="X-1",
                normalized_reference="X-1",
            )


class TestReferenceNormalization:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("  fac-001  ", "FAC-001"),
            ("000123", "000123"),
            ("001-001-0000123/A", "001-001-0000123/A"),
            (" ñandú-é ", "ÑANDÚ-É"),
        ],
    )
    def test_strip_and_upper_keep_zeros_and_punctuation(self, raw: str, expected: str) -> None:
        assert normalize_reference(raw) == expected

    @pytest.mark.django_db
    @pytest.mark.parametrize("raw", ["  fac-001  ", "000123", "ñandú-é", "ab.c/12"])
    def test_python_normalization_matches_postgresql_comparison(self, raw: str) -> None:
        with connection.cursor() as cursor:
            cursor.execute("SELECT UPPER(TRIM(%s))", [raw])
            assert cursor.fetchone()[0] == normalize_reference(raw)


@pytest.mark.django_db
class TestPurchase:
    def test_default_state_is_draft_with_version_one(self, supplier: Any, actor: Any) -> None:
        purchase = make_purchase(make_identity(supplier), actor)
        assert (purchase.state, purchase.version) == ("DRAFT", 1)
        assert purchase.internal_number is None

    def test_unknown_state_is_rejected(self, supplier: Any, actor: Any) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_purchase(make_identity(supplier), actor, state="OPEN")

    def test_only_one_confirmed_purchase_per_external_identity(
        self, supplier: Any, actor: Any
    ) -> None:
        identity = make_identity(supplier)
        root = make_purchase(identity, actor, state="VOIDED", internal_number="COM-ING-1")
        # Borradores competidores de reemplazo son admisibles.
        make_purchase(identity, actor, replaces=root)
        make_purchase(identity, actor, replaces=root)
        make_purchase(
            identity, actor, replaces=root, state="CONFIRMED", internal_number="COM-ING-2"
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            make_purchase(
                identity, actor, replaces=root, state="CONFIRMED", internal_number="COM-ING-3"
            )

    def test_independent_purchases_cannot_reuse_a_claimed_identity(
        self, supplier: Any, actor: Any
    ) -> None:
        identity = make_identity(supplier)
        make_purchase(identity, actor)
        with pytest.raises(IntegrityError), transaction.atomic():
            make_purchase(identity, actor)

    def test_internal_number_is_unique_when_informed(self, supplier: Any, actor: Any) -> None:
        make_purchase(
            make_identity(supplier), actor, state="CONFIRMED", internal_number="COM-ING-9"
        )
        other = make_identity(supplier, reference="B-2", normalized_reference="B-2")
        with pytest.raises(IntegrityError), transaction.atomic():
            make_purchase(other, actor, state="CONFIRMED", internal_number="COM-ING-9")

    def test_drafts_have_no_internal_number_and_confirmed_require_one(
        self, supplier: Any, actor: Any
    ) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_purchase(make_identity(supplier), actor, internal_number="COM-ING-1")
        with pytest.raises(IntegrityError), transaction.atomic():
            make_purchase(
                make_identity(supplier, reference="C", normalized_reference="C"),
                actor,
                state="CONFIRMED",
            )

    def test_snapshots_require_a_schema_version_key(self, supplier: Any, actor: Any) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            make_purchase(
                make_identity(supplier),
                actor,
                state="CONFIRMED",
                internal_number="COM-ING-5",
                supplier_snapshot={"name": "sin versión"},
            )
        purchase = make_purchase(
            make_identity(supplier, reference="D", normalized_reference="D"),
            actor,
            state="CONFIRMED",
            internal_number="COM-ING-6",
            supplier_snapshot={"schema_version": 1, "name": "ok"},
        )
        assert purchase.supplier_snapshot["schema_version"] == 1


@pytest.mark.django_db
class TestPurchaseLineAndCommand:
    def test_line_position_is_unique_per_purchase(
        self, supplier: Any, actor: Any, product: Any, tax_definition: Any
    ) -> None:
        purchase = make_purchase(make_identity(supplier), actor)
        values: dict[str, Any] = {
            "purchase": purchase,
            "product": product,
            "quantity": D(2),
            "unit_cost": D("10.00"),
            "tax_definition": tax_definition,
            "tax_treatment": "RECOVERABLE",
        }
        PurchaseLine.objects.create(position=1, **values)
        # Varias líneas del mismo producto son válidas; la posición no puede repetirse.
        PurchaseLine.objects.create(position=2, **values)
        with pytest.raises(IntegrityError), transaction.atomic():
            PurchaseLine.objects.create(position=1, **values)

    @pytest.mark.parametrize(
        "overrides",
        [
            {"quantity": D(0)},
            {"quantity": D("1.5")},
            {"unit_cost": D("-0.01")},
            {"tax_treatment": "PARTIAL"},
        ],
    )
    def test_line_values_are_checked(
        self,
        supplier: Any,
        actor: Any,
        product: Any,
        tax_definition: Any,
        overrides: dict[str, Any],
    ) -> None:
        purchase = make_purchase(make_identity(supplier), actor)
        values: dict[str, Any] = {
            "purchase": purchase,
            "position": 1,
            "product": product,
            "quantity": D(1),
            "unit_cost": D(1),
            "tax_definition": tax_definition,
            "tax_treatment": "RECOVERABLE",
        }
        values.update(overrides)
        with pytest.raises(IntegrityError), transaction.atomic():
            PurchaseLine.objects.create(**values)

    def test_command_receipt_is_unique_per_actor_action_and_key(self, actor: Any) -> None:
        values = {
            "actor": actor,
            "action": "purchase.create",
            "idempotency_key": "key-00000001",
            "input_fingerprint": "a" * 64,
        }
        PurchaseCommand.objects.create(**values)
        with pytest.raises(IntegrityError), transaction.atomic():
            PurchaseCommand.objects.create(**values)
        PurchaseCommand.objects.create(**{**values, "action": "purchase.update"})
