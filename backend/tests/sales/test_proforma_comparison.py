"""Comparación pura entre la copia cotizada y la venta actual, agrupada por producto."""

from decimal import Decimal

from sales.domain.proforma_comparison import ComparedLine, compare

D = Decimal


def line(
    product_id: int,
    quantity: int,
    price: str | None,
    rate: str | None = "15",
    total: str | None = None,
    base: str | None = None,
) -> ComparedLine:
    amount = None if price is None else D(total) if total else D(price) * quantity
    net = None if amount is None else D(base) if base else amount
    return ComparedLine(
        product_id=product_id,
        product_code=f"P{product_id}",
        product_name=f"Producto {product_id}",
        quantity=D(quantity),
        unit_price=None if price is None else D(price),
        tax_rate=None if rate is None else D(rate),
        base_amount=net,
        tax_amount=None if amount is None or net is None else amount - net,
        total_amount=amount,
    )


def by_product(result: dict, product_id: int) -> dict:  # type: ignore[type-arg]
    return next(item for item in result["products"] if item["product_id"] == product_id)


def test_identical_documents_have_no_differences() -> None:
    result = compare([line(1, 2, "10.00")], [line(1, 2, "10.00")])
    assert result["has_differences"] is False
    assert by_product(result, 1)["status"] == "UNCHANGED"
    assert by_product(result, 1)["changes"] == []
    assert result["totals"]["difference"] == "0.00"


def test_price_from_ten_to_twelve_shows_both_values_and_totals() -> None:
    result = compare([line(1, 1, "10.00")], [line(1, 1, "12.00")])
    item = by_product(result, 1)
    assert (item["status"], item["changes"]) == ("CHANGED", ["unit_price"])
    assert (item["quoted"]["unit_price"], item["current"]["unit_price"]) == ("10.00", "12.00")
    assert result["totals"]["quoted"]["total"] == "10.00"
    assert result["totals"]["current"]["total"] == "12.00"
    assert result["totals"]["difference"] == "2.00"
    assert result["has_differences"] is True


def test_tax_change_keeps_the_final_price_and_changes_the_breakdown() -> None:
    quoted = line(1, 1, "11.50", "15", total="11.50", base="10.00")
    current = line(1, 1, "11.50", "12", total="11.50", base="10.27")
    result = compare([quoted], [current])
    item = by_product(result, 1)
    assert item["changes"] == ["tax_rate"]
    assert (item["quoted"]["tax_rate"], item["current"]["tax_rate"]) == ("15", "12")
    assert (item["quoted"]["tax_amount"], item["current"]["tax_amount"]) == ("1.50", "1.23")
    assert item["quoted"]["unit_price"] == item["current"]["unit_price"] == "11.50"
    assert result["totals"]["difference"] == "0.00"
    assert result["has_differences"] is True


def test_removed_and_added_lines_are_separated() -> None:
    result = compare(
        [line(1, 1, "10.00"), line(2, 1, "5.00")], [line(1, 1, "10.00"), line(3, 2, "4.00")]
    )
    assert [(p["product_id"], p["status"]) for p in result["products"]] == [
        (1, "UNCHANGED"),
        (2, "REMOVED"),
        (3, "ADDED"),
    ]
    assert by_product(result, 2)["current"] is None
    assert by_product(result, 3)["quoted"] is None
    assert result["totals"]["quoted"]["total"] == "15.00"
    assert result["totals"]["current"]["total"] == "18.00"


def test_repeated_lines_are_aggregated_by_product() -> None:
    quoted = [line(1, 2, "10.00"), line(1, 1, "10.00")]
    current = [line(1, 3, "10.00")]
    same = compare(quoted, current)
    assert by_product(same, 1)["status"] == "UNCHANGED"
    assert by_product(same, 1)["quoted"]["quantity"] == "3"
    assert by_product(same, 1)["quoted"]["total_amount"] == "30.00"
    fewer = compare(quoted, [line(1, 1, "10.00"), line(1, 1, "10.00")])
    assert by_product(fewer, 1)["changes"] == ["quantity"]
    assert (
        by_product(fewer, 1)["quoted"]["quantity"],
        by_product(fewer, 1)["current"]["quantity"],
    ) == (
        "3",
        "2",
    )


def test_quantity_and_price_can_change_together() -> None:
    result = compare([line(1, 3, "10.00")], [line(1, 2, "13.00")])
    assert by_product(result, 1)["changes"] == ["quantity", "unit_price"]


def test_current_line_without_rate_has_no_current_totals() -> None:
    result = compare([line(1, 1, "10.00")], [line(1, 1, None, None)])
    assert result["totals"]["current"] is None
    assert result["totals"]["difference"] is None
    assert by_product(result, 1)["current"]["total_amount"] is None
    assert result["has_differences"] is True


def test_empty_sale_shows_every_quoted_product_removed() -> None:
    result = compare([line(1, 1, "10.00")], [])
    assert by_product(result, 1)["status"] == "REMOVED"
    assert result["totals"]["current"] == {"base": "0.00", "tax": "0.00", "total": "0.00"}
