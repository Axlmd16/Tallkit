"""Lecturas de configuración para el inicio: calificación artesanal y registro de retenciones."""

import uuid
from datetime import date
from typing import Any

import pytest
from tests.workshop_configuration.profile_helpers import profile_conditions, qualification

from identity.models import AuditEvent, User
from workshop_configuration.application import home_summary, official_catalog, withholding_settings
from workshop_configuration.application.electronic_profiles import save_profile
from workshop_configuration.application.electronic_status import evaluate_electronic_status
from workshop_configuration.models import FiscalEntity

TODAY = date(2026, 9, 26)


@pytest.fixture
def entity(db: None) -> FiscalEntity:
    official_catalog.ensure_installed()
    return FiscalEntity.objects.create(
        entity_type="ARTESANAL", ruc="0991234567001", legal_name="Taller", address="Matriz"
    )


def declare(actor: User, entity: FiscalEntity, **overrides: Any) -> None:
    save_profile(
        actor=actor,
        entity_id=entity.pk,
        expected_revision=0,
        idempotency_key=f"home-profile:{entity.pk}",
        payload={"conditions": profile_conditions(**overrides)},
    )


@pytest.mark.parametrize(
    ("ends_on", "days_left", "expired"),
    [
        ("2026-11-10", 45, False),
        ("2026-11-25", 60, False),
        ("2026-09-26", 0, False),
        ("2026-09-25", -1, True),
        ("2026-06-30", -88, True),
    ],
)
def test_notice_inside_the_warning_window_or_expired(
    entity: FiscalEntity, role_admin: User, ends_on: str, days_left: int, expired: bool
) -> None:
    declare(role_admin, entity, artisan_qualification=qualification(ends_on))
    notice = home_summary.artisan_qualification_notice(role_admin, on=TODAY)
    assert notice == home_summary.QualificationNotice(
        entity_id=entity.pk,
        ends_on=date.fromisoformat(ends_on),
        days_left=days_left,
        expired=expired,
    )


def test_no_notice_sixty_one_days_before(entity: FiscalEntity, role_admin: User) -> None:
    declare(role_admin, entity, artisan_qualification=qualification("2026-11-26"))
    assert home_summary.artisan_qualification_notice(role_admin, on=TODAY) is None


def test_no_notice_without_profile_or_qualification(entity: FiscalEntity, role_admin: User) -> None:
    assert home_summary.artisan_qualification_notice(role_admin, on=TODAY) is None
    declare(role_admin, entity)
    assert home_summary.artisan_qualification_notice(role_admin, on=TODAY) is None


def test_configuration_warning_keeps_its_behaviour(entity: FiscalEntity, role_admin: User) -> None:
    declare(role_admin, entity, artisan_qualification=qualification("2026-11-10"))
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert "artisan_qualification_expiring" in {warning.code for warning in status.warnings}


def test_only_the_administrator_receives_the_notice_and_nothing_is_audited(
    entity: FiscalEntity, role_admin: User, role_manager: User, role_seller: User
) -> None:
    declare(role_admin, entity, artisan_qualification=qualification("2026-11-10"))
    before = AuditEvent.objects.count()
    assert home_summary.artisan_qualification_notice(role_manager, on=TODAY) is None
    assert home_summary.artisan_qualification_notice(role_seller, on=TODAY) is None
    assert AuditEvent.objects.count() == before


def test_registers_withholdings_follows_the_entity_setting(
    entity: FiscalEntity, role_admin: User
) -> None:
    assert home_summary.registers_withholdings("ARTESANAL") is True
    assert home_summary.registers_withholdings("COMERCIAL") is True
    withholding_settings.set_withholding_settings(
        actor=role_admin,
        entity_id=entity.pk,
        expected_version=0,
        idempotency_key=str(uuid.uuid4()),
        registration_enabled=False,
    )
    assert home_summary.registers_withholdings("ARTESANAL") is False


def test_notice_survives_a_stored_value_that_no_longer_meets_its_format(
    entity: FiscalEntity, role_admin: User
) -> None:
    from tests.workshop_configuration.profile_helpers import applicable

    from workshop_configuration.models import ElectronicProfileRevision

    ElectronicProfileRevision.objects.create(
        fiscal_entity=entity,
        revision=1,
        conditions_format=2,
        conditions=profile_conditions(
            special_taxpayer=applicable("A1"), artisan_qualification=qualification("2026-10-20")
        ),
        created_by=role_admin,
    )
    notice = home_summary.artisan_qualification_notice(role_admin, on=TODAY)
    assert notice is not None
    assert notice.days_left == 24
