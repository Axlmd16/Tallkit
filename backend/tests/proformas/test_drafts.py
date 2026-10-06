"""Borradores de oferta: creación, guardado y copia sin efectos definitivos."""

from decimal import Decimal
from typing import Any

import pytest

from identity.models import AuditEvent
from inventory.application.reservations import read_availability
from inventory.models import InventoryMovement
from proformas.application import drafts
from proformas.application.errors import ProformaApplicationError
from proformas.models import Proforma, ProformaCommand
from sales.models import CommercialPayment, Sale
from workshop_configuration.models import ConfigurationUse, NumberAllocation

from .conftest import key

pytestmark = pytest.mark.django_db
D = Decimal


def no_definitive_effects(commercial: dict[str, Any]) -> None:
    assert not NumberAllocation.objects.exists()
    assert not ConfigurationUse.objects.exists()
    assert not Sale.objects.exists()
    assert not CommercialPayment.objects.exists()
    commercial["series"].refresh_from_db()
    assert commercial["series"].last_number == 0


def test_prepare_and_correct_the_draft(
    new_draft: Any, seller: Any, product: Any, stock: Any, commercial: Any
) -> None:
    stock(product, 5)
    movements = InventoryMovement.objects.count()
    body = new_draft((product, 2))
    assert (body["state"], body["internal_number"], body["version"]) == ("DRAFT", None, 1)
    assert body["lines"][0]["quantity"] == "2"
    assert body["lines"][0]["unit_price"] == "11.50"
    assert body["totals"] == {"base": "20.00", "tax": "3.00", "total": "23.00"}
    updated = drafts.update_draft(
        actor=seller,
        proforma_id=body["id"],
        payload={
            "idempotency_key": key(),
            "expected_version": 1,
            "lines": [{"product_id": product.pk, "quantity": "4"}],
        },
    ).body
    assert (updated["version"], updated["lines"][0]["quantity"]) == (2, "4")
    assert updated["internal_number"] is None
    availability = read_availability([product.pk], warehouse_id=commercial["warehouse"].pk)
    assert (availability[product.pk].quantity, availability[product.pk].reserved) == (D(5), D(0))
    assert InventoryMovement.objects.count() == movements
    no_definitive_effects(commercial)


def test_incompatible_line_is_not_partially_saved(
    new_draft: Any, seller: Any, product: Any, make_product: Any
) -> None:
    body = new_draft((product, 2))
    other = make_product()
    with pytest.raises(ProformaApplicationError) as error:
        drafts.update_draft(
            actor=seller,
            proforma_id=body["id"],
            payload={
                "idempotency_key": key(),
                "expected_version": 1,
                "lines": [
                    {"product_id": other.pk, "quantity": "1"},
                    {"product_id": product.pk, "quantity": "1.5"},
                ],
            },
        )
    assert error.value.code == "validation_error"
    proforma = Proforma.objects.get(pk=body["id"])
    assert proforma.version == 1
    assert [(line.product_id, line.quantity) for line in proforma.lines.all()] == [
        (product.pk, D(2))
    ]
    for bad in ({"service_id": 1}, {"entity_type": "ARTESANAL"}):
        with pytest.raises(ProformaApplicationError):
            drafts.create_draft(
                actor=seller,
                payload={
                    "idempotency_key": key(),
                    "customer_id": proforma.customer_id,
                    "lines": [],
                    **bad,
                },
            )
    assert Proforma.objects.count() == 1


def test_manual_price_or_discount_from_an_administrator_is_rejected(
    admin: Any, customer: Any, make_product: Any
) -> None:
    product = make_product(sale_price=D("10.00"))
    for extra in ({"unit_price": "9.00"}, {"discount": "0"}, {"tax_rate": "0"}):
        with pytest.raises(ProformaApplicationError) as error:
            drafts.create_draft(
                actor=admin,
                payload={
                    "idempotency_key": key(),
                    "customer_id": customer.pk,
                    "lines": [{"product_id": product.pk, "quantity": "1", **extra}],
                },
            )
        assert error.value.code == "unknown_field"
    assert not Proforma.objects.exists()
    product.refresh_from_db()
    assert product.sale_price == D("10.00")


def test_kit_is_quoted_intact(new_draft: Any, make_product: Any, stock: Any) -> None:
    kit = make_product(is_kit=True)
    component = make_product()
    stock(component, 3)
    body = new_draft((kit, 1))
    assert len(body["lines"]) == 1
    assert (body["lines"][0]["product_id"], body["lines"][0]["is_kit"]) == (kit.pk, True)


def test_draft_requires_registered_active_references(
    seller: Any, customer: Any, make_product: Any
) -> None:
    inactive = make_product(is_active=False)
    with pytest.raises(ProformaApplicationError) as error:
        drafts.create_draft(
            actor=seller,
            payload={
                "idempotency_key": key(),
                "customer_id": customer.pk,
                "lines": [{"product_id": inactive.pk, "quantity": "1"}],
            },
        )
    assert error.value.code == "inactive_reference"
    assert list(error.value.errors) == ["lines.0.product_id"]
    with pytest.raises(ProformaApplicationError) as error:
        drafts.create_draft(
            actor=seller,
            payload={"idempotency_key": key(), "customer_id": 999999, "lines": []},
        )
    assert "customer_id" in error.value.errors


def test_lost_creation_response_returns_the_same_draft(
    seller: Any, customer: Any, product: Any
) -> None:
    payload = {
        "idempotency_key": "draft-perdido-0001",
        "customer_id": customer.pk,
        "lines": [{"product_id": product.pk, "quantity": "2"}],
    }
    first = drafts.create_draft(actor=seller, payload=payload)
    second = drafts.create_draft(actor=seller, payload=dict(payload))
    assert (first.replayed, second.replayed) == (False, True)
    assert first.body["id"] == second.body["id"]
    assert Proforma.objects.count() == 1
    assert AuditEvent.objects.filter(action="proformas.proforma_created").count() == 1
    assert ProformaCommand.objects.count() == 1


def test_reused_key_with_other_quantities_is_a_conflict(
    seller: Any, customer: Any, product: Any
) -> None:
    payload = {
        "idempotency_key": "draft-conflicto-01",
        "customer_id": customer.pk,
        "lines": [{"product_id": product.pk, "quantity": "2"}],
    }
    created = drafts.create_draft(actor=seller, payload=payload).body
    changed = {**payload, "lines": [{"product_id": product.pk, "quantity": "5"}]}
    with pytest.raises(ProformaApplicationError) as error:
        drafts.create_draft(actor=seller, payload=changed)
    assert error.value.code == "idempotency_conflict"
    assert Proforma.objects.count() == 1
    assert Proforma.objects.get(pk=created["id"]).lines.get().quantity == D(2)
    failure = AuditEvent.objects.filter(action="proformas.proforma_created", result="FAILURE")
    assert failure.get().reason == "idempotency_conflict"


def test_stale_save_does_not_overwrite(
    new_draft: Any, seller: Any, admin: Any, product: Any
) -> None:
    body = new_draft((product, 2))

    def save(actor: Any, quantity: str) -> Any:
        return drafts.update_draft(
            actor=actor,
            proforma_id=body["id"],
            payload={
                "idempotency_key": key(),
                "expected_version": 1,
                "lines": [{"product_id": product.pk, "quantity": quantity}],
            },
        )

    save(seller, "3")
    with pytest.raises(ProformaApplicationError) as error:
        save(admin, "9")
    assert error.value.code == "stale_record"
    proforma = Proforma.objects.get(pk=body["id"])
    assert (proforma.version, proforma.lines.get().quantity) == (2, D(3))


def test_issued_document_rejects_ordinary_edition(
    issued: dict[str, Any], seller: Any, product: Any
) -> None:
    with pytest.raises(ProformaApplicationError) as error:
        drafts.update_draft(
            actor=seller,
            proforma_id=issued["id"],
            payload={
                "idempotency_key": key(),
                "expected_version": issued["version"],
                "lines": [{"product_id": product.pk, "quantity": "9"}],
            },
        )
    assert error.value.code == "proforma_issued"
    assert "nueva vinculada" in error.value.message
    assert Proforma.objects.get(pk=issued["id"]).lines.get().quantity == D(2)


def test_copy_changes_quantities_only_in_the_new_draft(
    issued: dict[str, Any], seller: Any, product: Any
) -> None:
    copy = drafts.copy_proforma(
        actor=seller, proforma_id=issued["id"], payload={"idempotency_key": "copia-0000001"}
    ).body
    assert (copy["state"], copy["internal_number"]) == ("DRAFT", None)
    assert copy["origin"] == {"id": issued["id"], "number": "COM-PRO-000001", "state": "VALID"}
    assert copy["valid_until"] is None
    drafts.update_draft(
        actor=seller,
        proforma_id=copy["id"],
        payload={
            "idempotency_key": key(),
            "expected_version": 1,
            "lines": [{"product_id": product.pk, "quantity": "1"}],
        },
    )
    original = Proforma.objects.get(pk=issued["id"])
    assert (original.state, original.version, original.lines.get().quantity) == (
        "ISSUED",
        issued["version"],
        D(2),
    )
    replay = drafts.copy_proforma(
        actor=seller, proforma_id=issued["id"], payload={"idempotency_key": "copia-0000001"}
    )
    assert replay.replayed
    assert replay.body["id"] == copy["id"]
    assert Proforma.objects.count() == 2
    event = AuditEvent.objects.get(action="proformas.proforma_copied")
    assert (event.target_id, event.reason) == (str(copy["id"]), f"origin:{issued['id']}")


def test_copy_of_expired_offer_uses_current_price_and_keeps_the_original(
    new_draft: Any, issue: Any, seller: Any, make_product: Any, at: Any
) -> None:
    product = make_product(sale_price=D("10.00"))
    at(2026, 10, 6)
    original = issue(new_draft((product, 1)))
    type(product).objects.filter(pk=product.pk).update(sale_price=D("12.00"))
    at(2026, 10, 20)
    copy = drafts.copy_proforma(
        actor=seller, proforma_id=original["id"], payload={"idempotency_key": key()}
    ).body
    assert copy["lines"][0]["unit_price"] == "12.00"
    assert copy["origin"]["state"] == "EXPIRED"
    assert copy["suggested_valid_until"] == "2026-10-27"
    stored = Proforma.objects.get(pk=original["id"])
    assert (stored.state, stored.lines.get().unit_price) == ("ISSUED", D("10.00"))
    reissued = issue({"id": copy["id"]})
    assert reissued["internal_number"] == "COM-PRO-000002"


def test_copy_keeps_inactive_product_until_it_is_corrected(
    issued: dict[str, Any], seller: Any, product: Any, make_product: Any
) -> None:
    from proformas.application import reviews

    type(product).objects.filter(pk=product.pk).update(is_active=False)
    copy = drafts.copy_proforma(
        actor=seller, proforma_id=issued["id"], payload={"idempotency_key": key()}
    ).body
    assert copy["lines"][0]["product_active"] is False
    review = reviews.preview_issue(actor=seller, proforma_id=copy["id"])
    assert review["can_issue"] is False
    assert review["issues"][0]["field"] == "lines.0.product_id"
    replacement = make_product()
    drafts.update_draft(
        actor=seller,
        proforma_id=copy["id"],
        payload={
            "idempotency_key": key(),
            "expected_version": 1,
            "lines": [{"product_id": replacement.pk, "quantity": "1"}],
        },
    )
    assert reviews.preview_issue(actor=seller, proforma_id=copy["id"])["can_issue"] is True


def test_draft_cannot_be_copied(new_draft: Any, seller: Any, product: Any) -> None:
    body = new_draft((product, 1))
    with pytest.raises(ProformaApplicationError) as error:
        drafts.copy_proforma(
            actor=seller, proforma_id=body["id"], payload={"idempotency_key": key()}
        )
    assert error.value.code == "proforma_not_issued"
