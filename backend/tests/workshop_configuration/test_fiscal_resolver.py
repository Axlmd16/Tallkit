"""La resolución fiscal no transforma desconocidos en condiciones confirmadas."""

from dataclasses import FrozenInstanceError
from datetime import date
from types import ModuleType

import pytest
from tests.workshop_configuration.profile_helpers import (
    applicable,
    profile_conditions,
    qualification,
)

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import User
from workshop_configuration.application.electronic_profiles import save_profile
from workshop_configuration.application.emission_locations import create_establishment, create_point
from workshop_configuration.models import ElectronicProfileRevision, FiscalEntity


def api() -> ModuleType:
    from workshop_configuration.application import fiscal_resolver

    return fiscal_resolver


@pytest.fixture
def entity(db: None) -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="0991234567001", legal_name="Prueba", address="Matriz"
    )


def test_missing_configuration_reports_pending_without_creating_defaults(
    entity: FiscalEntity, role_seller: User
) -> None:
    result = api().resolve_fiscal_configuration(
        actor=role_seller, entity_id=entity.pk, on=date(2026, 9, 25)
    )
    assert not result.ready_for_preparation
    assert {"profile", "point_missing"} <= set(result.preparation_issues)
    assert result.profile_revision is None
    assert result.future_emission_issues == ("certificate_missing", "emission_not_implemented")
    assert entity.electronic_profiles.count() == 0


def test_manager_cannot_read_commercial_fiscal_profile(
    entity: FiscalEntity, role_manager: User
) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        api().resolve_fiscal_configuration(
            actor=role_manager,
            entity_id=entity.pk,
            on=date(2026, 9, 25),
        )


def test_ready_profile_is_immutable_and_does_not_require_certificate(
    entity: FiscalEntity, role_admin: User, role_seller: User
) -> None:
    from workshop_configuration.application.official_catalog import ensure_installed

    ensure_installed()
    conditions = profile_conditions()
    save_profile(
        actor=role_admin,
        entity_id=entity.pk,
        expected_revision=0,
        idempotency_key="resolver:profile",
        payload={"conditions": conditions},
    )
    establishment = create_establishment(
        actor=role_admin, entity_id=entity.pk, code="001", address="Local"
    )
    point = create_point(actor=role_admin, establishment_id=establishment.pk, code="002")
    result = api().resolve_fiscal_configuration(
        actor=role_seller,
        entity_id=entity.pk,
        on=date(2026, 9, 25),
    )
    assert result.ready_for_preparation
    assert result.establishment_code == "001"
    assert result.point_code == "002"
    assert result.profile_revision == 1
    assert result.point_id == point.pk
    assert result.enabled_payment_codes == ("01", "20")
    assert result.default_payment_code == "01"
    assert result.future_emission_issues == ("certificate_missing", "emission_not_implemented")
    with pytest.raises(FrozenInstanceError):
        result.ruc = "1791234567001"
    with pytest.raises(FrozenInstanceError):
        result.conditions[0][1].status = "UNKNOWN"


def test_expired_conditions_remain_pending(entity: FiscalEntity, role_admin: User) -> None:
    save_profile(
        actor=role_admin,
        entity_id=entity.pk,
        expected_revision=0,
        idempotency_key="resolver:expired",
        payload={
            "conditions": {
                "artisan_qualification": qualification(ends_on="2025-12-31", starts_on="2025-01-01")
            }
        },
    )
    result = api().resolve_fiscal_configuration(
        actor=role_admin, entity_id=entity.pk, on=date(2026, 9, 25)
    )
    assert "conditions.artisan_qualification.expired" in result.preparation_issues
    assert "conditions.tax_regime.unknown" in result.preparation_issues


def test_environment_is_always_test_and_not_a_parameter(
    entity: FiscalEntity, role_admin: User
) -> None:
    result = api().resolve_fiscal_configuration(
        actor=role_admin, entity_id=entity.pk, on=date(2026, 9, 25)
    )
    assert result.environment == "1"
    with pytest.raises(TypeError):
        api().resolve_fiscal_configuration(
            actor=role_admin, entity_id=entity.pk, environment="2", on=date(2026, 9, 25)
        )


def test_missing_legacy_matrix_address_is_pending_not_server_error(
    entity: FiscalEntity, role_admin: User
) -> None:
    entity.address = None
    entity.save(update_fields=["address"])
    result = api().resolve_fiscal_configuration(
        actor=role_admin, entity_id=entity.pk, on=date(2026, 9, 25)
    )
    assert "matrix_address" in result.preparation_issues
    assert result.matrix_address == ""


@pytest.mark.parametrize(
    ("on", "status"),
    [
        (date(2024, 1, 1), "certificate_future"),
        (date(2026, 1, 1), "certificate_expired"),
        (date(2025, 6, 1), None),
    ],
)
def test_certificate_dates_are_local_emission_not_preparation_issues(
    entity: FiscalEntity, role_admin: User, on: date, status: str | None
) -> None:
    save_profile(
        actor=role_admin,
        entity_id=entity.pk,
        expected_revision=0,
        idempotency_key="resolver:certificate",
        payload={
            "conditions": {
                "tax_regime": {
                    "status": "APPLICABLE",
                    "value": "GENERAL",
                    "source": "Declaración",
                    "starts_on": "2025-01-01",
                }
            },
            "certificate": {
                "holder": "Titular",
                "issuer": "Certificador",
                "reference": "Referencia pública",
                "source": "Declaración",
                "starts_on": "2025-01-01",
                "ends_on": "2025-12-31",
            },
        },
    )
    result = api().resolve_fiscal_configuration(actor=role_admin, entity_id=entity.pk, on=on)
    assert result.future_emission_issues == (
        (status, "emission_not_implemented") if status else ("emission_not_implemented",)
    )
    if on.year == 2024:
        assert "conditions.tax_regime.future" in result.preparation_issues
    assert not any(issue.startswith("certificate") for issue in result.preparation_issues)


def test_default_point_belongs_to_the_entity_and_must_be_active(
    entity: FiscalEntity, role_admin: User, role_seller: User
) -> None:
    from workshop_configuration.application.emission_locations import set_point_active

    other = FiscalEntity.objects.create(
        entity_type="ARTESANAL", ruc="1791234567001", legal_name="Otro"
    )
    establishment = create_establishment(
        actor=role_admin, entity_id=other.pk, code="001", address="Otro local"
    )
    point = create_point(actor=role_admin, establishment_id=establishment.pk, code="001")
    result = api().resolve_fiscal_configuration(
        actor=role_seller, entity_id=entity.pk, on=date(2026, 9, 25)
    )
    assert result.point_id is None
    assert "point_missing" in result.preparation_issues
    result = api().resolve_fiscal_configuration(
        actor=role_admin, entity_id=other.pk, on=date(2026, 9, 25)
    )
    assert result.point_id == point.pk
    set_point_active(actor=role_admin, point_id=point.pk, expected_version=1, active=False)
    result = api().resolve_fiscal_configuration(
        actor=role_admin, entity_id=other.pk, on=date(2026, 9, 25)
    )
    assert result.point_id is None
    assert "point_missing" in result.preparation_issues


def _prepare_location(entity: FiscalEntity, role_admin: User) -> None:
    from workshop_configuration.application.official_catalog import ensure_installed

    ensure_installed()
    establishment = create_establishment(
        actor=role_admin, entity_id=entity.pk, code="001", address="Local"
    )
    create_point(actor=role_admin, establishment_id=establishment.pk, code="001")


def _save(entity: FiscalEntity, role_admin: User, **overrides: dict[str, str]) -> None:
    save_profile(
        actor=role_admin,
        entity_id=entity.pk,
        expected_revision=0,
        idempotency_key="resolver:closed",
        payload={"conditions": profile_conditions(**overrides)},
    )


def test_popular_business_regime_prepares_without_a_regime_legend_yet(
    entity: FiscalEntity, role_admin: User
) -> None:
    _prepare_location(entity, role_admin)
    _save(entity, role_admin, tax_regime=applicable("RIMPE_NEGOCIO_POPULAR"))
    result = api().resolve_fiscal_configuration(
        actor=role_admin, entity_id=entity.pk, on=date(2026, 9, 25)
    )
    assert result.ready_for_preparation
    assert result.tax_profile["regime"] == "RIMPE_NEGOCIO_POPULAR"
    # La leyenda de Negocio Popular está por confirmar con la ficha técnica del SRI.
    assert "regime_legend" not in result.tax_profile


def test_legacy_format_profile_is_a_preparation_issue(
    entity: FiscalEntity, role_admin: User
) -> None:
    _prepare_location(entity, role_admin)
    ElectronicProfileRevision.objects.create(
        fiscal_entity=entity,
        revision=1,
        conditions_format=1,
        conditions={"rimpe": {"status": "UNKNOWN"}},
        created_by=role_admin,
    )
    result = api().resolve_fiscal_configuration(
        actor=role_admin, entity_id=entity.pk, on=date(2026, 9, 25)
    )
    assert not result.ready_for_preparation
    assert "profile.legacy_format" in result.preparation_issues
    assert result.conditions == ()


def test_expiring_qualification_neither_blocks_nor_is_an_emission_issue(
    entity: FiscalEntity, role_admin: User
) -> None:
    _prepare_location(entity, role_admin)
    _save(entity, role_admin, artisan_qualification=qualification(ends_on="2026-10-25"))
    result = api().resolve_fiscal_configuration(
        actor=role_admin, entity_id=entity.pk, on=date(2026, 9, 25)
    )
    assert result.ready_for_preparation
    assert result.preparation_issues == ()
    assert result.future_emission_issues == ("certificate_missing", "emission_not_implemented")


def test_resolved_configuration_carries_the_structured_tax_profile(
    entity: FiscalEntity, role_admin: User
) -> None:
    _prepare_location(entity, role_admin)
    _save(
        entity,
        role_admin,
        tax_regime=applicable("RIMPE_EMPRENDEDOR"),
        artisan_qualification=qualification(),
    )
    result = api().resolve_fiscal_configuration(
        actor=role_admin, entity_id=entity.pk, on=date(2026, 9, 25)
    )
    assert result.ready_for_preparation
    assert result.tax_profile == {
        "regime": "RIMPE_EMPRENDEDOR",
        "regime_legend": "CONTRIBUYENTE RÉGIMEN RIMPE",
        "accounting_obligation": "NO",
        "artisan_qualification": {
            "number": "JNDA-12345",
            "issuing_body": "Junta Nacional de Defensa del Artesano",
            "ends_on": "2028-05-31",
        },
    }
    with pytest.raises(TypeError):
        result.tax_profile["regime"] = "GENERAL"
