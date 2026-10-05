"""Estados del perfil con causa explícita; el certificado solo advierte."""

from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from tests.workshop_configuration.profile_helpers import (
    applicable,
    profile_conditions,
    qualification,
)

from identity.models import User
from workshop_configuration.application import official_catalog
from workshop_configuration.application.electronic_profiles import save_profile
from workshop_configuration.application.electronic_status import (
    INCOMPLETE,
    NEEDS_REVIEW,
    NOT_CONFIGURED,
    READY,
    evaluate_electronic_status,
)
from workshop_configuration.models import (
    ElectronicProfileRevision,
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
    return profile_conditions(**overrides)


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
        creator = User.objects.first()
        assert creator is not None
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
            created_by=creator,
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
        withholding_agent=applicable("12345", ends_on="2026-09-25"),
    )
    _point(entity)
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert status.state == NEEDS_REVIEW
    agent = next(
        cause for cause in status.causes if cause.code == "conditions.withholding_agent.expired"
    )
    assert "2026-09-25" in agent.message


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
        withholding_agent=applicable("12345", starts_on="2025-01-01", ends_on="2025-12-31"),
    )
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert status.state == INCOMPLETE
    assert {"conditions.withholding_agent.expired", "point_missing"} <= _codes(entity)


def _ready_entity(entity: FiscalEntity, role_admin: User, **overrides: Any) -> None:
    _profile(role_admin, entity, **overrides)
    _point(entity)
    _tax(entity, mapped=True)


def test_real_workshop_profile_is_ready(entity: FiscalEntity, role_admin: User) -> None:
    _ready_entity(entity, role_admin, artisan_qualification=qualification("2028-05-31"))
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert status.state == READY
    assert status.causes == ()
    assert [warning.code for warning in status.warnings] == ["certificate_missing"]


def test_current_format_conditions_are_exposed_in_order(
    entity: FiscalEntity, role_admin: User
) -> None:
    _ready_entity(entity, role_admin)
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert [key for key, _ in status.conditions] == [
        "accounting_obligation",
        "artisan_qualification",
        "special_taxpayer",
        "tax_regime",
        "withholding_agent",
    ]


def test_legacy_format_profile_asks_to_declare_again_without_interpreting_text(
    entity: FiscalEntity, role_admin: User
) -> None:
    ElectronicProfileRevision.objects.create(
        fiscal_entity=entity,
        revision=1,
        conditions_format=1,
        conditions={
            "accounting_obligation": {
                "status": "APPLICABLE",
                "value": "no obligado",
                "source": "Certificado",
                "starts_on": "2026-01-01",
            },
            "rimpe": {"status": "UNKNOWN"},
        },
        created_by=role_admin,
    )
    _point(entity)
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert status.state == INCOMPLETE
    legacy = [cause for cause in status.causes if cause.code == "profile.legacy_format"]
    assert len(legacy) == 1
    assert "de nuevo" in legacy[0].message
    assert not [cause for cause in status.causes if cause.code.startswith("conditions.")]
    assert status.conditions == ()
    assert status.profile_revision == 1


def test_popular_business_regime_is_ready_to_prepare_electronic_invoices(
    entity: FiscalEntity, role_admin: User
) -> None:
    _ready_entity(entity, role_admin, tax_regime=applicable("RIMPE_NEGOCIO_POPULAR"))
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert status.state == READY
    assert status.causes == ()
    assert dict(status.conditions)["tax_regime"].value == "RIMPE_NEGOCIO_POPULAR"


@pytest.mark.parametrize(
    ("ends_on", "warns"),
    [("2026-11-25", True), ("2026-11-26", False), ("2026-09-26", True)],
)
def test_qualification_warning_starts_sixty_days_before_expiry(
    entity: FiscalEntity, role_admin: User, ends_on: str, warns: bool
) -> None:
    _ready_entity(entity, role_admin, artisan_qualification=qualification(ends_on))
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    codes = [warning.code for warning in status.warnings]
    assert ("artisan_qualification_expiring" in codes) is warns
    assert status.state == READY
    assert status.causes == ()


def test_qualification_warning_states_date_and_remaining_days(
    entity: FiscalEntity, role_admin: User
) -> None:
    _ready_entity(entity, role_admin, artisan_qualification=qualification("2026-11-10"))
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    warning = next(w for w in status.warnings if w.code == "artisan_qualification_expiring")
    assert "2026-11-10" in warning.message
    assert "45 días" in warning.message


def test_qualification_expired_yesterday_requires_review(
    entity: FiscalEntity, role_admin: User
) -> None:
    _ready_entity(entity, role_admin, artisan_qualification=qualification("2026-09-25"))
    status = evaluate_electronic_status(entity_id=entity.pk, on=TODAY)
    assert status.state == NEEDS_REVIEW
    expired = next(c for c in status.causes if c.code == "conditions.artisan_qualification.expired")
    assert "2026-09-25" in expired.message
    assert "artisan_qualification_expiring" not in [w.code for w in status.warnings]
