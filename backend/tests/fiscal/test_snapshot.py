"""Ensamble del snapshot fiscal versionado e independiente de datos maestros."""

import pytest

from fiscal.domain.payment_declaration import validate_payment_declaration
from fiscal.domain.receiver import parse_receiver


def _issuer(**overrides: object) -> dict[str, object]:
    issuer = {
        "ruc": "0991234567001",
        "legal_name": "Comercial Andina S.A.",
        "trade_name": "Andina",
        "address": "Av. Siempre Viva 123",
        "establishment_code": "001",
        "emission_point_code": "001",
        "environment": "1",
    }
    issuer.update(overrides)
    return issuer


def _receiver() -> object:
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
            "quantity": "1",
            "base_amount": "10.00",
            "tax_amount": "1.50",
            "total_amount": "11.50",
            "tax_rate": "15",
            "tax_code": "2",
            "percentage_code": "4",
        }
    ]


def _payments() -> object:
    return validate_payment_declaration(
        condition="CONTADO",
        forms=[{"payment_code": "01", "amount": "11.50"}],
        total="11.50",
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
        legends=["Contribuyente especial"],
        additional_info=[{"name": "Placa", "value": "PBA1234"}],
    )

    assert snapshot["schema_version"] == SCHEMA_VERSION
    assert snapshot["currency"] == "USD"
    assert snapshot["reference_date"] == "2026-09-25"
    assert snapshot["issuer"]["ruc"] == "0991234567001"
    assert snapshot["receiver"]["identification"] == "0999999999001"
    assert snapshot["totals"]["grand"] == "11.50"
    assert snapshot["lines"][0]["unit_price_without_tax"] == "10.000000"
    assert snapshot["catalog_versions"] == {"iva": "2024-04"}


def test_missing_issuer_field_blocks_with_impediment() -> None:
    from fiscal.domain.snapshot import SnapshotImpedimentError, build_snapshot

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
            legends=[],
            additional_info=[],
        )
    fields = {imp["field"] for imp in exc.value.impediments}
    assert "issuer.establishment_code" in fields


def test_empty_lines_block() -> None:
    from fiscal.domain.snapshot import SnapshotImpedimentError, build_snapshot

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
            legends=[],
            additional_info=[],
        )


def test_pending_payment_data_blocks_snapshot() -> None:
    from fiscal.domain.snapshot import SnapshotImpedimentError, build_snapshot

    credit_without_term = validate_payment_declaration(
        condition="CREDITO",
        forms=[{"payment_code": "20", "amount": "11.50"}],
        total="11.50",
    )
    with pytest.raises(SnapshotImpedimentError) as exc:
        build_snapshot(
            issuer=_issuer(),
            receiver=_receiver(),
            lines=_lines(),
            base_total="10.00",
            tax_total="1.50",
            grand_total="11.50",
            payments=credit_without_term,
            reference_date="2026-09-25",
            catalog_versions={},
            legends=[],
            additional_info=[],
        )
    assert any("payment" in imp["field"] for imp in exc.value.impediments)


def test_amount_impediments_propagate() -> None:
    from fiscal.domain.snapshot import SnapshotImpedimentError, build_snapshot

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
            legends=[],
            additional_info=[],
        )
    assert any(imp["field"] == "grand_total" for imp in exc.value.impediments)


def test_invalid_reference_date_blocks() -> None:
    from fiscal.domain.snapshot import SnapshotImpedimentError, build_snapshot

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
            legends=[],
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
        legends=[],
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
