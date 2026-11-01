"""Ensamble del snapshot fiscal versionado e independiente de datos maestros."""

from typing import Any, cast

import pytest

from fiscal.domain.payment_declaration import PaymentDeclaration, validate_payment_declaration
from fiscal.domain.receiver import FiscalReceiver, parse_receiver


def _issuer(**overrides: object) -> dict[str, object]:
    issuer: dict[str, object] = {
        "ruc": "0991234567001",
        "legal_name": "Comercial Andina S.A.",
        "trade_name": "Andina",
        "address": "Av. Siempre Viva 123",
        "establishment_address": "Sucursal Centro 45",
        "establishment_code": "001",
        "emission_point_code": "001",
        "environment": "1",
    }
    issuer.update(overrides)
    return issuer


def _tax_profile(**overrides: object) -> dict[str, object]:
    profile: dict[str, object] = {"regime": "GENERAL", "accounting_obligation": "NO"}
    profile.update(overrides)
    return profile


def _receiver() -> FiscalReceiver:
    return parse_receiver(
        {
            "identification_type": "04",
            "identification": "0999999999001",
            "legal_name": "Cliente Fiscal S.A.",
            "address": "Calle 10",
        }
    )


def _lines() -> list[dict[str, object]]:
    return [
        {
            "position": 1,
            "item_code": "SERV-001",
            "description": "Servicio sintético",
            "quantity": "1",
            "base_amount": "10.00",
            "tax_amount": "1.50",
            "total_amount": "11.50",
            "tax_rate": "15",
            "tax_code": "2",
            "percentage_code": "4",
        }
    ]


def _payments() -> PaymentDeclaration:
    return validate_payment_declaration(
        condition="CONTADO",
        forms=[{"payment_code": "01", "amount": "11.50"}],
        total="11.50",
        enabled_codes=("01", "20"),
    )


def test_snapshot_is_assembled_with_schema_version_and_decimal_strings() -> None:
    from fiscal.domain.snapshot import SCHEMA_VERSION, build_snapshot

    snapshot = build_snapshot(
        issuer=_issuer(),
        receiver=_receiver(),
        lines=_lines(),
        base_total="10.00",
        tax_total="1.50",
        grand_total="11.50",
        payments=_payments(),
        reference_date="2026-09-25",
        catalog_versions={"iva": "2024-04"},
        tax_profile=_tax_profile(),
        additional_info=[{"name": "Placa", "value": "PBA1234"}],
    )

    assert snapshot["schema_version"] == SCHEMA_VERSION
    assert snapshot["currency"] == "USD"
    assert snapshot["reference_date"] == "2026-09-25"
    assert snapshot["issuer"]["ruc"] == "0991234567001"
    assert snapshot["receiver"]["identification"] == "0999999999001"
    assert snapshot["totals"]["grand"] == "11.50"
    assert snapshot["lines"][0]["unit_price_without_tax"] == "10.000000"
    assert snapshot["lines"][0]["item_code"] == "SERV-001"
    assert snapshot["lines"][0]["description"] == "Servicio sintético"
    assert snapshot["catalog_versions"] == {"iva": "2024-04"}


def test_missing_issuer_field_blocks_with_impediment() -> None:
    from fiscal.domain.snapshot import build_snapshot
    from fiscal.domain.snapshot_amounts import SnapshotImpedimentError

    with pytest.raises(SnapshotImpedimentError) as exc:
        build_snapshot(
            issuer=_issuer(establishment_code=""),
            receiver=_receiver(),
            lines=_lines(),
            base_total="10.00",
            tax_total="1.50",
            grand_total="11.50",
            payments=_payments(),
            reference_date="2026-09-25",
            catalog_versions={"iva": "2024-04"},
            tax_profile=_tax_profile(),
            additional_info=[],
        )
    fields = {imp["field"] for imp in exc.value.impediments}
    assert "issuer.establishment_code" in fields


def test_empty_lines_block() -> None:
    from fiscal.domain.snapshot import build_snapshot
    from fiscal.domain.snapshot_amounts import SnapshotImpedimentError

    with pytest.raises(SnapshotImpedimentError):
        build_snapshot(
            issuer=_issuer(),
            receiver=_receiver(),
            lines=[],
            base_total="0.00",
            tax_total="0.00",
            grand_total="0.00",
            payments=_payments(),
            reference_date="2026-09-25",
            catalog_versions={},
            tax_profile=_tax_profile(),
            additional_info=[],
        )


def test_credit_snapshot_keeps_configuration_and_payment_details() -> None:
    from fiscal.domain.snapshot import SNAPSHOT_FORMAT, build_snapshot

    credit = validate_payment_declaration(
        condition="CREDITO",
        forms=[{"payment_code": "20", "amount": "11.50"}],
        total="11.50",
        enabled_codes=("01", "20"),
    )
    snapshot = build_snapshot(
        issuer=_issuer(),
        receiver=_receiver(),
        lines=_lines(),
        base_total="10.00",
        tax_total="1.50",
        grand_total="11.50",
        payments=credit,
        reference_date="2026-09-25",
        catalog_versions={"iva": "SRI-2.34-TABLA17"},
        tax_profile=_tax_profile(),
        additional_info=[],
        configuration={"profile_revision": 3, "point": {"code": "001", "version": 2}},
        payment_details={"20": {"display_name": "Transferencia", "catalog_version": "T24"}},
        line_details={1: {"display_name": "IVA 15 %"}},
    )
    assert snapshot["snapshot_format"] == SNAPSHOT_FORMAT
    assert snapshot["configuration"]["profile_revision"] == 3
    assert snapshot["payments"] == [
        {
            "payment_code": "20",
            "amount": "11.50",
            "display_name": "Transferencia",
            "catalog_version": "T24",
        }
    ]
    assert "term_days" not in snapshot["payments"][0]
    assert snapshot["lines"][0]["display_name"] == "IVA 15 %"


def test_amount_impediments_propagate() -> None:
    from fiscal.domain.snapshot import build_snapshot
    from fiscal.domain.snapshot_amounts import SnapshotImpedimentError

    with pytest.raises(SnapshotImpedimentError) as exc:
        build_snapshot(
            issuer=_issuer(),
            receiver=_receiver(),
            lines=_lines(),
            base_total="10.00",
            tax_total="1.50",
            grand_total="99.99",  # incoherente
            payments=_payments(),
            reference_date="2026-09-25",
            catalog_versions={},
            tax_profile=_tax_profile(),
            additional_info=[],
        )
    assert any(imp["field"] == "grand_total" for imp in exc.value.impediments)


def test_invalid_reference_date_blocks() -> None:
    from fiscal.domain.snapshot import build_snapshot
    from fiscal.domain.snapshot_amounts import SnapshotImpedimentError

    with pytest.raises(SnapshotImpedimentError) as exc:
        build_snapshot(
            issuer=_issuer(),
            receiver=_receiver(),
            lines=_lines(),
            base_total="10.00",
            tax_total="1.50",
            grand_total="11.50",
            payments=_payments(),
            reference_date="25-09-2026",
            catalog_versions={},
            tax_profile=_tax_profile(),
            additional_info=[],
        )
    assert any(imp["field"] == "reference_date" for imp in exc.value.impediments)


def test_snapshot_does_not_leak_operational_customer_fields() -> None:
    from fiscal.domain.snapshot import build_snapshot

    snapshot = build_snapshot(
        issuer=_issuer(),
        receiver=_receiver(),
        lines=_lines(),
        base_total="10.00",
        tax_total="1.50",
        grand_total="11.50",
        payments=_payments(),
        reference_date="2026-09-25",
        catalog_versions={},
        tax_profile=_tax_profile(),
        additional_info=[],
    )
    # El receptor fiscal es propio; no se copia el identificador del cliente operativo.
    assert set(snapshot["receiver"].keys()) == {
        "identification_type",
        "identification",
        "legal_name",
        "address",
        "email",
    }


def _build(**overrides: object) -> dict[str, object]:
    from fiscal.domain.snapshot import build_snapshot

    arguments: dict[str, object] = {
        "issuer": _issuer(),
        "receiver": _receiver(),
        "lines": _lines(),
        "base_total": "10.00",
        "tax_total": "1.50",
        "grand_total": "11.50",
        "payments": _payments(),
        "reference_date": "2026-09-25",
        "catalog_versions": {"iva": "2024-04"},
        "tax_profile": _tax_profile(),
        "additional_info": [],
    }
    arguments.update(overrides)
    return build_snapshot(**arguments)  # type: ignore[arg-type]


def test_snapshot_format_four_keeps_the_issuer_tax_profile_and_no_text_legends() -> None:
    from fiscal.domain.snapshot import SNAPSHOT_FORMAT

    profile = _tax_profile(
        regime="RIMPE_EMPRENDEDOR",
        regime_legend="CONTRIBUYENTE RÉGIMEN RIMPE",
        artisan_qualification={
            "number": "JNDA-12345",
            "issuing_body": "Junta Nacional de Defensa del Artesano",
            "ends_on": "2028-05-31",
        },
    )
    snapshot = _build(tax_profile=profile)
    assert SNAPSHOT_FORMAT == 4
    assert snapshot["snapshot_format"] == 4
    assert snapshot["issuer"]["tax_profile"] == profile  # type: ignore[index]
    assert snapshot["legends"] == []
    assert snapshot["issuer"]["ruc"] == "0991234567001"  # type: ignore[index]


def test_issuer_tax_profile_is_a_copy_independent_of_the_input() -> None:
    profile = _tax_profile()
    snapshot = _build(tax_profile=profile)
    profile["regime"] = "RIMPE_NEGOCIO_POPULAR"
    assert snapshot["issuer"]["tax_profile"]["regime"] == "GENERAL"  # type: ignore[index]


@pytest.mark.parametrize("missing", ["regime", "accounting_obligation"])
def test_tax_profile_without_regime_or_accounting_blocks_with_an_impediment(
    missing: str,
) -> None:
    from fiscal.domain.snapshot_amounts import SnapshotImpedimentError

    profile = _tax_profile()
    del profile[missing]
    with pytest.raises(SnapshotImpedimentError) as exc:
        _build(tax_profile=profile)
    assert f"issuer.tax_profile.{missing}" in {imp["field"] for imp in exc.value.impediments}


# --- Formato 4: emisor completo, plazo y detalle (DP-035) ---------------------------------------


def test_the_issuer_keeps_the_trade_name_and_both_addresses() -> None:
    snapshot = _build()
    issuer = snapshot["issuer"]
    assert issuer["trade_name"] == "Andina"  # type: ignore[index]
    assert issuer["address"] == "Av. Siempre Viva 123"  # type: ignore[index]
    assert issuer["establishment_address"] == "Sucursal Centro 45"  # type: ignore[index]


def test_an_issuer_without_trade_name_omits_it_instead_of_using_the_legal_name() -> None:
    issuer = _issuer()
    del issuer["trade_name"]
    snapshot = _build(issuer=issuer)
    assert "trade_name" not in snapshot["issuer"]  # type: ignore[operator]


def test_a_missing_establishment_address_blocks_without_inventing_one() -> None:
    from fiscal.domain.snapshot_amounts import SnapshotImpedimentError

    with pytest.raises(SnapshotImpedimentError) as exc:
        _build(issuer=_issuer(establishment_address=""))
    assert "issuer.establishment_address" in {i["field"] for i in exc.value.impediments}


def test_the_large_taxpayer_resolution_and_the_popular_business_legend_are_kept() -> None:
    profile = _tax_profile(
        regime="RIMPE_NEGOCIO_POPULAR",
        regime_legend="CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE",
        large_taxpayer_resolution="NAC-GCFOIOC21-00000868-E",
    )
    stored = _build(tax_profile=profile)["issuer"]["tax_profile"]  # type: ignore[index]
    assert stored == profile


def _credit(*forms: tuple[str, str]) -> PaymentDeclaration:
    total = sum(float(amount) for _, amount in forms)
    return validate_payment_declaration(
        condition="CREDITO",
        forms=[{"payment_code": code, "amount": amount} for code, amount in forms],
        total=f"{total:.2f}",
        enabled_codes=("01", "20"),
    )


def test_only_the_forms_flagged_carry_the_term_and_its_unit() -> None:
    declaration = _credit(("01", "5.00"), ("20", "6.50"))
    snapshot = _build(payments=declaration, term_days=30, term_form_indexes=(1,))
    first, second = cast(list[dict[str, Any]], snapshot["payments"])
    assert "term_days" not in first
    assert "time_unit" not in first
    assert (second["term_days"], second["time_unit"]) == (30, "dias")


def test_without_a_term_no_form_carries_one() -> None:
    snapshot = _build(payments=_credit(("20", "11.50")), term_days=None, term_form_indexes=())
    assert all("term_days" not in form for form in snapshot["payments"])  # type: ignore[attr-defined]


def test_a_term_without_forms_to_carry_it_is_not_kept_anywhere() -> None:
    snapshot = _build(payments=_credit(("20", "11.50")), term_days=30, term_form_indexes=())
    assert all("term_days" not in form for form in snapshot["payments"])  # type: ignore[attr-defined]


def test_additional_info_is_kept_as_validated_pairs() -> None:
    pairs = [{"name": "Vehículo", "value": "Placa PCM4567"}]
    assert _build(additional_info=pairs)["additional_info"] == pairs
