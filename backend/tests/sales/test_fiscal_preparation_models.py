"""Restricciones propias de preparación fiscal sobre un origen comercial protegido."""

import uuid
from typing import Any

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone


def _fails(call: Any) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        call()


def test_preparation_requires_exactly_one_origin_and_stable_uuid(
    confirmed_sale: Any, seller: Any
) -> None:
    from fiscal.models import FiscalPreparation
    from sales.models import Sale

    sale = Sale.objects.get(pk=confirmed_sale()["id"])
    preparation = FiscalPreparation.objects.create(
        fiscal_entity_id=sale.fiscal_entity_id,
        commercial_sale=sale,
        source_version=sale.version,
        created_by=seller,
    )

    assert isinstance(preparation.id, uuid.UUID)
    assert preparation.state == "DRAFT"
    _fails(
        lambda: FiscalPreparation.objects.create(
            fiscal_entity_id=sale.fiscal_entity_id,
            source_version=sale.version,
            created_by=seller,
        )
    )


def test_only_one_active_preparation_exists_per_sale(confirmed_sale: Any, seller: Any) -> None:
    from fiscal.models import FiscalPreparation
    from sales.models import Sale

    sale = Sale.objects.get(pk=confirmed_sale()["id"])
    FiscalPreparation.objects.create(
        fiscal_entity_id=sale.fiscal_entity_id,
        commercial_sale=sale,
        source_version=sale.version,
        created_by=seller,
    )
    _fails(
        lambda: FiscalPreparation.objects.create(
            fiscal_entity_id=sale.fiscal_entity_id,
            commercial_sale=sale,
            source_version=sale.version,
            created_by=seller,
        )
    )


def test_cancelled_preparation_keeps_snapshot_and_allows_replacement(
    confirmed_sale: Any, seller: Any
) -> None:
    from fiscal.models import FiscalPreparation
    from sales.models import Sale

    sale = Sale.objects.get(pk=confirmed_sale()["id"])
    original = FiscalPreparation.objects.create(
        fiscal_entity_id=sale.fiscal_entity_id,
        commercial_sale=sale,
        source_version=sale.version,
        state="CANCELLED",
        snapshot={"schema_version": 1, "grand_total": "100.00"},
        cancelled_at=timezone.now(),
        cancelled_by=seller,
        cancellation_reason="Dato incorrecto",
        created_by=seller,
    )
    replacement = FiscalPreparation.objects.create(
        fiscal_entity_id=sale.fiscal_entity_id,
        commercial_sale=sale,
        source_version=sale.version,
        replaces=original,
        created_by=seller,
    )

    original.refresh_from_db()
    assert original.snapshot == {"schema_version": 1, "grand_total": "100.00"}
    assert replacement.replaces_id == original.id


def test_prepared_state_requires_versioned_snapshot_and_audit_fields(
    confirmed_sale: Any, seller: Any
) -> None:
    from fiscal.models import FiscalPreparation
    from sales.models import Sale

    sale = Sale.objects.get(pk=confirmed_sale()["id"])
    common = {
        "fiscal_entity_id": sale.fiscal_entity_id,
        "commercial_sale": sale,
        "source_version": sale.version,
        "state": "PREPARED",
        "created_by": seller,
    }
    _fails(lambda: FiscalPreparation.objects.create(**common))
    prepared = FiscalPreparation.objects.create(
        **common,
        snapshot={"schema_version": 1},
        prepared_at=timezone.now(),
        prepared_by=seller,
    )
    assert prepared.snapshot is not None
    assert prepared.snapshot["schema_version"] == 1


def test_history_and_command_receipt_have_scoped_unique_identity(
    confirmed_sale: Any, seller: Any
) -> None:
    from fiscal.models import FiscalCommandReceipt, FiscalPreparation, FiscalPreparationHistory
    from sales.models import Sale

    sale = Sale.objects.get(pk=confirmed_sale()["id"])
    preparation = FiscalPreparation.objects.create(
        fiscal_entity_id=sale.fiscal_entity_id,
        commercial_sale=sale,
        source_version=sale.version,
        created_by=seller,
    )
    FiscalPreparationHistory.objects.create(
        preparation=preparation,
        sequence=1,
        event="CREATED",
        actor=seller,
        metadata={"source_version": sale.version},
    )
    _fails(
        lambda: FiscalPreparationHistory.objects.create(
            preparation=preparation,
            sequence=1,
            event="CREATED",
            actor=seller,
            metadata={},
        )
    )
    FiscalCommandReceipt.objects.create(
        actor=seller,
        action="fiscal.preparation_created",
        idempotency_key="fiscal:create:001",
        input_fingerprint="a" * 64,
        response_status=201,
        result_preparation=preparation,
    )
    _fails(
        lambda: FiscalCommandReceipt.objects.create(
            actor=seller,
            action="fiscal.preparation_created",
            idempotency_key="fiscal:create:001",
            input_fingerprint="a" * 64,
            response_status=201,
        )
    )
