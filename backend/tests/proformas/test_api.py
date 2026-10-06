"""Contrato HTTP de proformas: rutas, DTO, errores, permisos por rol, sesión y CSRF."""

import re
from typing import Any

import pytest
from django.test import Client
from rest_framework.test import APIClient

from identity.models import AuditEvent
from proformas.models import Proforma, ProformaCommand
from sales.models import CommercialPayment, Sale

from .conftest import key

pytestmark = pytest.mark.django_db
P = "/api/v1/proformas/"
DECIMAL = re.compile(r"^\d+\.\d{2}$")


def client_for(user: Any) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def api(seller: Any) -> APIClient:
    return client_for(seller)


def create(
    client: APIClient, customer: Any, product: Any, quantity: str = "2", **extra: Any
) -> Any:
    return client.post(
        P,
        {
            "idempotency_key": key("api"),
            "customer_id": customer.pk,
            "lines": [{"product_id": product.pk, "quantity": quantity}],
            **extra,
        },
        format="json",
    )


def issue_via_api(client: APIClient, proforma_id: int) -> Any:
    review = client.get(f"{P}{proforma_id}/issue-preview/").json()
    assert review["can_issue"], review
    return client.post(
        f"{P}{proforma_id}/issue/",
        {
            "idempotency_key": key("api-issue"),
            "expected_version": review["version"],
            "review_token": review["review_token"],
        },
        format="json",
    )


def convert_via_api(client: APIClient, proforma_id: int) -> Any:
    review = client.get(f"{P}{proforma_id}/conversion-preview/").json()
    assert review["can_convert"], review
    return client.post(
        f"{P}{proforma_id}/convert/",
        {
            "idempotency_key": key("api-conv"),
            "expected_version": review["version"],
            "review_token": review["review_token"],
        },
        format="json",
    )


def login(user: Any, *, enforce_csrf: bool = False) -> tuple[Client, str]:
    """Sesión real por el endpoint de autenticación; devuelve el cliente y su token CSRF."""
    session = Client(enforce_csrf_checks=True)
    user.set_password("Clave-segura-2026")
    user.save()
    session.get("/api/v1/auth/csrf/")
    response = session.post(
        "/api/v1/auth/login/",
        {"username": user.username, "password": "Clave-segura-2026"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=session.cookies["csrftoken"].value,
    )
    assert response.status_code == 200, response.content
    return session, session.cookies["csrftoken"].value


def walk(value: Any, path: str = "") -> list[tuple[str, Any]]:
    if isinstance(value, dict):
        return [item for k, v in value.items() for item in walk(v, f"{path}.{k}")]
    if isinstance(value, list):
        return [item for i, v in enumerate(value) for item in walk(v, f"{path}[{i}]")]
    return [(path, value)]


def test_full_flow_through_the_design_routes(
    api: APIClient, customer: Any, product: Any, stock: Any, at: Any
) -> None:
    at(2026, 10, 6)
    stock(product, 1)
    assert (
        api.get(f"{P}customer-options/?search=proforma").json()["results"][0]["id"] == customer.pk
    )
    option = api.get(f"{P}product-options/?search={product.code}").json()["results"][0]
    assert (option["unit_price"], option["available"]) == ("11.50", "1")
    capture = api.post(
        f"{P}draft-preview/",
        {"customer_id": customer.pk, "lines": [{"product_id": product.pk, "quantity": "2"}]},
        format="json",
    )
    assert capture.status_code == 200
    assert capture.json()["totals"]["total"] == "23.00"

    created = create(api, customer, product)
    assert created.status_code == 201
    draft = created.json()
    assert (draft["state"], draft["internal_number"]) == ("DRAFT", None)
    patched = api.patch(
        f"{P}{draft['id']}/",
        {
            "idempotency_key": key("api"),
            "expected_version": 1,
            "lines": [{"product_id": product.pk, "quantity": "3"}],
        },
        format="json",
    )
    assert (patched.status_code, patched.json()["version"]) == (200, 2)

    issued = issue_via_api(api, draft["id"])
    assert issued.status_code == 200
    body = issued.json()
    assert (body["state"], body["internal_number"], body["valid_until"]) == (
        "VALID",
        "COM-PRO-000001",
        "2026-10-13",
    )
    listed = api.get(f"{P}?search=COM-PRO-000001&state=VALID").json()
    assert (listed["count"], listed["total_pages"], listed["results"][0]["id"]) == (
        1,
        1,
        draft["id"],
    )
    document = api.get(f"{P}{draft['id']}/document/")
    assert document.status_code == 200
    assert document.json()["lines"][0]["availability_sufficient"] is False
    assert api.get(f"{P}{draft['id']}/document/logo/").status_code == 204

    copied = api.post(f"{P}{draft['id']}/copy/", {"idempotency_key": key("api")}, format="json")
    assert copied.status_code == 201
    assert copied.json()["origin"]["number"] == "COM-PRO-000001"
    voided = api.post(
        f"{P}{copied.json()['id']}/void/",
        {"idempotency_key": key("api"), "expected_version": 1},
        format="json",
    )
    assert (voided.status_code, voided.json()["state"]) == (200, "VOIDED")

    converted = convert_via_api(api, draft["id"])
    assert converted.status_code == 200
    sale = converted.json()["sale"]
    assert (converted.json()["state"], sale["state"], sale["can_open"]) == (
        "CONVERTED",
        "DRAFT",
        True,
    )
    detail = api.get(f"/api/v1/sales/{sale['id']}/").json()
    assert detail["origin"]["proforma_number"] == "COM-PRO-000001"
    assert detail["quote_comparison"]["proforma_id"] == draft["id"]
    assert api.get("/api/v1/sales/?origin=PROFORMA").json()["count"] == 1


def test_decimals_travel_as_strings_and_no_cost_is_exposed(
    api: APIClient, customer: Any, product: Any, stock: Any, at: Any
) -> None:
    at(2026, 10, 6)
    stock(product, 5)
    draft = create(api, customer, product).json()
    bodies = [
        draft,
        api.get(f"{P}{draft['id']}/issue-preview/").json(),
        issue_via_api(api, draft["id"]).json(),
        api.get(P).json(),
        api.get(f"{P}{draft['id']}/document/").json(),
        api.get(f"{P}{draft['id']}/conversion-preview/").json(),
        api.get(f"{P}product-options/").json(),
    ]
    for body in bodies:
        for path, value in walk(body):
            assert not isinstance(value, float), path
            name = path.rsplit(".", 1)[-1]
            if value is not None and re.search(r"(amount|total|price|base|tax)$", name):
                assert isinstance(value, str), path
                assert DECIMAL.match(value), (path, value)
            assert not re.search(r"cost|average|valuation|valoriz", path, re.IGNORECASE), path


@pytest.mark.parametrize(
    "extra",
    [
        {"unit_price": "1.00"},
        {"discount": "0"},
        {"tax_rate": "0"},
        {"condition": "CREDITO"},
        {"internal_number": "COM-PRO-000009"},
        {"state": "ISSUED"},
        {"grand_total": "1.00"},
    ],
)
def test_unknown_and_economic_fields_are_rejected(
    extra: dict[str, Any], api: APIClient, customer: Any, product: Any
) -> None:
    response = create(api, customer, product, **extra)
    assert response.status_code == 400
    assert response["Content-Type"] == "application/problem+json"
    problem = response.json()
    assert problem["code"] == "unknown_field"
    assert list(problem["errors"]) == list(extra)
    line = api.post(
        P,
        {
            "idempotency_key": key("api"),
            "customer_id": customer.pk,
            "lines": [{"product_id": product.pk, "quantity": "1", "unit_price": "1.00"}],
        },
        format="json",
    )
    assert line.json()["errors"] == {"lines.0.unit_price": ["Campo no admitido."]}
    assert not Proforma.objects.exists()


def test_effective_state_and_conflicts_are_distinguishable(
    api: APIClient, customer: Any, product: Any, at: Any
) -> None:
    at(2026, 10, 6)
    draft = create(api, customer, product).json()
    stale = api.patch(
        f"{P}{draft['id']}/",
        {"idempotency_key": key("api"), "expected_version": 9, "lines": []},
        format="json",
    )
    assert (stale.status_code, stale.json()["code"]) == (409, "stale_record")
    assert api.get(f"{P}{draft['id']}/document/").json()["code"] == "proforma_not_issued"
    review = api.get(f"{P}{draft['id']}/issue-preview/").json()
    type(product).objects.filter(pk=product.pk).update(sale_price="20.00")
    changed = api.post(
        f"{P}{draft['id']}/issue/",
        {
            "idempotency_key": key("api"),
            "expected_version": review["version"],
            "review_token": review["review_token"],
        },
        format="json",
    )
    assert (changed.status_code, changed.json()["code"]) == (409, "review_required")
    issued = issue_via_api(api, draft["id"]).json()
    edited = api.patch(
        f"{P}{draft['id']}/",
        {"idempotency_key": key("api"), "expected_version": issued["version"], "lines": []},
        format="json",
    )
    assert (edited.status_code, edited.json()["code"]) == (409, "proforma_issued")
    at(2026, 10, 14, 0, 0)
    assert api.get(f"{P}{draft['id']}/").json()["state"] == "EXPIRED"
    expired = api.post(
        f"{P}{draft['id']}/convert/",
        {"idempotency_key": key("api"), "expected_version": issued["version"], "review_token": "x"},
        format="json",
    )
    assert (expired.status_code, expired.json()["code"]) == (409, "proforma_expired")
    at(2026, 10, 7)
    sale_id = convert_via_api(api, draft["id"]).json()["sale"]["id"]
    again = api.post(
        f"{P}{draft['id']}/convert/",
        {"idempotency_key": key("api"), "expected_version": 3, "review_token": "x"},
        format="json",
    )
    problem = again.json()
    assert (again.status_code, problem["code"]) == (409, "proforma_converted")
    assert problem["conflict"] == {"type": "sale", "id": sale_id}
    assert problem["details"]["sale"]["id"] == sale_id
    voided = api.post(
        f"{P}{draft['id']}/void/",
        {"idempotency_key": key("api"), "expected_version": 3},
        format="json",
    )
    assert voided.json()["code"] == "proforma_converted"
    assert api.get(f"{P}999999/").status_code == 404
    assert api.get(f"{P}?state=VENCIDA").status_code == 400
    assert api.get(f"{P}?page=0").status_code == 400
    assert api.post(P, [1, 2], format="json").status_code == 400
    assert Sale.objects.count() == 1


def test_missing_configuration_and_inactive_reference_are_reported(
    api: APIClient, customer: Any, product: Any, commercial: Any, at: Any
) -> None:
    at(2026, 10, 6)
    draft = create(api, customer, product).json()
    review = api.get(f"{P}{draft['id']}/issue-preview/").json()
    commercial["series"].is_active = False
    commercial["series"].save()
    missing = api.post(
        f"{P}{draft['id']}/issue/",
        {
            "idempotency_key": key("api"),
            "expected_version": review["version"],
            "review_token": review["review_token"],
        },
        format="json",
    )
    assert (missing.status_code, missing.json()["code"]) == (409, "configuration_missing")
    assert "series" in missing.json()["errors"]
    type(product).objects.filter(pk=product.pk).update(is_active=False)
    inactive = api.get(f"{P}{draft['id']}/issue-preview/").json()
    assert inactive["issues"][0]["code"] == "inactive_reference"
    assert inactive["review_token"] is None


def test_no_delete_and_no_payment_routes_exist_for_offers(
    api: APIClient, issued: dict[str, Any]
) -> None:
    assert api.delete(f"{P}{issued['id']}/").status_code == 405
    for suffix in ("payments/", "payments/preview/", "withholdings/", "refunds/"):
        assert api.post(f"{P}{issued['id']}/{suffix}", {}, format="json").status_code == 404
    # El identificador de una oferta no es una venta: cobrar sobre él no crea hechos de cobranza.
    for suffix in ("payments/", "payments/preview/"):
        response = api.post(
            f"/api/v1/sales/{issued['id']}/{suffix}",
            {
                "idempotency_key": key("api"),
                "operation_id": "00000000-0000-4000-8000-000000000009",
                "parts": [{"method": "EFECTIVO", "amount": "23.00"}],
            },
            format="json",
        )
        assert response.status_code in {400, 404, 409}
    assert not CommercialPayment.objects.exists()
    assert not Sale.objects.exists()


# --- Autorización ---------------------------------------------------------------------------

READS = [
    "",
    "{id}/",
    "{id}/document/",
    "{id}/document/logo/",
    "{id}/issue-preview/",
    "{id}/conversion-preview/",
    "customer-options/",
    "product-options/",
]
WRITES = ["", "draft-preview/", "{id}/issue/", "{id}/void/", "{id}/copy/", "{id}/convert/"]


@pytest.mark.parametrize("role", ["admin", "seller", "seller_manager"])
def test_commercial_roles_can_use_every_action(
    role: str,
    request: pytest.FixtureRequest,
    new_draft: Any,
    product: Any,
    customer: Any,
    at: Any,
) -> None:
    at(2026, 10, 6)
    actor = request.getfixturevalue(role)
    client = client_for(actor)
    draft = create(client, customer, product)
    assert draft.status_code == 201
    proforma_id = draft.json()["id"]
    assert issue_via_api(client, proforma_id).status_code == 200
    for path in ("", f"{proforma_id}/", f"{proforma_id}/document/"):
        assert client.get(P + path).status_code == 200
    assert client.get(f"{P}{proforma_id}/document/logo/").status_code == 204
    copy = client.post(f"{P}{proforma_id}/copy/", {"idempotency_key": key("api")}, format="json")
    assert copy.status_code == 201
    void = client.post(
        f"{P}{copy.json()['id']}/void/",
        {"idempotency_key": key("api"), "expected_version": 1},
        format="json",
    )
    assert void.status_code == 200
    assert convert_via_api(client, proforma_id).status_code == 200


def test_workshop_manager_alone_is_denied_everything_without_effects(
    manager: Any, issued: dict[str, Any], customer: Any, product: Any
) -> None:
    client = client_for(manager)
    before = (Proforma.objects.count(), ProformaCommand.objects.count())
    for path in READS:
        response = client.get(P + path.format(id=issued["id"]))
        assert response.status_code == 403, path
        assert "COM-PRO" not in response.content.decode()
        assert customer.name not in response.content.decode()
    for path in WRITES:
        response = client.post(
            P + path.format(id=issued["id"]),
            {
                "idempotency_key": key("api"),
                "customer_id": customer.pk,
                "expected_version": issued["version"],
                "lines": [{"product_id": product.pk, "quantity": "1"}],
            },
            format="json",
        )
        assert response.status_code == 403, path
        assert "COM-PRO" not in response.content.decode()
    assert client.patch(f"{P}{issued['id']}/", {}, format="json").status_code == 403
    assert (Proforma.objects.count(), ProformaCommand.objects.count()) == before
    assert Proforma.objects.get(pk=issued["id"]).state == "ISSUED"
    assert not Sale.objects.exists()
    assert (
        AuditEvent.objects.filter(actor=manager, result="DENIED").exists()
        or AuditEvent.objects.filter(actor=manager).exists()
    )


def test_combined_roles_never_receive_costs(
    seller_manager: Any, customer: Any, product: Any, stock: Any, at: Any
) -> None:
    at(2026, 10, 6)
    stock(product, 5, "40.00")
    client = client_for(seller_manager)
    draft = create(client, customer, product).json()
    issued = issue_via_api(client, draft["id"]).json()
    converted = convert_via_api(client, draft["id"]).json()
    sale = client.get(f"/api/v1/sales/{converted['sale']['id']}/").json()
    for body in (issued, client.get(f"{P}{draft['id']}/document/").json(), converted, sale):
        for path, _ in walk(body):
            assert not re.search(r"cost|average|valuation", path, re.IGNORECASE), path
    assert "costs" not in sale
    assert issued["lines"][0]["unit_price"] == "11.50"


def test_seller_without_sales_permission_cannot_convert_and_sees_no_link_access(
    issued: dict[str, Any], seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    from identity.application import authorization

    original = authorization.has_permission

    def without_sales(actor: Any, permission: str) -> bool:
        return False if permission.startswith("ventas.") else original(actor, permission)

    for module in (
        "identity.application.authorization",
        "proformas.application.queries",
        "identity.api.permissions",
    ):
        monkeypatch.setattr(f"{module}.has_permission", without_sales)
    client = client_for(seller)
    detail = client.get(f"{P}{issued['id']}/").json()
    assert "convert" not in detail["allowed_actions"]
    assert client.get(f"{P}{issued['id']}/conversion-preview/").status_code == 403
    response = client.post(
        f"{P}{issued['id']}/convert/",
        {"idempotency_key": key("api"), "expected_version": issued["version"], "review_token": "x"},
        format="json",
    )
    assert response.status_code == 403
    assert not Sale.objects.exists()


def test_unauthenticated_or_invalidated_session_is_rejected(
    issued: dict[str, Any], seller: Any
) -> None:
    anonymous = APIClient()
    for path in READS:
        assert anonymous.get(P + path.format(id=issued["id"])).status_code == 403, path
    session, token = login(seller)
    assert session.get(f"{P}{issued['id']}/").status_code == 200
    assert session.post("/api/v1/auth/logout/", HTTP_X_CSRFTOKEN=token).status_code in {200, 204}
    for path in ("{id}/", "{id}/document/", "{id}/document/logo/"):
        response = session.get(P + path.format(id=issued["id"]))
        assert response.status_code == 403
        assert "COM-PRO" not in response.content.decode()


def test_inactive_user_is_rejected(issued: dict[str, Any], seller: Any) -> None:
    session, _ = login(seller)
    assert session.get(f"{P}{issued['id']}/").status_code == 200
    type(seller).objects.filter(pk=seller.pk).update(is_active=False)
    assert session.get(f"{P}{issued['id']}/").status_code == 403


def test_writes_require_csrf_with_session_authentication(
    seller: Any, customer: Any, product: Any
) -> None:
    session, token = login(seller)
    payload = {
        "idempotency_key": key("api"),
        "customer_id": customer.pk,
        "lines": [{"product_id": product.pk, "quantity": "1"}],
    }
    for path in ("", "draft-preview/"):
        denied = session.post(P + path, payload, content_type="application/json")
        assert denied.status_code == 403, path
    assert not Proforma.objects.exists()
    allowed = session.post(P, payload, content_type="application/json", HTTP_X_CSRFTOKEN=token)
    assert allowed.status_code == 201


def test_replay_after_losing_permission_reveals_nothing_and_repeats_nothing(
    new_draft: Any, seller: Any, product: Any, at: Any
) -> None:
    from identity.models import UserRole

    at(2026, 10, 6)
    client = client_for(seller)
    draft = new_draft((product, 1))
    review = client.get(f"{P}{draft['id']}/issue-preview/").json()
    payload = {
        "idempotency_key": "emision-replay-0001",
        "expected_version": review["version"],
        "review_token": review["review_token"],
    }
    assert client.post(f"{P}{draft['id']}/issue/", payload, format="json").status_code == 200
    UserRole.objects.filter(user=seller).delete()
    seller.refresh_from_db()
    replay = client_for(type(seller).objects.get(pk=seller.pk)).post(
        f"{P}{draft['id']}/issue/", payload, format="json"
    )
    assert replay.status_code == 403
    assert "COM-PRO" not in replay.content.decode()
    assert "review_token" not in replay.content.decode()
    assert ProformaCommand.objects.filter(action="proformas.proforma_issued").count() == 1
    assert Proforma.objects.get(pk=draft["id"]).internal_number == "COM-PRO-000001"


def test_logo_bytes_are_served_only_with_permission(
    new_draft: Any,
    issue: Any,
    seller: Any,
    admin: Any,
    manager: Any,
    product: Any,
    commercial: Any,
    at: Any,
) -> None:
    import uuid

    from tests.workshop_configuration.logo_helpers import image_bytes, upload

    from workshop_configuration.application import entity_logos

    at(2026, 10, 6)
    entity_logos.upload_entity_logo(
        actor=admin,
        entity_id=commercial["entity"].pk,
        file=upload(image_bytes()),
        idempotency_key=f"logo-{uuid.uuid4().hex}",
    )
    body = issue(new_draft((product, 1)))
    response = client_for(seller).get(f"{P}{body['id']}/document/logo/")
    assert response.status_code == 200
    assert response["Content-Type"] == "image/png"
    assert response["X-Content-Type-Options"] == "nosniff"
    assert "no-store" in response["Cache-Control"]
    assert response.content.startswith(b"\x89PNG")
    assert client_for(seller).get(f"{P}{body['id']}/document/").json()["has_logo"] is True
    denied = client_for(manager).get(f"{P}{body['id']}/document/logo/")
    assert denied.status_code == 403
    assert not denied.content.startswith(b"\x89PNG")


def test_errors_carry_the_request_id_and_no_private_data(
    api: APIClient, customer: Any, product: Any
) -> None:
    response = create(api, customer, product, quantity="0")
    problem = response.json()
    assert response.status_code == 400
    assert set(problem) >= {"type", "title", "status", "detail", "code", "request_id"}
    assert response.has_header("X-Request-ID")
    assert customer.identification not in response.content.decode()
