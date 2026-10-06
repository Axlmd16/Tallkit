"""Anulación explícita, estado efectivo, consultas paginadas y documento histórico."""

from decimal import Decimal
from typing import Any

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from identity.models import AuditEvent
from proformas.application import drafts, issuing, queries
from proformas.application.errors import ProformaApplicationError
from proformas.models import Proforma
from workshop_configuration.models import NumberAllocation

from .conftest import key

pytestmark = pytest.mark.django_db
D = Decimal


def void(actor: Any, body: dict[str, Any], **extra: Any) -> Any:
    payload = {"idempotency_key": key("void"), "expected_version": body["version"], **extra}
    return issuing.void_proforma(actor=actor, proforma_id=body["id"], payload=payload)


def test_validity_limit_without_manual_intervention(
    issued: dict[str, Any], seller: Any, at: Any
) -> None:
    at(2026, 10, 13, 23, 59)
    assert queries.get_proforma(actor=seller, proforma_id=issued["id"])["state"] == "VALID"
    at(2026, 10, 14, 0, 0)
    detail = queries.get_proforma(actor=seller, proforma_id=issued["id"])
    assert detail["state"] == "EXPIRED"
    assert "convert" not in detail["allowed_actions"]
    assert {"copy", "void", "print"} <= set(detail["allowed_actions"])
    stored = Proforma.objects.get(pk=issued["id"])
    assert (stored.state, stored.version) == ("ISSUED", issued["version"])


def test_queries_never_write(issued: dict[str, Any], seller: Any, at: Any) -> None:
    at(2026, 11, 1)
    with CaptureQueriesContext(connection) as captured:
        queries.get_proforma(actor=seller, proforma_id=issued["id"])
        queries.list_proformas(actor=seller, state="EXPIRED")
        queries.document(actor=seller, proforma_id=issued["id"])
    writes = [
        q["sql"]
        for q in captured
        if q["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
    ]
    assert not writes, writes


@pytest.mark.parametrize("when", [(2026, 10, 7), (2026, 11, 1)])
def test_void_valid_or_expired_offer_keeps_number_content_and_history(
    when: tuple[int, int, int], issued: dict[str, Any], seller: Any, at: Any
) -> None:
    at(*when)
    body = void(seller, issued).body
    assert (body["state"], body["internal_number"]) == ("VOIDED", "COM-PRO-000001")
    assert body["totals"] == {"base": "20.00", "tax": "3.00", "total": "23.00"}
    assert body["lines"][0]["quantity"] == "2"
    assert set(body["allowed_actions"]) == {"copy", "print"}
    assert NumberAllocation.objects.count() == 1
    stored = Proforma.objects.get(pk=issued["id"])
    assert stored.voided_by_id == seller.pk
    assert AuditEvent.objects.filter(action="proformas.proforma_voided", result="SUCCESS").exists()


def test_voiding_never_releases_the_number(
    issued: dict[str, Any], new_draft: Any, issue: Any, seller: Any, product: Any
) -> None:
    void(seller, issued)
    assert issue(new_draft((product, 1)))["internal_number"] == "COM-PRO-000002"


def test_terminal_state_is_kept_and_never_reactivated(
    issued: dict[str, Any], seller: Any, at: Any
) -> None:
    voided = void(seller, issued).body
    at(2026, 12, 1)
    assert queries.get_proforma(actor=seller, proforma_id=issued["id"])["state"] == "VOIDED"
    with pytest.raises(ProformaApplicationError) as error:
        void(seller, voided)
    assert error.value.code == "proforma_voided"
    with pytest.raises(ProformaApplicationError):
        drafts.update_draft(
            actor=seller,
            proforma_id=issued["id"],
            payload={"idempotency_key": key(), "expected_version": voided["version"]},
        )
    assert Proforma.objects.get(pk=issued["id"]).state == "VOIDED"


def test_void_is_idempotent_and_checks_the_version(issued: dict[str, Any], seller: Any) -> None:
    with pytest.raises(ProformaApplicationError) as error:
        void(seller, issued, expected_version=issued["version"] + 5)
    assert error.value.code == "stale_record"
    first = void(seller, issued, idempotency_key="anular-clave-01")
    second = void(seller, issued, idempotency_key="anular-clave-01")
    assert (first.replayed, second.replayed) == (False, True)
    assert second.body["state"] == "VOIDED"


def test_draft_can_be_voided_without_number(new_draft: Any, seller: Any, product: Any) -> None:
    body = void(seller, new_draft((product, 1))).body
    assert (body["state"], body["internal_number"]) == ("VOIDED", None)
    assert not NumberAllocation.objects.exists()


def test_search_filter_and_navigate(
    new_draft: Any,
    issue: Any,
    seller: Any,
    admin: Any,
    product: Any,
    customer: Any,
    at: Any,
) -> None:
    from customer_registry.models import Customer

    at(2026, 10, 1)
    expired = issue(new_draft((product, 1)))
    at(2026, 10, 9)
    other = Customer.objects.create(
        person_type="NATURAL",
        name="Segundo Comprador",
        identification_type="CI",
        identification="0912345678",
        phone="0988888888",
    )
    valid = issue(new_draft((product, 1), customer_id=other.pk))
    voided = void(seller, issue(new_draft((product, 1)))).body
    draft = new_draft((product, 1))
    copy = drafts.copy_proforma(
        actor=seller, proforma_id=expired["id"], payload={"idempotency_key": key()}
    ).body

    def ids(**filters: Any) -> list[int]:
        return [row["id"] for row in queries.list_proformas(actor=seller, **filters)["items"]]

    assert ids() == [copy["id"], draft["id"], voided["id"], valid["id"], expired["id"]]
    assert ids(state="EXPIRED") == [expired["id"]]
    assert ids(state="VALID") == [valid["id"]]
    assert ids(state="VOIDED") == [voided["id"]]
    assert ids(state="DRAFT") == [copy["id"], draft["id"]]
    assert ids(search="segundo") == [valid["id"]]
    assert ids(search="0912345678") == [valid["id"]]
    assert ids(search="COM-PRO-000001") == [expired["id"]]
    assert ids(search="Cliente Proforma", state="VOIDED") == [voided["id"]]
    assert ids(customer_id=other.pk) == [valid["id"]]
    row = queries.list_proformas(actor=seller, state="EXPIRED")["items"][0]
    assert (row["internal_number"], row["grand_total"], row["state"]) == (
        "COM-PRO-000001",
        "11.50",
        "EXPIRED",
    )
    assert row["customer"]["name"] == "Cliente Proforma"
    detail = queries.get_proforma(actor=seller, proforma_id=expired["id"])
    assert detail["derived"] == [{"id": copy["id"], "number": None, "state": "DRAFT"}]
    assert (
        queries.get_proforma(actor=seller, proforma_id=copy["id"])["origin"]["id"] == expired["id"]
    )
    with pytest.raises(ProformaApplicationError):
        queries.list_proformas(actor=seller, state="VENCIDA")


def test_list_and_detail_share_the_same_local_clock(
    issued: dict[str, Any], seller: Any, at: Any
) -> None:
    for moment, state in (((2026, 10, 13, 23, 59), "VALID"), ((2026, 10, 14, 0, 0), "EXPIRED")):
        at(*moment)
        listed = queries.list_proformas(actor=seller, state=state)["items"]
        assert [row["state"] for row in listed] == [state]
        assert queries.get_proforma(actor=seller, proforma_id=issued["id"])["state"] == state


def test_pagination_is_stable_and_bounded(new_draft: Any, seller: Any, product: Any) -> None:
    created = [new_draft((product, 1))["id"] for _ in range(5)]
    first = queries.list_proformas(actor=seller, page=1, page_size=2)
    second = queries.list_proformas(actor=seller, page=2, page_size=2)
    third = queries.list_proformas(actor=seller, page=3, page_size=2)
    seen = [row["id"] for page in (first, second, third) for row in page["items"]]
    assert seen == sorted(created, reverse=True)
    assert first["total_count"] == 5
    for page, size in ((0, 20), (1, 0), (1, 101)):
        with pytest.raises(ProformaApplicationError):
            queries.list_proformas(actor=seller, page=page, page_size=size)


def test_document_is_historical_and_separates_current_availability(
    new_draft: Any, issue: Any, seller: Any, product: Any, stock: Any, at: Any
) -> None:
    at(2026, 10, 6)
    stock(product, 1)
    issued = issue(new_draft((product, 3)))
    stock(product, 5)
    document = queries.document(actor=seller, proforma_id=issued["id"])
    line = document["lines"][0]
    assert (line["availability_at_issue"], line["availability_sufficient"]) == ("1", False)
    assert document["current_availability"] == [
        {"position": 1, "product_code": product.code, "available": "6"}
    ]
    assert document["availability_observed_at"].startswith("2026-10-06")
    assert (document["number"], document["state"], document["valid_until"]) == (
        "COM-PRO-000001",
        "VALID",
        "2026-10-13",
    )
    assert "No reserva" in document["notice"]
    assert "no es una factura" in document["notice"].lower()
    flat = str(document).lower()
    assert "cost" not in flat
    assert "condition" not in flat
    assert "artesanal" not in flat
    assert "product_id" not in line


def test_document_after_void_or_expiry_keeps_values_and_shows_state(
    issued: dict[str, Any], seller: Any, at: Any
) -> None:
    at(2026, 11, 1)
    expired = queries.document(actor=seller, proforma_id=issued["id"])
    assert (expired["state"], expired["valid_until"], expired["grand_total"]) == (
        "EXPIRED",
        "2026-10-13",
        "23.00",
    )
    void(seller, queries.get_proforma(actor=seller, proforma_id=issued["id"]))
    voided = queries.document(actor=seller, proforma_id=issued["id"])
    assert (voided["state"], voided["valid_until"], voided["grand_total"]) == (
        "VOIDED",
        "2026-10-13",
        "23.00",
    )


def test_draft_has_no_document_or_invented_number(
    new_draft: Any, seller: Any, product: Any
) -> None:
    body = new_draft((product, 1))
    assert "print" not in body["allowed_actions"]
    for call in (queries.document, queries.document_logo):
        with pytest.raises(ProformaApplicationError) as error:
            call(actor=seller, proforma_id=body["id"])
        assert error.value.code == "proforma_not_issued"
    with pytest.raises(ProformaApplicationError) as error:
        queries.get_proforma(actor=seller, proforma_id=999999)
    assert error.value.code == "not_found"


def test_document_shows_the_manufacturer_code_frozen_at_issue(
    new_draft: Any, issue: Any, seller: Any, make_product: Any, at: Any
) -> None:
    at(2026, 10, 6)
    product = make_product(manufacturer_code="FAB-778")
    plain = make_product()
    draft = new_draft((product, 1), (plain, 1))
    assert [line["manufacturer_code"] for line in draft["lines"]] == ["FAB-778", ""]
    issued = issue(draft)
    type(product).objects.filter(pk=product.pk).update(manufacturer_code="OTRO-1")
    document = queries.document(actor=seller, proforma_id=issued["id"])
    assert [line["manufacturer_code"] for line in document["lines"]] == ["FAB-778", ""]
    detail = queries.get_proforma(actor=seller, proforma_id=issued["id"])
    assert detail["lines"][0]["manufacturer_code"] == "FAB-778"


def test_offer_issued_before_the_code_was_frozen_falls_back_to_the_catalog(
    new_draft: Any,
    issue: Any,
    seller: Any,
    product: Any,
    at: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Las ofertas emitidas antes de conservar el código lo toman del catálogo vigente."""
    original = issuing._product_snapshot

    def without_code(ref: Any, *, sufficient: bool) -> dict[str, Any]:
        snapshot = original(ref, sufficient=sufficient)
        del snapshot["manufacturer_code"]
        return snapshot

    monkeypatch.setattr(issuing, "_product_snapshot", without_code)
    at(2026, 10, 6)
    issued = issue(new_draft((product, 1)))
    type(product).objects.filter(pk=product.pk).update(manufacturer_code="CAT-9")
    document = queries.document(actor=seller, proforma_id=issued["id"])
    assert document["lines"][0]["manufacturer_code"] == "CAT-9"


def test_document_shows_the_product_brand_frozen_at_issue(
    new_draft: Any, issue: Any, seller: Any, make_product: Any, at: Any
) -> None:
    from catalog.models import ProductBrand

    at(2026, 10, 6)
    brand = ProductBrand.objects.create(name="Eaton")
    branded = make_product(product_brand=brand)
    plain = make_product()
    draft = new_draft((branded, 1), (plain, 1))
    assert [line["brand_name"] for line in draft["lines"]] == ["Eaton", ""]
    issued = issue(draft)
    ProductBrand.objects.filter(pk=brand.pk).update(name="Otra marca")
    document = queries.document(actor=seller, proforma_id=issued["id"])
    assert [line["brand_name"] for line in document["lines"]] == ["Eaton", ""]
