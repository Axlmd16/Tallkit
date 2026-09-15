from unittest.mock import patch

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import Role
from identity.models import User, UserRole
from workshop_configuration.application.initialization import (
    IdempotencyConflictError,
    WorkshopAlreadyInitializedError,
    initialize_workshop,
)
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import (
    ConfigurationCommand,
    DocumentSeries,
    FiscalEntity,
    NumberingScope,
    Warehouse,
    WorkshopConfiguration,
)


@pytest.fixture
def admin(db: None) -> User:
    user = User.objects.create_user(username="config-admin", password="password123")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    return user


@pytest.fixture
def seller(db: None) -> User:
    user = User.objects.create_user(username="config-seller", password="password123")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    return user


def valid_input() -> dict[str, str]:
    return {
        "commercial_ruc": "0991234567001",
        "commercial_legal_name": "Taller Comercial",
        "artisanal_ruc": "1791234567001",
        "artisanal_legal_name": "Taller Artesanal",
        "warehouse_name": "Bodega principal",
        "idempotency_key": "initialize-workshop-001",
    }


@pytest.mark.django_db
def test_initialize_workshop_creates_both_entities_warehouse_and_four_series(
    admin: User,
) -> None:
    result = initialize_workshop(actor=admin, **valid_input())

    installation = WorkshopConfiguration.objects.get()
    assert result.installation_id == installation.pk
    assert installation.is_initialized is True
    assert installation.initialized_at is not None
    assert FiscalEntity.objects.count() == 2
    assert Warehouse.objects.values_list("name", flat=True).get() == "Bodega principal"
    assert NumberingScope.objects.count() == 4
    assert set(DocumentSeries.objects.values_list("code", "last_number")) == {
        ("COM-ING", 0),
        ("COM-PRO", 0),
        ("COM-VEN", 0),
        ("ART-SER", 0),
    }


@pytest.mark.django_db
def test_initialize_workshop_returns_persisted_result_for_compatible_retry(admin: User) -> None:
    first = initialize_workshop(actor=admin, **valid_input())
    second = initialize_workshop(actor=admin, **valid_input())

    assert second == first
    assert FiscalEntity.objects.count() == 2
    assert DocumentSeries.objects.count() == 4
    assert ConfigurationCommand.objects.count() == 1


@pytest.mark.django_db
def test_initialize_workshop_rejects_reused_key_with_different_input(admin: User) -> None:
    initialize_workshop(actor=admin, **valid_input())

    with pytest.raises(IdempotencyConflictError):
        initialize_workshop(
            actor=admin,
            **{**valid_input(), "commercial_legal_name": "Nombre incompatible"},
        )

    assert FiscalEntity.objects.get(entity_type="COMERCIAL").legal_name == "Taller Comercial"
    assert ConfigurationCommand.objects.count() == 1


@pytest.mark.django_db
def test_initialize_workshop_rejects_different_configuration_after_initialization(
    admin: User,
) -> None:
    initialize_workshop(actor=admin, **valid_input())

    with pytest.raises(WorkshopAlreadyInitializedError):
        initialize_workshop(
            actor=admin,
            **{
                **valid_input(),
                "commercial_ruc": "0999999999001",
                "idempotency_key": "initialize-workshop-002",
            },
        )

    assert FiscalEntity.objects.get(entity_type="COMERCIAL").ruc == "0991234567001"


@pytest.mark.django_db
def test_initialize_workshop_requires_both_administrative_permissions(seller: User) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        initialize_workshop(actor=seller, **valid_input())

    assert FiscalEntity.objects.count() == 0
    assert Warehouse.objects.count() == 0
    assert WorkshopConfiguration.objects.get().is_initialized is False


@pytest.mark.django_db
def test_initialize_workshop_rejects_equal_ruc_before_writing(admin: User) -> None:
    with pytest.raises(ConfigurationValidationError):
        initialize_workshop(
            actor=admin,
            **{**valid_input(), "artisanal_ruc": "0991234567001"},
        )

    assert FiscalEntity.objects.count() == 0
    assert Warehouse.objects.count() == 0


@pytest.mark.django_db
def test_initialize_workshop_rejects_blank_warehouse_before_writing(admin: User) -> None:
    with pytest.raises(ConfigurationValidationError):
        initialize_workshop(actor=admin, **{**valid_input(), "warehouse_name": "   "})

    assert FiscalEntity.objects.count() == 0
    assert Warehouse.objects.count() == 0


@pytest.mark.django_db(transaction=True)
def test_initialize_workshop_rolls_back_everything_after_intermediate_failure(
    admin: User,
) -> None:
    with (
        patch(
            "workshop_configuration.application.initialization.DocumentSeries.objects.create",
            side_effect=RuntimeError("simulated database failure"),
        ),
        pytest.raises(RuntimeError, match="simulated database failure"),
    ):
        initialize_workshop(actor=admin, **valid_input())

    installation = WorkshopConfiguration.objects.get()
    assert installation.is_initialized is False
    assert FiscalEntity.objects.count() == 0
    assert Warehouse.objects.count() == 0
    assert NumberingScope.objects.count() == 0
    assert DocumentSeries.objects.count() == 0
    assert ConfigurationCommand.objects.count() == 0
