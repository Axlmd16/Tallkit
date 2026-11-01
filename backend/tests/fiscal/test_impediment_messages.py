"""Los impedimentos de configuración nombran la condición afectada y apuntan al Administrador."""

import pytest

from fiscal.application.impediment_messages import ADMINISTRATOR, classify


def _config(code: str) -> dict[str, str]:
    return classify(
        {"field": f"config.{code}", "message": "La configuración fiscal no está lista."}
    )


@pytest.mark.parametrize(
    ("code", "label", "fragment"),
    [
        ("conditions.large_taxpayer.unknown", "Gran contribuyente", "no la ha declarado"),
        ("conditions.special_taxpayer.unknown", "Contribuyente especial", "no la ha declarado"),
        (
            "conditions.withholding_agent.invalid_format",
            "Agente de retención",
            "ya no cumple el formato",
        ),
        ("conditions.tax_regime.expired", "Régimen tributario", "vigencia"),
        (
            "conditions.accounting_obligation.future",
            "Obligación de llevar contabilidad",
            "vigencia",
        ),
    ],
)
def test_condition_impediment_names_the_condition_and_what_is_wrong(
    code: str, label: str, fragment: str
) -> None:
    result = _config(code)
    assert result["audience"] == ADMINISTRATOR
    assert result["code"] == code
    assert label in result["message"]
    assert fragment in result["message"]
    assert "Configuración, pestaña Facturación electrónica" in result["message"]


def test_unknown_condition_key_still_gets_a_generic_message_for_the_administrator() -> None:
    result = _config("conditions.otra.unknown")
    assert result["audience"] == ADMINISTRATOR
    assert "condición tributaria" in result["message"]
