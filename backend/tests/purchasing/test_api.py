"""API HTTP de compras: rutas, permisos, contrato de campos, listas y errores."""

from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework.test import APIClient

from identity.models import UserRole
from purchasing.models import Purchase
from shared.transactions import RetryableConflictError
from workshop_configuration.models import ConfigurationUse, NumberAllocation, TaxPeriod

pytestmark = pytest.mark.django_db
BASE = "/api/v1/purchases/"


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Any) -> None:
    """Contexto comercial, bodega y serie COM-ING."""


@pytest.fixture
def api(admin: Any) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


def created(api: APIClient, payload: dict[str, Any]) -> dict[str, Any]:
    response = api.post(BASE, payload, format="json")
    assert response.status_code == 201, response.content
    return dict(response.json())


def confirmed_body(api: APIClient, draft: dict[str, Any], key: str) -> dict[str, Any]:
    review = api.post(f"{BASE}{draft['id']}/preview/", {}, format="json").json()
    response = api.post(
        f"{BASE}{draft['id']}/confirm/",
        {
            "idempotency_key": key,
            "expected_version": draft["version"],
            "review_token": review["review_token"],
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    return dict(response.json())


class TestRoutesAndPermissions:
    def test_create_list_retrieve_and_patch(
        self, api: APIClient, draft_payload: Any, commercial: Any, product: Any, line: Any
    ) -> None:
        body = created(api, draft_payload([line(product, commercial["ten"])]))
        assert api.get(BASE).status_code == 200
        detail = api.get(f"{BASE}{body['id']}/")
        assert detail.status_code == 200
        assert detail.json()["totals"]["total"] == "22.00"
        patched = api.patch(
            f"{BASE}{body['id']}/",
            {"idempotency_key": "patch-key-0001", "expected_version": 1, "notes": "hola"},
            format="json",
        )
        assert patched.status_code == 200
        assert patched.json()["version"] == 2

    def test_confirmation_flow_and_required_fields(
        self, api: APIClient, draft_payload: Any, commercial: Any, product: Any, line: Any
    ) -> None:
        draft = created(api, draft_payload([line(product, commercial["ten"])]))
        review = api.post(f"{BASE}{draft['id']}/preview/", {}, format="json")
        assert review.status_code == 200
        for payload, field in (
            ({"expected_version": 1, "review_token": "x"}, "idempotency_key"),
            ({"idempotency_key": "conf-key-0001", "review_token": "x"}, "expected_version"),
            ({"idempotency_key": "conf-key-0001", "expected_version": 1}, "review_token"),
        ):
            response = api.post(f"{BASE}{draft['id']}/confirm/", payload, format="json")
            assert response.status_code == 400
            assert field in response.json()["errors"]
        done = confirmed_body(api, draft, "conf-key-0002")
        assert done["state"] == "CONFIRMED"
        assert done["internal_number"] == "COM-ING-000001"

    def test_void_replacement_and_reason(
        self, api: APIClient, draft_payload: Any, commercial: Any, product: Any, line: Any
    ) -> None:
        draft = created(api, draft_payload([line(product, commercial["ten"])]))
        done = confirmed_body(api, draft, "conf-key-0003")
        preview = api.post(f"{BASE}{done['id']}/void-preview/", {}, format="json")
        assert preview.status_code == 200
        token = preview.json()["review_token"]
        no_reason = api.post(
            f"{BASE}{done['id']}/void/",
            {
                "idempotency_key": "void-key-0001",
                "expected_version": done["version"],
                "review_token": token,
            },
            format="json",
        )
        assert no_reason.status_code == 400
        assert "reason" in no_reason.json()["errors"]
        voided = api.post(
            f"{BASE}{done['id']}/void/",
            {
                "idempotency_key": "void-key-0002",
                "expected_version": done["version"],
                "review_token": token,
                "reason": "Error",
            },
            format="json",
        )
        assert voided.status_code == 200
        assert voided.json()["state"] == "VOIDED"
        replacement = api.post(
            f"{BASE}{done['id']}/replacement/", {"idempotency_key": "repl-key-0001"}, format="json"
        )
        assert replacement.status_code == 201
        assert replacement.json()["replaces_id"] == done["id"]

    def test_each_route_uses_its_own_permission_and_hides_data_from_other_roles(
        self, draft_payload: Any, admin: Any, commercial: Any
    ) -> None:
        body = created_by(admin, draft_payload())
        seller = get_user_model().objects.create_user(username="s1", password="pw")
        UserRole.objects.create(user=seller, role="VENDEDOR")
        manager = get_user_model().objects.create_user(username="m1", password="pw")
        UserRole.objects.create(user=manager, role="ENCARGADO_TALLER")
        for user in (seller, manager):
            client = APIClient()
            client.force_authenticate(user=user)
            for method, url in (
                ("get", BASE),
                ("post", BASE),
                ("get", f"{BASE}{body['id']}/"),
                ("patch", f"{BASE}{body['id']}/"),
                ("post", f"{BASE}{body['id']}/preview/"),
                ("post", f"{BASE}{body['id']}/confirm/"),
                ("post", f"{BASE}{body['id']}/void-preview/"),
                ("post", f"{BASE}{body['id']}/void/"),
                ("post", f"{BASE}{body['id']}/replacement/"),
                ("get", f"{BASE}tax-options/?document_date=2026-01-15"),
            ):
                assert getattr(client, method)(url, {}, format="json").status_code == 403, url

    def test_tax_options_fix_the_commercial_scope_and_change_nothing(
        self, api: APIClient, commercial: Any
    ) -> None:
        from workshop_configuration.models import FiscalEntity, TaxDefinition

        artisan = FiscalEntity.objects.create(
            entity_type="ARTESANAL", legal_name="Art", ruc="1790000000002"
        )
        TaxDefinition.objects.create(fiscal_entity=artisan, code="ART", name="Art")
        before = (
            ConfigurationUse.objects.count(),
            NumberAllocation.objects.count(),
            TaxPeriod.objects.count(),
        )
        response = api.get(f"{BASE}tax-options/?document_date=2026-01-15")
        assert response.status_code == 200
        codes = {row["code"] for row in response.json()["results"]}
        assert codes == {"IVA", "CERO"}
        assert {row["tax_status"] for row in response.json()["results"]} == {"applicable"}
        assert (
            ConfigurationUse.objects.count(),
            NumberAllocation.objects.count(),
            TaxPeriod.objects.count(),
        ) == before
        assert api.get(f"{BASE}tax-options/").status_code == 400
        assert api.get(f"{BASE}tax-options/?document_date=nope").status_code == 400


def created_by(user: Any, payload: dict[str, Any]) -> dict[str, Any]:
    client = APIClient()
    client.force_authenticate(user=user)
    return created(client, payload)


class TestFieldContract:
    def test_patch_distinguishes_omitting_from_emptying_and_replaces_all_lines_in_order(
        self,
        api: APIClient,
        draft_payload: Any,
        commercial: Any,
        product: Any,
        line: Any,
        make_product: Any,
    ) -> None:
        other = make_product()
        body = created(
            api,
            draft_payload([line(product, commercial["ten"])], notes="conservar"),
        )
        omitted = api.patch(
            f"{BASE}{body['id']}/",
            {
                "idempotency_key": "patch-key-0002",
                "expected_version": 1,
                "supplier_reference": "Z-9",
            },
            format="json",
        ).json()
        assert omitted["notes"] == "conservar"
        assert len(omitted["lines"]) == 1
        replaced = api.patch(
            f"{BASE}{body['id']}/",
            {
                "idempotency_key": "patch-key-0003",
                "expected_version": 2,
                "notes": "",
                "lines": [line(other, commercial["zero"]), line(product, commercial["ten"], "1")],
            },
            format="json",
        ).json()
        assert replaced["notes"] == ""
        assert [row["product"]["id"] for row in replaced["lines"]] == [other.pk, product.pk]
        assert [row["position"] for row in replaced["lines"]] == [1, 2]
        emptied = api.patch(
            f"{BASE}{body['id']}/",
            {"idempotency_key": "patch-key-0004", "expected_version": 3, "lines": []},
            format="json",
        ).json()
        assert emptied["lines"] == []

    @pytest.mark.parametrize(
        ("mutation", "field"),
        [
            ({"supplier_reference": "x" * 129}, "supplier_reference"),
            ({"notes": "x" * 2001}, "notes"),
            (
                {
                    "no_document_reason": "x" * 2001,
                    "document_type": "SIN_DOCUMENTO",
                    "supplier_reference": "",
                },
                "no_document_reason",
            ),
        ],
    )
    def test_text_limits(
        self, api: APIClient, draft_payload: Any, mutation: dict[str, Any], field: str
    ) -> None:
        response = api.post(BASE, draft_payload(**mutation), format="json")
        assert response.status_code == 400
        assert field in response.json()["errors"]

    def test_line_limit_and_line_field_paths(
        self, api: APIClient, draft_payload: Any, commercial: Any, product: Any, line: Any
    ) -> None:
        many = api.post(
            BASE, draft_payload([line(product, commercial["ten"])] * 201), format="json"
        )
        assert many.status_code == 400
        assert "lines" in many.json()["errors"]
        lines = [line(product, commercial["ten"]) for _ in range(3)]
        lines[2]["quantity"] = "0"
        bad = api.post(BASE, draft_payload(lines), format="json")
        assert bad.status_code == 400
        assert "lines.2.quantity" in bad.json()["errors"]

    def test_unknown_fields_and_client_totals(self, api: APIClient, draft_payload: Any) -> None:
        response = api.post(BASE, draft_payload(total="1.00", state="CONFIRMED"), format="json")
        assert response.status_code == 400
        assert response.json()["code"] == "unknown_field"
        assert set(response.json()["errors"]) == {"total", "state"}

    def test_body_must_be_a_json_object(self, api: APIClient) -> None:
        response = api.post(BASE, [], format="json")
        assert response.status_code == 400


class TestLists:
    def test_envelope_defaults_filters_and_order(
        self, api: APIClient, draft_payload: Any, supplier: Any
    ) -> None:
        from supplier_registry.models import Supplier

        other = Supplier.objects.create(name="Otro")
        created(api, draft_payload(document_date="2026-01-10", supplier_reference="A-1"))
        created(api, draft_payload(document_date="2026-01-20", supplier_reference="A-2"))
        created(
            api,
            draft_payload(
                document_date="2026-01-20", supplier_id=other.pk, supplier_reference="B-1"
            ),
        )
        page = api.get(BASE).json()
        assert set(page) == {"count", "page", "page_size", "total_pages", "results"}
        assert (page["page"], page["page_size"], page["count"]) == (1, 20, 3)
        dates = [row["document_date"] for row in page["results"]]
        assert dates == sorted(dates, reverse=True)
        ids = [row["id"] for row in page["results"] if row["document_date"] == "2026-01-20"]
        assert ids == sorted(ids, reverse=True)
        assert api.get(f"{BASE}?supplier_id={other.pk}").json()["count"] == 1
        assert api.get(f"{BASE}?state=DRAFT").json()["count"] == 3
        assert api.get(f"{BASE}?state=CONFIRMED").json()["count"] == 0
        assert api.get(f"{BASE}?date_from=2026-01-15").json()["count"] == 2
        assert api.get(f"{BASE}?date_to=2026-01-15").json()["count"] == 1
        assert api.get(f"{BASE}?search=A-2").json()["count"] == 1
        assert api.get(f"{BASE}?search=otro").json()["count"] == 1

    @pytest.mark.parametrize(
        "query",
        ["page=0", "page_size=101", "page_size=0", "state=OPEN", "date_from=ayer", "supplier_id=x"],
    )
    def test_invalid_query_is_a_400(self, api: APIClient, query: str) -> None:
        assert api.get(f"{BASE}?{query}").status_code == 400

    def test_pages(self, api: APIClient, draft_payload: Any) -> None:
        for _ in range(3):
            created(api, draft_payload())
        second = api.get(f"{BASE}?page=2&page_size=2").json()
        assert (len(second["results"]), second["total_pages"]) == (1, 2)


class TestErrors:
    def test_unauthenticated_and_csrf(self, admin: Any, draft_payload: Any) -> None:
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
        blocked = csrf_client.post(BASE, draft_payload(), content_type="application/json")
        assert blocked.status_code == 403

    def test_not_found_is_returned_after_authorizing(self, api: APIClient) -> None:
        assert api.get(f"{BASE}999999/").status_code == 404
        assert api.post(f"{BASE}999999/preview/", {}, format="json").status_code == 404

    def test_conflicts_use_stable_codes(
        self, api: APIClient, draft_payload: Any, commercial: Any, product: Any, line: Any
    ) -> None:
        body = created(
            api, draft_payload([line(product, commercial["ten"])], supplier_reference="D-1")
        )
        duplicate = api.post(BASE, draft_payload(supplier_reference="D-1"), format="json")
        assert (duplicate.status_code, duplicate.json()["code"]) == (
            409,
            "duplicate_supplier_document",
        )
        api.patch(
            f"{BASE}{body['id']}/",
            {"idempotency_key": "patch-key-0005", "expected_version": 1, "notes": "A"},
            format="json",
        )
        stale = api.patch(
            f"{BASE}{body['id']}/",
            {"idempotency_key": "patch-key-0006", "expected_version": 1, "notes": "B"},
            format="json",
        )
        assert (stale.status_code, stale.json()["code"]) == (409, "stale_record")
        review = api.post(f"{BASE}{body['id']}/preview/", {}, format="json").json()
        TaxPeriod.objects.filter(tax_definition=commercial["ten"]).update(rate=12)
        required = api.post(
            f"{BASE}{body['id']}/confirm/",
            {
                "idempotency_key": "conf-key-0010",
                "expected_version": 2,
                "review_token": review["review_token"],
            },
            format="json",
        )
        assert (required.status_code, required.json()["code"]) == (409, "review_required")
        payload = draft_payload(notes="uno")
        assert api.post(BASE, payload, format="json").status_code == 201
        reused = api.post(BASE, {**payload, "notes": "dos"}, format="json")
        assert (reused.status_code, reused.json()["code"]) == (409, "idempotency_conflict")

    def test_retryable_conflicts_become_concurrent_operation(
        self, api: APIClient, monkeypatch: Any
    ) -> None:
        def boom(**kwargs: Any) -> Any:
            raise RetryableConflictError("40P01")

        monkeypatch.setattr("purchasing.application.purchases.create_draft", boom)
        response = api.post(BASE, {"idempotency_key": "any-key-00001"}, format="json")
        assert (response.status_code, response.json()["code"]) == (409, "concurrent_operation")
        assert Purchase.objects.count() == 0
