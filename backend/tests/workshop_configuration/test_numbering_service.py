"""Pruebas TDD para allocate_number: asignación de número con bloqueo e idempotencia.

Trazabilidad: spec "Secuenciales seguros ante concurrencia y reintentos",
"Conservación de números asignados", "Formato visible del número interno".
Design decisión 5 (numeración y transacción del consumidor).
"""

import hashlib
import json
from datetime import date

import pytest

from identity.domain.authorization import Role
from identity.models import User, UserRole
from workshop_configuration.application.numbering import (
    AllocationConflictError,
    AllocateNumberResult,
    NumberExhaustedError,
    NumberingScopeNotFoundError,
    allocate_number,
)
from workshop_configuration.models import (
    DocumentSeries,
    FiscalEntity,
    NumberAllocation,
    NumberingScope,
    WorkshopConfiguration,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fingerprint(data: dict) -> str:
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def scope_and_series(db: None) -> dict[str, object]:
    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL",
        ruc="0991234567001",
        legal_name="Taller Comercial",
    )
    scope = NumberingScope.objects.create(
        fiscal_entity=entity,
        document_type="VENTA",
    )
    series = DocumentSeries.objects.create(
        numbering_scope=scope,
        code="COM-VEN",
        is_active=True,
        last_number=0,
    )
    return {"scope": scope, "series": series}


# ---------------------------------------------------------------------------
# Asignación básica
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_allocate_number_returns_visible_number(scope_and_series: dict) -> None:
    scope: NumberingScope = scope_and_series["scope"]
    fingerprint = _fingerprint({"consumer_id": "sale-001", "scope_id": scope.pk})
    result = allocate_number(
        scope_id=scope.pk,
        consumer_type="sale",
        consumer_id="sale-001",
        request_key="rk-001",
        request_fingerprint=fingerprint,
    )
    assert isinstance(result, AllocateNumberResult)
    assert result.visible_number == "COM-VEN-000001"
    assert result.number == 1

    series = DocumentSeries.objects.get(pk=scope_and_series["series"].pk)
    assert series.last_number == 1


@pytest.mark.django_db
def test_allocate_number_increments_counter(scope_and_series: dict) -> None:
    scope: NumberingScope = scope_and_series["scope"]
    fp1 = _fingerprint({"consumer_id": "sale-001", "scope_id": scope.pk})
    fp2 = _fingerprint({"consumer_id": "sale-002", "scope_id": scope.pk})
    r1 = allocate_number(
        scope_id=scope.pk,
        consumer_type="sale",
        consumer_id="sale-001",
        request_key="rk-001",
        request_fingerprint=fp1,
    )
    r2 = allocate_number(
        scope_id=scope.pk,
        consumer_type="sale",
        consumer_id="sale-002",
        request_key="rk-002",
        request_fingerprint=fp2,
    )
    assert r1.number == 1
    assert r2.number == 2
    assert r1.visible_number == "COM-VEN-000001"
    assert r2.visible_number == "COM-VEN-000002"


# ---------------------------------------------------------------------------
# Idempotencia
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_allocate_number_idempotent_same_key(scope_and_series: dict) -> None:
    """Mismo consumer_id + request_key devuelve la asignación anterior."""
    scope: NumberingScope = scope_and_series["scope"]
    fp = _fingerprint({"consumer_id": "sale-001", "scope_id": scope.pk})
    r1 = allocate_number(
        scope_id=scope.pk,
        consumer_type="sale",
        consumer_id="sale-001",
        request_key="rk-001",
        request_fingerprint=fp,
    )
    r2 = allocate_number(
        scope_id=scope.pk,
        consumer_type="sale",
        consumer_id="sale-001",
        request_key="rk-001",
        request_fingerprint=fp,
    )
    assert r1.number == r2.number
    assert r1.visible_number == r2.visible_number
    # No debe haber creado una segunda asignación
    assert NumberAllocation.objects.filter(numbering_scope=scope).count() == 1


@pytest.mark.django_db
def test_allocate_number_rejects_different_fingerprint_same_key(
    scope_and_series: dict,
) -> None:
    """Misma clave con huella diferente: AllocationConflictError."""
    scope: NumberingScope = scope_and_series["scope"]
    fp1 = _fingerprint({"consumer_id": "sale-001", "scope_id": scope.pk})
    allocate_number(
        scope_id=scope.pk,
        consumer_type="sale",
        consumer_id="sale-001",
        request_key="rk-001",
        request_fingerprint=fp1,
    )
    fp2 = _fingerprint({"consumer_id": "sale-001", "scope_id": scope.pk, "extra": "diff"})
    with pytest.raises(AllocationConflictError):
        allocate_number(
            scope_id=scope.pk,
            consumer_type="sale",
            consumer_id="sale-001",
            request_key="rk-001",
            request_fingerprint=fp2,  # distinta huella
        )


@pytest.mark.django_db
def test_allocate_number_rejects_scope_not_found(db: None) -> None:
    fp = _fingerprint({"consumer_id": "sale-001"})
    with pytest.raises(NumberingScopeNotFoundError):
        allocate_number(
            scope_id=99999,
            consumer_type="sale",
            consumer_id="sale-001",
            request_key="rk-001",
            request_fingerprint=fp,
        )


# ---------------------------------------------------------------------------
# Número de siete dígitos al superar 999999
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_allocate_number_uses_seven_digits_when_needed(scope_and_series: dict) -> None:
    """El contador crece más allá de seis dígitos sin reiniciarse."""
    series: DocumentSeries = scope_and_series["series"]
    series.last_number = 999999
    series.save()

    scope: NumberingScope = scope_and_series["scope"]
    fp = _fingerprint({"consumer_id": "sale-1000000", "scope_id": scope.pk})
    result = allocate_number(
        scope_id=scope.pk,
        consumer_type="sale",
        consumer_id="sale-1000000",
        request_key="rk-1000000",
        request_fingerprint=fp,
    )
    assert result.number == 1_000_000
    assert result.visible_number == "COM-VEN-1000000"
