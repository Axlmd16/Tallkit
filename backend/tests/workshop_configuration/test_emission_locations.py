"""Las series fiscales conservan códigos e identidad dentro de cada emisor."""

from typing import Any

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import User
from workshop_configuration.application.entity_warehouse import StaleRecordError
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import FiscalEntity


def api() -> Any:
    from workshop_configuration.application import emission_locations

    return emission_locations


@pytest.fixture
def entity(db: None) -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Prueba"
    )


def test_codes_preserve_zeros_and_are_scoped_by_issuer(
    entity: FiscalEntity, role_admin: User
) -> None:
    other = FiscalEntity.objects.create(
        entity_type="ARTESANAL", ruc="1791234567001", legal_name="Taller"
    )
    first = api().create_establishment(
        actor=role_admin, entity_id=entity.pk, code="001", address="Matriz"
    )
    second = api().create_establishment(
        actor=role_admin, entity_id=other.pk, code="001", address="Taller"
    )
    point = api().create_point(actor=role_admin, establishment_id=first.pk, code="002")
    assert first.code == second.code == "001"
    assert first.pk != second.pk
    assert point.code == "002"
    with pytest.raises(ConfigurationValidationError):
        api().create_point(actor=role_admin, establishment_id=first.pk, code="002")


@pytest.mark.parametrize("code", ["000", "01", "0001", "\uff1101", " 001", 1, None])
def test_invalid_codes_are_rejected(entity: FiscalEntity, role_admin: User, code: Any) -> None:
    with pytest.raises(ConfigurationValidationError):
        api().create_establishment(
            actor=role_admin, entity_id=entity.pk, code=code, address="Matriz"
        )


def test_missing_address_is_rejected(entity: FiscalEntity, role_admin: User) -> None:
    with pytest.raises(ConfigurationValidationError):
        api().create_establishment(actor=role_admin, entity_id=entity.pk, code="001", address=" ")


def test_deactivation_keeps_code_and_detects_stale_write(
    entity: FiscalEntity, role_admin: User
) -> None:
    establishment = api().create_establishment(
        actor=role_admin, entity_id=entity.pk, code="001", address="Matriz"
    )
    point = api().create_point(actor=role_admin, establishment_id=establishment.pk, code="002")
    result = api().set_point_active(
        actor=role_admin, point_id=point.pk, expected_version=1, active=False
    )
    assert not result.is_active
    assert result.code == "002"
    with pytest.raises(StaleRecordError):
        api().set_point_active(actor=role_admin, point_id=point.pk, expected_version=1, active=True)
    with pytest.raises(ConfigurationValidationError):
        api().create_point(actor=role_admin, establishment_id=establishment.pk, code="002")


def test_deactivating_establishment_preserves_points_and_blocks_new_ones(
    entity: FiscalEntity, role_admin: User
) -> None:
    establishment = api().create_establishment(
        actor=role_admin, entity_id=entity.pk, code="001", address="Matriz"
    )
    point = api().create_point(actor=role_admin, establishment_id=establishment.pk, code="002")

    result = api().set_establishment_active(
        actor=role_admin,
        establishment_id=establishment.pk,
        expected_version=1,
        active=False,
    )

    assert not result.is_active
    point.refresh_from_db()
    assert point.code == "002"
    assert point.is_active
    with pytest.raises(ConfigurationValidationError):
        api().create_point(actor=role_admin, establishment_id=establishment.pk, code="003")


def test_non_admin_cannot_create_location(entity: FiscalEntity, role_seller: User) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        api().create_establishment(
            actor=role_seller, entity_id=entity.pk, code="001", address="Matriz"
        )


@pytest.mark.django_db(transaction=True)
def test_concurrent_point_creation_reports_one_controlled_conflict(
    role_admin: User, run_parallel: Any
) -> None:
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Prueba"
    )
    establishment = api().create_establishment(
        actor=role_admin, entity_id=entity.pk, code="001", address="Matriz"
    )

    def create() -> Any:
        return api().create_point(
            actor=User.objects.get(pk=role_admin.pk),
            establishment_id=establishment.pk,
            code="002",
        )

    outcomes = run_parallel(create, create)

    assert [status for status, _ in outcomes].count("ok") == 1
    failures = [result for status, result in outcomes if status == "error"]
    assert len(failures) == 1
    assert isinstance(failures[0], ConfigurationValidationError)
    assert establishment.emission_points.filter(code="002").count() == 1
