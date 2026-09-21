"""Permisos por acción y rol, sesión invalidada y ausencia de costos en toda respuesta."""

import inspect
import uuid
from collections.abc import Callable
from typing import Any

import pytest
from django.contrib.auth import get_user_model

from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import ROLE_PERMISSIONS
from identity.models import UserRole
from inventory.application import queries as inventory_queries
from sales.application import (
    operations,
    payments,
    reads,
    refunds,
    returns,
    reviews,
    sales,
    voids,
)
from sales.application.errors import SalesApplicationError
from sales.models import Sale, SaleReturn
from workshop_configuration.models import Warehouse

from .test_payments import parts, pay
from .test_refunds import refund_data
from .test_returns import do_return, item, line_id
from .test_returns import request as return_request

pytestmark = pytest.mark.django_db

COST_KEYS = {
    "cost",
    "costs",
    "total_cost",
    "applied_value",
    "published_unit_cost",
    "value_delta",
    "current_average_cost",
    "valuation",
    "average",
    "unit_cost",
}


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


def user(username: str, *roles: str) -> Any:
    created = get_user_model().objects.create_user(username=username, password="x" * 14)
    for role in roles:
        UserRole.objects.create(user=created, role=role)
    return created


def keys_of(value: Any) -> set[str]:
    """Todas las claves de una estructura anidada."""
    found: set[str] = set()
    if isinstance(value, dict):
        for key, inner in value.items():
            found.add(str(key))
            found |= keys_of(inner)
    elif isinstance(value, list | tuple):
        for inner in value:
            found |= keys_of(inner)
    return found


def test_no_new_permissions_were_added_for_sales() -> None:
    used = {
        "ventas.ver",
        "ventas.crear",
        "ventas.confirmar",
        "ventas.anular",
        "ventas.devolver",
        "pagos_comerciales.ver",
        "pagos_comerciales.registrar",
        "pagos_comerciales.anular",
    }
    catalog = set().union(*ROLE_PERMISSIONS.values())
    assert used <= catalog


@pytest.fixture
def scenario(seller: Any, admin: Any, confirmed_sale: Any) -> dict[str, Any]:
    sale = confirmed_sale(price="20.00", quantity=5)
    payment = pay(seller, sale["id"], parts("100.00")).body
    do_return(admin, sale["id"], return_request([item(line_id(sale["id"]), fit=1)]))
    return {"sale": sale, "payment": payment}


def attempt(actor: Any, scenario: dict[str, Any], action: str) -> Any:
    sale_id = scenario["sale"]["id"]
    op = str(uuid.uuid4())
    calls: dict[str, Any] = {
        "list": lambda: reads.list_sales(actor=actor),
        "detail": lambda: reads.sale_detail(actor=actor, sale_id=sale_id),
        "document": lambda: reads.sale_document(actor=actor, sale_id=sale_id),
        "create": lambda: sales.create_draft(
            actor=actor,
            payload={
                "idempotency_key": "auth-create-0001",
                "customer_id": 1,
                "condition": "CREDITO",
            },
        ),
        "update": lambda: sales.update_draft(
            actor=actor,
            sale_id=sale_id,
            payload={"idempotency_key": "auth-update-001", "expected_version": 1},
        ),
        "review": lambda: reviews.preview_confirmation(actor=actor, sale_id=sale_id),
        "confirm": lambda: sales.confirm_sale(
            actor=actor,
            sale_id=sale_id,
            payload={
                "idempotency_key": "auth-confirm-01",
                "expected_version": 1,
                "review_token": "x",
            },
        ),
        "pay_view": lambda: payments.payment_history(actor=actor, sale_id=sale_id),
        "receivables": lambda: reads.receivables(actor=actor),
        "pay": lambda: payments.preview_payment(
            actor=actor, sale_id=sale_id, payload={"operation_id": op, "parts": parts("1.00")}
        ),
        "correct": lambda: payments.preview_correction(
            actor=actor,
            sale_id=sale_id,
            payment_id=scenario["payment"]["id"],
            payload={"operation_id": op, "reason": "x"},
        ),
        "return": lambda: returns.preview_return(
            actor=actor,
            sale_id=sale_id,
            payload=return_request([item(line_id(sale_id), fit=1)]),
        ),
        "refund": lambda: refunds.preview_refund(
            actor=actor,
            sale_id=sale_id,
            payload=refund_data(SaleReturn.objects.get(), "1.00"),
        ),
        "void": lambda: voids.preview_void(actor=actor, sale_id=sale_id, payload={"reason": "x"}),
        "status": lambda: operations.operation_status(actor=actor, operation_id=uuid.uuid4()),
    }
    return calls[action]()


READ_ACTIONS = ["list", "detail", "document", "pay_view", "receivables"]
SELLER_ALLOWED = {"list", "detail", "document", "review", "pay_view", "receivables", "pay"}
ADMIN_ONLY = ["correct", "return", "refund", "void"]


@pytest.mark.parametrize(
    "action", ["list", "detail", "document", "pay_view", "receivables", "review", "pay"]
)
def test_seller_can_operate_on_commercial_sales(
    seller: Any, scenario: dict[str, Any], action: str
) -> None:
    assert attempt(seller, scenario, action) is not None


@pytest.mark.parametrize("action", ADMIN_ONLY)
def test_only_the_administrator_corrects_pays_back_voids_and_returns(
    seller: Any, admin: Any, scenario: dict[str, Any], action: str
) -> None:
    for _ in range(2):  # también al reintentar la misma solicitud directa
        with pytest.raises(BusinessPermissionDeniedError):
            attempt(seller, scenario, action)
    assert attempt(admin, scenario, action) is not None


@pytest.mark.parametrize(
    "action",
    [
        "list",
        "detail",
        "document",
        "create",
        "update",
        "review",
        "confirm",
        "pay_view",
        "receivables",
        "pay",
        "correct",
        "return",
        "refund",
        "void",
    ],
)
def test_workshop_manager_without_commercial_role_is_denied_everywhere(
    scenario: dict[str, Any], action: str
) -> None:
    workshop = user("auth-workshop", "ENCARGADO_TALLER")
    with pytest.raises(BusinessPermissionDeniedError):
        attempt(workshop, scenario, action)


def test_seller_with_workshop_role_charges_as_seller_without_admin_corrections(
    scenario: dict[str, Any],
) -> None:
    both = user("auth-both", "VENDEDOR", "ENCARGADO_TALLER")
    assert attempt(both, scenario, "pay")["sale_id"] == scenario["sale"]["id"]
    for action in ADMIN_ONLY:
        with pytest.raises(BusinessPermissionDeniedError):
            attempt(both, scenario, action)


def test_seller_confirms_an_authorized_sale(
    seller: Any, customer: Any, product: Any, stock: Any
) -> None:
    stock(product, 3, "12.00")
    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": "auth-seller-0001",
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [{"product_id": product.pk, "quantity": "1"}],
        },
    ).body
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    body = sales.confirm_sale(
        actor=seller,
        sale_id=draft["id"],
        payload={
            "idempotency_key": "auth-seller-0002",
            "expected_version": 1,
            "review_token": review["review_token"],
        },
    ).body
    assert body["state"] == "CONFIRMED"


def test_an_invalidated_session_or_deactivated_user_cannot_confirm_or_replay(
    seller: Any, customer: Any, product: Any, stock: Any
) -> None:
    stock(product, 3, "12.00")
    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": "auth-sess-000001",
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [{"product_id": product.pk, "quantity": "1"}],
        },
    ).body
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    payload = {
        "idempotency_key": "auth-sess-000002",
        "expected_version": 1,
        "review_token": review["review_token"],
    }
    seller.is_active = False
    seller.save()
    with pytest.raises(BusinessPermissionDeniedError):
        sales.confirm_sale(actor=seller, sale_id=draft["id"], payload=payload)
    assert Sale.objects.get(pk=draft["id"]).state == "DRAFT"
    seller.is_active = True
    seller.save()
    sales.confirm_sale(actor=seller, sale_id=draft["id"], payload=payload)
    seller.is_active = False
    seller.save()
    with pytest.raises(BusinessPermissionDeniedError):
        sales.confirm_sale(actor=seller, sale_id=draft["id"], payload=payload)


def test_operational_responses_never_contain_costs_for_seller_or_workshop_manager(
    seller: Any, scenario: dict[str, Any], confirmed_sale: Any
) -> None:
    sale_id = scenario["sale"]["id"]
    other = user("auth-both2", "VENDEDOR", "ENCARGADO_TALLER")
    for actor in (seller, other):
        responses = [
            reads.list_sales(actor=actor),
            reads.sale_detail(actor=actor, sale_id=sale_id),
            reads.sale_document(actor=actor, sale_id=sale_id),
            reads.receivables(actor=actor),
            payments.payment_history(actor=actor, sale_id=sale_id),
            reviews.preview_confirmation(actor=actor, sale_id=sale_id),
            payments.preview_payment(
                actor=actor,
                sale_id=sale_id,
                payload={"operation_id": str(uuid.uuid4()), "parts": parts("1.00")},
            ),
            operations.operation_status(
                actor=actor, operation_id=uuid.UUID(scenario["payment"]["operation_id"])
            ),
        ]
        for response in responses:
            leaked = keys_of(response) & COST_KEYS
            assert not leaked, leaked
    # replay del recibo y errores tampoco revelan costos
    with pytest.raises(SalesApplicationError) as error:
        sales.update_draft(
            actor=seller,
            sale_id=sale_id,
            payload={"idempotency_key": "auth-leak-00001", "expected_version": 1, "unit_cost": "1"},
        )
    assert not (keys_of(error.value.errors) & COST_KEYS) or error.value.code == "unknown_field"
    assert "applied_value" not in str(error.value.message)


def test_only_the_valuation_permission_adds_costs_and_no_parameter_elevates_the_projection(
    seller: Any, admin: Any, scenario: dict[str, Any]
) -> None:
    sale_id = scenario["sale"]["id"]
    with_cost = reads.sale_detail(actor=admin, sale_id=sale_id)
    assert "costs" in with_cost
    assert with_cost["costs"]["total_cost"] == "20.000000"
    assert "costs" not in reads.sale_detail(actor=seller, sale_id=sale_id)
    accountant = user("auth-valuation")
    UserRole.objects.create(user=accountant, role="VENDEDOR")
    assert "costs" not in reads.sale_detail(actor=accountant, sale_id=sale_id)
    for function in (reads.sale_detail, reads.list_sales, reads.sale_document, reads.receivables):
        names = set(inspect.signature(function).parameters)
        assert not names & {"include_costs", "with_costs", "costs", "valuation", "expand", "fields"}
    review = reviews.preview_confirmation(actor=admin, sale_id=sale_id)
    assert "effects" in review


def test_a_visible_kardex_movement_grants_no_access_to_the_sale_or_its_costs(
    seller: Any, scenario: dict[str, Any]
) -> None:
    sale = Sale.objects.get(pk=scenario["sale"]["id"])
    assert sale.inventory_operation_id is not None
    projection = inventory_queries.get_operation(
        sale.inventory_operation_id, include_valuation=False, can_open_origin=True
    )
    assert "origin_url" not in projection["origin"]
    assert "reason" not in projection
    assert not keys_of(projection) & COST_KEYS
    assert str(sale.pk) not in str(projection["origin"].get("origin_url", ""))
    workshop = user("auth-kardex", "ENCARGADO_TALLER")
    with pytest.raises(BusinessPermissionDeniedError):
        reads.sale_detail(actor=workshop, sale_id=sale.pk)


@pytest.mark.parametrize(
    "call",
    ["draft", "preview_capture", "payment", "return", "refund"],
)
def test_an_administrator_with_extra_roles_can_never_mix_tax_entities(
    admin: Any, scenario: dict[str, Any], call: str
) -> None:
    UserRole.objects.create(user=admin, role="ENCARGADO_TALLER")
    sale_id = scenario["sale"]["id"]
    op = str(uuid.uuid4())
    calls: dict[str, Callable[[], Any]] = {
        "draft": lambda: sales.create_draft(
            actor=admin,
            payload={
                "idempotency_key": "auth-mix-000001",
                "customer_id": 1,
                "condition": "CREDITO",
                "entity_type": "ARTESANAL",
            },
        ),
        "preview_capture": lambda: reviews.preview_draft_capture(
            actor=admin, payload={"entity_type": "ARTESANAL"}
        ),
        "payment": lambda: payments.preview_payment(
            actor=admin,
            sale_id=sale_id,
            payload={"operation_id": op, "parts": parts("1.00"), "entity_type": "ARTESANAL"},
        ),
        "return": lambda: returns.preview_return(
            actor=admin,
            sale_id=sale_id,
            payload=return_request([item(line_id(sale_id), fit=1)], entity_type="ARTESANAL"),
        ),
        "refund": lambda: refunds.preview_refund(
            actor=admin,
            sale_id=sale_id,
            payload={**refund_data(SaleReturn.objects.get(), "1.00"), "entity_type": "ARTESANAL"},
        ),
    }
    with pytest.raises(SalesApplicationError) as error:
        calls[call]()
    assert "entity_type" in error.value.errors
    assert reads.sale_detail(actor=admin, sale_id=sale_id)["fiscal_scope"] == "COMERCIAL"


def test_a_denied_critical_correction_is_audited_and_changes_nothing(
    seller: Any, scenario: dict[str, Any]
) -> None:
    from identity.models import AuditEvent

    sale = Sale.objects.get(pk=scenario["sale"]["id"])
    before = (sale.version, sale.state)
    with pytest.raises(BusinessPermissionDeniedError):
        attempt(seller, scenario, "correct")
    denied = AuditEvent.objects.filter(
        actor=seller, result="DENIED", action="sales.payment_correction_reviewed"
    )
    assert denied.count() == 1
    sale.refresh_from_db()
    assert (sale.version, sale.state) == before
