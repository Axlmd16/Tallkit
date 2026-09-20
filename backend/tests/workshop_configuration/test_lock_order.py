"""Orden de bloqueos del ADR-0004: raíz antes que dependientes en todos los editores."""

import re
from datetime import date, timedelta
from typing import Any

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from identity.domain.authorization import Role
from identity.models import User, UserRole
from workshop_configuration.application.series import replace_series, update_series_code
from workshop_configuration.application.taxes import (
    StaleRecordError,
    TaxPeriodNotFoundError,
    schedule_successor,
    update_tax_period,
)
from workshop_configuration.models import (
    DocumentSeries,
    FiscalEntity,
    NumberingScope,
    TaxDefinition,
    TaxPeriod,
    WorkshopConfiguration,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin() -> User:
    user = User.objects.create_user(username="lock-admin", password="password123")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    return user


@pytest.fixture
def entity() -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", legal_name="Comercial", ruc="0991234567001"
    )


def lock_sequence(queries: Any) -> list[str]:
    tables = []
    for query in queries:
        if "FOR UPDATE" in query["sql"]:
            table = re.search(r'FROM "workshop_configuration_(\w+)"', query["sql"])
            if table:
                tables.append(table.group(1))
    return tables


def first_positions(sequence: list[str], *names: str) -> list[int]:
    return [sequence.index(name) for name in names]


def test_update_tax_period_locks_definition_before_periods(
    admin: User, entity: FiscalEntity
) -> None:
    definition = TaxDefinition.objects.create(fiscal_entity=entity, code="IVA", name="IVA")
    period = TaxPeriod.objects.create(
        tax_definition=definition, rate="15", starts_on=date(2030, 1, 1)
    )
    with CaptureQueriesContext(connection) as queries:
        update_tax_period(actor=admin, period_id=period.pk, expected_version=1, rate="12")
    sequence = lock_sequence(queries)
    definition_at, period_at = first_positions(sequence, "taxdefinition", "taxperiod")
    assert definition_at < period_at


def test_schedule_successor_locks_definition_before_periods(
    admin: User, entity: FiscalEntity
) -> None:
    definition = TaxDefinition.objects.create(fiscal_entity=entity, code="IVA", name="IVA")
    period = TaxPeriod.objects.create(
        tax_definition=definition, rate="15", starts_on=date(2020, 1, 1)
    )
    with CaptureQueriesContext(connection) as queries:
        schedule_successor(
            actor=admin,
            period_id=period.pk,
            expected_version=1,
            new_rate="16",
            successor_starts_on=date.today() + timedelta(days=30),
        )
    sequence = lock_sequence(queries)
    definition_at, period_at = first_positions(sequence, "taxdefinition", "taxperiod")
    assert definition_at < period_at


def test_period_edits_revalidate_version_and_existence_under_the_lock(
    admin: User, entity: FiscalEntity
) -> None:
    definition = TaxDefinition.objects.create(fiscal_entity=entity, code="IVA", name="IVA")
    period = TaxPeriod.objects.create(
        tax_definition=definition, rate="15", starts_on=date(2030, 1, 1)
    )
    with pytest.raises(StaleRecordError):
        update_tax_period(actor=admin, period_id=period.pk, expected_version=9, rate="12")
    with pytest.raises(TaxPeriodNotFoundError):
        update_tax_period(actor=admin, period_id=999999, expected_version=1, rate="12")


def _scope_and_series(entity: FiscalEntity) -> DocumentSeries:
    scope = NumberingScope.objects.create(fiscal_entity=entity, document_type="INGRESO")
    return DocumentSeries.objects.create(
        numbering_scope=scope, code="COM-ING", is_active=True, last_number=0
    )


def test_replace_series_locks_scope_before_series(admin: User, entity: FiscalEntity) -> None:
    series = _scope_and_series(entity)
    with CaptureQueriesContext(connection) as queries:
        replace_series(actor=admin, series_id=series.pk, expected_version=1, new_code="COM-ING2")
    scope_at, series_at = first_positions(
        lock_sequence(queries), "numberingscope", "documentseries"
    )
    assert scope_at < series_at


def test_update_series_code_locks_scope_before_series(admin: User, entity: FiscalEntity) -> None:
    series = _scope_and_series(entity)
    with CaptureQueriesContext(connection) as queries:
        update_series_code(actor=admin, series_id=series.pk, expected_version=1, code="COM-ING3")
    scope_at, series_at = first_positions(
        lock_sequence(queries), "numberingscope", "documentseries"
    )
    assert scope_at < series_at
