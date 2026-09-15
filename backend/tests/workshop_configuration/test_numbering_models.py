from hashlib import sha256

import pytest
from django.contrib.auth import get_user_model
from django.db import DatabaseError, IntegrityError, transaction
from django.db.models import ProtectedError

from workshop_configuration.domain.validation import DocumentType, FiscalEntityType
from workshop_configuration.models import (
    ConfigurationCommand,
    DocumentSeries,
    FiscalEntity,
    NumberAllocation,
    NumberingScope,
)

pytestmark = pytest.mark.django_db


def create_entity() -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type=FiscalEntityType.COMERCIAL,
        ruc="0991234567001",
        legal_name="Taller Comercial",
    )


def create_scope() -> NumberingScope:
    return NumberingScope.objects.create(
        fiscal_entity=create_entity(),
        document_type=DocumentType.VENTA,
    )


def create_series(scope: NumberingScope | None = None, code: str = "COM-VEN") -> DocumentSeries:
    return DocumentSeries.objects.create(numbering_scope=scope or create_scope(), code=code)


def allocation_values(series: DocumentSeries) -> dict[str, object]:
    return {
        "numbering_scope": series.numbering_scope,
        "series": series,
        "number": 1,
        "consumer_type": "sale",
        "consumer_id": "sale-001",
        "request_key": "request-sale-001",
        "request_fingerprint": sha256(b"sale-001").hexdigest(),
        "visible_number": "COM-VEN-000001",
    }


def test_numbering_scope_is_unique_per_entity_and_document_type() -> None:
    scope = create_scope()

    with pytest.raises(IntegrityError), transaction.atomic():
        NumberingScope.objects.create(
            fiscal_entity=scope.fiscal_entity,
            document_type=DocumentType.VENTA,
        )


def test_numbering_scope_rejects_unknown_document_type() -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        NumberingScope.objects.create(
            fiscal_entity=create_entity(),
            document_type="FACTURA",
        )


def test_document_series_has_one_active_record_per_scope_and_global_code() -> None:
    scope = create_scope()
    create_series(scope)

    with pytest.raises(IntegrityError), transaction.atomic():
        create_series(scope, "COM-VEN-2")

    other_scope = NumberingScope.objects.create(
        fiscal_entity=scope.fiscal_entity,
        document_type=DocumentType.PROFORMA,
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        create_series(other_scope, "COM-VEN")


@pytest.mark.parametrize(
    ("code", "last_number"),
    [("CO", 0), ("COM_VEN", 0), ("COM-VEN", -1), ("COM-VEN", 9_223_372_036_854_775_808)],
)
def test_document_series_rejects_invalid_code_or_counter(code: str, last_number: int) -> None:
    with pytest.raises((DatabaseError, OverflowError)), transaction.atomic():
        DocumentSeries.objects.create(
            numbering_scope=create_scope(),
            code=code,
            last_number=last_number,
        )


def test_number_allocation_is_unique_by_number_document_and_request() -> None:
    series = create_series()
    values = allocation_values(series)
    NumberAllocation.objects.create(**values)

    variants = (
        {**values, "consumer_id": "sale-002", "request_key": "request-sale-002"},
        {**values, "number": 2, "request_key": "request-sale-002"},
        {**values, "number": 2, "consumer_id": "sale-002"},
    )
    for duplicate in variants:
        with pytest.raises(IntegrityError), transaction.atomic():
            NumberAllocation.objects.create(**duplicate)


def test_numbering_history_protects_scope_and_series() -> None:
    series = create_series()
    NumberAllocation.objects.create(**allocation_values(series))

    with pytest.raises(ProtectedError):
        series.delete()
    with pytest.raises(ProtectedError):
        series.numbering_scope.delete()
    with pytest.raises(ProtectedError):
        series.numbering_scope.fiscal_entity.delete()


def test_configuration_command_key_is_scoped_by_actor_and_action() -> None:
    user_model = get_user_model()
    first_actor = user_model.objects.create_user(username="admin-a", password="segura")
    second_actor = user_model.objects.create_user(username="admin-b", password="segura")
    values = {
        "actor": first_actor,
        "action": "initialize_workshop",
        "idempotency_key": "initialize-001",
        "input_fingerprint": sha256(b"input").hexdigest(),
        "response_status": 201,
        "result": {"status": "initialized"},
    }
    ConfigurationCommand.objects.create(**values)

    with pytest.raises(IntegrityError), transaction.atomic():
        ConfigurationCommand.objects.create(**values)

    same_key_other_action = ConfigurationCommand.objects.create(
        **{**values, "action": "create_tax"}
    )
    same_key_other_actor = ConfigurationCommand.objects.create(**{**values, "actor": second_actor})
    assert same_key_other_action.pk is not None
    assert same_key_other_actor.pk is not None
