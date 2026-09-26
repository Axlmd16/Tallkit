"""Estados del perfil con causa explícita; el certificado solo advierte."""

from datetime import date
from decimal import Decimal
from typing import Any

import pytest

from identity.models import User
from workshop_configuration.application import official_catalog
from workshop_configuration.application.electronic_profiles import CONDITIONS, save_profile
from workshop_configuration.application.electronic_status import (
    INCOMPLETE,
    NEEDS_REVIEW,
    NOT_CONFIGURED,
    READY,
    evaluate_electronic_status,
)
from workshop_configuration.models import (
    FiscalEmissionPoint,
    FiscalEntity,
    FiscalEstablishment,
    FiscalTaxMapping,
    OfficialCatalogEntry,
    TaxDefinition,
    TaxPeriod,
)

TODAY = date(2026, 9, 26)


@pytest.fixture
def entity(db: None) -> FiscalEntity:
    official_catalog.ensure_installed()
    return FiscalEntity.objects.create(
        entity_type="ARTESANAL", ruc="0991234567001", legal_name="Taller", address="Matriz"
    )


def _conditions(**overrides: dict[str, Any]) -> dict[str, Any]:
    conditions: dict[str, Any] = {
        key: {"status": "NOT_APPLICABLE", "source": "Certificado RUC", "starts_on": "2026-01-01"}
        for key in CONDITIONS
    }
    conditions.update(overrides)
    return conditions


def _profile(actor: User, entity: FiscalEntity, revision: int = 0, **overrides: Any) -> None:
    save_profile(
        actor=actor,
        entity_id=entity.pk,
        expected_revision=revision,
        idempotency_key=f"status:{entity.pk}:{revision}",
        payload={"conditions": _conditions(**overrides)},
    )


def _point(entity: FiscalEntity) -> None:
    establishment = FiscalEstablishment.objects.create(
        fiscal_entity=entity, code="001", address="Local"
    )
    FiscalEmissionPoint.objects.create(establishment=establishment, code="001")


def _tax(entity: FiscalEntity, *, mapped: bool, ends_on: date | None = None) -> TaxDefinition:
    definition = TaxDefinition.objects.create(fiscal_entity=entity, code="IVA", name="IVA taller")
    TaxPeriod.objects.create(
        tax_definition=definition, rate=Decimal("0"), starts_on=date(2026, 1, 1)
    )
    if mapped:
        entry = OfficialCatalogEntry.objects.get(
            kind="TAX_RATE", catalog_version=official_catalog.SELECTABLE_TAX_VERSION, code="0"
        )
        FiscalTaxMapping.objects.create(
            tax_definition=definition,
            catalog_version=entry.catalog_version,
            percentage_code=entry.code,
            catalog_entry=entry,
            starts_on=date(2026, 1, 1),
            ends_on=ends_on,
            source="Certificado RUC",
            created_by=User.objects.first(),
        )
    return definition


def _codes(entity: FiscalEntity) -> set[str]:
    return {
        cause.code for cause in evaluate_electronic_status(entity_id=entity.pk, on=TODAY).causes
    }


def test_without_profile_is_not_configured(entity: FiscalEntity) -> None:
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert status.state == NOT_CONFIGURED
    assert status.profile_revision is None
    assert status.causes[0].message == "Todavía no existe una configuración guardada."


def test_unknown_conditions_and_missing_point_are_incomplete(
    entity: FiscalEntity, role_admin: User
) -> None:
    _profile(role_admin, entity, tax_regime={"status": "UNKNOWN"})
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert status.state == INCOMPLETE
    assert {"conditions.tax_regime.unknown", "point_missing"} <= _codes(entity)
    assert all(cause.message for cause in status.causes)


def test_complete_profile_is_ready_without_certificate(
    entity: FiscalEntity, role_admin: User
) -> None:
    _profile(role_admin, entity)
    _point(entity)
    _tax(entity, mapped=True)
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert status.state == READY
    assert status.causes == ()
    assert [warning.code for warning in status.warnings] == ["certificate_missing"]
    assert status.environment == "1"


def test_expired_certificate_is_only_a_warning(entity: FiscalEntity, role_admin: User) -> None:
    save_profile(
        actor=role_admin,
        entity_id=entity.pk,
        expected_revision=0,
        idempotency_key="status:certificate",
        payload={
            "conditions": _conditions(),
            "certificate": {
                "holder": "Titular",
                "issuer": "Certificador",
                "reference": "REF-1",
                "source": "Declaración",
                "starts_on": "2025-01-01",
                "ends_on": "2025-12-31",
            },
        },
    )
    _point(entity)
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert status.state == READY
    assert [warning.code for warning in status.warnings] == ["certificate_expired"]


def test_expired_condition_requires_review(entity: FiscalEntity, role_admin: User) -> None:
    _profile(
        role_admin,
        entity,
        rimpe={
            "status": "APPLICABLE",
            "value": "Emprendedor",
            "source": "Certificado RUC",
            "starts_on": "2025-01-01",
            "ends_on": "2026-09-25",
        },
    )
    _point(entity)
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert status.state == NEEDS_REVIEW
    rimpe = next(cause for cause in status.causes if cause.code == "conditions.rimpe.expired")
    assert "2026-09-25" in rimpe.message


def test_definition_without_mapping_is_incomplete(entity: FiscalEntity, role_admin: User) -> None:
    _profile(role_admin, entity)
    _point(entity)
    definition = _tax(entity, mapped=False)
    assert evaluate_electronic_status(entity_id=entity.pk, on=TODAY).state == INCOMPLETE
    assert f"tax_mapping.{definition.pk}.missing" in _codes(entity)


def test_expired_mapping_or_inactive_entry_requires_review(
    entity: FiscalEntity, role_admin: User
) -> None:
    _profile(role_admin, entity)
    _point(entity)
    definition = _tax(entity, mapped=True, ends_on=date(2026, 6, 30))
    assert evaluate_electronic_status(entity_id=entity.pk, on=TODAY).state == NEEDS_REVIEW
    assert f"tax_mapping.{definition.pk}.expired" in _codes(entity)

    FiscalTaxMapping.objects.update(ends_on=None)
    OfficialCatalogEntry.objects.filter(kind="TAX_RATE", code="0").update(is_active=False)
    assert evaluate_electronic_status(entity_id=entity.pk, on=TODAY).state == NEEDS_REVIEW
    assert f"tax_mapping.{definition.pk}.review" in _codes(entity)


def test_missing_items_prevail_and_all_causes_are_listed(
    entity: FiscalEntity, role_admin: User
) -> None:
    _profile(
        role_admin,
        entity,
        rimpe={
            "status": "APPLICABLE",
            "value": "Emprendedor",
            "source": "Certificado RUC",
            "starts_on": "2025-01-01",
            "ends_on": "2025-12-31",
        },
    )
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert status.state == INCOMPLETE
    assert {"conditions.rimpe.expired", "point_missing"} <= _codes(entity)
