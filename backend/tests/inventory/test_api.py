"""API HTTP de inventario: existencias, Kardex y operaciones manuales."""

from decimal import Decimal
from typing import Any

import pytest
from rest_framework.test import APIClient

from inventory.application import posting
from inventory.models import InventoryPosition

pytestmark = pytest.mark.django_db
D = Decimal
BASE = "/api/v1/inventory/"


@pytest.fixture
def api(admin: Any) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


@pytest.fixture
def viewer(db: None) -> APIClient:
    """Usuario con inventario.ver pero sin valoración ni ajuste."""
    from django.contrib.auth import get_user_model

    from identity.models import UserRole

    user = get_user_model().objects.create_user(username="inv-viewer", password="x" * 14)
    UserRole.objects.create(user=user, role="ENCARGADO_TALLER")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def payload(product: Any, key: str, **overrides: Any) -> dict[str, Any]:
    return {
        "idempotency_key": key,
        "kind": "INITIAL_LOAD",
        "product_id": product.pk,
        "quantity": "8",
        "unit_cost": "2.50",
        "reason": "Existencia inicial",
        **overrides,
    }


def make_operation(api: APIClient, product: Any, key: str, **overrides: Any) -> dict[str, Any]:
    response = api.post(f"{BASE}operations/", payload(product, key, **overrides), format="json")
    assert response.status_code == 201, response.content
    return dict(response.json())


def confirm(api: APIClient, body: dict[str, Any], key: str) -> dict[str, Any]:
    review = api.post(f"{BASE}operations/{body['id']}/preview/", {}, format="json").json()
    response = api.post(
        f"{BASE}operations/{body['id']}/confirm/",
        {
            "idempotency_key": key,
            "expected_version": body["version"],
            "review_token": review["review_token"],
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    return dict(response.json())


@pytest.fixture
def stocked(api: APIClient, product: Any, warehouse: Any) -> dict[str, Any]:
    return confirm(api, make_operation(api, product, "api-seed-0001"), "api-seed-0002")


class TestStock:
    def test_list_and_item_expose_valuation_only_with_permission(
        self, api: APIClient, viewer: APIClient, stocked: dict[str, Any], product: Any
    ) -> None:
        admin_row = api.get(BASE).json()["results"][0]
        assert (admin_row["average_cost"], admin_row["inventory_value"]) == (
            "2.500000",
            "20.000000",
        )
        row = viewer.get(BASE).json()["results"][0]
        assert row["quantity"] == "8"
        assert not {"average_cost", "inventory_value"} & row.keys()
        item = viewer.get(f"{BASE}products/{product.pk}/")
        assert item.status_code == 200
        assert "inventory_value" not in item.json()
        assert api.get(f"{BASE}products/{product.pk}/").json()["inventory_value"] == "20.000000"

    def test_filters_pagination_and_errors(self, api: APIClient, stocked: dict[str, Any]) -> None:
        assert api.get(f"{BASE}?stock=positive&is_active=all&page=1&page_size=1").status_code == 200
        for query in ("stock=many", "page=0", "page_size=500", "is_active=maybe", "category_id=x"):
            assert api.get(f"{BASE}?{query}").status_code == 400
        assert api.get(f"{BASE}products/999999/").status_code == 404

    def test_no_query_parameter_can_raise_the_projection(
        self, viewer: APIClient, stocked: dict[str, Any], product: Any
    ) -> None:
        for query in ("include_valuation=true", "valuation=1", "expand=cost"):
            response = viewer.get(f"{BASE}?{query}")
            assert response.status_code == 400
            assert response.json()["code"] == "unknown_field"
        assert viewer.get(f"{BASE}products/{product.pk}/?include_valuation=true").status_code == 400


class TestQuantities:
    """Lectura mínima de existencias por producto para las listas de uso diario."""

    URL = f"{BASE}stock/quantities/"

    def test_returns_only_product_and_quantity_without_costs(
        self, viewer: APIClient, stocked: dict[str, Any], product: Any, make_product: Any
    ) -> None:
        other = make_product()
        response = viewer.get(f"{self.URL}?product_ids={product.pk},{other.pk}")
        assert response.status_code == 200
        rows = response.json()["results"]
        assert rows == [
            {"product_id": product.pk, "quantity": "8"},
            {"product_id": other.pk, "quantity": "0"},
        ]
        for row in rows:
            assert set(row) == {"product_id", "quantity"}

    def test_costs_never_travel_even_for_administrators(
        self, api: APIClient, stocked: dict[str, Any], product: Any
    ) -> None:
        body = api.get(f"{self.URL}?product_ids={product.pk}").json()
        assert "average_cost" not in str(body)
        assert "inventory_value" not in str(body)

    def test_requires_inventory_view_permission(self, db: None, product: Any) -> None:
        from django.contrib.auth import get_user_model

        user = get_user_model().objects.create_user(username="sin-inventario", password="x" * 14)
        client = APIClient()
        client.force_authenticate(user=user)
        assert client.get(f"{self.URL}?product_ids={product.pk}").status_code == 403

    def test_does_not_create_positions(self, viewer: APIClient, product: Any) -> None:
        before = InventoryPosition.objects.count()
        response = viewer.get(f"{self.URL}?product_ids={product.pk}")
        assert response.json()["results"] == [{"product_id": product.pk, "quantity": "0"}]
        assert InventoryPosition.objects.count() == before

    def test_rejects_invalid_identifier_lists(self, viewer: APIClient, product: Any) -> None:
        too_many = ",".join(str(n) for n in range(1, 102))
        for query in (
            "",
            "product_ids=",
            "product_ids=abc",
            "product_ids=1,x",
            "product_ids=0",
            "product_ids=-3",
            f"product_ids={too_many}",
            f"product_ids={product.pk}&stock=positive",
        ):
            assert viewer.get(f"{self.URL}?{query}").status_code == 400, query

    def test_ignores_unknown_products_and_repeated_ids(
        self, viewer: APIClient, product: Any
    ) -> None:
        response = viewer.get(f"{self.URL}?product_ids={product.pk},{product.pk},999999")
        assert response.json()["results"] == [{"product_id": product.pk, "quantity": "0"}]


class TestKardex:
    def test_envelope_and_valuation_visibility(
        self, api: APIClient, viewer: APIClient, stocked: dict[str, Any], product: Any
    ) -> None:
        response = api.get(f"{BASE}products/{product.pk}/kardex/?date_from=2020-01-01")
        assert response.status_code == 200
        body = response.json()
        assert {
            "cut",
            "opening_quantity",
            "closing_quantity",
            "period_totals",
            "matching_totals",
            "page_opening_quantity",
            "results",
            "count",
        } <= body.keys()
        assert (body["opening_quantity"], body["closing_quantity"]) == ("0", "8")
        assert body["results"][0]["value_after"] == "20.000000"
        operative = viewer.get(f"{BASE}products/{product.pk}/kardex/").json()
        assert "value_after" not in operative["results"][0]
        assert "opening_value" not in operative

    def test_filters_and_cut_token(
        self, api: APIClient, stocked: dict[str, Any], product: Any
    ) -> None:
        first = api.get(f"{BASE}products/{product.pk}/kardex/?page_size=1").json()
        token = first["cut"]["token"]
        again = api.get(f"{BASE}products/{product.pk}/kardex/?cut_token={token}&page=1&page_size=1")
        assert again.status_code == 200
        stale = api.get(
            f"{BASE}products/{product.pk}/kardex/?cut_token={token}&movement_type=REVERSAL"
        )
        assert (stale.status_code, stale.json()["code"]) == (409, "stale_record")
        for query in (
            "date_from=hoy",
            "movement_type=SALE",
            "source_type=PURCHASE",
            "date_from=2026-02-01&date_to=2026-01-01",
            "actor_id=x",
            "bogus=1",
        ):
            assert api.get(f"{BASE}products/{product.pk}/kardex/?{query}").status_code == 400
        assert api.get(f"{BASE}products/999999/kardex/").status_code == 404


class TestOperations:
    def test_create_list_patch_and_only_prepared_are_editable(
        self, api: APIClient, product: Any, warehouse: Any
    ) -> None:
        body = make_operation(api, product, "api-op-0001")
        assert api.get(f"{BASE}operations/").json()["count"] == 1
        patched = api.patch(
            f"{BASE}operations/{body['id']}/",
            {"idempotency_key": "api-op-0002", "expected_version": 1, "quantity": "9"},
            format="json",
        )
        assert (patched.status_code, patched.json()["quantity"]) == (200, "9")
        done = confirm(api, patched.json(), "api-op-0003")
        assert done["state"] == "POSTED"
        blocked = api.patch(
            f"{BASE}operations/{body['id']}/",
            {
                "idempotency_key": "api-op-0004",
                "expected_version": done["version"],
                "quantity": "1",
            },
            format="json",
        )
        assert (blocked.status_code, blocked.json()["code"]) == (409, "not_editable")

    @pytest.mark.parametrize("kind", ["PURCHASE_RECEIPT", "REVERSAL"])
    def test_purchase_receipts_and_reversals_are_not_accepted(
        self, api: APIClient, product: Any, warehouse: Any, kind: str
    ) -> None:
        response = api.post(
            f"{BASE}operations/", payload(product, "api-op-0005", kind=kind), format="json"
        )
        assert response.status_code == 400
        assert "kind" in response.json()["errors"]

    def test_warehouse_and_entity_cannot_be_chosen_by_the_client(
        self, api: APIClient, product: Any, warehouse: Any
    ) -> None:
        for field in ("warehouse_id", "entity_id"):
            response = api.post(
                f"{BASE}operations/", payload(product, "api-op-0006", **{field: 1}), format="json"
            )
            assert response.status_code == 400
            assert response.json()["code"] == "unknown_field"

    def test_reverse_flow_and_purchase_origin_rejection(
        self, api: APIClient, stocked: dict[str, Any], product: Any, actor: Any, warehouse: Any
    ) -> None:
        preview = api.post(f"{BASE}operations/{stocked['id']}/reverse-preview/", {}, format="json")
        assert preview.status_code == 200
        assert preview.json()["can_reverse"] is True
        reversed_ = api.post(
            f"{BASE}operations/{stocked['id']}/reverse/",
            {
                "idempotency_key": "api-rev-0001",
                "expected_version": stocked["version"],
                "review_token": preview.json()["review_token"],
                "reason": "Error",
            },
            format="json",
        )
        assert (reversed_.status_code, reversed_.json()["state"]) == (200, "REVERSED")
        from django.db import transaction

        from catalog.application.inventory_references import lock_product_references

        with transaction.atomic():
            refs = lock_product_references([product.pk], require_active=False)
            origin = posting.prepare_operation(
                kind="PURCHASE_RECEIPT",
                actor=actor,
                source_type="PURCHASE",
                source_id=5,
                entry_lines=[posting.EntryLine(product.pk, D(1), D("1.00"), (1,))],
            )
            posting.post_operation(origin, posting.lock_positions(refs, warehouse_id=1), refs)
        rejected = api.post(f"{BASE}operations/{origin.pk}/reverse-preview/", {}, format="json")
        assert rejected.status_code == 400
        assert "anulación" in rejected.json()["detail"].lower()

    def test_conflict_codes(self, api: APIClient, stocked: dict[str, Any], product: Any) -> None:
        loaded = api.post(f"{BASE}operations/", payload(product, "api-op-0010"), format="json")
        assert (loaded.status_code, loaded.json()["code"]) == (409, "already_initialized")
        big = make_operation(
            api, product, "api-op-0011", kind="ADJUSTMENT_OUT", quantity="20", unit_cost=None
        )
        review = api.post(f"{BASE}operations/{big['id']}/preview/", {}, format="json").json()
        assert review["can_confirm"] is False
        assert review["issues"][0]["code"] == "insufficient_stock"
        entry = make_operation(
            api, product, "api-op-0012", kind="ADJUSTMENT_IN", quantity="1", unit_cost="2.50"
        )
        confirm(api, entry, "api-op-0013")
        preview = api.post(f"{BASE}operations/{stocked['id']}/reverse-preview/", {}, format="json")
        assert preview.json()["issues"][0]["code"] == "unsafe_reversal"
        attempt = api.post(
            f"{BASE}operations/{stocked['id']}/reverse/",
            {
                "idempotency_key": "api-rev-0002",
                "expected_version": stocked["version"],
                "review_token": "irrelevante",
                "reason": "x",
            },
            format="json",
        )
        assert attempt.status_code in {400, 409}
        InventoryPosition.objects.update(value=D("1.000000"))
        broken = api.post(f"{BASE}operations/{entry['id']}/reverse-preview/", {}, format="json")
        assert broken.json()["issues"][0]["code"] == "inventory_inconsistent"

    def test_detail_projection_is_operative_without_permission_and_economic_with_it(
        self, api: APIClient, viewer: APIClient, stocked: dict[str, Any]
    ) -> None:
        operative = viewer.get(f"{BASE}operations/{stocked['id']}/")
        assert operative.status_code == 200
        text = operative.content.decode()
        for forbidden in (
            "unit_cost",
            "entry_value",
            "average_cost",
            "rounding_adjustment",
            "value_",
        ):
            assert forbidden not in text
        economic = api.get(f"{BASE}operations/{stocked['id']}/").json()
        assert economic["entry_value"] == "20.000000"
        assert economic["movements"][0]["value_after"] == "20.000000"

    def test_manual_actions_need_the_adjust_permission(
        self, viewer: APIClient, stocked: dict[str, Any], product: Any
    ) -> None:
        for method, url in (
            ("get", f"{BASE}operations/"),
            ("post", f"{BASE}operations/"),
            ("patch", f"{BASE}operations/{stocked['id']}/"),
            ("post", f"{BASE}operations/{stocked['id']}/preview/"),
            ("post", f"{BASE}operations/{stocked['id']}/confirm/"),
            ("post", f"{BASE}operations/{stocked['id']}/reverse-preview/"),
            ("post", f"{BASE}operations/{stocked['id']}/reverse/"),
        ):
            assert getattr(viewer, method)(url, {}, format="json").status_code == 403, url


class TestNoDirectBalanceWrites:
    def test_stock_routes_accept_no_writes(
        self, api: APIClient, stocked: dict[str, Any], product: Any
    ) -> None:
        for method in ("post", "put", "patch", "delete"):
            for url in (
                BASE,
                f"{BASE}products/{product.pk}/",
                f"{BASE}products/{product.pk}/kardex/",
            ):
                response = getattr(api, method)(url, {"quantity": "99"}, format="json")
                assert response.status_code in {403, 405}, (method, url)
        assert InventoryPosition.objects.get().quantity == D(8)

    def test_no_writable_stock_field_exists_in_the_catalog_contract(
        self, api: APIClient, product: Any
    ) -> None:
        response = api.patch(
            f"/api/v1/products/{product.pk}/",
            {"expected_version": 1, "idempotency_key": "cat-key-0001", "stock": 50},
            format="json",
        )
        assert response.status_code == 400
        assert InventoryPosition.objects.count() == 0


def test_stock_item_and_kardex_share_the_same_ordinal_for_comparison(
    api: APIClient, stocked: dict[str, Any], product: Any
) -> None:
    item = api.get(f"{BASE}products/{product.pk}/").json()
    kardex = api.get(f"{BASE}products/{product.pk}/kardex/").json()
    assert item["last_ordinal"] == kardex["cut"]["ordinal"]
    assert item["quantity"] == kardex["closing_quantity"]
