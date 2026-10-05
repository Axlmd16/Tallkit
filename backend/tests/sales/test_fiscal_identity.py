"""Identidad fiscal de ensayo: clave válida, idempotencia, ámbitos y prohibición productiva."""

from datetime import date
from typing import Any

import pytest
from django.utils import timezone

from fiscal.domain.states import PreparationState
from fiscal.models import FiscalNumberingScope, FiscalPreparation
from sales.models import Sale
from workshop_configuration.models import FiscalEntity


def _snapshot(
    entity: FiscalEntity, *, environment: str = "1", establishment: str = "001"
) -> dict[str, Any]:
    return {
        "schema_version": "factura-2.1.0",
        "currency": "USD",
        "reference_date": "2026-09-25",
        "issuer": {
            "ruc": entity.ruc,
            "legal_name": entity.legal_name,
            "address": "Av. Matriz",
            "establishment_code": establishment,
            "emission_point_code": "001",
            "environment": environment,
        },
        "receiver": {"identification_type": "04", "identification": "0999999999001"},
        "totals": {"base": "86.96", "tax": "13.04", "grand": "100.00"},
    }


def _prepared(
    sale_id: int, entity: FiscalEntity, actor: Any, **snapshot_kwargs: Any
) -> FiscalPreparation:
    return FiscalPreparation.objects.create(
        fiscal_entity=entity,
        commercial_sale=Sale.objects.get(pk=sale_id),
        source_version=1,
        state=PreparationState.PREPARED,
        prepared_at=timezone.now(),
        prepared_by=actor,
        version=2,
        snapshot=_snapshot(entity, **snapshot_kwargs),
        created_by=actor,
    )


@pytest.fixture
def commercial_entity(confirmed_sale: Any) -> FiscalEntity:
    return FiscalEntity.objects.get(entity_type="COMERCIAL")


def test_assign_produces_valid_key_and_first_sequential(
    confirmed_sale: Any, seller: Any, commercial_entity: FiscalEntity
) -> None:
    from fiscal.application.identity import assign_test_identity
    from fiscal.domain.access_key import validate_access_key

    sale = confirmed_sale(price="100.00", condition="CONTADO")
    prep = _prepared(sale["id"], commercial_entity, seller)

    result = assign_test_identity(actor=seller, preparation_id=prep.pk)
    assert result.sequential == "000000001"
    assert len(result.access_key) == 49
    assert validate_access_key(result.access_key)
    assert result.access_key.startswith("25092026")
    assert not result.replayed


def test_assign_is_idempotent_without_advancing_counter(
    confirmed_sale: Any, seller: Any, commercial_entity: FiscalEntity
) -> None:
    from fiscal.application.identity import assign_test_identity
    from fiscal.models import FiscalDocumentIdentity

    sale = confirmed_sale(price="100.00", condition="CONTADO")
    prep = _prepared(sale["id"], commercial_entity, seller)

    first = assign_test_identity(actor=seller, preparation_id=prep.pk)
    replay = assign_test_identity(actor=seller, preparation_id=prep.pk)
    assert first.access_key == replay.access_key
    assert replay.replayed
    assert FiscalDocumentIdentity.objects.count() == 1
    scope = FiscalNumberingScope.objects.get()
    assert scope.last_sequential == 1


def test_same_sequential_in_different_scopes(
    confirmed_sale: Any, seller: Any, commercial_entity: FiscalEntity
) -> None:
    from fiscal.application.identity import assign_test_identity

    sale_a = confirmed_sale(price="100.00", condition="CONTADO")
    sale_b = confirmed_sale(price="100.00", condition="CONTADO")
    prep_a = _prepared(sale_a["id"], commercial_entity, seller, establishment="001")
    prep_b = _prepared(sale_b["id"], commercial_entity, seller, establishment="002")

    a = assign_test_identity(actor=seller, preparation_id=prep_a.pk)
    b = assign_test_identity(actor=seller, preparation_id=prep_b.pk)
    assert a.sequential == "000000001"
    assert b.sequential == "000000001"
    assert a.access_key != b.access_key


def test_exhausted_sequence_is_rejected(
    confirmed_sale: Any, seller: Any, commercial_entity: FiscalEntity
) -> None:
    from fiscal.application.identity import SequenceExhaustedError, assign_test_identity

    sale = confirmed_sale(price="100.00", condition="CONTADO")
    prep = _prepared(sale["id"], commercial_entity, seller)
    FiscalNumberingScope.objects.create(
        fiscal_entity=commercial_entity,
        document_type="01",
        establishment_code="001",
        emission_point_code="001",
        environment="1",
        last_sequential=999_999_999,
    )
    with pytest.raises(SequenceExhaustedError):
        assign_test_identity(actor=seller, preparation_id=prep.pk)


def test_production_environment_is_rejected(
    confirmed_sale: Any, seller: Any, commercial_entity: FiscalEntity
) -> None:
    from fiscal.application.identity import ProductionEmissionDisabledError, assign_test_identity

    sale = confirmed_sale(price="100.00", condition="CONTADO")
    prep = _prepared(sale["id"], commercial_entity, seller, environment="2")
    with pytest.raises(ProductionEmissionDisabledError):
        assign_test_identity(actor=seller, preparation_id=prep.pk)
    assert not FiscalNumberingScope.objects.exists()


def test_cancel_keeps_assigned_number(
    confirmed_sale: Any, seller: Any, commercial_entity: FiscalEntity
) -> None:
    from fiscal.application.identity import assign_test_identity
    from fiscal.application.preparations import cancel
    from fiscal.models import FiscalDocumentIdentity

    sale = confirmed_sale(price="100.00", condition="CONTADO")
    prep = _prepared(sale["id"], commercial_entity, seller)
    result = assign_test_identity(actor=seller, preparation_id=prep.pk)

    cancel(actor=seller, preparation_id=prep.pk, expected_version=prep.version, reason="Anulado")
    identity = FiscalDocumentIdentity.objects.get(preparation=prep)
    assert identity.access_key == result.access_key  # conserva su número


def test_antecedent_does_not_advance_or_create_counter(
    confirmed_sale: Any, admin: Any, commercial_entity: FiscalEntity
) -> None:
    from fiscal.application.identity import record_numbering_antecedent

    record_numbering_antecedent(
        actor=admin,
        entity_id=commercial_entity.pk,
        document_type="01",
        establishment_code="001",
        emission_point_code="001",
        environment="2",
        last_declared_number=120,
        declared_on=date(2026, 1, 15),
        source="Facturador externo del SRI",
    )
    assert not FiscalNumberingScope.objects.exists()


def test_assign_denied_without_fiscal_permission(
    confirmed_sale: Any, commercial_entity: FiscalEntity, db: None
) -> None:
    from fiscal.application.identity import assign_test_identity
    from identity.application.authorization import BusinessPermissionDeniedError
    from identity.models import User

    stranger = User.objects.create_user(username="sin-rol", password="password123")
    sale = confirmed_sale(price="100.00", condition="CONTADO")
    prep = _prepared(sale["id"], commercial_entity, stranger)
    with pytest.raises(BusinessPermissionDeniedError):
        assign_test_identity(actor=stranger, preparation_id=prep.pk)


def test_antecedent_validation_rejects_bad_inputs(
    confirmed_sale: Any, admin: Any, commercial_entity: FiscalEntity
) -> None:
    from fiscal.application.identity import IdentityError, record_numbering_antecedent

    base = {
        "actor": admin,
        "entity_id": commercial_entity.pk,
        "document_type": "01",
        "establishment_code": "001",
        "emission_point_code": "001",
        "environment": "2",
        "last_declared_number": 120,
        "declared_on": date(2026, 1, 15),
        "source": "Facturador externo",
    }
    for override in (
        {"document_type": "18"},
        {"environment": "9"},
        {"last_declared_number": 0},
        {"source": "   "},
    ):
        with pytest.raises(IdentityError):
            record_numbering_antecedent(**{**base, **override})


@pytest.mark.django_db(transaction=True)
def test_concurrent_assignment_in_same_scope_gets_distinct_sequentials(
    confirmed_sale: Any, seller: Any, run_parallel: Any
) -> None:
    from django.db import transaction

    from fiscal.application.identity import assign_test_identity
    from fiscal.models import FiscalDocumentIdentity

    with transaction.atomic():
        entity = FiscalEntity.objects.get(entity_type="COMERCIAL")
        sale_a = confirmed_sale(price="100.00", condition="CONTADO")
        sale_b = confirmed_sale(price="100.00", condition="CONTADO")
        prep_a = _prepared(sale_a["id"], entity, seller)
        prep_b = _prepared(sale_b["id"], entity, seller)

    def assign(preparation_id: Any) -> Any:
        from identity.models import User

        return assign_test_identity(
            actor=User.objects.get(pk=seller.pk), preparation_id=preparation_id
        )

    outcomes = run_parallel(lambda: assign(prep_a.pk), lambda: assign(prep_b.pk))
    assert [status for status, _ in outcomes].count("ok") == 2
    sequentials = {
        FiscalDocumentIdentity.objects.get(preparation_id=prep_a.pk).sequential,
        FiscalDocumentIdentity.objects.get(preparation_id=prep_b.pk).sequential,
    }
    assert sequentials == {1, 2}
    assert FiscalNumberingScope.objects.get().last_sequential == 2
