"""Contrato HTTP de la integración económica del taller: flujo, errores y permisos por rol."""

import uuid
from typing import Any

import pytest
from rest_framework.test import APIClient
from tests.workshop.workshop_helpers import add_line, create, finalize, key, version

from workshop.application import orders

pytestmark = pytest.mark.django_db
P = "/api/v1/maintenance-orders/"
S = "/api/v1/service-operations/"


def client_for(user: Any) -> APIClient:
    client = APIClient()
    if user is not None:
        client.force_authenticate(user=user)
    return client


def problem(response: Any, status: int, code: str) -> dict[str, Any]:
    assert response.status_code == status, response.content
    assert response["Content-Type"] == "application/problem+json"
    body: dict[str, Any] = response.json()
    assert body["code"] == code
    return body


@pytest.fixture
def order(manager, artisan_billing, commercial, customer, vehicle, make_service) -> dict[str, Any]:  # type: ignore[no-untyped-def]
    created = create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=1)
    add_line(manager, created["id"], service_id=make_service().pk, applied_price="60.00")
    orders.update_order(
        actor=manager,
        order_id=created["id"],
        payload={
            "diagnosis": "Frenos",
            "expected_version": version(created["id"]),
            "idempotency_key": key(),
        },
    )
    return created


def add_part_http(api: APIClient, order_id: int, product_id: int, quantity: str = "1") -> Any:
    return api.post(
        f"{P}{order_id}/parts/",
        {
            "product_id": product_id,
            "quantity": quantity,
            "expected_version": version(order_id),
            "idempotency_key": key(),
        },
        format="json",
    )


def test_full_http_flow_keeps_documents_separated(  # type: ignore[no-untyped-def]
    manager, seller, admin, order, stocked
) -> None:
    workshop, sales_api, admin_api = client_for(manager), client_for(seller), client_for(admin)
    product = stocked(5, price="40.00")
    options = workshop.get(f"{P}{order['id']}/parts/product-options/", {"search": product.code})
    assert options.status_code == 200
    assert options.json()["results"][0]["available"] == "5"
    assert add_part_http(workshop, order["id"], product.pk).status_code == 201
    [draft] = workshop.get(f"{P}{order['id']}/parts/").json()
    assert draft["state"] == "DRAFT"
    assert draft["estimate"]["totals"]["total"] == "40.00"

    problem(
        workshop.post(
            f"{P}{order['id']}/finalize/",
            {"expected_version": version(order["id"]), "idempotency_key": key()},
            format="json",
        ),
        400,
        "finalize_requirements",
    )

    problem(
        sales_api.patch(
            f"/api/v1/sales/{draft['id']}/",
            {"lines": [], "expected_version": draft["version"], "idempotency_key": key()},
            format="json",
        ),
        409,
        "linked_sale_locked",
    )
    review = sales_api.post(f"/api/v1/sales/{draft['id']}/preview/", {}, format="json").json()
    confirmed = sales_api.post(
        f"/api/v1/sales/{draft['id']}/confirm/",
        {
            "expected_version": draft["version"],
            "review_token": review["review_token"],
            "idempotency_key": key(),
        },
        format="json",
    )
    assert confirmed.status_code == 200, confirmed.content
    void_preview = admin_api.post(
        f"/api/v1/sales/{draft['id']}/void-preview/",
        {"reason": "Repuesto mal registrado"},
        format="json",
    ).json()
    assert void_preview["can_void"] is False
    assert [i["code"] for i in void_preview["issues"]] == ["linked_sale_not_voidable"]
    problem(
        admin_api.post(
            f"/api/v1/sales/{draft['id']}/void/",
            {
                "reason": "Repuesto mal registrado",
                "review_token": "x",
                "expected_version": confirmed.json()["version"],
                "idempotency_key": key(),
            },
            format="json",
        ),
        409,
        "linked_sale_not_voidable",
    )

    preview = workshop.post(
        f"{P}{order['id']}/service-operations/preview/", {"condition": "CREDITO"}, format="json"
    ).json()
    created = workshop.post(
        f"{P}{order['id']}/service-operations/",
        {
            "condition": "CREDITO",
            "review_digest": preview["review_digest"],
            "expected_version": version(order["id"]),
            "idempotency_key": key(),
        },
        format="json",
    )
    assert created.status_code == 201, created.content
    operation = created.json()
    paid = workshop.post(
        f"{S}{operation['id']}/payments/",
        {
            "operation_id": str(uuid.uuid4()),
            "parts": [{"method": "EFECTIVO", "amount": "20.00"}],
            "idempotency_key": key(),
        },
        format="json",
    )
    assert paid.status_code == 201, paid.content
    assert paid.json()["balance"] == "40.00"
    problem(
        admin_api.post(
            f"{S}{operation['id']}/void/",
            {
                "reason": "Error",
                "expected_version": paid.json()["version"],
                "idempotency_key": key(),
            },
            format="json",
        ),
        409,
        "payments_block_void",
    )

    summary = admin_api.get(f"{P}{order['id']}/economic-summary/").json()
    assert summary["commercial"]["documents"][0]["balance"] == "40.00"
    assert summary["artisan"]["documents"][0]["balance"] == "40.00"
    assert summary["combined"]["informative"] is True
    receivables = workshop.get(S).json()
    assert [row["balance"] for row in receivables["results"]] == ["40.00"]
    view = sales_api.get(f"{P}{order['id']}/commercial-view/")
    assert view.status_code == 200
    assert "services" not in view.json()

    assert (
        workshop.post(
            f"{P}{order['id']}/finalize/",
            {"expected_version": version(order["id"]), "idempotency_key": key()},
            format="json",
        ).status_code
        == 200
    )
    problem(add_part_http(workshop, order["id"], product.pk), 409, "parts_not_allowed")


def test_errors_for_availability_and_documented_lines(manager, order, stocked) -> None:  # type: ignore[no-untyped-def]
    workshop = client_for(manager)
    problem(
        add_part_http(workshop, order["id"], stocked(1).pk, "2"), 409, "insufficient_availability"
    )
    problem(
        workshop.post(
            f"{P}{order['id']}/service-operations/",
            {
                "condition": "CONTADO",
                "review_digest": "0" * 64,
                "expected_version": version(order["id"]),
                "idempotency_key": key(),
            },
            format="json",
        ),
        409,
        "review_required",
    )


def test_permission_matrix_for_billing_endpoints(  # type: ignore[no-untyped-def]
    manager, seller, admin, order, stocked
) -> None:
    product = stocked(5)
    add_part_http(client_for(manager), order["id"], product.pk)
    oid = order["id"]
    seller_api, manager_api, anonymous = client_for(seller), client_for(manager), client_for(None)
    command = {"expected_version": 1, "idempotency_key": key()}

    for method, url, body in (
        ("post", f"{P}{oid}/parts/", {"product_id": product.pk, "quantity": "1", **command}),
        ("get", f"{P}{oid}/parts/", None),
        ("get", f"{P}{oid}/economic-summary/", None),
        ("post", f"{P}{oid}/service-operations/preview/", {"condition": "CONTADO"}),
        ("get", S, None),
    ):
        response = getattr(seller_api, method)(url, body, format="json")
        assert response.status_code == 403, (url, response.content)
        response = getattr(anonymous, method)(url, body, format="json")
        assert response.status_code in {401, 403}, url

    assert manager_api.get(f"{P}{oid}/commercial-view/").status_code == 403
    assert manager_api.get(f"{S}1/void-preview/").status_code == 403
    finalize_blocked = manager_api.post(
        f"{P}{oid}/finalize/",
        {"expected_version": version(oid), "idempotency_key": key()},
        format="json",
    )
    assert finalize_blocked.status_code == 400
    assert client_for(admin).get(f"{P}{oid}/economic-summary/").status_code == 200


def test_finalized_order_rejects_parts(manager, order, stocked) -> None:  # type: ignore[no-untyped-def]
    finalize(manager, order["id"])
    problem(
        add_part_http(client_for(manager), order["id"], stocked(5).pk), 409, "parts_not_allowed"
    )


def test_withholding_routes_for_an_artisan_operation(  # type: ignore[no-untyped-def]
    manager, admin, seller, order
) -> None:
    from tests.workshop.workshop_helpers import confirm_services

    from workshop.application.support import business_today

    operation = confirm_services(manager, order["id"], "CREDITO")
    workshop, admin_api = client_for(manager), client_for(admin)
    route = f"{S}{operation['id']}/"

    def charge(body: dict[str, Any]) -> Any:
        return workshop.post(
            f"{route}payments/",
            {"operation_id": str(uuid.uuid4()), "idempotency_key": key(), **body},
            format="json",
        )

    warned = charge({"withholding": {"amount": "30.00"}})
    assert problem(warned, 409, "withholding_warning")["errors"]["threshold"] == ["12.00"]

    created = charge(
        {
            "parts": [{"method": "TRANSFERENCIA", "amount": "58.00"}],
            "withholding": {"amount": "2.00"},
        }
    )
    assert created.status_code == 201, created.content
    body = created.json()
    assert (body["paid"], body["withheld"], body["balance"]) == ("58.00", "2.00", "0.00")
    withholding_id = body["withholdings"][0]["id"]

    pending = workshop.get(f"{S}withholdings/pending/")
    assert pending.status_code == 200
    assert pending.json()["pending_total"] == "2.00"
    assert pending.json()["items"][0]["fiscal_scope"] == "ARTESANAL"
    assert client_for(seller).get(f"{S}withholdings/pending/").status_code == 403

    voucher = {
        "voucher_number": "001-001-000028564",
        "voucher_date": business_today().isoformat(),
    }
    target = f"{route}withholdings/{withholding_id}/"
    bad = workshop.post(
        f"{target}voucher/",
        {**voucher, "voucher_number": "1-1-1", "idempotency_key": key()},
        format="json",
    )
    problem(bad, 400, "validation_error")
    done = workshop.post(f"{target}voucher/", {**voucher, "idempotency_key": key()}, format="json")
    assert done.status_code == 200
    assert done.json()["withholdings"][0]["voucher_pending"] is False
    assert workshop.get(f"{S}withholdings/pending/").json()["total_count"] == 0

    correction = {
        **voucher,
        "voucher_number": "001-001-000000002",
        "operation_id": str(uuid.uuid4()),
        "reason": "Número mal digitado",
        "idempotency_key": key(),
    }
    assert (
        workshop.post(f"{target}voucher-correction/", correction, format="json").status_code == 403
    )
    corrected = admin_api.post(f"{target}voucher-correction/", correction, format="json")
    assert corrected.json()["withholdings"][0]["voucher_number"] == "001-001-000000002"

    void_body = {"reason": "Registrada por error", "idempotency_key": key()}
    assert workshop.post(f"{target}void/", void_body, format="json").status_code == 403
    voided = admin_api.post(f"{target}void/", void_body, format="json")
    assert voided.status_code == 200
    assert (voided.json()["withheld"], voided.json()["balance"]) == ("0.00", "2.00")
    again = admin_api.post(f"{target}void/", {**void_body, "idempotency_key": key()}, format="json")
    problem(again, 409, "invalid_state")
