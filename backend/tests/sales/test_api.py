"""API HTTP de ventas: rutas, permisos, contrato de campos, listas y errores."""

import uuid
from typing import Any

import pytest
from django.test import Client
from rest_framework.test import APIClient

from customer_registry.models import Customer
from inventory.models import InventoryMovement
from sales.application import reviews, sales
from sales.application.workshop_links import add_linked_line
from sales.models import CommercialPayment, Sale, SaleReturn, SalesCommand
from shared.transactions import RetryableConflictError
from workshop_configuration.models import NumberAllocation, TaxPeriod

from .conftest import _user

pytestmark = pytest.mark.django_db
BASE = "/api/v1/sales/"


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Any) -> None:
    """Contexto comercial, bodega y serie COM-VEN."""


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


def key(prefix: str = "api") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:16]}"


def draft_body(customer: Any, product: Any, quantity: Any = "2", **extra: Any) -> dict[str, Any]:
    return {
        "idempotency_key": key("draft"),
        "customer_id": customer.pk,
        "condition": "CREDITO",
        "lines": [{"product_id": product.pk, "quantity": quantity}],
        **extra,
    }


def made(api: APIClient, customer: Any, product: Any, **extra: Any) -> dict[str, Any]:
    response = api.post(BASE, draft_body(customer, product, **extra), format="json")
    assert response.status_code == 201, response.content
    return dict(response.json())


def confirmed(api: APIClient, draft: dict[str, Any]) -> dict[str, Any]:
    review = api.post(f"{BASE}{draft['id']}/preview/", {}, format="json").json()
    response = api.post(
        f"{BASE}{draft['id']}/confirm/",
        {
            "idempotency_key": key("conf"),
            "expected_version": draft["version"],
            "review_token": review["review_token"],
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    return dict(response.json())


@pytest.fixture
def stocked(product: Any, stock: Any) -> Any:
    stock(product, 20, "80.00")
    return product


def pay_body(amount: str, **extra: Any) -> dict[str, Any]:
    return {
        "operation_id": str(uuid.uuid4()),
        "parts": [{"method": "EFECTIVO", "amount": amount}],
        **extra,
    }


def paid(api: APIClient, sale_id: int, amount: str) -> dict[str, Any]:
    data = pay_body(amount)
    review = api.post(f"{BASE}{sale_id}/payments/preview/", data, format="json").json()
    response = api.post(
        f"{BASE}{sale_id}/payments/",
        {**data, "idempotency_key": key("pay"), "review_token": review["review_token"]},
        format="json",
    )
    assert response.status_code == 201, response.content
    return dict(response.json())


class TestSalesRoutes:
    def test_create_list_retrieve_and_patch_without_delete(
        self, api: APIClient, customer: Any, stocked: Any
    ) -> None:
        body = made(api, customer, stocked)
        assert api.get(BASE).status_code == 200
        detail = api.get(f"{BASE}{body['id']}/")
        assert detail.status_code == 200
        assert detail.json()["lines"][0]["quantity"] == "2"
        patched = api.patch(
            f"{BASE}{body['id']}/",
            {"idempotency_key": key(), "expected_version": 1, "notes": "hola"},
            format="json",
        )
        assert (patched.status_code, patched.json()["version"]) == (200, 2)
        assert api.delete(f"{BASE}{body['id']}/").status_code == 405

    def test_origin_filter_and_field_are_exposed_by_all_sale_reads(
        self,
        seller_api: APIClient,
        seller: Any,
        maintenance_order: Any,
        product: Any,
        stock: Any,
    ) -> None:
        stock(product, 2, "8.00")
        line = add_linked_line(
            actor=seller,
            order_ref=maintenance_order,
            product_id=product.pk,
            quantity="1",
        )
        linked = Sale.objects.get(pk=line.sale_id)
        sales.update_draft(
            actor=seller,
            sale_id=linked.pk,
            payload={
                "idempotency_key": key("linked-edit"),
                "expected_version": linked.version,
                "condition": "CREDITO",
            },
        )
        linked.refresh_from_db()
        review = reviews.preview_confirmation(actor=seller, sale_id=linked.pk)
        sales.confirm_sale(
            actor=seller,
            sale_id=linked.pk,
            payload={
                "idempotency_key": key("linked-conf"),
                "expected_version": linked.version,
                "review_token": review["review_token"],
            },
        )
        expected = {
            "type": "MAINTENANCE",
            "order_id": maintenance_order.pk,
            "order_number": maintenance_order.number,
            "proforma_id": None,
            "proforma_number": None,
        }

        listing = seller_api.get(f"{BASE}?origin=MAINTENANCE")
        assert listing.status_code == 200
        assert listing.json()["results"][0]["origin"] == expected
        assert seller_api.get(f"{BASE}?origin=OTHER").status_code == 400
        assert seller_api.get(f"{BASE}{linked.pk}/").json()["origin"] == expected
        assert seller_api.get(f"{BASE}{linked.pk}/document/").json()["origin"] == expected
        receivables = seller_api.get(f"{BASE}receivables/?origin=MAINTENANCE")
        assert receivables.json()["results"][0]["origin"] == expected

    def test_permissions_ver_and_crear(
        self, seller_api: APIClient, api: APIClient, customer: Any, stocked: Any
    ) -> None:
        workshop = client_for(_user("api-workshop", "ENCARGADO_TALLER"))
        assert workshop.get(BASE).status_code == 403
        assert workshop.post(BASE, draft_body(customer, stocked), format="json").status_code == 403
        assert (
            seller_api.post(BASE, draft_body(customer, stocked), format="json").status_code == 201
        )
        assert Client().get(BASE).status_code in {401, 403}

    def test_preview_and_confirmation_flow_with_required_fields(
        self, api: APIClient, customer: Any, stocked: Any
    ) -> None:
        draft = made(api, customer, stocked)
        before = (Sale.objects.count(), SalesCommand.objects.count())
        capture = api.post(
            f"{BASE}draft-preview/",
            {
                "customer_id": customer.pk,
                "condition": "CREDITO",
                "lines": [{"product_id": stocked.pk, "quantity": "2"}],
            },
            format="json",
        )
        assert capture.status_code == 200
        assert capture.json()["totals"]["total"] == "23.00"
        review = api.post(f"{BASE}{draft['id']}/preview/", {}, format="json")
        assert review.status_code == 200
        assert (Sale.objects.count(), SalesCommand.objects.count()) == before
        assert NumberAllocation.objects.count() == 0
        for missing in ("expected_version", "review_token", "idempotency_key"):
            data = {
                "idempotency_key": key(),
                "expected_version": 1,
                "review_token": review.json()["review_token"],
            }
            del data[missing]
            response = api.post(f"{BASE}{draft['id']}/confirm/", data, format="json")
            assert response.status_code == 400, missing
            assert missing in response.json()["errors"]
        assert confirmed(api, draft)["internal_number"] == "COM-VEN-000001"

    def test_payments_routes(
        self, api: APIClient, seller_api: APIClient, customer: Any, stocked: Any
    ) -> None:
        sale = confirmed(api, made(api, customer, stocked))
        preview = seller_api.post(
            f"{BASE}{sale['id']}/payments/preview/", pay_body("10.00"), format="json"
        )
        assert preview.status_code == 200
        assert preview.json()["can_register"] is True
        payment = paid(seller_api, sale["id"], "10.00")
        assert payment["amount"] == "10.00"
        listing = seller_api.get(f"{BASE}{sale['id']}/payments/")
        assert listing.status_code == 200
        assert len(listing.json()) == 1
        workshop = client_for(_user("api-w2", "ENCARGADO_TALLER"))
        assert workshop.get(f"{BASE}{sale['id']}/payments/").status_code == 403
        assert (
            workshop.post(
                f"{BASE}{sale['id']}/payments/", pay_body("1.00"), format="json"
            ).status_code
            == 403
        )

    def test_corrections_require_the_administrator_and_a_reason(
        self, api: APIClient, seller_api: APIClient, customer: Any, stocked: Any
    ) -> None:
        sale = confirmed(api, made(api, customer, stocked))
        payment = paid(api, sale["id"], "10.00")
        path = f"{BASE}{sale['id']}/payments/{payment['id']}/"
        data = {"operation_id": str(uuid.uuid4()), "reason": "Error"}
        assert seller_api.post(f"{path}correction-preview/", data, format="json").status_code == 403
        assert seller_api.post(f"{path}correct/", data, format="json").status_code == 403
        blank = api.post(f"{path}correction-preview/", {**data, "reason": " "}, format="json")
        assert blank.status_code == 400
        review = api.post(f"{path}correction-preview/", data, format="json")
        assert review.status_code == 200
        done = api.post(
            f"{path}correct/",
            {**data, "idempotency_key": key(), "review_token": review.json()["review_token"]},
            format="json",
        )
        assert (done.status_code, done.json()["state"]) == (200, "CORRECTED")

    def test_returns_and_refunds_routes(
        self,
        api: APIClient,
        seller_api: APIClient,
        customer: Any,
        stocked: Any,
        make_product: Any,
        stock: Any,
    ) -> None:
        priced = make_product(sale_price="20.00")
        stock(priced, 10, "40.00")
        sale = confirmed(api, made(api, customer, priced, quantity="5"))
        paid(api, sale["id"], "100.00")
        line = sale["lines"][0]["id"]
        data = {
            "operation_id": str(uuid.uuid4()),
            "reason": "Producto equivocado",
            "lines": [{"sale_line_id": line, "fit_quantity": "2", "unfit_quantity": "0"}],
        }
        assert (
            seller_api.post(f"{BASE}{sale['id']}/returns/preview/", data, format="json").status_code
            == 403
        )
        review = api.post(f"{BASE}{sale['id']}/returns/preview/", data, format="json")
        assert review.status_code == 200
        created = api.post(
            f"{BASE}{sale['id']}/returns/",
            {**data, "idempotency_key": key(), "review_token": review.json()["review_token"]},
            format="json",
        )
        assert created.status_code == 201
        assert seller_api.get(f"{BASE}{sale['id']}/returns/").status_code == 200
        refund = {
            "operation_id": str(uuid.uuid4()),
            "sale_return_id": created.json()["id"],
            "reason": "Devolución al cliente",
            "parts": [{"method": "EFECTIVO", "amount": "40.00"}],
        }
        preview = api.post(f"{BASE}{sale['id']}/refunds/preview/", refund, format="json")
        assert preview.status_code == 200
        done = api.post(
            f"{BASE}{sale['id']}/refunds/",
            {**refund, "idempotency_key": key(), "review_token": preview.json()["review_token"]},
            format="json",
        )
        assert done.status_code == 201
        assert len(api.get(f"{BASE}{sale['id']}/refunds/").json()) == 1
        assert SaleReturn.objects.count() == 1

    def test_void_with_the_disbursement_payload(
        self, api: APIClient, seller_api: APIClient, customer: Any, stocked: Any
    ) -> None:
        sale = confirmed(api, made(api, customer, stocked, quantity="1"))
        paid(api, sale["id"], "11.50")
        data = {
            "reason": "Error de captura",
            "refund": {
                "operation_id": str(uuid.uuid4()),
                "parts": [{"method": "EFECTIVO", "amount": "11.50"}],
            },
        }
        assert (
            seller_api.post(f"{BASE}{sale['id']}/void-preview/", data, format="json").status_code
            == 403
        )
        review = api.post(f"{BASE}{sale['id']}/void-preview/", data, format="json")
        assert (review.status_code, review.json()["can_void"]) == (200, True)
        done = api.post(
            f"{BASE}{sale['id']}/void/",
            {
                **data,
                "idempotency_key": key(),
                "expected_version": review.json()["version"],
                "review_token": review.json()["review_token"],
            },
            format="json",
        )
        assert (done.status_code, done.json()["state"]) == (200, "VOIDED")

    def test_document_receivables_operations_and_options(
        self, api: APIClient, seller_api: APIClient, customer: Any, stocked: Any
    ) -> None:
        sale = confirmed(api, made(api, customer, stocked, quantity="1"))
        payment = paid(api, sale["id"], "5.00")
        document = seller_api.get(f"{BASE}{sale['id']}/document/")
        assert document.status_code == 200
        assert "SRI" in document.json()["notice"]
        receivables = seller_api.get(f"{BASE}receivables/")
        assert receivables.status_code == 200
        assert receivables.json()["receivable_total"] == "6.50"
        filtered = seller_api.get(f"{BASE}receivables/?condition=CREDITO&only_debt=true")
        assert (filtered.status_code, filtered.json()["count"]) == (200, 1)
        assert seller_api.get(f"{BASE}receivables/?condition=CONTADO").json()["count"] == 0
        assert seller_api.get(f"{BASE}receivables/?condition=FIADO").status_code == 400
        assert seller_api.get(f"{BASE}receivables/?only_debt=si").status_code == 400
        status_ = seller_api.get(f"{BASE}operations/{payment['operation_id']}/")
        assert (status_.status_code, status_.json()["kind"]) == (200, "payment")
        assert seller_api.get(f"{BASE}operations/{uuid.uuid4()}/").status_code == 404
        customers = seller_api.get(f"{BASE}customer-options/?search=Cliente")
        assert customers.status_code == 200
        assert customers.json()["results"][0]["name"] == customer.name
        products = seller_api.get(f"{BASE}product-options/")
        assert products.status_code == 200
        assert products.json()["results"][0]["unit_price"] == "11.50"
        assert "cost" not in str(products.json()).lower()


class TestFieldContract:
    def test_decimals_are_strings_and_binary_numbers_or_booleans_are_rejected(
        self, api: APIClient, customer: Any, stocked: Any
    ) -> None:
        sale = confirmed(api, made(api, customer, stocked, quantity="2"))
        assert sale["grand_total"] == "23.00"
        assert isinstance(sale["lines"][0]["unit_price"], str)
        for bad in (10.5, True, "1e2", "10,50", "10.001"):
            response = api.post(
                f"{BASE}{sale['id']}/payments/preview/",
                pay_body("1.00") | {"parts": [{"method": "EFECTIVO", "amount": bad}]},
                format="json",
            )
            assert response.status_code == 400, bad
        assert (
            api.post(BASE, draft_body(customer, stocked, quantity=1.5), format="json").status_code
            == 400
        )
        assert (
            api.post(BASE, draft_body(customer, stocked, quantity=True), format="json").status_code
            == 400
        )

    @pytest.mark.parametrize(
        "extra",
        [
            {"unit_price": "1.00"},
            {"discount": "0"},
            {"fiscal_date": "2020-01-01"},
            {"tax_rate": "0"},
            {"total": "1.00"},
            {"unit_cost": "1.00"},
            {"balance": "0"},
            {"unknown": 1},
        ],
    )
    def test_foreign_or_forbidden_fields_are_rejected_with_unknown_field(
        self, api: APIClient, customer: Any, stocked: Any, extra: dict[str, Any]
    ) -> None:
        response = api.post(BASE, draft_body(customer, stocked, **extra), format="json")
        assert (response.status_code, response.json()["code"]) == (400, "unknown_field")
        line_level = draft_body(customer, stocked)
        line_level["lines"][0].update(extra)
        nested = api.post(BASE, line_level, format="json")
        assert (nested.status_code, nested.json()["code"]) == (400, "unknown_field")
        assert Sale.objects.count() == 0

    def test_a_non_object_body_is_rejected(self, api: APIClient) -> None:
        assert api.post(BASE, [1, 2], format="json").status_code == 400


class TestLimits:
    def test_line_and_note_limits(self, api: APIClient, customer: Any, stocked: Any) -> None:
        lines = [{"product_id": stocked.pk, "quantity": "1"}] * 201
        assert (
            api.post(
                BASE, {**draft_body(customer, stocked), "lines": lines}, format="json"
            ).status_code
            == 400
        )
        ok = api.post(
            BASE,
            {**draft_body(customer, stocked), "lines": lines[:200], "notes": "x" * 2000},
            format="json",
        )
        assert ok.status_code == 201
        long_note = api.post(BASE, draft_body(customer, stocked, notes="x" * 2001), format="json")
        assert long_note.status_code == 400

    def test_parts_reasons_and_return_lines_limits(
        self, api: APIClient, customer: Any, stocked: Any
    ) -> None:
        sale = confirmed(api, made(api, customer, stocked, quantity="2"))
        three = {
            "operation_id": str(uuid.uuid4()),
            "parts": [
                {"method": "EFECTIVO", "amount": "1.00"},
                {"method": "TRANSFERENCIA", "amount": "1.00"},
                {"method": "EFECTIVO", "amount": "1.00"},
            ],
        }
        assert (
            api.post(f"{BASE}{sale['id']}/payments/preview/", three, format="json").status_code
            == 400
        )
        payment = paid(api, sale["id"], "5.00")
        path = f"{BASE}{sale['id']}/payments/{payment['id']}/correction-preview/"
        for reason in ("", "   ", "x" * 501):
            response = api.post(
                path, {"operation_id": str(uuid.uuid4()), "reason": reason}, format="json"
            )
            assert response.status_code == 400
        trimmed = api.post(
            path, {"operation_id": str(uuid.uuid4()), "reason": "  ok  "}, format="json"
        )
        assert trimmed.status_code == 200
        many = {
            "operation_id": str(uuid.uuid4()),
            "reason": "x",
            "lines": [{"sale_line_id": 1, "fit_quantity": "1", "unfit_quantity": "0"}] * 201,
        }
        assert (
            api.post(f"{BASE}{sale['id']}/returns/preview/", many, format="json").status_code == 400
        )

    def test_patch_distinguishes_omitting_from_clearing_and_replaces_lines_in_order(
        self, api: APIClient, customer: Any, stocked: Any, make_product: Any
    ) -> None:
        other = make_product()
        draft = made(api, customer, stocked, notes="nota")
        omitted = api.patch(
            f"{BASE}{draft['id']}/",
            {"idempotency_key": key(), "expected_version": 1, "condition": "CONTADO"},
            format="json",
        ).json()
        assert omitted["notes"] == "nota"
        assert len(omitted["lines"]) == 1
        replaced = api.patch(
            f"{BASE}{draft['id']}/",
            {
                "idempotency_key": key(),
                "expected_version": 2,
                "notes": "",
                "lines": [
                    {"product_id": other.pk, "quantity": "1"},
                    {"product_id": stocked.pk, "quantity": "3"},
                ],
            },
            format="json",
        ).json()
        assert replaced["notes"] == ""
        assert [(line["position"], line["product_id"]) for line in replaced["lines"]] == [
            (1, other.pk),
            (2, stocked.pk),
        ]
        cleared = api.patch(
            f"{BASE}{draft['id']}/",
            {"idempotency_key": key(), "expected_version": 3, "lines": []},
            format="json",
        ).json()
        assert cleared["lines"] == []


class TestLists:
    def test_envelope_defaults_limits_filters_and_stable_order(
        self, api: APIClient, customer: Any, stocked: Any
    ) -> None:
        second = Customer.objects.create(
            person_type="NATURAL",
            name="Otro",
            identification_type="CI",
            identification="1700000002",
            phone="0999999999",
        )
        for _ in range(3):
            confirmed(api, made(api, customer, stocked, quantity="1"))
        confirmed(api, made(api, second, stocked, quantity="1"))
        body = api.get(BASE).json()
        assert set(body) == {"count", "page", "page_size", "total_pages", "results"}
        assert (body["page"], body["page_size"], body["count"], body["total_pages"]) == (
            1,
            20,
            4,
            1,
        )
        ids = [r["id"] for r in body["results"]]
        assert ids == sorted(ids, reverse=True)
        assert api.get(f"{BASE}?page_size=101").status_code == 400
        assert api.get(f"{BASE}?page=0").status_code == 400
        assert api.get(f"{BASE}?page_size=abc").status_code == 400
        assert api.get(f"{BASE}?state=OTRO").status_code == 400
        assert api.get(f"{BASE}?date_from=ayer").status_code == 400
        assert api.get(f"{BASE}?customer_id={second.pk}").json()["count"] == 1
        assert (
            api.get(f"{BASE}?state=CONFIRMED&page_size=2&page=2").json()["results"][0]["id"]
            < ids[1] + 1
        )
        from sales.application import reviews

        today = reviews.today().isoformat()
        assert api.get(f"{BASE}?date_from={today}&date_to={today}").json()["count"] == 4
        assert api.get(f"{BASE}receivables/?min_age_days=1").json()["count"] == 0
        assert api.get(f"{BASE}receivables/?min_age_days=0").json()["count"] == 4
        assert api.get(f"{BASE}receivables/?min_age_days=-1").status_code == 400


class TestErrors:
    def test_csrf_and_session(self, admin: Any, customer: Any, stocked: Any) -> None:
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
        blocked = csrf_client.post(
            BASE, draft_body(customer, stocked), content_type="application/json"
        )
        assert blocked.status_code == 403
        preview_blocked = csrf_client.post(
            f"{BASE}draft-preview/", {}, content_type="application/json"
        )
        assert preview_blocked.status_code == 403

    def test_problem_json_with_request_id_and_not_found_after_authorizing(
        self, api: APIClient, seller_api: APIClient
    ) -> None:
        missing = api.get(
            f"{BASE}999999/", HTTP_X_REQUEST_ID="00000000-0000-4000-8000-000000000001"
        )
        assert missing.status_code == 404
        assert missing["Content-Type"].startswith("application/problem+json")
        assert missing.json()["request_id"] is not None
        workshop = client_for(_user("api-w3", "ENCARGADO_TALLER"))
        assert workshop.get(f"{BASE}999999/").status_code == 403
        assert api.post(f"{BASE}999999/preview/", {}, format="json").status_code == 404
        assert (
            seller_api.post(
                f"{BASE}999999/void-preview/", {"reason": "x"}, format="json"
            ).status_code
            == 403
        )

    def test_conflicts_use_stable_codes_without_leaking_infrastructure_or_costs(
        self, api: APIClient, customer: Any, stocked: Any
    ) -> None:
        draft = made(api, customer, stocked)
        api.patch(
            f"{BASE}{draft['id']}/",
            {"idempotency_key": key(), "expected_version": 1, "notes": "A"},
            format="json",
        )
        stale = api.patch(
            f"{BASE}{draft['id']}/",
            {"idempotency_key": key(), "expected_version": 1, "notes": "B"},
            format="json",
        )
        assert (stale.status_code, stale.json()["code"]) == (409, "stale_record")
        review = api.post(f"{BASE}{draft['id']}/preview/", {}, format="json").json()
        TaxPeriod.objects.filter(tax_definition=stocked.tax_definition).update(rate=12)
        required = api.post(
            f"{BASE}{draft['id']}/confirm/",
            {
                "idempotency_key": key(),
                "expected_version": 2,
                "review_token": review["review_token"],
            },
            format="json",
        )
        assert (required.status_code, required.json()["code"]) == (409, "review_required")
        payload = draft_body(customer, stocked)
        assert api.post(BASE, payload, format="json").status_code == 201
        reused = api.post(BASE, {**payload, "notes": "otra"}, format="json")
        assert (reused.status_code, reused.json()["code"]) == (409, "idempotency_conflict")
        for response in (stale, required, reused):
            text = response.content.decode().lower()
            assert "traceback" not in text
            assert "psycopg" not in text
            assert "cost" not in text

    def test_state_dependency_and_availability_conflicts(
        self, api: APIClient, customer: Any, stocked: Any, make_product: Any, stock: Any
    ) -> None:
        sale = confirmed(api, made(api, customer, stocked, quantity="1"))
        edit = api.patch(
            f"{BASE}{sale['id']}/", {"idempotency_key": key(), "expected_version": 2}, format="json"
        )
        assert (edit.status_code, edit.json()["code"]) == (409, "not_editable")
        early = api.post(f"{BASE}{sale['id']}/payments/preview/", pay_body("1.00"), format="json")
        assert early.status_code == 200
        draft = made(api, customer, stocked, quantity="1")
        pre = api.post(f"{BASE}{draft['id']}/payments/preview/", pay_body("1.00"), format="json")
        assert pre.json()["issues"][0]["code"] == "invalid_state"
        paid(api, sale["id"], "5.00")
        line = sale["lines"][0]["id"]
        returned = api.post(
            f"{BASE}{sale['id']}/returns/preview/",
            {
                "operation_id": str(uuid.uuid4()),
                "reason": "x",
                "lines": [{"sale_line_id": line, "fit_quantity": "1", "unfit_quantity": "0"}],
            },
            format="json",
        )
        assert returned.status_code == 200
        void = api.post(f"{BASE}{sale['id']}/void-preview/", {"reason": "x"}, format="json")
        assert void.json()["issues"][0]["field"] == "refund"
        scarce = make_product()
        stock(scarce, 1, "4.00")
        first = made(api, customer, scarce, quantity="1")
        second = made(api, customer, scarce, quantity="1")
        confirmed(api, first)
        gone = api.post(f"{BASE}{second['id']}/preview/", {}, format="json").json()
        assert gone["can_confirm"] is False
        assert gone["issues"][0]["code"] == "insufficient_stock"

    def test_retryable_conflicts_become_concurrent_operation(
        self, api: APIClient, monkeypatch: Any
    ) -> None:
        def boom(**kwargs: Any) -> Any:
            raise RetryableConflictError("40P01")

        monkeypatch.setattr("sales.application.sales.create_draft", boom)
        response = api.post(BASE, {"idempotency_key": key()}, format="json")
        assert (response.status_code, response.json()["code"]) == (409, "concurrent_operation")
        assert Sale.objects.count() == 0
        assert CommercialPayment.objects.count() == 0
        assert InventoryMovement.objects.count() == 0


class TestWithholdingRoutes:
    def test_charge_with_withholding_voucher_void_and_pending_list(
        self, api: APIClient, seller_api: APIClient, customer: Any, stocked: Any
    ) -> None:
        sale = confirmed(seller_api, made(seller_api, customer, stocked, quantity="1"))
        total = sale["grand_total"]
        withheld = "2.00"
        money = f"{float(total) - 2:.2f}"
        data = {
            "operation_id": str(uuid.uuid4()),
            "parts": [{"method": "TRANSFERENCIA", "amount": money}],
            "withholding": {"amount": withheld},
        }
        review = seller_api.post(f"{BASE}{sale['id']}/payments/preview/", data, format="json")
        assert review.status_code == 200
        assert review.json()["warning"] is None
        created = seller_api.post(
            f"{BASE}{sale['id']}/payments/",
            {**data, "idempotency_key": key("wh"), "review_token": review.json()["review_token"]},
            format="json",
        )
        assert created.status_code == 201, created.content
        body = created.json()
        assert body["withholding"]["amount"] == withheld
        assert body["money"]["withheld_total"] == withheld
        assert body["money"]["balance"] == "0.00"
        withholding_id = body["withholding"]["id"]

        status = seller_api.get(f"{BASE}operations/{data['operation_id']}/")
        assert status.status_code == 200
        assert status.json()["kind"] == "payment"

        pending = seller_api.get(f"{BASE}withholdings/pending/")
        assert pending.status_code == 200
        assert pending.json()["pending_total"] == withheld
        assert pending.json()["items"][0]["id"] == withholding_id

        route = f"{BASE}{sale['id']}/withholdings/{withholding_id}/"
        voucher = {
            "voucher_number": "001-001-000028564",
            "voucher_date": reviews.today().isoformat(),
        }
        bad = seller_api.post(
            f"{route}voucher/",
            {**voucher, "voucher_number": "1-1-1", "idempotency_key": key("wh")},
            format="json",
        )
        assert bad.status_code == 400
        done = seller_api.post(
            f"{route}voucher/", {**voucher, "idempotency_key": key("wh")}, format="json"
        )
        assert done.status_code == 200
        assert done.json()["voucher_pending"] is False
        assert seller_api.get(f"{BASE}withholdings/pending/").json()["total_count"] == 0

        correction = {
            **voucher,
            "voucher_number": "001-001-000000002",
            "operation_id": str(uuid.uuid4()),
            "reason": "Número mal digitado",
            "idempotency_key": key("wh"),
        }
        denied = seller_api.post(f"{route}voucher-correction/", correction, format="json")
        assert denied.status_code == 403
        corrected = api.post(f"{route}voucher-correction/", correction, format="json")
        assert corrected.status_code == 200
        assert corrected.json()["voucher_number"] == "001-001-000000002"

        void_body = {"reason": "Registrada por error", "idempotency_key": key("wh")}
        assert seller_api.post(f"{route}void/", void_body, format="json").status_code == 403
        voided = api.post(f"{route}void/", void_body, format="json")
        assert voided.status_code == 200
        assert voided.json()["state"] == "VOIDED"
        assert voided.json()["money"]["balance"] == withheld

        history = seller_api.get(f"{BASE}{sale['id']}/withholdings/")
        assert [row["state"] for row in history.json()] == ["VOIDED"]
        again = api.post(
            f"{route}void/", {**void_body, "idempotency_key": key("wh")}, format="json"
        )
        assert again.status_code == 409

    def test_withholding_alone_warning_and_operation_status(
        self, seller_api: APIClient, customer: Any, stocked: Any
    ) -> None:
        sale = confirmed(
            seller_api, made(seller_api, customer, stocked, quantity="1", condition="CREDITO")
        )
        amount = f"{float(sale['grand_total']) / 2:.2f}"
        withholding: dict[str, Any] = {"amount": amount}
        data: dict[str, Any] = {"operation_id": str(uuid.uuid4()), "withholding": withholding}
        review = seller_api.post(f"{BASE}{sale['id']}/payments/preview/", data, format="json")
        assert review.json()["can_register"] is False
        assert review.json()["issues"][0]["code"] == "withholding_warning"
        assert review.json()["warning"]["percentage"] == "20.00"
        rejected = seller_api.post(
            f"{BASE}{sale['id']}/payments/", {**data, "idempotency_key": key("wh")}, format="json"
        )
        assert rejected.status_code == 409
        assert rejected.json()["code"] == "withholding_warning"

        withholding["acknowledged"] = True
        review = seller_api.post(f"{BASE}{sale['id']}/payments/preview/", data, format="json")
        created = seller_api.post(
            f"{BASE}{sale['id']}/payments/",
            {**data, "idempotency_key": key("wh"), "review_token": review.json()["review_token"]},
            format="json",
        )
        assert created.status_code == 201, created.content
        assert created.json()["payment_id"] is None
        status = seller_api.get(f"{BASE}operations/{data['operation_id']}/")
        assert status.json()["kind"] == "withholding"

    def test_pending_list_is_denied_without_the_permission(self, actor: Any) -> None:
        assert client_for(actor).get(f"{BASE}withholdings/pending/").status_code == 403
