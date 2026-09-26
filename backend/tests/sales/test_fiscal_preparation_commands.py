"""Creación fiscal idempotente, autorizada y serializada por origen comercial."""

from typing import Any

import pytest
from django.db import transaction

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import AuditEvent, User


def test_lost_response_replay_returns_same_preparation(confirmed_sale: Any, seller: User) -> None:
    from fiscal.application.preparations import create_draft
    from fiscal.models import FiscalPreparation, FiscalPreparationHistory

    source_id = confirmed_sale()["id"]
    first = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=source_id,
        idempotency_key="fiscal:create:001",
    )
    replay = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=source_id,
        idempotency_key="fiscal:create:001",
    )

    assert first.preparation_id == replay.preparation_id
    assert not first.replayed
    assert replay.replayed
    assert FiscalPreparation.objects.count() == 1
    assert FiscalPreparationHistory.objects.count() == 1
    assert AuditEvent.objects.filter(action="fiscal.preparation_created").count() == 1


def test_same_command_key_with_different_source_is_conflict(
    confirmed_sale: Any, seller: User
) -> None:
    from fiscal.application.preparations import IdempotencyConflictError, create_draft
    from fiscal.models import FiscalPreparation

    first, second = confirmed_sale(), confirmed_sale()
    create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=first["id"],
        idempotency_key="fiscal:create:001",
    )
    with pytest.raises(IdempotencyConflictError):
        create_draft(
            actor=seller,
            source_kind="COMMERCIAL",
            source_id=second["id"],
            idempotency_key="fiscal:create:001",
        )
    assert FiscalPreparation.objects.count() == 1


def test_permission_is_checked_before_replaying_result(confirmed_sale: Any, seller: User) -> None:
    from fiscal.application.preparations import create_draft

    source_id = confirmed_sale()["id"]
    create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=source_id,
        idempotency_key="fiscal:create:001",
    )
    seller.role_assignments.all().delete()

    with pytest.raises(BusinessPermissionDeniedError):
        create_draft(
            actor=seller,
            source_kind="COMMERCIAL",
            source_id=source_id,
            idempotency_key="fiscal:create:001",
        )


def test_equal_sales_are_distinct_origins(confirmed_sale: Any, seller: User) -> None:
    from fiscal.application.preparations import create_draft

    first, second = confirmed_sale(price="25.00"), confirmed_sale(price="25.00")
    a = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=first["id"],
        idempotency_key="fiscal:create:001",
    )
    b = create_draft(
        actor=seller,
        source_kind="COMMERCIAL",
        source_id=second["id"],
        idempotency_key="fiscal:create:002",
    )
    assert a.preparation_id != b.preparation_id


@pytest.mark.django_db(transaction=True)
def test_concurrent_creation_keeps_one_active_preparation(
    confirmed_sale: Any, seller: User, run_parallel: Any
) -> None:
    from fiscal.application.preparations import ActivePreparationConflictError, create_draft
    from fiscal.models import FiscalCommandReceipt, FiscalPreparation

    with transaction.atomic():
        source_id = confirmed_sale()["id"]

    def create(key: str) -> Any:
        return create_draft(
            actor=User.objects.get(pk=seller.pk),
            source_kind="COMMERCIAL",
            source_id=source_id,
            idempotency_key=key,
        )

    outcomes = run_parallel(
        lambda: create("fiscal:create:001"), lambda: create("fiscal:create:002")
    )

    assert [status for status, _ in outcomes].count("ok") == 1
    failures = [result for status, result in outcomes if status == "error"]
    assert len(failures) == 1
    assert isinstance(failures[0], ActivePreparationConflictError)
    assert FiscalPreparation.objects.count() == 1
    assert FiscalCommandReceipt.objects.count() == 1
