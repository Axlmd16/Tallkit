"""Perfiles del emisor válidos en el formato 2, compartidos por las pruebas fiscales."""

from typing import Any

SOURCE = "Certificado de RUC"
STARTS_ON = "2026-01-01"


def applicable(value: str, **extra: str) -> dict[str, str]:
    return {
        "status": "APPLICABLE",
        "value": value,
        "source": SOURCE,
        "starts_on": STARTS_ON,
        **extra,
    }


def not_applicable() -> dict[str, str]:
    return {"status": "NOT_APPLICABLE", "source": SOURCE, "starts_on": STARTS_ON}


def qualification(
    ends_on: str = "2028-05-31", number: str = "JNDA-12345", starts_on: str = STARTS_ON
) -> dict[str, str]:
    return applicable(
        number,
        issuing_body="Junta Nacional de Defensa del Artesano",
        starts_on=starts_on,
        ends_on=ends_on,
    )


def profile_conditions(**overrides: dict[str, str]) -> dict[str, Any]:
    """Régimen General, contabilidad NO y ninguna otra condición aplicable (DP-035, regla 5)."""
    conditions: dict[str, Any] = {
        "tax_regime": applicable("GENERAL"),
        "accounting_obligation": applicable("NO"),
        "withholding_agent": not_applicable(),
        "special_taxpayer": not_applicable(),
        "large_taxpayer": not_applicable(),
        "artisan_qualification": not_applicable(),
    }
    conditions.update(overrides)
    return conditions
