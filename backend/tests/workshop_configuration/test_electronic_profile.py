"""El perfil distingue desconocidos y nunca acepta material privado de firma."""

from datetime import date
from types import ModuleType

import pytest

from workshop_configuration.domain import validation


def profile_api() -> ModuleType:
    from workshop_configuration.domain import electronic_profile

    return electronic_profile


def test_unknown_condition_is_not_a_tax_exemption() -> None:
    api = profile_api()
    condition = api.parse_condition({"status": "UNKNOWN"})
    assert condition.status == "UNKNOWN"
    assert not condition.is_resolved
    assert condition.value is None


def test_non_applicable_condition_needs_evidence() -> None:
    api = profile_api()
    with pytest.raises(validation.ConfigurationValidationError):
        api.parse_condition({"status": "NOT_APPLICABLE"})
    condition = api.parse_condition(
        {"status": "NOT_APPLICABLE", "source": "Revisión tributaria", "starts_on": "2026-09-25"}
    )
    assert condition.is_resolved
    assert condition.value is None
    assert condition.starts_on == date(2026, 9, 25)


def test_applicable_condition_preserves_value_source_and_validity() -> None:
    api = profile_api()
    condition = api.parse_condition(
        {
            "status": "APPLICABLE",
            "value": "Resolución declarada",
            "source": "Documento revisado",
            "starts_on": "2026-01-01",
            "ends_on": "2026-12-31",
        }
    )
    assert condition.value == "Resolución declarada"
    assert condition.source == "Documento revisado"
    assert condition.ends_on == date(2026, 12, 31)


@pytest.mark.parametrize(
    "payload",
    [
        {"status": "UNKNOWN", "value": "NO"},
        {
            "status": "NOT_APPLICABLE",
            "source": "Documento",
            "starts_on": "2026-09-25",
            "value": "SI",
        },
        {"status": "APPLICABLE", "source": "Documento", "starts_on": "2026-09-25"},
        {
            "status": "APPLICABLE",
            "value": "SI",
            "source": "Documento",
            "starts_on": "2026-09-25",
            "ends_on": "2026-09-24",
        },
    ],
)
def test_inconsistent_condition_is_rejected(payload: dict[str, str]) -> None:
    with pytest.raises(validation.ConfigurationValidationError):
        profile_api().parse_condition(payload)


def test_certificate_dates_are_declarations_not_cryptographic_verification() -> None:
    certificate = profile_api().parse_certificate_metadata(
        {
            "holder": "Titular de prueba",
            "issuer": "Certificador declarado",
            "reference": "Referencia",
            "source": "Consulta administrativa",
            "starts_on": "2026-01-01",
            "ends_on": "2026-12-31",
        }
    )
    assert certificate.status_on(date(2025, 12, 31)) == "FUTURE"
    assert certificate.status_on(date(2026, 9, 25)) == "DECLARED_CURRENT"
    assert certificate.status_on(date(2027, 1, 1)) == "EXPIRED"


@pytest.mark.parametrize("field", ["password", "private_key", "p12", "pfx", "file"])
def test_certificate_secret_is_rejected_without_echo(field: str) -> None:
    secret = "SECRET-NOT-FOR-LOGS"
    with pytest.raises(validation.ConfigurationValidationError) as caught:
        profile_api().parse_certificate_metadata({field: secret})
    assert secret not in str(caught.value)
    assert secret not in str(caught.value.errors)


def test_certificate_end_must_follow_start() -> None:
    with pytest.raises(validation.ConfigurationValidationError):
        profile_api().parse_certificate_metadata(
            {
                "holder": "Titular",
                "issuer": "Certificador",
                "reference": "Referencia",
                "source": "Documento",
                "starts_on": "2026-01-01",
                "ends_on": "2026-01-01",
            }
        )
