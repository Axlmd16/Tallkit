"""API HTTP de entradas: rutas, permisos, contrato, proyección por rol, listas y errores."""

from datetime import timedelta
from typing import Any

import pytest
from django.test import Client
from django.utils import timezone
from rest_framework.test import APIClient

from purchasing.models import Purchase
from shared.transactions import RetryableConflictError

from .test_models import make_identity, make_purchase

pytestmark = pytest.mark.django_db
BASE = "/api/v1/purchases/"
ENTRIES = f"{BASE}entries/"
RETIRED = ("preview/", "confirm/", "replacement/")


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Any) -> None:
    """Contexto comercial, bodega y serie COM-ING."""


def client_for(user: Any) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def api(admin: Any) -> APIClient:
    return client_for(admin)


@pytest.fixture
def seller_api(seller: Any) -> APIClient:
    return client_for(seller)


_counter = iter(range(1, 100_000))


def entry_body(product: Any, quantity: str = "2", cost: str | None = None, **extra: Any) -> Any:
    line: dict[str, Any] = {"product_id": product.pk, "quantity": quantity}
    if cost is not None:
        line["unit_cost"] = cost
    return {"idempotency_key": f"entry-key-{next(_counter):06d}", "lines": [line], **extra}


def register(client: APIClient, product: Any, **kwargs: Any) -> dict[str, Any]:
    response = client.post(ENTRIES, entry_body(product, **kwargs), format="json")
    assert response.status_code == 201, response.content
    return dict(response.json())


class TestRoutes:
    def test_the_seller_reviews_registers_lists_and_reads(
        self, seller_api: APIClient, product: Any
    ) -> None:
        review = seller_api.post(
            f"{ENTRIES}review/",
            {"lines": [{"product_id": product.pk, "quantity": "2"}]},
            format="json",
        )
        assert review.status_code == 200
        assert review.json()["summary"] == {"products": 1, "units": 2}
        body = register(seller_api, product)
        assert body["internal_number"] == "COM-ING-000001"
        assert seller_api.get(BASE).json()["count"] == 1
        assert seller_api.get(f"{BASE}{body['id']}/").status_code == 200

    def test_the_administrator_voids_with_a_reviewed_token(
        self, api: APIClient, seller_api: APIClient, product: Any
    ) -> None:
        body = register(seller_api, product, quantity="3", cost="2.00")
        preview = api.post(f"{BASE}{body['id']}/void-preview/", {}, format="json")
        assert preview.status_code == 200
        token = preview.json()["review_token"]
        missing_reason = api.post(
            f"{BASE}{body['id']}/void/",
            {
                "idempotency_key": "void-key-0001",
                "expected_version": body["version"],
                "review_token": token,
            },
            format="json",
        )
        assert missing_reason.status_code == 400
        assert "reason" in missing_reason.json()["errors"]
        voided = api.post(
            f"{BASE}{body['id']}/void/",
            {
                "idempotency_key": "void-key-0002",
                "expected_version": body["version"],
                "review_token": token,
                "reason": "Error de captura",
            },
            format="json",
        )
        assert voided.status_code == 200
        assert voided.json()["state"] == "VOIDED"

    @pytest.mark.parametrize("suffix", RETIRED)
    def test_the_routes_of_the_previous_flow_no_longer_exist(
        self, api: APIClient, product: Any, suffix: str
    ) -> None:
        body = register(api, product)
        assert api.post(f"{BASE}{body['id']}/{suffix}", {}, format="json").status_code == 404
        assert api.patch(f"{BASE}{body['id']}/", {}, format="json").status_code == 405
        assert api.post(BASE, {}, format="json").status_code == 405
        assert api.get(f"{BASE}tax-options/").status_code == 404

    def test_each_route_hides_data_from_the_workshop_manager(
        self, manager: Any, api: APIClient, product: Any
    ) -> None:
        body = register(api, product)
        client = client_for(manager)
        for method, url in (
            ("get", BASE),
            ("post", ENTRIES),
            ("post", f"{ENTRIES}review/"),
            ("get", f"{BASE}{body['id']}/"),
            ("post", f"{BASE}{body['id']}/void-preview/"),
            ("post", f"{BASE}{body['id']}/void/"),
        ):
            assert getattr(client, method)(url, {}, format="json").status_code == 403, url

    def test_the_seller_cannot_void_even_his_own_entry(
        self, seller_api: APIClient, product: Any
    ) -> None:
        body = register(seller_api, product)
        preview = seller_api.post(f"{BASE}{body['id']}/void-preview/", {}, format="json")
        assert preview.status_code == 403
        assert seller_api.post(f"{BASE}{body['id']}/void/", {}, format="json").status_code == 403


class TestRoleProjection:
    def test_the_seller_never_receives_costs_in_any_response(
        self, seller_api: APIClient, product: Any, supplier: Any
    ) -> None:
        body = register(
            seller_api,
            product,
            quantity="2",
            cost="4.50",
            supplier_id=supplier.pk,
            reference="F-1",
        )
        views = [
            body,
            seller_api.get(f"{BASE}{body['id']}/").json(),
            seller_api.get(BASE).json(),
            seller_api.post(
                f"{ENTRIES}review/",
                {"lines": [{"product_id": product.pk, "quantity": "2", "unit_cost": "4.50"}]},
                format="json",
            ).json(),
        ]
        for view in views:
            text = str(view)
            for forbidden in (
                "4.50",
                "unit_cost",
                "cost_registered",
                "amounts",
                "legacy",
                "'total'",
                "inventory_value",
            ):
                assert forbidden not in text, (forbidden, text)
            assert "identification" not in text
        assert views[1]["supplier"] == {"id": supplier.pk, "name": supplier.name}

    def test_the_administrator_sees_costs_and_tells_no_cost_from_zero(
        self, api: APIClient, seller_api: APIClient, product: Any, make_product: Any
    ) -> None:
        other = make_product()
        payload = {
            "idempotency_key": "entry-key-900001",
            "lines": [
                {"product_id": product.pk, "quantity": "2", "unit_cost": "4.50"},
                {"product_id": other.pk, "quantity": "1"},
            ],
        }
        body = seller_api.post(ENTRIES, payload, format="json").json()
        detail = api.get(f"{BASE}{body['id']}/").json()
        first, second = detail["lines"]
        assert (first["cost_registered"], first["unit_cost"]) == (True, "4.500000")
        assert (second["cost_registered"], second["unit_cost"]) == (False, None)
        zero = register(api, make_product(), cost="0")
        assert api.get(f"{BASE}{zero['id']}/").json()["lines"][0]["cost_registered"] is True

    def test_a_legacy_draft_is_visible_only_to_the_administrator(
        self, api: APIClient, seller_api: APIClient, supplier: Any, admin: Any
    ) -> None:
        draft = make_purchase(make_identity(supplier), admin)
        assert api.get(f"{BASE}{draft.pk}/").status_code == 200
        assert api.get(f"{BASE}{draft.pk}/").json()["legacy"]["is_pending_draft"] is True
        assert seller_api.get(f"{BASE}{draft.pk}/").status_code == 404
        assert seller_api.get(f"{BASE}?state=DRAFT").json()["count"] == 0
        assert api.get(f"{BASE}?state=DRAFT").json()["count"] == 1

    def test_a_reference_to_a_supplier_is_kept_without_private_data(
        self, seller_api: APIClient, product: Any, supplier: Any
    ) -> None:
        body = register(seller_api, product, supplier_id=supplier.pk)
        assert body["supplier"] == {"id": supplier.pk, "name": supplier.name}


class TestFieldContract:
    def test_unknown_fields_and_client_totals_are_rejected(
        self, seller_api: APIClient, product: Any
    ) -> None:
        response = seller_api.post(
            ENTRIES,
            entry_body(product, grand_total="1.00", document_date="2026-01-01"),
            format="json",
        )
        assert response.status_code == 400
        assert response.json()["code"] == "unknown_field"

    def test_line_limit_and_line_field_paths(self, seller_api: APIClient, product: Any) -> None:
        lines = [{"product_id": product.pk, "quantity": "1"}] * 201
        response = seller_api.post(
            ENTRIES, {"idempotency_key": "entry-key-910001", "lines": lines}, format="json"
        )
        assert response.status_code == 400
        assert "lines" in response.json()["errors"]
        bad = seller_api.post(
            ENTRIES,
            {
                "idempotency_key": "entry-key-910002",
                "lines": [{"product_id": product.pk, "quantity": "0"}],
            },
            format="json",
        )
        assert "lines.0.quantity" in bad.json()["errors"]

    def test_the_idempotency_key_is_required(self, seller_api: APIClient, product: Any) -> None:
        payload = entry_body(product)
        payload.pop("idempotency_key")
        response = seller_api.post(ENTRIES, payload, format="json")
        assert response.status_code == 400
        assert "idempotency_key" in response.json()["errors"]

    def test_body_must_be_a_json_object(self, seller_api: APIClient) -> None:
        assert seller_api.post(ENTRIES, [1, 2], format="json").status_code == 400


class TestLists:
    def test_envelope_order_and_filters(
        self,
        api: APIClient,
        seller_api: APIClient,
        seller: Any,
        admin: Any,
        make_product: Any,
        supplier: Any,
    ) -> None:
        first = register(seller_api, make_product(), reference="A-1", supplier_id=supplier.pk)
        second = register(api, make_product(), reference="B-2")
        page = api.get(BASE).json()
        assert set(page) == {
            "count",
            "page",
            "page_size",
            "total_pages",
            "results",
            "registered_by_options",
        }
        assert (page["page"], page["page_size"], page["count"]) == (1, 20, 2)
        assert [row["id"] for row in page["results"]] == [second["id"], first["id"]]
        row = page["results"][1]
        assert (row["product_count"], row["unit_count"]) == (1, "2")
        assert row["registered_by"]["id"] == seller.pk
        assert {o["id"] for o in page["registered_by_options"]} == {seller.pk, admin.pk}
        assert api.get(f"{BASE}?registered_by={seller.pk}").json()["count"] == 1
        assert api.get(f"{BASE}?state=CONFIRMED").json()["count"] == 2
        assert api.get(f"{BASE}?state=VOIDED").json()["count"] == 0
        assert api.get(f"{BASE}?search=A-1").json()["count"] == 1
        assert api.get(f"{BASE}?search={supplier.name[:4]}").json()["count"] == 1
        assert api.get(f"{BASE}?search=COM-ING-000002").json()["count"] == 1
        assert api.get(f"{BASE}?supplier_id={supplier.pk}").json()["count"] == 1

    def test_the_period_filter_uses_the_local_day_of_confirmation(
        self, api: APIClient, product: Any
    ) -> None:
        register(api, product)
        today = timezone.localdate()
        assert api.get(f"{BASE}?date_from={today}&date_to={today}").json()["count"] == 1
        yesterday = today - timedelta(days=1)
        assert api.get(f"{BASE}?date_to={yesterday}").json()["count"] == 0
        assert api.get(f"{BASE}?date_from={today + timedelta(days=1)}").json()["count"] == 0

    @pytest.mark.parametrize(
        "query",
        [
            "page=0",
            "page_size=101",
            "page_size=0",
            "state=OPEN",
            "date_from=ayer",
            "supplier_id=x",
            "registered_by=x",
        ],
    )
    def test_invalid_query_is_a_400(self, api: APIClient, query: str) -> None:
        assert api.get(f"{BASE}?{query}").status_code == 400

    def test_pages(self, api: APIClient, make_product: Any) -> None:
        for _ in range(3):
            register(api, make_product())
        second = api.get(f"{BASE}?page=2&page_size=2").json()
        assert (len(second["results"]), second["total_pages"]) == (1, 2)


class TestErrors:
    def test_unauthenticated_and_csrf(self, admin: Any, product: Any) -> None:
        assert Client().get(BASE).status_code in {401, 403}
        csrf_client = Client(enforce_csrf_checks=True)
        admin.set_password("Clave-segura-2026")
        admin.save()
        csrf_client.get("/api/v1/auth/csrf/")
        token = csrf_client.cookies["csrftoken"].value
        login = csrf_client.post(
            "/api/v1/auth/login/",
            {"username": admin.username, "password": "Clave-segura-2026"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        assert login.status_code == 200
        blocked = csrf_client.post(ENTRIES, entry_body(product), content_type="application/json")
        assert blocked.status_code == 403

    def test_not_found_is_returned_after_authorizing(self, api: APIClient) -> None:
        assert api.get(f"{BASE}999999/").status_code == 404
        assert api.post(f"{BASE}999999/void-preview/", {}, format="json").status_code == 404

    def test_conflicts_use_stable_codes(self, api: APIClient, product: Any) -> None:
        payload = entry_body(product)
        assert api.post(ENTRIES, payload, format="json").status_code == 201
        reused = api.post(ENTRIES, {**payload, "reference": "otro"}, format="json")
        assert (reused.status_code, reused.json()["code"]) == (409, "idempotency_conflict")
        duplicate = api.post(ENTRIES, entry_body(product), format="json")
        assert (duplicate.status_code, duplicate.json()["code"]) == (409, "possible_duplicate")
        first_id = Purchase.objects.get().pk
        acknowledged = api.post(
            ENTRIES, entry_body(product, acknowledged_entry_ids=[first_id]), format="json"
        )
        assert acknowledged.status_code == 201

    def test_configuration_errors_are_conflicts(self, api: APIClient, product: Any) -> None:
        from workshop_configuration.models import DocumentSeries

        DocumentSeries.objects.all().delete()
        response = api.post(ENTRIES, entry_body(product), format="json")
        assert (response.status_code, response.json()["code"]) == (409, "configuration_missing")

    def test_retryable_conflicts_become_concurrent_operation(
        self, api: APIClient, monkeypatch: Any
    ) -> None:
        def boom(**kwargs: Any) -> Any:
            raise RetryableConflictError("40P01")

        monkeypatch.setattr("purchasing.application.entries.register_entry", boom)
        response = api.post(ENTRIES, {"idempotency_key": "any-key-00001"}, format="json")
        assert (response.status_code, response.json()["code"]) == (409, "concurrent_operation")
        assert Purchase.objects.count() == 0
