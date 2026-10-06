"""Revisión firmada, emisión numerada, reemisión y rollback de la oferta."""

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.core import signing
from tests.workshop_configuration.logo_helpers import image_bytes, upload

from identity.models import AuditEvent
from inventory.application.reservations import read_availability
from inventory.models import InventoryMovement
from proformas.application import drafts, issuing, reviews
from proformas.application.errors import ProformaApplicationError
from proformas.models import Proforma, ProformaBrandAsset, ProformaCommand
from sales.models import CommercialPayment, Sale
from workshop_configuration.application import entity_logos
from workshop_configuration.models import (
    ConfigurationUse,
    DocumentSeries,
    NumberAllocation,
    TaxPeriod,
)

from .conftest import key

pytestmark = pytest.mark.django_db
D = Decimal


def emit(actor: Any, body: dict[str, Any], review: dict[str, Any], **extra: Any) -> Any:
    payload = {
        "idempotency_key": key("emit"),
        "expected_version": review["version"],
        "review_token": review["review_token"],
    }
    payload.update(extra)
    return issuing.issue_proforma(actor=actor, proforma_id=body["id"], payload=payload)


def still_draft(body: dict[str, Any], commercial: dict[str, Any]) -> None:
    proforma = Proforma.objects.get(pk=body["id"])
    assert (proforma.state, proforma.internal_number, proforma.header_snapshot) == (
        "DRAFT",
        None,
        None,
    )
    assert proforma.lines.filter(unit_price__isnull=False).count() == 0
    assert not NumberAllocation.objects.exists()
    assert not ConfigurationUse.objects.exists()
    commercial["series"].refresh_from_db()
    assert commercial["series"].last_number == 0
    assert not AuditEvent.objects.filter(
        action="proformas.proforma_issued", result="SUCCESS"
    ).exists()


def upload_logo(admin: Any, commercial: dict[str, Any], size: tuple[int, int] = (120, 40)) -> None:
    entity_logos.upload_entity_logo(
        actor=admin,
        entity_id=commercial["entity"].pk,
        file=upload(image_bytes(size=size)),
        idempotency_key=f"logo-{uuid.uuid4().hex}",
    )


# --- Revisión -------------------------------------------------------------------------------


def test_previews_write_nothing(
    new_draft: Any, seller: Any, product: Any, customer: Any, commercial: Any, at: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 2))
    before = (ProformaCommand.objects.count(), AuditEvent.objects.count())
    capture = reviews.preview_draft(
        actor=seller,
        payload={"customer_id": customer.pk, "lines": [{"product_id": product.pk, "quantity": 2}]},
    )
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    assert (
        capture["totals"] == review["totals"] == {"base": "20.00", "tax": "3.00", "total": "23.00"}
    )
    assert (capture["can_issue"], review["can_issue"]) == (False, True)
    assert (ProformaCommand.objects.count(), AuditEvent.objects.count()) == before
    still_draft(body, commercial)
    assert Proforma.objects.get(pk=body["id"]).version == 1


def test_suggested_validity_and_adjustment(
    new_draft: Any, seller: Any, product: Any, at: Any, issue: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 1))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    assert (review["issue_date"], review["valid_until"], review["suggested_valid_until"]) == (
        "2026-10-06",
        "2026-10-13",
        "2026-10-13",
    )
    adjusted = drafts.update_draft(
        actor=seller,
        proforma_id=body["id"],
        payload={"idempotency_key": key(), "expected_version": 1, "valid_until": "2026-10-20"},
    ).body
    issued = issue(adjusted)
    assert (issued["issue_date"], issued["valid_until"]) == ("2026-10-06", "2026-10-20")


def test_token_is_bound_to_actor_document_version_and_time(
    new_draft: Any, seller: Any, admin: Any, product: Any, commercial: Any, at: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 1))
    other = new_draft((product, 1))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    assert review["expires_in_seconds"] == 900
    payload = signing.loads(review["review_token"], salt=reviews.REVIEW_SALT)
    assert set(payload) == {"a", "act", "p", "v", "d"}
    with pytest.raises(ProformaApplicationError) as error:
        emit(admin, body, review)
    assert error.value.errors["review_token"] == ["La revisión no corresponde."]
    with pytest.raises(ProformaApplicationError):
        emit(seller, other, review)
    with pytest.raises(ProformaApplicationError):
        emit(seller, body, review, review_token="manipulado")
    with pytest.raises(ProformaApplicationError) as error:
        reviews.read_token(
            review["review_token"],
            actor=seller,
            action=reviews.ISSUE_ACTION,
            proforma_id=body["id"],
            version=1,
            max_age=-1,
        )
    assert error.value.code == "review_required"
    still_draft(body, commercial)


@pytest.mark.parametrize("change", ["price", "rate", "quantity", "validity", "customer", "day"])
def test_relevant_change_after_review_requires_a_new_review(
    change: str,
    new_draft: Any,
    seller: Any,
    product: Any,
    customer: Any,
    commercial: Any,
    at: Any,
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 2))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    version = review["version"]
    if change == "price":
        type(product).objects.filter(pk=product.pk).update(sale_price=D("12.00"))
    elif change == "rate":
        TaxPeriod.objects.filter(pk=commercial["period"].pk).update(rate=D("12"))
    elif change == "customer":
        type(customer).objects.filter(pk=customer.pk).update(name="Otro nombre")
    elif change == "day":
        at(2026, 10, 7)
    else:
        fields = (
            {"lines": [{"product_id": product.pk, "quantity": "3"}]}
            if change == "quantity"
            else {"valid_until": "2026-10-30"}
        )
        version = drafts.update_draft(
            actor=seller,
            proforma_id=body["id"],
            payload={"idempotency_key": key(), "expected_version": 1, **fields},
        ).body["version"]
    with pytest.raises(ProformaApplicationError) as error:
        emit(seller, body, review, expected_version=version)
    assert error.value.code in {"review_required", "validation_error"}
    still_draft(body, commercial)
    fresh = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    assert emit(seller, body, fresh).body["state"] == "VALID"


def test_missing_tax_configuration_is_an_impediment_not_an_exemption(
    new_draft: Any, seller: Any, make_product: Any, commercial: Any, at: Any
) -> None:
    from workshop_configuration.models import TaxDefinition

    at(2026, 10, 6)
    without_rate = TaxDefinition.objects.create(
        fiscal_entity=commercial["entity"], code="SIN", name="Sin vigencia"
    )
    body = new_draft((make_product(tax_definition=without_rate), 1))
    assert body["totals"] is None
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    assert review["can_issue"] is False
    assert review["review_token"] is None
    assert review["issues"][0]["code"] == "configuration_missing"
    assert review["lines"][0]["tax_amount"] is None
    still_draft(body, commercial)


def test_incomplete_offer_cannot_be_issued(
    new_draft: Any, seller: Any, customer: Any, commercial: Any, at: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft()
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    assert [issue["field"] for issue in review["issues"]] == ["lines"]
    type(customer).objects.filter(pk=customer.pk).update(is_active=False)
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    assert {issue["field"] for issue in review["issues"]} == {"customer_id", "lines"}
    still_draft(body, commercial)


def test_product_deactivated_before_issuing_identifies_the_line(
    new_draft: Any, seller: Any, product: Any, make_product: Any, commercial: Any, at: Any
) -> None:
    at(2026, 10, 6)
    other = make_product()
    body = new_draft((product, 1), (other, 1))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    type(other).objects.filter(pk=other.pk).update(is_active=False)
    with pytest.raises(ProformaApplicationError) as error:
        emit(seller, body, review)
    assert error.value.code == "inactive_reference"
    assert list(error.value.errors) == ["lines.1.product_id"]
    still_draft(body, commercial)
    assert Proforma.objects.get(pk=body["id"]).lines.count() == 2


def test_validity_before_today_must_be_corrected(
    new_draft: Any, seller: Any, product: Any, commercial: Any, at: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 1), valid_until="2026-10-08")
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    at(2026, 10, 9)
    late = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    assert late["can_issue"] is False
    assert [issue["field"] for issue in late["issues"]] == ["valid_until"]
    with pytest.raises(ProformaApplicationError) as error:
        emit(seller, body, review)
    assert "valid_until" in error.value.errors or error.value.code == "review_required"
    still_draft(body, commercial)


# --- Emisión --------------------------------------------------------------------------------


def test_valid_issue_numbers_and_freezes_the_offer_without_economic_effects(
    new_draft: Any, issue: Any, seller: Any, product: Any, stock: Any, commercial: Any, at: Any
) -> None:
    at(2026, 10, 6)
    stock(product, 5)
    movements = InventoryMovement.objects.count()
    body = issue(new_draft((product, 2)))
    assert (body["state"], body["internal_number"]) == ("VALID", "COM-PRO-000001")
    assert (body["issue_date"], body["valid_until"]) == ("2026-10-06", "2026-10-13")
    assert body["totals"] == {"base": "20.00", "tax": "3.00", "total": "23.00"}
    proforma = Proforma.objects.get(pk=body["id"])
    assert proforma.state == "ISSUED"
    assert proforma.header_snapshot is not None
    assert proforma.header_snapshot["issuer"]["ruc"] == "1790000000001"
    assert proforma.header_snapshot["customer"]["name"] == "Cliente Proforma"
    assert proforma.header_snapshot["series_code"] == "COM-PRO"
    line = proforma.lines.get()
    assert (line.unit_price, line.tax_rate, line.base_amount, line.tax_amount) == (
        D("11.50"),
        D("15"),
        D("20.00"),
        D("3.00"),
    )
    assert line.availability_at_issue == D(5)
    allocation = NumberAllocation.objects.get()
    assert (allocation.consumer_type, allocation.consumer_id, allocation.request_key) == (
        "proforma",
        str(proforma.pk),
        f"proforma:{proforma.pk}:issue",
    )
    assert allocation.series.code == "COM-PRO"
    assert ConfigurationUse.objects.filter(consumer_type="proforma").count() == 1
    commercial["sale_series"].refresh_from_db()
    assert commercial["sale_series"].last_number == 0
    availability = read_availability([product.pk], warehouse_id=commercial["warehouse"].pk)
    assert (availability[product.pk].quantity, availability[product.pk].reserved) == (D(5), D(0))
    assert InventoryMovement.objects.count() == movements
    assert not Sale.objects.exists()
    assert not CommercialPayment.objects.exists()
    event = AuditEvent.objects.get(action="proformas.proforma_issued", result="SUCCESS")
    assert event.target_id == str(proforma.pk)
    assert event.actor_id == seller.pk


def test_quoting_above_availability_is_allowed_and_recorded(
    new_draft: Any,
    issue: Any,
    seller: Any,
    product: Any,
    make_product: Any,
    stock: Any,
    commercial: Any,
    at: Any,
) -> None:
    from catalog.application.inventory_references import lock_product_references
    from inventory.application import posting
    from inventory.application.reservations import reserve

    at(2026, 10, 6)
    stock(product, 5)
    refs = lock_product_references([product.pk])
    locked = posting.lock_positions(refs, warehouse_id=commercial["warehouse"].pk)
    reserve(
        locked,
        product_id=product.pk,
        source_type="SALE_LINE",
        source_id=987654,
        source_reference={"prueba": True},
        quantity=D(4),
    )
    draft = new_draft((product, 3))
    assert draft["lines"][0]["availability"] == "1"
    assert draft["warnings"][0]["code"] == "insufficient_availability"
    review = reviews.preview_issue(actor=seller, proforma_id=draft["id"])
    assert review["can_issue"] is True
    assert review["warnings"][0]["available"] == "1"
    body = issue(draft)
    assert body["lines"][0]["availability_at_issue"] == "1"
    assert body["lines"][0]["availability_sufficient"] is False
    availability = read_availability([product.pk], warehouse_id=commercial["warehouse"].pk)
    assert (availability[product.pk].quantity, availability[product.pk].reserved) == (D(5), D(4))


def test_availability_change_between_review_and_issue_only_updates_the_notice(
    new_draft: Any, seller: Any, product: Any, stock: Any, at: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 3))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    stock(product, 6)
    issued = emit(seller, body, review).body
    assert issued["lines"][0]["availability_at_issue"] == "6"
    assert issued["lines"][0]["availability_sufficient"] is True


def test_master_data_changes_do_not_recalculate_the_issued_offer(
    issued: dict[str, Any], seller: Any, product: Any, customer: Any, commercial: Any
) -> None:
    from proformas.application import queries
    from workshop_configuration.models import FiscalEntity

    type(product).objects.filter(pk=product.pk).update(sale_price=D("99.00"), name="Renombrado")
    type(customer).objects.filter(pk=customer.pk).update(name="Cliente cambiado")
    TaxPeriod.objects.filter(pk=commercial["period"].pk).update(rate=D("0"))
    FiscalEntity.objects.filter(pk=commercial["entity"].pk).update(legal_name="Otra razón")
    detail = queries.get_proforma(actor=seller, proforma_id=issued["id"])
    document = queries.document(actor=seller, proforma_id=issued["id"])
    assert detail["customer"]["name"] == document["customer"]["name"] == "Cliente Proforma"
    assert document["issuer"]["legal_name"] == "Comercial SA"
    assert detail["lines"][0]["unit_price"] == "11.50"
    assert detail["lines"][0]["product_name"] != "Renombrado"
    assert (document["base_total"], document["tax_total"], document["grand_total"]) == (
        "20.00",
        "3.00",
        "23.00",
    )


def test_missing_active_proforma_series_never_uses_another_series(
    new_draft: Any, seller: Any, product: Any, commercial: Any, at: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 1))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    DocumentSeries.objects.filter(pk=commercial["series"].pk).update(is_active=False)
    with pytest.raises(ProformaApplicationError) as error:
        emit(seller, body, review)
    assert error.value.code == "configuration_missing"
    assert "series" in error.value.errors
    still_draft(body, commercial)
    commercial["sale_series"].refresh_from_db()
    assert commercial["sale_series"].last_number == 0
    failure = AuditEvent.objects.get(action="proformas.proforma_issued", result="FAILURE")
    assert failure.reason == "configuration_missing"


def test_missing_scope_is_reported_in_the_review(
    new_draft: Any, seller: Any, product: Any, commercial: Any, at: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 1))
    commercial["series"].delete()
    commercial["scope"].delete()
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    assert review["can_issue"] is False
    assert {"code": "configuration_missing", "field": "series"}.items() <= review["issues"][
        0
    ].items()


@pytest.mark.parametrize("stage", ["numbering", "brand", "history"])
def test_failure_during_issue_rolls_everything_back(
    stage: str,
    new_draft: Any,
    seller: Any,
    admin: Any,
    product: Any,
    commercial: Any,
    at: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    at(2026, 10, 6)
    upload_logo(admin, commercial)
    body = new_draft((product, 2))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])

    def boom(*args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("fallo inyectado")

    if stage == "numbering":
        original = issuing.allocate_number  # type: ignore[attr-defined]

        def after_numbering(**kwargs: Any) -> Any:
            original(**kwargs)
            raise RuntimeError("fallo inyectado")

        monkeypatch.setattr(issuing, "allocate_number", after_numbering)
    elif stage == "brand":
        original_asset = issuing._brand_asset

        def after_brand(brand: Any) -> Any:
            original_asset(brand)
            raise RuntimeError("fallo inyectado")

        monkeypatch.setattr(issuing, "_brand_asset", after_brand)
    else:
        monkeypatch.setattr(Proforma, "save", boom)
    with pytest.raises(RuntimeError, match="fallo inyectado"):
        emit(seller, body, review)
    monkeypatch.undo()
    at(2026, 10, 6)
    still_draft(body, commercial)
    assert not ProformaBrandAsset.objects.exists()
    assert not ProformaCommand.objects.filter(action="proformas.proforma_issued").exists()
    retry = emit(seller, body, reviews.preview_issue(actor=seller, proforma_id=body["id"]))
    assert retry.body["internal_number"] == "COM-PRO-000001"


def test_rejection_is_audited_outside_the_rollback_without_personal_data(
    new_draft: Any, seller: Any, product: Any, customer: Any, at: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 1))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    type(product).objects.filter(pk=product.pk).update(sale_price=D("50.00"))
    with pytest.raises(ProformaApplicationError):
        emit(seller, body, review)
    event = AuditEvent.objects.get(action="proformas.proforma_issued", result="FAILURE")
    assert event.reason == "review_required"
    assert customer.name not in str(event.metadata) + event.reason
    assert customer.identification not in str(event.metadata) + event.reason


# --- Reemisión ------------------------------------------------------------------------------


def test_reissue_with_another_key_returns_the_same_number(
    new_draft: Any, seller: Any, product: Any, commercial: Any, at: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 2))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    first = emit(seller, body, review, idempotency_key="emision-clave-0001")
    same_key = emit(seller, body, review, idempotency_key="emision-clave-0001")
    at(2026, 12, 1)  # vencida y con el token ya caducado
    other_key = emit(seller, body, review, idempotency_key="emision-clave-0002")
    assert same_key.replayed is True
    assert first.body["internal_number"] == other_key.body["internal_number"] == "COM-PRO-000001"
    assert other_key.body["state"] == "EXPIRED"
    assert NumberAllocation.objects.count() == 1
    assert ConfigurationUse.objects.count() == 1
    commercial["series"].refresh_from_db()
    assert commercial["series"].last_number == 1
    assert (
        AuditEvent.objects.filter(action="proformas.proforma_issued", result="SUCCESS").count() == 1
    )


def test_reissue_with_a_different_review_is_a_conflict(
    new_draft: Any, seller: Any, product: Any, at: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 2))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    emit(seller, body, review)
    forged = reviews.issue_token(
        actor=seller,
        action=reviews.ISSUE_ACTION,
        proforma_id=body["id"],
        version=1,
        digest="0" * 64,
    )
    with pytest.raises(ProformaApplicationError) as error:
        emit(seller, body, review, review_token=forged)
    assert error.value.code == "idempotency_conflict"
    assert NumberAllocation.objects.count() == 1


# --- Marca histórica ------------------------------------------------------------------------


def test_logo_bytes_are_frozen_and_deduplicated(
    new_draft: Any, issue: Any, seller: Any, admin: Any, product: Any, commercial: Any, at: Any
) -> None:
    from proformas.application import queries

    at(2026, 10, 6)
    upload_logo(admin, commercial)
    first = issue(new_draft((product, 1)))
    second = issue(new_draft((product, 1)))
    assert ProformaBrandAsset.objects.count() == 1
    historical = queries.document_logo(actor=seller, proforma_id=first["id"])
    assert historical is not None
    upload_logo(admin, commercial, size=(60, 60))
    third = issue(new_draft((product, 1)))
    assert ProformaBrandAsset.objects.count() == 2
    assert queries.document_logo(actor=seller, proforma_id=first["id"]) == historical
    assert queries.document_logo(actor=seller, proforma_id=second["id"]) == historical
    assert queries.document_logo(actor=seller, proforma_id=third["id"]) != historical
    entity_logos.remove_entity_logo(
        actor=admin, entity_id=commercial["entity"].pk, idempotency_key=f"logo-{uuid.uuid4().hex}"
    )
    assert queries.document_logo(actor=seller, proforma_id=first["id"]) == historical
    assert queries.document(actor=seller, proforma_id=first["id"])["has_logo"] is True


def test_offer_issued_without_logo_keeps_that_absence(
    issued: dict[str, Any], seller: Any, admin: Any, commercial: Any
) -> None:
    from proformas.application import queries

    upload_logo(admin, commercial)
    assert queries.document_logo(actor=seller, proforma_id=issued["id"]) is None
    assert queries.document(actor=seller, proforma_id=issued["id"])["has_logo"] is False


def test_logo_replaced_after_review_requires_a_new_review(
    new_draft: Any, seller: Any, admin: Any, product: Any, commercial: Any, at: Any
) -> None:
    at(2026, 10, 6)
    upload_logo(admin, commercial)
    body = new_draft((product, 1))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    upload_logo(admin, commercial, size=(60, 60))
    with pytest.raises(ProformaApplicationError) as error:
        emit(seller, body, review)
    assert error.value.code == "review_required"
    still_draft(body, commercial)
    assert not ProformaBrandAsset.objects.exists()


def test_unreadable_logo_is_a_correctable_error_not_a_silent_omission(
    new_draft: Any, seller: Any, admin: Any, product: Any, commercial: Any, at: Any
) -> None:
    from workshop_configuration.application import logo_storage
    from workshop_configuration.models import FiscalEntityLogo

    at(2026, 10, 6)
    upload_logo(admin, commercial)
    body = new_draft((product, 1))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    logo_storage.delete_files(FiscalEntityLogo.objects.get().storage_name)
    broken = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    assert broken["can_issue"] is False
    assert broken["issues"][0]["code"] == "logo_unreadable"
    with pytest.raises(ProformaApplicationError) as error:
        emit(seller, body, review)
    assert error.value.code == "logo_unreadable"
    still_draft(body, commercial)
