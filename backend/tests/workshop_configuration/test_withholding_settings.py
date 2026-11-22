"""Ajustes de retenciones recibidas por entidad: activación y umbral de advertencia."""

from decimal import Decimal
from uuid import uuid4

import pytest
from django.db import IntegrityError, transaction

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import AuditEvent, User
from workshop_configuration.application import withholding_settings as service
from workshop_configuration.application.electronic_status import evaluate_electronic_status
from workshop_configuration.application.initialization import IdempotencyConflictError
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import FiscalEntity, ReceivedWithholdingSetting

D = Decimal


@pytest.fixture
def commercial(db: None) -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Comercial"
    )


@pytest.fixture
def artisan(db: None) -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type="ARTESANAL", ruc="0991234567002", legal_name="Artesanal"
    )


def _save(actor: User, entity: FiscalEntity, **changes: object) -> dict[str, object]:
    current = service.settings_for_entity(entity_id=entity.pk)
    return service.set_withholding_settings(
        actor=actor,
        entity_id=entity.pk,
        expected_version=current.version,
        idempotency_key=str(uuid4()),
        **changes,
    )


def test_defaults_apply_without_a_stored_row(commercial: FiscalEntity) -> None:
    current = service.settings_for_entity(entity_id=commercial.pk)
    assert (current.registration_enabled, current.warning_percentage, current.version) == (
        True,
        D("20.00"),
        0,
    )
    assert not ReceivedWithholdingSetting.objects.exists()
    by_type = service.withholding_settings("COMERCIAL")
    assert (by_type.registration_enabled, by_type.warning_percentage) == (True, D("20.00"))


def test_unknown_entity_type_uses_defaults(db: None) -> None:
    current = service.withholding_settings("ARTESANAL")
    assert (current.registration_enabled, current.warning_percentage) == (True, D("20.00"))


def test_disabling_one_entity_leaves_the_other_untouched(
    commercial: FiscalEntity, artisan: FiscalEntity, role_admin: User
) -> None:
    result = _save(role_admin, commercial, registration_enabled=False)
    assert result["registration_enabled"] is False
    assert result["version"] == 1
    assert service.withholding_settings("COMERCIAL").registration_enabled is False
    assert service.withholding_settings("ARTESANAL").registration_enabled is True


def test_warning_can_change_or_be_disabled(commercial: FiscalEntity, role_admin: User) -> None:
    _save(role_admin, commercial, warning_percentage="12.5")
    assert service.withholding_settings("COMERCIAL").warning_percentage == D("12.50")
    _save(role_admin, commercial, warning_percentage=None)
    current = service.withholding_settings("COMERCIAL")
    assert current.warning_percentage is None
    assert current.registration_enabled is True


@pytest.mark.parametrize("value", ["0", "0.00", "100.01", "20.005", "-1", "abc", 20.5, True])
def test_invalid_percentage_is_rejected(
    commercial: FiscalEntity, role_admin: User, value: object
) -> None:
    with pytest.raises(ConfigurationValidationError):
        _save(role_admin, commercial, warning_percentage=value)
    assert not ReceivedWithholdingSetting.objects.exists()


def test_a_change_is_required(commercial: FiscalEntity, role_admin: User) -> None:
    with pytest.raises(ConfigurationValidationError):
        _save(role_admin, commercial)


def test_only_the_administrator_can_change_or_read_them(
    commercial: FiscalEntity, role_seller: User
) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        _save(role_seller, commercial, registration_enabled=False)
    with pytest.raises(BusinessPermissionDeniedError):
        service.get_withholding_settings(actor=role_seller, entity_id=commercial.pk)
    assert not ReceivedWithholdingSetting.objects.exists()


def test_change_is_audited(commercial: FiscalEntity, role_admin: User) -> None:
    _save(role_admin, commercial, registration_enabled=False, warning_percentage="10")
    event = AuditEvent.objects.get(action="fiscal.withholding_settings_saved")
    assert event.actor_id == role_admin.pk
    assert event.metadata["changed_fields"] == ["registration_enabled", "warning_percentage"]
    assert event.target_type == "received_withholding_setting"


def test_command_is_idempotent_and_detects_conflicts(
    commercial: FiscalEntity, role_admin: User
) -> None:
    key = str(uuid4())
    first = service.set_withholding_settings(
        actor=role_admin,
        entity_id=commercial.pk,
        expected_version=0,
        idempotency_key=key,
        registration_enabled=False,
    )
    again = service.set_withholding_settings(
        actor=role_admin,
        entity_id=commercial.pk,
        expected_version=0,
        idempotency_key=key,
        registration_enabled=False,
    )
    assert first == again
    assert ReceivedWithholdingSetting.objects.get().version == 1
    with pytest.raises(IdempotencyConflictError):
        service.set_withholding_settings(
            actor=role_admin,
            entity_id=commercial.pk,
            expected_version=0,
            idempotency_key=key,
            registration_enabled=True,
        )


def test_stale_version_is_rejected(commercial: FiscalEntity, role_admin: User) -> None:
    from workshop_configuration.application.entity_warehouse import StaleRecordError

    _save(role_admin, commercial, registration_enabled=False)
    with pytest.raises(StaleRecordError):
        service.set_withholding_settings(
            actor=role_admin,
            entity_id=commercial.pk,
            expected_version=0,
            idempotency_key=str(uuid4()),
            registration_enabled=True,
        )


def test_settings_do_not_change_the_profile_state(
    commercial: FiscalEntity, role_admin: User
) -> None:
    from django.utils import timezone

    before = evaluate_electronic_status(entity_id=commercial.pk, on=timezone.localdate())
    _save(role_admin, commercial, registration_enabled=False, warning_percentage=None)
    after = evaluate_electronic_status(entity_id=commercial.pk, on=timezone.localdate())
    assert (after.state, after.causes, after.warnings) == (
        before.state,
        before.causes,
        before.warnings,
    )


@pytest.mark.parametrize("value", [D("0.00"), D("100.01"), D("-5.00")])
def test_database_rejects_out_of_range_percentage(
    commercial: FiscalEntity, role_admin: User, value: Decimal
) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        ReceivedWithholdingSetting.objects.create(
            fiscal_entity=commercial, warning_percentage=value, updated_by=role_admin
        )
