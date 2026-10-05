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


# --- Formato 2: valores cerrados (estructurar-perfil-del-emisor-y-codigos-fiscales) ---


def declared(value: str | None = None, **extra: str) -> dict[str, str]:
    payload = {"status": "APPLICABLE", "source": "Certificado de RUC", "starts_on": "2026-01-01"}
    if value is not None:
        payload["value"] = value
    return {**payload, **extra}


NOT_APPLICABLE = {
    "status": "NOT_APPLICABLE",
    "source": "Certificado de RUC",
    "starts_on": "2026-01-01",
}
QUALIFICATION = declared(
    "JNDA-12345",
    issuing_body="Junta Nacional de Defensa del Artesano",
    ends_on="2028-05-31",
)


def workshop_profile(**override: dict[str, str]) -> dict[str, dict[str, str]]:
    return {
        "tax_regime": declared("GENERAL"),
        "accounting_obligation": declared("NO"),
        "withholding_agent": NOT_APPLICABLE,
        "special_taxpayer": NOT_APPLICABLE,
        "artisan_qualification": QUALIFICATION,
        **override,
    }


def rejected_fields(payload: object) -> dict[str, list[str]]:
    with pytest.raises(validation.ConfigurationValidationError) as caught:
        profile_api().parse_profile_conditions(payload)
    return caught.value.errors


def test_real_workshop_profile_is_accepted() -> None:
    parsed = profile_api().parse_profile_conditions(workshop_profile())
    assert set(parsed) == {
        "tax_regime",
        "accounting_obligation",
        "withholding_agent",
        "special_taxpayer",
        "artisan_qualification",
    }
    assert parsed["tax_regime"].value == "GENERAL"
    assert parsed["accounting_obligation"].value == "NO"
    assert parsed["withholding_agent"].status == "NOT_APPLICABLE"
    assert parsed["withholding_agent"].value is None
    assert parsed["artisan_qualification"].value == "JNDA-12345"
    assert parsed["artisan_qualification"].issuing_body == "Junta Nacional de Defensa del Artesano"
    assert parsed["artisan_qualification"].ends_on == date(2028, 5, 31)


def test_missing_conditions_default_to_unknown() -> None:
    parsed = profile_api().parse_profile_conditions({})
    assert {condition.status for condition in parsed.values()} == {"UNKNOWN"}
    assert len(parsed) == 5


@pytest.mark.parametrize("regime", ["GENERAL", "RIMPE_EMPRENDEDOR", "RIMPE_NEGOCIO_POPULAR"])
def test_regime_accepts_only_the_three_closed_values(regime: str) -> None:
    parsed = profile_api().parse_profile_conditions(workshop_profile(tax_regime=declared(regime)))
    assert parsed["tax_regime"].value == regime


@pytest.mark.parametrize("regime", ["General", "RIMPE", "RIMPE_POPULAR", "", "   ", "GENERAL "])
def test_regime_rejects_any_other_text(regime: str) -> None:
    errors = rejected_fields(workshop_profile(tax_regime=declared(regime)))
    assert "tax_regime.value" in errors


@pytest.mark.parametrize("key", ["tax_regime", "accounting_obligation"])
def test_regime_and_accounting_always_apply(key: str) -> None:
    errors = rejected_fields(workshop_profile(**{key: NOT_APPLICABLE}))
    assert f"{key}.status" in errors


@pytest.mark.parametrize("value", ["SI", "NO"])
def test_accounting_accepts_si_and_no(value: str) -> None:
    parsed = profile_api().parse_profile_conditions(
        workshop_profile(accounting_obligation=declared(value))
    )
    assert parsed["accounting_obligation"].value == value


@pytest.mark.parametrize("value", ["Sí, desde 2024", "Sí", "si", "No", "no obligado", "", "TRUE"])
def test_accounting_rejects_free_text(value: str) -> None:
    errors = rejected_fields(workshop_profile(accounting_obligation=declared(value)))
    assert "accounting_obligation.value" in errors


@pytest.mark.parametrize("resolution", ["1", "12345678", "00000001"])
def test_withholding_agent_accepts_one_to_eight_digits(resolution: str) -> None:
    parsed = profile_api().parse_profile_conditions(
        workshop_profile(withholding_agent=declared(resolution))
    )
    assert parsed["withholding_agent"].value == resolution


@pytest.mark.parametrize("resolution", ["NAC-0012", "123456789", "12 34", "١٢٣", "12.5", ""])
def test_withholding_agent_rejects_non_ascii_digit_formats(resolution: str) -> None:
    errors = rejected_fields(workshop_profile(withholding_agent=declared(resolution)))
    assert "withholding_agent.value" in errors


def test_withholding_agent_applicable_requires_the_resolution_number() -> None:
    errors = rejected_fields(workshop_profile(withholding_agent=declared()))
    assert "withholding_agent.value" in errors


@pytest.mark.parametrize("resolution", ["A", "ABC123", "1234567890123", "abc12"])
def test_special_taxpayer_accepts_alphanumeric_up_to_thirteen(resolution: str) -> None:
    parsed = profile_api().parse_profile_conditions(
        workshop_profile(special_taxpayer=declared(resolution))
    )
    assert parsed["special_taxpayer"].value == resolution


@pytest.mark.parametrize("resolution", ["12345678901234", "AB-12", "ÁBC1", "12 3", ""])
def test_special_taxpayer_rejects_other_formats(resolution: str) -> None:
    errors = rejected_fields(workshop_profile(special_taxpayer=declared(resolution)))
    assert "special_taxpayer.value" in errors


def test_rimpe_is_no_longer_a_separate_condition() -> None:
    errors = rejected_fields({**workshop_profile(), "rimpe": declared("Emprendedor")})
    assert "conditions" in errors


def test_unknown_condition_key_is_rejected() -> None:
    assert "conditions" in rejected_fields({**workshop_profile(), "otra": declared("X")})


def test_conditions_must_be_an_object() -> None:
    assert "conditions" in rejected_fields(["tax_regime"])


def test_unknown_status_cannot_carry_values() -> None:
    errors = rejected_fields(workshop_profile(tax_regime={"status": "UNKNOWN", "value": "GENERAL"}))
    assert "tax_regime.status" in errors


def test_qualification_number_is_stripped_and_bounded() -> None:
    parsed = profile_api().parse_profile_conditions(
        workshop_profile(
            artisan_qualification={**QUALIFICATION, "value": "  JNDA-12345  "},
        )
    )
    assert parsed["artisan_qualification"].value == "JNDA-12345"
    longest = "A" * 50
    profile_api().parse_profile_conditions(
        workshop_profile(artisan_qualification={**QUALIFICATION, "value": longest})
    )
    errors = rejected_fields(
        workshop_profile(artisan_qualification={**QUALIFICATION, "value": "A" * 51})
    )
    assert "artisan_qualification.value" in errors


def test_qualification_number_cannot_contain_line_breaks() -> None:
    errors = rejected_fields(
        workshop_profile(artisan_qualification={**QUALIFICATION, "value": "JNDA\n1"})
    )
    assert "artisan_qualification.value" in errors


def test_qualification_requires_issuing_body() -> None:
    payload = {key: val for key, val in QUALIFICATION.items() if key != "issuing_body"}
    errors = rejected_fields(workshop_profile(artisan_qualification=payload))
    assert "artisan_qualification.issuing_body" in errors
    too_long = {**QUALIFICATION, "issuing_body": "J" * 201}
    errors = rejected_fields(workshop_profile(artisan_qualification=too_long))
    assert "artisan_qualification.issuing_body" in errors


def test_qualification_requires_an_end_date() -> None:
    payload = {key: val for key, val in QUALIFICATION.items() if key != "ends_on"}
    errors = rejected_fields(workshop_profile(artisan_qualification=payload))
    assert "artisan_qualification.ends_on" in errors


@pytest.mark.parametrize("ends_on", ["2026-01-01", "2025-12-31"])
def test_qualification_end_must_be_after_start(ends_on: str) -> None:
    errors = rejected_fields(
        workshop_profile(artisan_qualification={**QUALIFICATION, "ends_on": ends_on})
    )
    assert "artisan_qualification.ends_on" in errors


def test_qualification_not_applicable_carries_no_qualification_data() -> None:
    parsed = profile_api().parse_profile_conditions(
        workshop_profile(artisan_qualification=NOT_APPLICABLE)
    )
    assert parsed["artisan_qualification"].issuing_body is None
    errors = rejected_fields(
        workshop_profile(artisan_qualification={**NOT_APPLICABLE, "issuing_body": "Junta"})
    )
    assert "artisan_qualification.issuing_body" in errors


def test_issuing_body_is_only_admitted_for_the_qualification() -> None:
    errors = rejected_fields(
        workshop_profile(accounting_obligation={**declared("NO"), "issuing_body": "Junta"})
    )
    assert "accounting_obligation.issuing_body" in errors


def test_regime_legend_is_derived_from_the_closed_value() -> None:
    api = profile_api()
    assert api.regime_legend("RIMPE_EMPRENDEDOR") == "CONTRIBUYENTE RÉGIMEN RIMPE"
    assert api.regime_legend("GENERAL") is None
    assert api.regime_legend("RIMPE_NEGOCIO_POPULAR") is None
    assert api.regime_legend(None) is None


def test_condition_payload_round_trips_without_empty_fields() -> None:
    api = profile_api()
    parsed = api.parse_profile_conditions(workshop_profile())
    payload = {key: api.condition_payload(condition) for key, condition in parsed.items()}
    assert payload["artisan_qualification"]["ends_on"] == "2028-05-31"
    assert payload["artisan_qualification"]["issuing_body"] == (
        "Junta Nacional de Defensa del Artesano"
    )
    assert "issuing_body" not in payload["accounting_obligation"]
    assert payload["tax_regime"]["starts_on"] == "2026-01-01"
    again = api.parse_profile_conditions(payload)
    assert again == parsed


def _qualification_condition(ends_on: str) -> object:
    api = profile_api()
    parsed = api.parse_profile_conditions(
        workshop_profile(artisan_qualification={**QUALIFICATION, "ends_on": ends_on})
    )
    return parsed["artisan_qualification"]


@pytest.mark.parametrize(
    ("ends_on", "days"),
    [
        ("2026-11-25", 60),
        ("2026-11-26", None),
        ("2026-09-26", 0),
        ("2026-09-25", None),
        ("2026-10-26", 30),
    ],
)
def test_qualification_days_left_only_inside_the_warning_window(
    ends_on: str, days: int | None
) -> None:
    api = profile_api()
    assert api.QUALIFICATION_WARNING_DAYS == 60
    condition = _qualification_condition(ends_on)
    assert api.qualification_days_left(condition, date(2026, 9, 26)) == days


def test_qualification_days_left_ignores_conditions_that_do_not_apply() -> None:
    api = profile_api()
    assert api.qualification_days_left(api.DeclaredCondition("UNKNOWN"), date(2026, 9, 26)) is None
    parsed = api.parse_profile_conditions(workshop_profile(artisan_qualification=NOT_APPLICABLE))
    assert api.qualification_days_left(parsed["artisan_qualification"], date(2026, 9, 26)) is None
