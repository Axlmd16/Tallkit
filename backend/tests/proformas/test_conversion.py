"""Conversión única y atómica a venta, replay, comparación y conciliación."""

from decimal import Decimal
from io import StringIO
from typing import Any

import pytest
from django.core.management import CommandError, call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext

from identity.models import AuditEvent
from inventory.application.reservations import read_availability
from inventory.models import InventoryMovement
from proformas.application import conversion, issuing, queries, reconciliation
from proformas.application.errors import ProformaApplicationError
from proformas.models import Proforma
from sales.models import CommercialPayment, Sale, SalesCommand
from workshop_configuration.models import TaxPeriod

from .conftest import key

pytestmark = pytest.mark.django_db
D = Decimal


def no_sale(body: dict[str, Any], state: str = "ISSUED") -> None:
    assert not Sale.objects.exists()
    assert Proforma.objects.get(pk=body["id"]).state == state
    assert not AuditEvent.objects.filter(
        action="proformas.proforma_converted", result="SUCCESS"
    ).exists()


def test_valid_conversion_creates_one_draft_sale_without_effects(
    issued: dict[str, Any], convert: Any, seller: Any, product: Any, stock: Any, commercial: Any
) -> None:
    stock(product, 5)
    movements = InventoryMovement.objects.count()
    outcome = convert(issued)
    body = outcome.body
    assert (outcome.status, body["state"]) == (200, "CONVERTED")
    sale = Sale.objects.get()
    assert body["sale"] == {
        "id": sale.pk,
        "internal_number": None,
        "state": "DRAFT",
        "can_open": True,
    }
    assert (sale.state, sale.origin_type, sale.origin_proforma_id, sale.origin_reference) == (
        "DRAFT",
        "PROFORMA",
        issued["id"],
        "COM-PRO-000001",
    )
    assert sale.customer_id == Proforma.objects.get(pk=issued["id"]).customer_id
    assert [(line.product_id, line.quantity) for line in sale.lines.all()] == [(product.pk, D(2))]
    availability = read_availability([product.pk], warehouse_id=commercial["warehouse"].pk)
    assert (availability[product.pk].quantity, availability[product.pk].reserved) == (D(5), D(0))
    assert InventoryMovement.objects.count() == movements
    assert not CommercialPayment.objects.exists()
    assert not SalesCommand.objects.exists()
    commercial["sale_series"].refresh_from_db()
    assert commercial["sale_series"].last_number == 0
    event = AuditEvent.objects.get(action="proformas.proforma_converted", result="SUCCESS")
    assert (event.target_id, event.reason, event.actor_id) == (
        str(issued["id"]),
        f"sale:{sale.pk}",
        seller.pk,
    )
    assert set(body["allowed_actions"]) == {"copy", "print"}
    assert reconciliation.reconcile() == []


def test_preview_shows_current_differences_without_effects(
    issued: dict[str, Any], seller: Any, product: Any
) -> None:
    type(product).objects.filter(pk=product.pk).update(sale_price=D("12.00"))
    with CaptureQueriesContext(connection) as captured:
        review = conversion.preview_conversion(actor=seller, proforma_id=issued["id"])
    assert not [
        q for q in captured if q["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
    ]
    item = review["comparison"]["products"][0]
    assert (item["quoted"]["unit_price"], item["current"]["unit_price"]) == ("11.50", "12.00")
    assert review["comparison"]["totals"]["quoted"]["total"] == "23.00"
    assert review["comparison"]["totals"]["current"]["total"] == "24.00"
    assert review["can_convert"] is True
    assert review["warnings"][0]["code"] == "insufficient_availability"
    no_sale(issued)


@pytest.mark.parametrize("case", ["draft", "expired", "voided"])
def test_offer_that_is_not_convertible_creates_no_sale(
    case: str, new_draft: Any, issue: Any, seller: Any, product: Any, at: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 1))
    expected_state = "DRAFT"
    if case != "draft":
        body = issue(body)
        expected_state = "ISSUED"
    if case == "expired":
        at(2026, 10, 14, 0, 0)
    if case == "voided":
        body = issuing.void_proforma(
            actor=seller,
            proforma_id=body["id"],
            payload={"idempotency_key": key(), "expected_version": body["version"]},
        ).body
        expected_state = "VOIDED"
    review = conversion.preview_conversion(actor=seller, proforma_id=body["id"])
    assert review["can_convert"] is False
    code = {
        "draft": "proforma_not_issued",
        "expired": "proforma_expired",
        "voided": "proforma_voided",
    }[case]
    assert review["blocked_by"]["code"] == code
    with pytest.raises(ProformaApplicationError) as error:
        conversion.convert_proforma(
            actor=seller,
            proforma_id=body["id"],
            payload={
                "idempotency_key": key(),
                "expected_version": body["version"],
                "review_token": "x",
            },
        )
    assert error.value.code == code
    no_sale(body, expected_state)


def test_replay_recovers_the_result_even_after_expiry(
    issued: dict[str, Any], convert: Any, seller: Any, at: Any
) -> None:
    review = conversion.preview_conversion(actor=seller, proforma_id=issued["id"])
    payload = {
        "idempotency_key": "conversion-clave-01",
        "expected_version": review["version"],
        "review_token": review["review_token"],
    }
    first = conversion.convert_proforma(actor=seller, proforma_id=issued["id"], payload=payload)
    at(2026, 12, 1)
    replay = conversion.convert_proforma(
        actor=seller, proforma_id=issued["id"], payload=dict(payload)
    )
    assert (first.replayed, replay.replayed) == (False, True)
    assert replay.body["state"] == "CONVERTED"
    assert replay.body["sale"]["id"] == first.body["sale"]["id"]
    assert Sale.objects.count() == 1


def test_new_attempt_on_converted_offer_reports_the_existing_sale(
    issued: dict[str, Any], convert: Any, seller: Any, at: Any
) -> None:
    sale_id = convert(issued).body["sale"]["id"]
    at(2026, 12, 1)
    review = conversion.preview_conversion(actor=seller, proforma_id=issued["id"])
    assert (review["can_convert"], review["blocked_by"]["code"]) == (False, "proforma_converted")
    assert review["sale"]["id"] == sale_id
    with pytest.raises(ProformaApplicationError) as error:
        conversion.convert_proforma(
            actor=seller,
            proforma_id=issued["id"],
            payload={"idempotency_key": key(), "expected_version": 3, "review_token": "x"},
        )
    assert error.value.code == "proforma_converted"
    assert error.value.conflict == {
        "sale": {"id": sale_id, "internal_number": None, "state": "DRAFT"}
    }
    assert Sale.objects.count() == 1
    with pytest.raises(ProformaApplicationError) as error:
        issuing.void_proforma(
            actor=seller,
            proforma_id=issued["id"],
            payload={"idempotency_key": key(), "expected_version": 3},
        )
    assert error.value.code == "proforma_converted"
    assert Sale.objects.get().origin_proforma_id == issued["id"]


@pytest.mark.parametrize("reference", ["customer", "product"])
def test_deactivated_reference_is_reported_without_partial_sale(
    reference: str, issued: dict[str, Any], seller: Any, product: Any, customer: Any
) -> None:
    review = conversion.preview_conversion(actor=seller, proforma_id=issued["id"])
    target = customer if reference == "customer" else product
    type(target).objects.filter(pk=target.pk).update(is_active=False)
    field = "customer_id" if reference == "customer" else "lines.0.product_id"
    blocked = conversion.preview_conversion(actor=seller, proforma_id=issued["id"])
    assert blocked["can_convert"] is False
    assert [issue["field"] for issue in blocked["issues"]] == [field]
    with pytest.raises(ProformaApplicationError) as error:
        conversion.convert_proforma(
            actor=seller,
            proforma_id=issued["id"],
            payload={
                "idempotency_key": key(),
                "expected_version": review["version"],
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "inactive_reference"
    assert list(error.value.errors) == [field]
    no_sale(issued)
    failure = AuditEvent.objects.get(action="proformas.proforma_converted", result="FAILURE")
    assert failure.reason == "inactive_reference"


def test_failure_after_creating_the_sale_rolls_everything_back(
    issued: dict[str, Any], convert: Any, seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = Proforma.save

    def boom(self: Proforma, *args: Any, **kwargs: Any) -> None:
        assert Sale.objects.filter(origin_proforma_id=self.pk).exists()
        raise RuntimeError("fallo tras crear la venta")

    monkeypatch.setattr(Proforma, "save", boom)
    with pytest.raises(RuntimeError, match="fallo tras crear la venta"):
        convert(issued)
    monkeypatch.setattr(Proforma, "save", original)
    no_sale(issued)
    assert convert(issued).body["state"] == "CONVERTED"
    assert Sale.objects.count() == 1


def test_change_after_review_requires_a_new_review(
    issued: dict[str, Any], seller: Any, product: Any, commercial: Any
) -> None:
    review = conversion.preview_conversion(actor=seller, proforma_id=issued["id"])
    TaxPeriod.objects.filter(pk=commercial["period"].pk).update(rate=D("12"))
    with pytest.raises(ProformaApplicationError) as error:
        conversion.convert_proforma(
            actor=seller,
            proforma_id=issued["id"],
            payload={
                "idempotency_key": key(),
                "expected_version": review["version"],
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "review_required"
    no_sale(issued)


def test_day_change_before_executing_rejects_the_conversion(
    issued: dict[str, Any], seller: Any, at: Any
) -> None:
    at(2026, 10, 13, 23, 59)
    review = conversion.preview_conversion(actor=seller, proforma_id=issued["id"])
    assert review["can_convert"] is True
    at(2026, 10, 14, 0, 0)
    with pytest.raises(ProformaApplicationError) as error:
        conversion.convert_proforma(
            actor=seller,
            proforma_id=issued["id"],
            payload={
                "idempotency_key": key(),
                "expected_version": review["version"],
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "proforma_expired"
    no_sale(issued)


def test_conversion_requires_both_permissions(
    issued: dict[str, Any], manager: Any, seller: Any
) -> None:
    from identity.application.authorization import BusinessPermissionDeniedError

    for call in (
        lambda: conversion.preview_conversion(actor=manager, proforma_id=issued["id"]),
        lambda: conversion.convert_proforma(
            actor=manager, proforma_id=issued["id"], payload={"idempotency_key": key()}
        ),
    ):
        with pytest.raises(BusinessPermissionDeniedError):
            call()
    no_sale(issued)


def test_search_converted_and_open_the_linked_sale(
    issued: dict[str, Any], convert: Any, seller: Any, new_draft: Any, product: Any
) -> None:
    new_draft((product, 1))
    sale_id = convert(issued).body["sale"]["id"]
    listed = queries.list_proformas(actor=seller, search="Cliente Proforma", state="CONVERTED")
    assert [row["id"] for row in listed["items"]] == [issued["id"]]
    assert listed["items"][0]["sale"]["id"] == sale_id
    assert listed["items"][0]["sale"]["can_open"] is True


def test_reconciliation_detects_a_synthetic_discrepancy_without_writing(
    issued: dict[str, Any],
    new_draft: Any,
    issue: Any,
    convert: Any,
    product: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import sales.application.proforma_links as proforma_links

    convert(issued)
    other = issue(new_draft((product, 1)))
    real = proforma_links.all_sale_links()
    assert [link.proforma_id for link in real] == [issued["id"]]
    # Discrepancia sintética: el contrato de ventas devuelve el vínculo en la oferta equivocada.
    moved = proforma_links.ProformaSaleLink(other["id"], real[0].sale_id, "DRAFT", None)
    monkeypatch.setattr(proforma_links, "all_sale_links", lambda: (moved,))
    before = list(Proforma.objects.order_by("pk").values_list("pk", "state", "version"))
    with CaptureQueriesContext(connection) as captured:
        differences = reconciliation.reconcile()
    assert not [
        q for q in captured if q["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
    ]
    assert sorted((d.code, d.proforma_id) for d in differences) == sorted(
        [("converted_without_sale", issued["id"]), ("sale_without_conversion", other["id"])]
    )
    assert list(Proforma.objects.order_by("pk").values_list("pk", "state", "version")) == before
    errors = StringIO()
    with pytest.raises(CommandError, match="2 diferencias"):
        call_command("reconcile_proformas", stderr=errors)
    assert "converted_without_sale" in errors.getvalue()
    orphan = proforma_links.ProformaSaleLink(987654, real[0].sale_id, "DRAFT", None)
    monkeypatch.setattr(proforma_links, "all_sale_links", lambda: (*real, orphan))
    assert [(d.code, d.proforma_id) for d in reconciliation.reconcile()] == [
        ("sale_without_proforma", 987654)
    ]


def test_reconciliation_command_succeeds_when_consistent(
    issued: dict[str, Any], convert: Any
) -> None:
    convert(issued)
    out = StringIO()
    call_command("reconcile_proformas", stdout=out)
    assert "sin diferencias" in out.getvalue()
