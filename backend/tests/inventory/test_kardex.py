"""Kardex por producto: corte estable, saldos del período, filtros y paginación."""

import time
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from django.db import connection, transaction
from django.test.utils import CaptureQueriesContext

from catalog.application.inventory_references import lock_product_references
from inventory.application import posting, queries
from inventory.application.errors import InventoryApplicationError

D = Decimal
GYE = ZoneInfo("America/Guayaquil")
pytestmark = pytest.mark.django_db


def local(year: int, month: int, day: int, hour: int = 12, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=GYE).astimezone(UTC)


class Ledger:
    """Registra movimientos manuales con la hora efectiva controlada."""

    def __init__(self, actor: Any, warehouse: Any, product: Any, monkeypatch: Any) -> None:
        self.actor, self.warehouse, self.product, self.mp = actor, warehouse, product, monkeypatch

    def move(self, kind: str, quantity: int, when: datetime, cost: str = "2.00") -> Any:
        self.mp.setattr(posting, "_now", lambda: when)
        with transaction.atomic():
            refs = lock_product_references([self.product.pk], require_active=False)
            args: dict[str, Any] = (
                {
                    "entry_lines": [
                        posting.EntryLine(self.product.pk, D(quantity), D(cost) * quantity)
                    ]
                }
                if kind.endswith("_IN")
                else {"exit_lines": [posting.ExitLine(self.product.pk, D(quantity))]}
            )
            operation = posting.prepare_operation(
                kind=kind, actor=self.actor, source_type="", source_id=None, **args
            )
            posting.post_operation(
                operation, posting.lock_positions(refs, warehouse_id=self.warehouse.pk), refs
            )
        return operation


@pytest.fixture
def ledger(actor: Any, warehouse: Any, product: Any, monkeypatch: Any) -> Ledger:
    return Ledger(actor, warehouse, product, monkeypatch)


@pytest.fixture
def september(ledger: Ledger) -> Ledger:
    ledger.move("ADJUSTMENT_IN", 10, local(2026, 8, 31))
    ledger.move("ADJUSTMENT_IN", 5, local(2026, 9, 5))
    ledger.move("ADJUSTMENT_OUT", 3, local(2026, 9, 6))
    return ledger


def kardex(product: Any, **filters: Any) -> dict[str, Any]:
    filters.setdefault("date_from", date(2026, 9, 1))
    filters.setdefault("date_to", date(2026, 9, 30))
    return queries.kardex(product_id=product.pk, include_valuation=False, **filters)


def balances(result: dict[str, Any]) -> list[str]:
    return [row["quantity_after"] for row in result["results"]]


class TestPeriodBalances:
    def test_opening_rows_and_closing_balances(self, september: Ledger, product: Any) -> None:
        result = kardex(product)
        assert result["opening_quantity"] == "10"
        assert balances(result) == ["15", "12"]
        assert result["closing_quantity"] == "12"
        assert result["period_totals"]["quantity_in"] == "5"
        assert result["period_totals"]["quantity_out"] == "3"
        assert result["count"] == 2

    def test_a_filter_hiding_an_entry_keeps_the_real_balance(
        self, september: Ledger, product: Any
    ) -> None:
        result = kardex(product, movement_type="ADJUSTMENT_OUT")
        assert balances(result) == ["12"]  # nunca 7: no se suman solo las filas visibles
        assert result["opening_quantity"] == "10"
        assert result["closing_quantity"] == "12"
        assert result["matching_totals"]["quantity_in"] == "0"
        assert result["matching_totals"]["quantity_out"] == "3"
        assert result["period_totals"]["quantity_in"] == "5"
        assert result["period_totals"]["quantity_out"] == "3"

    def test_opening_uses_the_last_movement_before_the_limit_never_filtered_rows(
        self, september: Ledger, product: Any
    ) -> None:
        result = kardex(product, movement_type="ADJUSTMENT_IN", date_from=date(2026, 9, 6))
        assert result["opening_quantity"] == "15"
        assert result["results"] == []

    def test_period_without_movements_and_product_without_history(
        self, september: Ledger, product: Any, make_product: Any
    ) -> None:
        empty = kardex(product, date_from=date(2026, 10, 1), date_to=date(2026, 10, 31))
        assert (empty["opening_quantity"], empty["closing_quantity"]) == ("12", "12")
        assert empty["results"] == []
        assert empty["page_opening_quantity"] is None
        assert empty["period_totals"]["quantity_in"] == "0"
        blank = queries.kardex(product_id=make_product().pk, include_valuation=False)
        assert (blank["opening_quantity"], blank["closing_quantity"]) == ("0", "0")
        assert blank["count"] == 0

    def test_filter_without_matches_keeps_the_period_effects(
        self, september: Ledger, product: Any
    ) -> None:
        result = kardex(product, source_type="PURCHASE", source_id=999)
        assert result["results"] == []
        assert result["page_opening_quantity"] is None
        assert result["matching_totals"]["quantity_in"] == "0"
        assert result["period_totals"]["quantity_in"] == "5"

    def test_valuation_is_only_present_when_authorized(
        self, september: Ledger, product: Any
    ) -> None:
        operative = kardex(product)
        assert not any(
            key in row
            for row in operative["results"]
            for key in ("value_after", "applied_unit_cost")
        )
        assert "value_in" not in operative["period_totals"]
        economic = queries.kardex(
            product_id=product.pk,
            include_valuation=True,
            date_from=date(2026, 9, 1),
            date_to=date(2026, 9, 30),
        )
        assert economic["results"][0]["value_after"] == "30.000000"
        assert economic["opening_value"] == "20.000000"
        assert economic["period_totals"]["value_in"] == "10.000000"


class TestPagination:
    @pytest.fixture
    def long_history(self, ledger: Ledger) -> Ledger:
        ledger.move("ADJUSTMENT_IN", 10, local(2026, 8, 31))
        ledger.move("ADJUSTMENT_IN", 5, local(2026, 9, 5))
        ledger.move("ADJUSTMENT_OUT", 3, local(2026, 9, 6))
        ledger.move("ADJUSTMENT_IN", 2, local(2026, 9, 7))
        return ledger

    def test_second_page_shows_the_running_balance_and_its_opening(
        self, long_history: Ledger, product: Any
    ) -> None:
        second = kardex(product, page=2, page_size=2)
        assert balances(second) == ["14"]
        assert second["page_opening_quantity"] == "12"
        assert (second["page"], second["total_pages"], second["count"]) == (2, 2, 3)

    def test_filtered_page_with_hidden_intermediates(self, ledger: Ledger, product: Any) -> None:
        ledger.move("ADJUSTMENT_IN", 5, local(2026, 9, 2))
        ledger.move("ADJUSTMENT_OUT", 2, local(2026, 9, 3))  # oculto por el filtro
        ledger.move("ADJUSTMENT_IN", 4, local(2026, 9, 4))
        page = kardex(product, movement_type="ADJUSTMENT_IN", page=2, page_size=1)
        assert balances(page) == ["7"]
        assert page["page_opening_quantity"] == "3"

    def test_full_traversal_returns_each_match_exactly_once(
        self, long_history: Ledger, product: Any
    ) -> None:
        first = kardex(product, page_size=1)
        seen = list(first["results"])
        for number in range(2, first["total_pages"] + 1):
            seen += kardex(product, page=number, page_size=1, cut_token=first["cut"]["token"])[
                "results"
            ]
        assert [row["ordinal"] for row in seen] == [2, 3, 4]

    def test_new_movements_after_the_cut_do_not_appear_on_later_pages(
        self, long_history: Ledger, product: Any
    ) -> None:
        first = kardex(product, page_size=2)
        long_history.move("ADJUSTMENT_IN", 9, local(2026, 9, 8))
        later = kardex(product, page=2, page_size=2, cut_token=first["cut"]["token"])
        assert [row["ordinal"] for row in later["results"]] == [4]
        assert later["count"] == 3
        assert later["closing_quantity"] == "14"
        fresh = kardex(product, page_size=2)
        assert fresh["count"] == 4


class TestCut:
    def test_token_is_bound_to_product_and_filters_and_expires(
        self, september: Ledger, product: Any, make_product: Any, monkeypatch: Any
    ) -> None:
        first = kardex(product)
        token = first["cut"]["token"]
        assert first["cut"]["expires_in_seconds"] == 1800
        with pytest.raises(InventoryApplicationError) as other_filter:
            kardex(product, movement_type="ADJUSTMENT_IN", cut_token=token)
        assert other_filter.value.code == "stale_record"
        with pytest.raises(InventoryApplicationError) as other_product:
            queries.kardex(product_id=make_product().pk, include_valuation=False, cut_token=token)
        assert other_product.value.code == "stale_record"
        page_only = kardex(product, page=1, page_size=1, cut_token=token)  # página no invalida
        assert page_only["cut"]["ordinal"] == first["cut"]["ordinal"]
        real = time.time()
        monkeypatch.setattr(time, "time", lambda: real + 31 * 60)
        with pytest.raises(InventoryApplicationError) as expired:
            kardex(product, cut_token=token)
        assert expired.value.code == "stale_record"

    def test_token_carries_no_costs_or_personal_data(self, september: Ledger, product: Any) -> None:
        from django.core import signing

        payload = signing.loads(kardex(product)["cut"]["token"], salt=queries.CUT_SALT)
        assert set(payload) <= {"p", "w", "f", "o", "t"}

    @pytest.mark.django_db(transaction=True)
    def test_first_statement_configures_repeatable_read_before_any_query(
        self, ledger: Ledger, product: Any
    ) -> None:
        ledger.move("ADJUSTMENT_IN", 1, local(2026, 9, 5))
        with CaptureQueriesContext(connection) as captured:
            queries.kardex(product_id=product.pk, include_valuation=False)
        statements = [q["sql"] for q in captured.captured_queries if q["sql"] != "BEGIN"]
        assert statements[0].startswith("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        assert not any("FOR UPDATE" in sql for sql in statements)


class TestDatesAndValidation:
    def test_local_day_ranges_are_inclusive_and_converted_to_utc(
        self, ledger: Ledger, product: Any
    ) -> None:
        ledger.move("ADJUSTMENT_IN", 1, local(2026, 9, 30, 23, 30))  # 04:30Z del 1 de octubre
        ledger.move("ADJUSTMENT_IN", 1, local(2026, 10, 1, 0, 30))
        september = kardex(product)
        assert [row["ordinal"] for row in september["results"]] == [1]
        october = kardex(product, date_from=date(2026, 10, 1), date_to=None)
        assert [row["ordinal"] for row in october["results"]] == [2]

    def test_unilateral_limits(self, september: Ledger, product: Any) -> None:
        only_from = queries.kardex(
            product_id=product.pk, include_valuation=False, date_from=date(2026, 9, 6)
        )
        assert balances(only_from) == ["12"]
        only_to = queries.kardex(
            product_id=product.pk, include_valuation=False, date_to=date(2026, 8, 31)
        )
        assert balances(only_to) == ["10"]
        assert only_to["closing_quantity"] == "10"

    @pytest.mark.parametrize(
        ("filters", "field"),
        [
            ({"date_from": date(2026, 10, 1), "date_to": date(2026, 9, 1)}, "date_from"),
            ({"movement_type": "SALE"}, "movement_type"),
            ({"source_type": "PURCHASE"}, "source_id"),
            ({"source_id": 3}, "source_type"),
            ({"page": 0}, "page"),
            ({"page_size": 101}, "page_size"),
        ],
    )
    def test_invalid_input_is_a_correctable_error(
        self, product: Any, filters: dict[str, Any], field: str
    ) -> None:
        with pytest.raises(InventoryApplicationError) as error:
            queries.kardex(product_id=product.pk, include_valuation=False, **filters)
        assert error.value.code == "validation_error"
        assert field in error.value.errors

    def test_unknown_product_is_not_found(self) -> None:
        with pytest.raises(InventoryApplicationError) as error:
            queries.kardex(product_id=987_654, include_valuation=False)
        assert error.value.code == "not_found"


class TestOrderingAndQueries:
    def test_same_hour_keeps_ordinal_order(self, ledger: Ledger, product: Any) -> None:
        same = local(2026, 9, 5)
        for _ in range(3):
            ledger.move("ADJUSTMENT_IN", 1, same)
        assert [row["ordinal"] for row in kardex(product)["results"]] == [1, 2, 3]

    def test_no_n_plus_one_in_rows_and_summaries(self, ledger: Ledger, product: Any) -> None:
        for day in range(1, 4):
            ledger.move("ADJUSTMENT_IN", 1, local(2026, 9, day))
        with CaptureQueriesContext(connection) as few:
            kardex(product, page_size=100)
        for day in range(4, 25):
            ledger.move("ADJUSTMENT_IN", 1, local(2026, 9, day))
        with CaptureQueriesContext(connection) as many:
            result = kardex(product, page_size=100)
        assert len(result["results"]) == 24
        assert len(many) == len(few)


class TestReversedOperations:
    def test_original_and_compensation_both_remain_and_link_to_each_other(
        self, ledger: Ledger, product: Any, actor: Any, warehouse: Any
    ) -> None:
        original = ledger.move("ADJUSTMENT_IN", 5, local(2026, 9, 5))
        refs = lock_product_references([product.pk], require_active=False)
        with transaction.atomic():
            ledger.mp.setattr(posting, "_now", lambda: local(2026, 9, 6))
            posting.reverse_operation(
                original,
                actor=actor,
                source_type="MANUAL_VOID",
                source_id=None,
                reason="Error",
                locked=posting.lock_positions(refs, warehouse_id=warehouse.pk),
                product_refs=refs,
            )
        rows = kardex(product)["results"]
        assert [r["movement_type"] for r in rows] == ["ADJUSTMENT_IN", "REVERSAL"]
        assert [r["quantity_after"] for r in rows] == ["5", "0"]
        assert rows[1]["quantity_out"] == "5"  # la compensación no borra ni altera el original
