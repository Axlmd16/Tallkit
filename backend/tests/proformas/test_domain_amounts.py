"""Importes de la oferta: desglose inclusivo por línea sobre el núcleo monetario compartido."""

import ast
from decimal import Decimal
from pathlib import Path

from proformas.domain.amounts import OfferLine, compose_offer

SRC = Path(__file__).resolve().parents[2] / "src"


def test_inclusive_breakdown_of_the_offer() -> None:
    offer = compose_offer([OfferLine(1, 10, Decimal(2), Decimal("11.50"), Decimal("15"))])
    assert offer.totals is not None
    assert (offer.totals.total, offer.totals.base, offer.totals.tax) == (
        Decimal("23.00"),
        Decimal("20.00"),
        Decimal("3.00"),
    )


def test_rounding_is_per_line_and_the_document_sums_lines() -> None:
    offer = compose_offer(
        [
            OfferLine(1, 10, Decimal(1), Decimal("0.03"), Decimal("20")),
            OfferLine(2, 11, Decimal(1), Decimal("0.03"), Decimal("20")),
        ]
    )
    assert offer.totals is not None
    assert (offer.totals.base, offer.totals.tax, offer.totals.total) == (
        Decimal("0.06"),
        Decimal("0.00"),
        Decimal("0.06"),
    )
    assert [line.amounts.base for line in offer.lines if line.amounts] == [
        Decimal("0.03"),
        Decimal("0.03"),
    ]


def test_missing_rate_is_an_impediment_not_an_exemption() -> None:
    offer = compose_offer([OfferLine(1, 10, Decimal(1), Decimal("10.00"), None)])
    assert offer.totals is None
    assert offer.lines[0].amounts is None
    assert offer.lines[0].error


def test_configured_zero_rate_is_valid() -> None:
    offer = compose_offer([OfferLine(1, 10, Decimal(3), Decimal("10.00"), Decimal("0"))])
    assert offer.totals is not None
    assert (offer.totals.base, offer.totals.tax) == (Decimal("30.00"), Decimal("0.00"))


def test_offer_without_lines_has_no_totals() -> None:
    assert compose_offer([]).totals is None


def test_amounts_reuse_the_shared_core_without_floats() -> None:
    tree = ast.parse((SRC / "proformas/domain/amounts.py").read_text(encoding="utf-8"))
    imported = {
        node.module for node in ast.walk(tree) if isinstance(node, ast.ImportFrom) and node.module
    }
    assert "shared.money" in imported
    assert not [n for n in ast.walk(tree) if isinstance(n, ast.Name) and n.id == "float"]
    assert not [
        n for n in ast.walk(tree) if isinstance(n, ast.Constant) and isinstance(n.value, float)
    ]
    arithmetic = (ast.Mult, ast.Div, ast.Add, ast.Sub)
    assert not [
        n for n in ast.walk(tree) if isinstance(n, ast.BinOp) and isinstance(n.op, arithmetic)
    ], "sin fórmulas propias"
