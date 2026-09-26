"""Punto predeterminado: único activo automático, varios exigen designación."""

from datetime import date
from uuid import uuid4

import pytest

from identity.models import User
from workshop_configuration.application import official_catalog, preparation_settings
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import (
    FiscalEmissionPoint,
    FiscalEntity,
    FiscalEstablishment,
)

TODAY = date(2026, 9, 26)


@pytest.fixture
def entity(db: None) -> FiscalEntity:
    official_catalog.ensure_installed()
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Comercial"
    )


def _point(entity: FiscalEntity, establishment_code: str, code: str) -> FiscalEmissionPoint:
    establishment, _ = FiscalEstablishment.objects.get_or_create(
        fiscal_entity=entity, code=establishment_code, defaults={"address": "Av. Principal"}
    )
    return FiscalEmissionPoint.objects.create(establishment=establishment, code=code)


def _designate(actor: User, entity: FiscalEntity, point: FiscalEmissionPoint) -> None:
    current = preparation_settings.effective_defaults(entity_id=entity.pk, on=TODAY)
    preparation_settings.set_preparation_defaults(
        actor=actor,
        entity_id=entity.pk,
        expected_version=current.version,
        idempotency_key=str(uuid4()),
        default_point_id=point.pk,
    )


def test_single_active_point_is_used_without_designation(entity: FiscalEntity) -> None:
    point = _point(entity, "001", "001")
    defaults = preparation_settings.effective_defaults(entity_id=entity.pk, on=TODAY)
    assert defaults.point_id == point.pk
    assert defaults.point_issue is None


def test_no_point_is_an_administrative_issue(entity: FiscalEntity) -> None:
    defaults = preparation_settings.effective_defaults(entity_id=entity.pk, on=TODAY)
    assert defaults.point_id is None
    assert defaults.point_issue == "point_missing"


def test_several_points_require_designation(entity: FiscalEntity, role_admin: User) -> None:
    _point(entity, "001", "001")
    second = _point(entity, "001", "002")
    defaults = preparation_settings.effective_defaults(entity_id=entity.pk, on=TODAY)
    assert defaults.point_id is None
    assert defaults.point_issue == "default_point_required"

    _designate(role_admin, entity, second)
    defaults = preparation_settings.effective_defaults(entity_id=entity.pk, on=TODAY)
    assert defaults.point_id == second.pk
    assert defaults.point_issue is None


def test_point_of_another_entity_is_rejected(entity: FiscalEntity, role_admin: User) -> None:
    other = FiscalEntity.objects.create(
        entity_type="ARTESANAL", ruc="0991234567002", legal_name="Artesanal"
    )
    foreign = _point(other, "001", "001")
    with pytest.raises(ConfigurationValidationError):
        _designate(role_admin, entity, foreign)
    assert preparation_settings.effective_defaults(entity_id=entity.pk, on=TODAY).version == 0


def test_disabled_designated_point_is_unusable(entity: FiscalEntity, role_admin: User) -> None:
    first = _point(entity, "001", "001")
    second = _point(entity, "001", "002")
    third = _point(entity, "001", "003")
    _designate(role_admin, entity, second)
    FiscalEmissionPoint.objects.filter(pk=second.pk).update(is_active=False)
    defaults = preparation_settings.effective_defaults(entity_id=entity.pk, on=TODAY)
    assert defaults.point_id is None
    assert defaults.point_issue == "default_point_required"
    FiscalEmissionPoint.objects.filter(pk=third.pk).update(is_active=False)
    defaults = preparation_settings.effective_defaults(entity_id=entity.pk, on=TODAY)
    assert defaults.point_id == first.pk


def test_inactive_point_cannot_be_designated(entity: FiscalEntity, role_admin: User) -> None:
    point = _point(entity, "001", "001")
    FiscalEmissionPoint.objects.filter(pk=point.pk).update(is_active=False)
    point.refresh_from_db()
    with pytest.raises(ConfigurationValidationError):
        _designate(role_admin, entity, point)


@pytest.mark.django_db(transaction=True)
def test_concurrent_designation_keeps_one_version(run_parallel, role_admin: User) -> None:  # type: ignore[no-untyped-def]
    official_catalog.ensure_installed()
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Comercial"
    )
    first = _point(entity, "001", "001")
    second = _point(entity, "001", "002")

    def designate(point: FiscalEmissionPoint) -> object:
        return lambda: preparation_settings.set_preparation_defaults(
            actor=role_admin,
            entity_id=entity.pk,
            expected_version=0,
            idempotency_key=str(uuid4()),
            default_point_id=point.pk,
        )

    outcomes = run_parallel(designate(first), designate(second))
    assert sorted(kind for kind, _ in outcomes) == ["error", "ok"]
    assert preparation_settings.effective_defaults(entity_id=entity.pk, on=TODAY).version == 1
