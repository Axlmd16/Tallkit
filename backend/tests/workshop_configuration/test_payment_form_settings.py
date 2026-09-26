"""Formas de pago SRI: catálogo completo visible y solo 01/20 habilitables en V1."""

from datetime import date
from uuid import uuid4

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import User
from workshop_configuration.application import official_catalog, preparation_settings
from workshop_configuration.application.entity_warehouse import StaleRecordError
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import FiscalEntity

TODAY = date(2026, 9, 26)


@pytest.fixture
def entity(db: None) -> FiscalEntity:
    official_catalog.ensure_installed()
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Comercial"
    )


def _options(entity: FiscalEntity) -> dict[str, preparation_settings.PaymentFormOption]:
    return {
        option.code: option
        for option in preparation_settings.payment_form_options(entity_id=entity.pk, on=TODAY)
    }


def _set(actor: User, entity: FiscalEntity, code: str, *, enabled: bool) -> None:
    option = _options(entity)[code]
    preparation_settings.set_payment_form_enabled(
        actor=actor,
        entity_id=entity.pk,
        code=code,
        enabled=enabled,
        expected_version=option.version,
        idempotency_key=str(uuid4()),
    )


def test_policy_without_records_enables_01_and_20(entity: FiscalEntity) -> None:
    options = _options(entity)
    assert set(options) == {"01", "15", "16", "17", "18", "19", "20", "21"}
    assert {code for code, option in options.items() if option.enabled} == {"01", "20"}
    assert {code for code, option in options.items() if option.enableable} == {"01", "20"}
    assert options["01"].is_default
    assert options["01"].internal_method == "EFECTIVO"
    assert options["20"].internal_method == "TRANSFERENCIA"
    assert options["19"].description == "TARJETA DE CRÉDITO"
    assert options["19"].source_version == "2.34"


def test_card_cannot_be_enabled_in_v1(entity: FiscalEntity, role_admin: User) -> None:
    with pytest.raises(ConfigurationValidationError, match="payment_form_not_enableable_v1"):
        _set(role_admin, entity, "19", enabled=True)
    assert not _options(entity)["19"].enabled


def test_default_form_cannot_be_disabled_without_substitute(
    entity: FiscalEntity, role_admin: User
) -> None:
    with pytest.raises(ConfigurationValidationError, match="predeterminada"):
        _set(role_admin, entity, "01", enabled=False)
    preparation_settings.set_preparation_defaults(
        actor=role_admin,
        entity_id=entity.pk,
        expected_version=0,
        idempotency_key=str(uuid4()),
        default_payment_code="20",
    )
    _set(role_admin, entity, "01", enabled=False)
    options = _options(entity)
    assert not options["01"].enabled
    assert options["20"].is_default


def test_disable_and_enable_transfer(entity: FiscalEntity, role_admin: User) -> None:
    _set(role_admin, entity, "20", enabled=False)
    assert not _options(entity)["20"].enabled
    _set(role_admin, entity, "20", enabled=True)
    assert _options(entity)["20"].enabled


def test_stale_version_is_rejected(entity: FiscalEntity, role_admin: User) -> None:
    _set(role_admin, entity, "20", enabled=False)
    with pytest.raises(StaleRecordError):
        preparation_settings.set_payment_form_enabled(
            actor=role_admin,
            entity_id=entity.pk,
            code="20",
            enabled=True,
            expected_version=0,
            idempotency_key=str(uuid4()),
        )


def test_repeated_command_returns_same_result(entity: FiscalEntity, role_admin: User) -> None:
    key = str(uuid4())
    for _ in range(2):
        preparation_settings.set_payment_form_enabled(
            actor=role_admin,
            entity_id=entity.pk,
            code="20",
            enabled=False,
            expected_version=0,
            idempotency_key=key,
        )
    assert _options(entity)["20"].version == 1


def test_default_payment_must_be_enabled(entity: FiscalEntity, role_admin: User) -> None:
    with pytest.raises(ConfigurationValidationError):
        preparation_settings.set_preparation_defaults(
            actor=role_admin,
            entity_id=entity.pk,
            expected_version=0,
            idempotency_key=str(uuid4()),
            default_payment_code="19",
        )


@pytest.mark.parametrize("role", ["role_seller", "role_manager"])
def test_operational_roles_cannot_change_forms(
    entity: FiscalEntity, role: str, request: pytest.FixtureRequest
) -> None:
    actor = request.getfixturevalue(role)
    with pytest.raises(BusinessPermissionDeniedError):
        _set(actor, entity, "20", enabled=False)
