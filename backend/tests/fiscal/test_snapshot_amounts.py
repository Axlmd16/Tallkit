"""Representación fiscal de importes: precio unitario sin impuestos y coherencia.

Conserva los importes históricos (precios con impuesto incluido, base redondeada a
centavos) sin recalcular la operación ni introducir ajustes.
"""

import pytest


def _line(**overrides: object) -> dict[str, object]:
    line = {
        "position": 1,
        "quantity": "1",
        "base_amount": "10.00",
        "tax_amount": "1.50",
        "total_amount": "11.50",
        "tax_rate": "15",
        "tax_code": "2",
        "percentage_code": "4",
    }
    line.update(overrides)
    return line


def test_unit_price_without_tax_uses_six_decimals() -> None:
    from fiscal.domain.snapshot_amounts import build_amounts

    result = build_amounts(
        lines=[_line(quantity="3", base_amount="10.00", tax_amount="1.50", total_amount="11.50")],
        base_total="10.00",
        tax_total="1.50",
        grand_total="11.50",
    )
    line = result.lines[0]
    # 10.00 / 3 = 3.333333 (escala 6, HALF_UP)
    assert line.unit_price_without_tax == "3.333333"
    assert line.base_amount == "10.00"


def test_line_coherence_base_plus_tax_equals_total() -> None:
    from fiscal.domain.snapshot_amounts import SnapshotImpedimentError, build_amounts

    with pytest.raises(SnapshotImpedimentError) as exc:
        build_amounts(
            lines=[_line(base_amount="10.00", tax_amount="1.50", total_amount="12.00")],
            base_total="10.00",
            tax_total="1.50",
            grand_total="12.00",
        )
    fields = {imp["field"] for imp in exc.value.impediments}
    assert any("line[1]" in field for field in fields)


def test_multiple_lines_same_rate_group_together() -> None:
    from fiscal.domain.snapshot_amounts import build_amounts

    result = build_amounts(
        lines=[
            _line(position=1, base_amount="10.00", tax_amount="1.50", total_amount="11.50"),
            _line(position=2, base_amount="20.00", tax_amount="3.00", total_amount="23.00"),
        ],
        base_total="30.00",
        tax_total="4.50",
        grand_total="34.50",
    )
    assert len(result.tax_groups) == 1
    group = result.tax_groups[0]
    assert group.percentage_code == "4"
    assert group.base_amount == "30.00"
    assert group.tax_amount == "4.50"


def test_distinct_treatments_stay_in_separate_groups_even_when_zero() -> None:
    from fiscal.domain.snapshot_amounts import build_amounts

    result = build_amounts(
        lines=[
            # Tarifa 0%
            _line(
                position=1,
                base_amount="10.00",
                tax_amount="0.00",
                total_amount="10.00",
                tax_rate="0",
                percentage_code="0",
            ),
            # No objeto de IVA
            _line(
                position=2,
                base_amount="5.00",
                tax_amount="0.00",
                total_amount="5.00",
                tax_rate="0",
                percentage_code="6",
            ),
        ],
        base_total="15.00",
        tax_total="0.00",
        grand_total="15.00",
    )
    codes = {group.percentage_code for group in result.tax_groups}
    assert codes == {"0", "6"}
    assert all(group.tax_amount == "0.00" for group in result.tax_groups)


def test_document_total_mismatch_by_one_cent_blocks() -> None:
    from fiscal.domain.snapshot_amounts import SnapshotImpedimentError, build_amounts

    with pytest.raises(SnapshotImpedimentError) as exc:
        build_amounts(
            lines=[_line(base_amount="20.00", tax_amount="3.00", total_amount="23.00")],
            base_total="20.00",
            tax_total="3.00",
            grand_total="23.01",  # difiere en un centavo del historico
        )
    fields = {imp["field"] for imp in exc.value.impediments}
    assert "grand_total" in fields
    detail = next(imp for imp in exc.value.impediments if imp["field"] == "grand_total")
    assert detail["expected"] == "23.00"
    assert detail["observed"] == "23.01"


def test_fractional_quantity_is_supported() -> None:
    from fiscal.domain.snapshot_amounts import build_amounts

    result = build_amounts(
        lines=[
            _line(
                quantity="2.5",
                base_amount="25.00",
                tax_amount="3.75",
                total_amount="28.75",
            )
        ],
        base_total="25.00",
        tax_total="3.75",
        grand_total="28.75",
    )
    # 25.00 / 2.5 = 10.000000
    assert result.lines[0].unit_price_without_tax == "10.000000"


def test_insufficient_precision_blocks_with_line_and_difference() -> None:
    from fiscal.domain.snapshot_amounts import SnapshotImpedimentError, build_amounts

    # Con escala 6 el precio unitario solo pierde el centavo en cantidades grandes:
    # 1.00 / 30000 = 0.000033 (6 dec, HALF_UP); 0.000033 * 30000 = 0.99 != 1.00.
    with pytest.raises(SnapshotImpedimentError) as exc:
        build_amounts(
            lines=[
                _line(
                    quantity="30000",
                    base_amount="1.00",
                    tax_amount="0.00",
                    total_amount="1.00",
                    tax_rate="0",
                    percentage_code="0",
                )
            ],
            base_total="1.00",
            tax_total="0.00",
            grand_total="1.00",
        )
    fields = {imp["field"] for imp in exc.value.impediments}
    assert any("line[1]" in field and "unit_price" in field for field in fields)


def test_amounts_are_decimal_strings() -> None:
    from fiscal.domain.snapshot_amounts import build_amounts

    result = build_amounts(
        lines=[_line()],
        base_total="10.00",
        tax_total="1.50",
        grand_total="11.50",
    )
    assert result.base_total == "10.00"
    assert result.tax_total == "1.50"
    assert result.grand_total == "11.50"
    assert isinstance(result.lines[0].unit_price_without_tax, str)
