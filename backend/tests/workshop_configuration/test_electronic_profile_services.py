"""Revisiones declaradas aisladas de la configuración comercial existente."""

from types import ModuleType
from typing import Any

import pytest
from tests.workshop_configuration.profile_helpers import (
    applicable,
    profile_conditions,
    qualification,
)

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import User
from workshop_configuration.application.entity_warehouse import StaleRecordError
from workshop_configuration.domain.electronic_profile import CONDITION_KEYS
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import (
    ConfigurationCommand,
    ElectronicProfileRevision,
    FiscalEntity,
)


def services() -> ModuleType:
    from workshop_configuration.application import electronic_profiles

    return electronic_profiles


@pytest.fixture
def entity(db: None) -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Prueba"
    )


def test_missing_profile_remains_unknown_without_altering_entity(
    entity: FiscalEntity, role_admin: User
) -> None:
    assert services().get_profile(actor=role_admin, entity_id=entity.pk) is None
    entity.refresh_from_db()
    assert entity.version == 1


def test_revisions_keep_previous_data_and_creator(entity: FiscalEntity, role_admin: User) -> None:
    api = services()
    first = api.save_profile(
        actor=role_admin,
        entity_id=entity.pk,
        expected_revision=0,
        idempotency_key="profile:001",
        payload={"conditions": {}},
    )
    second = api.save_profile(
        actor=role_admin,
        entity_id=entity.pk,
        expected_revision=1,
        idempotency_key="profile:002",
        payload={
            "conditions": {
                "artisan_qualification": {
                    "status": "NOT_APPLICABLE",
                    "source": "Revisión",
                    "starts_on": "2026-09-25",
                }
            }
        },
    )
    first.refresh_from_db()
    assert first.revision == 1
    assert first.conditions["artisan_qualification"]["status"] == "UNKNOWN"
    assert second.revision == 2
    assert second.conditions["artisan_qualification"]["status"] == "NOT_APPLICABLE"
    assert second.created_by_id == role_admin.pk
    entity.refresh_from_db()
    assert entity.version == 1


def test_stale_revision_does_not_overwrite(entity: FiscalEntity, role_admin: User) -> None:
    api = services()
    first = api.save_profile(
        actor=role_admin,
        entity_id=entity.pk,
        expected_revision=0,
        idempotency_key="profile:001",
        payload={},
    )
    with pytest.raises(StaleRecordError):
        api.save_profile(
            actor=role_admin,
            entity_id=entity.pk,
            expected_revision=0,
            idempotency_key="profile:002",
            payload={},
        )
    assert api.get_profile(actor=role_admin, entity_id=entity.pk).pk == first.pk


def test_replay_returns_same_revision_and_checks_permission(
    entity: FiscalEntity, role_admin: User
) -> None:
    api = services()
    args: dict[str, Any] = {
        "actor": role_admin,
        "entity_id": entity.pk,
        "expected_revision": 0,
        "idempotency_key": "profile:001",
        "payload": {},
    }
    first = api.save_profile(**args)
    assert api.save_profile(**args).pk == first.pk
    role_admin.role_assignments.all().delete()
    with pytest.raises(BusinessPermissionDeniedError):
        api.save_profile(**args)


def test_seller_cannot_write_profile(entity: FiscalEntity, role_seller: User) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        services().save_profile(
            actor=role_seller,
            entity_id=entity.pk,
            expected_revision=0,
            idempotency_key="profile:001",
            payload={},
        )


def test_secret_rejection_does_not_persist_or_log_value(
    entity: FiscalEntity, role_admin: User
) -> None:
    api = services()
    with pytest.raises(ConfigurationValidationError):
        api.save_profile(
            actor=role_admin,
            entity_id=entity.pk,
            expected_revision=0,
            idempotency_key="profile:001",
            payload={"certificate": {"password": "secret"}},
        )
    assert api.get_profile(actor=role_admin, entity_id=entity.pk) is None


def test_reused_key_with_changed_conditions_is_conflict(
    entity: FiscalEntity, role_admin: User
) -> None:
    from workshop_configuration.application.initialization import IdempotencyConflictError

    api = services()
    api.save_profile(
        actor=role_admin,
        entity_id=entity.pk,
        expected_revision=0,
        idempotency_key="profile:001",
        payload={},
    )
    with pytest.raises(IdempotencyConflictError):
        api.save_profile(
            actor=role_admin,
            entity_id=entity.pk,
            expected_revision=1,
            idempotency_key="profile:001",
            payload={"conditions": {}},
        )


@pytest.mark.django_db(transaction=True)
def test_competing_revisions_do_not_overwrite_history(role_admin: User, run_parallel: Any) -> None:
    entity = FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Prueba"
    )
    api = services()

    def save(key: str) -> Any:
        return api.save_profile(
            actor=User.objects.get(pk=role_admin.pk),
            entity_id=entity.pk,
            expected_revision=0,
            idempotency_key=key,
            payload={},
        )

    outcomes = run_parallel(lambda: save("profile:001"), lambda: save("profile:002"))
    assert [status for status, _ in outcomes].count("ok") == 1
    failures = [result for status, result in outcomes if status == "error"]
    assert len(failures) == 1
    assert isinstance(failures[0], StaleRecordError)
    assert api.get_profile(actor=role_admin, entity_id=entity.pk).revision == 1


def test_save_profile_stores_closed_values_in_format_two(
    entity: FiscalEntity, role_admin: User
) -> None:
    revision = services().save_profile(
        actor=role_admin,
        entity_id=entity.pk,
        expected_revision=0,
        idempotency_key="profile:format2",
        payload={"conditions": profile_conditions(artisan_qualification=qualification())},
    )
    assert revision.conditions_format == 2
    assert set(revision.conditions) == set(CONDITION_KEYS)
    assert "rimpe" not in revision.conditions
    assert revision.conditions["accounting_obligation"] == {
        "status": "APPLICABLE",
        "value": "NO",
        "source": "Certificado de RUC",
        "starts_on": "2026-01-01",
    }
    assert revision.conditions["artisan_qualification"]["ends_on"] == "2028-05-31"
    assert revision.conditions["artisan_qualification"]["issuing_body"].startswith("Junta")
    assert revision.conditions["withholding_agent"]["status"] == "NOT_APPLICABLE"


@pytest.mark.parametrize(
    ("conditions", "field"),
    [
        (
            {"accounting_obligation": applicable("Sí, desde 2024")},
            "accounting_obligation.value",
        ),
        ({"tax_regime": applicable("General")}, "tax_regime.value"),
        ({"withholding_agent": applicable("NAC-0012")}, "withholding_agent.value"),
        ({"rimpe": {"status": "UNKNOWN"}}, "conditions"),
    ],
)
def test_legacy_or_free_text_body_is_rejected_without_receipt_or_revision(
    entity: FiscalEntity,
    role_admin: User,
    conditions: dict[str, object],
    field: str,
) -> None:
    with pytest.raises(ConfigurationValidationError) as caught:
        services().save_profile(
            actor=role_admin,
            entity_id=entity.pk,
            expected_revision=0,
            idempotency_key="profile:legacy",
            payload={"conditions": {**profile_conditions(), **conditions}},
        )
    assert field in caught.value.errors
    assert not ElectronicProfileRevision.objects.exists()
    assert not ConfigurationCommand.objects.exists()


def test_replay_of_a_format_two_save_returns_the_same_revision(
    entity: FiscalEntity, role_admin: User
) -> None:
    args: dict[str, Any] = {
        "actor": role_admin,
        "entity_id": entity.pk,
        "expected_revision": 0,
        "idempotency_key": "profile:replay2",
        "payload": {"conditions": profile_conditions()},
    }
    first = services().save_profile(**args)
    assert services().save_profile(**args).pk == first.pk
    assert ElectronicProfileRevision.objects.count() == 1
