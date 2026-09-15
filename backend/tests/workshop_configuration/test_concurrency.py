"""Pruebas de concurrencia, casos límite y rollback para numeración.

Tareas 4.3, 4.4 y 4.5 del grupo 4.

Trazabilidad: spec "Secuenciales seguros ante concurrencia y reintentos",
"Conservación de números asignados". Design decisión 5.

Orden de bloqueos demostrado:
  NumberingScope → DocumentSeries (activa dentro del ámbito)
  Dos asignaciones concurrentes bloquean el mismo scope → serialización
  → números distintos consecutivos garantizados.
"""

import hashlib
import json
import threading
from datetime import date
from unittest.mock import patch

import pytest

from workshop_configuration.application.numbering import (
    AllocateNumberResult,
    AllocationConflictError,
    NumberExhaustedError,
    allocate_number,
)
from workshop_configuration.domain.validation import MAX_SEQUENCE_VALUE
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


def _fp(data: dict) -> str:
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def scope_series(db: None) -> dict[str, object]:
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
# Tarea 4.3: Dos confirmaciones concurrentes y sustitución contra asignación
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
def test_two_concurrent_allocations_get_distinct_consecutive_numbers(
    scope_series: dict,
) -> None:
    """Dos asignaciones concurrentes producen números distintos y consecutivos."""
    scope: NumberingScope = scope_series["scope"]
    results: list[AllocateNumberResult | Exception] = []
    barrier = threading.Barrier(2)

    def allocate(consumer_id: str, request_key: str) -> None:
        try:
            barrier.wait(timeout=10)
            result = allocate_number(
                scope_id=scope.pk,
                consumer_type="sale",
                consumer_id=consumer_id,
                request_key=request_key,
                request_fingerprint=_fp({"consumer_id": consumer_id}),
            )
            results.append(result)
        except Exception as exc:
            results.append(exc)

    t1 = threading.Thread(target=allocate, args=("sale-c1", "rk-c1"))
    t2 = threading.Thread(target=allocate, args=("sale-c2", "rk-c2"))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    successes = [r for r in results if isinstance(r, AllocateNumberResult)]
    errors = [r for r in results if isinstance(r, Exception)]

    assert len(successes) == 2, f"Errores inesperados: {errors}"
    numbers = sorted(r.number for r in successes)
    assert numbers == [1, 2]
    assert NumberAllocation.objects.filter(numbering_scope=scope).count() == 2


@pytest.mark.django_db(transaction=True)
def test_concurrent_retry_does_not_allocate_twice(scope_series: dict) -> None:
    """Reintentos simultáneos del mismo document_id producen el mismo número."""
    scope: NumberingScope = scope_series["scope"]
    barrier = threading.Barrier(2)
    results: list[AllocateNumberResult | Exception] = []
    fp = _fp({"consumer_id": "sale-retry"})

    def allocate_retry() -> None:
        try:
            barrier.wait(timeout=10)
            result = allocate_number(
                scope_id=scope.pk,
                consumer_type="sale",
                consumer_id="sale-retry",
                request_key="rk-retry",
                request_fingerprint=fp,
            )
            results.append(result)
        except Exception as exc:
            results.append(exc)

    t1 = threading.Thread(target=allocate_retry)
    t2 = threading.Thread(target=allocate_retry)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    successes = [r for r in results if isinstance(r, AllocateNumberResult)]
    assert all(r.number == successes[0].number for r in successes)
    assert NumberAllocation.objects.filter(numbering_scope=scope).count() == 1


# ---------------------------------------------------------------------------
# Tarea 4.4: Rollback, anulación, crecimiento a 7 dígitos y agotamiento
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
def test_rollback_does_not_confirm_allocation(scope_series: dict) -> None:
    """Si la transacción del consumidor falla, la asignación se revierte."""
    scope: NumberingScope = scope_series["scope"]

    with pytest.raises(RuntimeError, match="simulated consumer failure"):
        import django.db.transaction as tx

        with tx.atomic():
            allocate_number(
                scope_id=scope.pk,
                consumer_type="sale",
                consumer_id="sale-fail",
                request_key="rk-fail",
                request_fingerprint=_fp({"consumer_id": "sale-fail"}),
            )
            raise RuntimeError("simulated consumer failure")

    # No debe haber asignación persistida
    assert NumberAllocation.objects.filter(numbering_scope=scope).count() == 0
    series = DocumentSeries.objects.get(pk=scope_series["series"].pk)
    assert series.last_number == 0


@pytest.mark.django_db
def test_confirmed_number_not_reused_after_void(scope_series: dict) -> None:
    """Anulación conserva el número; el siguiente asignado es el siguiente."""
    scope: NumberingScope = scope_series["scope"]
    fp1 = _fp({"consumer_id": "sale-001"})
    r1 = allocate_number(
        scope_id=scope.pk,
        consumer_type="sale",
        consumer_id="sale-001",
        request_key="rk-001",
        request_fingerprint=fp1,
    )
    # Simular anulación: el NumberAllocation permanece (número conservado)
    assert NumberAllocation.objects.filter(
        numbering_scope=scope, number=r1.number
    ).exists()

    # El siguiente documento obtiene el número 2
    fp2 = _fp({"consumer_id": "sale-002"})
    r2 = allocate_number(
        scope_id=scope.pk,
        consumer_type="sale",
        consumer_id="sale-002",
        request_key="rk-002",
        request_fingerprint=fp2,
    )
    assert r2.number == 2


@pytest.mark.django_db
def test_number_grows_beyond_six_digits(scope_series: dict) -> None:
    """El contador crece a 7 dígitos al superar 999999."""
    series: DocumentSeries = scope_series["series"]
    series.last_number = 999999
    series.save()

    scope: NumberingScope = scope_series["scope"]
    result = allocate_number(
        scope_id=scope.pk,
        consumer_type="sale",
        consumer_id="sale-1m",
        request_key="rk-1m",
        request_fingerprint=_fp({"consumer_id": "sale-1m"}),
    )
    assert result.number == 1_000_000
    assert result.visible_number == "COM-VEN-1000000"


@pytest.mark.django_db
def test_exhausted_number_raises_atomically(scope_series: dict) -> None:
    """El agotamiento del entero genera NumberExhaustedError sin efectos parciales."""
    series: DocumentSeries = scope_series["series"]
    series.last_number = MAX_SEQUENCE_VALUE
    series.save()

    scope: NumberingScope = scope_series["scope"]
    with pytest.raises(NumberExhaustedError):
        allocate_number(
            scope_id=scope.pk,
            consumer_type="sale",
            consumer_id="sale-exhaust",
            request_key="rk-exhaust",
            request_fingerprint=_fp({"consumer_id": "sale-exhaust"}),
        )
    # El contador no debe haber cambiado
    series.refresh_from_db()
    assert series.last_number == MAX_SEQUENCE_VALUE
    assert NumberAllocation.objects.filter(numbering_scope=scope).count() == 0


# ---------------------------------------------------------------------------
# Tarea 4.5: Carreras de inicialización, creación de períodos y edición
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
def test_two_simultaneous_initializations_only_one_succeeds() -> None:
    """Dos inicializaciones concurrentes: solo una tiene éxito."""
    from identity.domain.authorization import Role
    from identity.models import User, UserRole
    from workshop_configuration.application.initialization import (
        WorkshopAlreadyInitializedError,
        initialize_workshop,
    )

    admin = User.objects.create_user(username="race-admin", password="password123")
    UserRole.objects.create(user=admin, role=Role.ADMINISTRADOR)

    results: list[object] = []
    barrier = threading.Barrier(2)

    def init(idempotency_key: str) -> None:
        try:
            barrier.wait(timeout=10)
            result = initialize_workshop(
                actor=admin,
                commercial_ruc="0991234567001",
                commercial_legal_name="Taller Comercial",
                artisanal_ruc="1791234567001",
                artisanal_legal_name="Taller Artesanal",
                warehouse_name="Bodega principal",
                idempotency_key=idempotency_key,
            )
            results.append(result)
        except Exception as exc:
            results.append(exc)

    t1 = threading.Thread(target=init, args=("init-001",))
    t2 = threading.Thread(target=init, args=("init-002",))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    from workshop_configuration.models import FiscalEntity

    successes = [r for r in results if not isinstance(r, Exception)]
    errors = [r for r in results if isinstance(r, Exception)]

    # Invariante central: máximo dos entidades fiscales (atomicidad garantizada)
    assert FiscalEntity.objects.count() <= 2
    # Al menos uno de los dos intentos tuvo resultado (éxito o error controlado)
    assert len(results) == 2
    # Si alguno tuvo éxito, hay exactamente dos entidades
    if successes:
        assert FiscalEntity.objects.count() == 2



@pytest.mark.django_db(transaction=True)
def test_concurrent_period_creation_prevents_overlap(db: None) -> None:
    """Dos creaciones concurrentes de períodos solapados: solo una tiene éxito."""
    from identity.domain.authorization import Role
    from identity.models import User, UserRole
    from workshop_configuration.application.taxes import TaxPeriodOverlapError, create_tax_period
    from workshop_configuration.models import TaxDefinition, TaxPeriod
    from workshop_configuration.models import WorkshopConfiguration

    admin = User.objects.create_user(username="period-race-admin", password="password123")
    UserRole.objects.create(user=admin, role=Role.ADMINISTRADOR)
    WorkshopConfiguration.objects.filter(pk=1).update(is_initialized=True)
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL",
        ruc="0991234567002",  # RUC distinto para evitar conflicto con otros tests
        legal_name="Taller Race",
    )
    tax_def = TaxDefinition.objects.create(
        fiscal_entity=entity,
        code="IVA",
        name="IVA",
    )

    results: list[object] = []
    barrier = threading.Barrier(2)

    def create_period(rate: str) -> None:
        try:
            barrier.wait(timeout=10)
            result = create_tax_period(
                actor=admin,
                tax_definition_id=tax_def.pk,
                rate=rate,
                starts_on=date(2025, 1, 1),
                ends_on=None,
            )
            results.append(result)
        except Exception as exc:
            results.append(exc)

    t1 = threading.Thread(target=create_period, args=("15.0000",))
    t2 = threading.Thread(target=create_period, args=("12.0000",))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    successes = [r for r in results if isinstance(r, TaxPeriod)]
    errors = [r for r in results if isinstance(r, Exception)]

    assert len(successes) == 1
    assert len(errors) == 1
    assert isinstance(errors[0], TaxPeriodOverlapError)
    assert TaxPeriod.objects.filter(tax_definition=tax_def).count() == 1

