"""Restricciones de persistencia de la oferta, sus líneas, recibos y activos de marca."""

import hashlib
from decimal import Decimal
from typing import Any

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from proformas.models import Proforma, ProformaBrandAsset, ProformaCommand, ProformaLine

from .factories import issued_values, line_amounts, make_line, make_proforma

pytestmark = pytest.mark.django_db
D = Decimal


def _fails(**values: Any) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Proforma.objects.filter(pk=values.pop("pk")).update(**values)


def test_draft_has_no_number_amounts_or_history(customer: Any, commercial: Any, actor: Any) -> None:
    proforma = make_proforma(customer, commercial, actor)
    assert proforma.state == "DRAFT"
    assert proforma.version == 1
    assert proforma.internal_number is None
    assert proforma.valid_until is None
    assert proforma.header_snapshot is None
    assert str(proforma) == f"Borrador {proforma.pk}"


def test_draft_cannot_hold_a_number(customer: Any, commercial: Any, actor: Any) -> None:
    proforma = make_proforma(customer, commercial, actor)
    _fails(pk=proforma.pk, internal_number="COM-PRO-000001")


def test_issued_requires_number_dates_totals_and_snapshot(
    customer: Any, commercial: Any, actor: Any
) -> None:
    proforma = make_proforma(customer, commercial, actor)
    for missing in ("internal_number", "issue_date", "valid_until", "grand_total"):
        _fails(pk=proforma.pk, **{**issued_values(actor), missing: None})
    _fails(pk=proforma.pk, **issued_values(actor, header_snapshot=None))
    Proforma.objects.filter(pk=proforma.pk).update(**issued_values(actor))
    proforma.refresh_from_db()
    assert str(proforma) == "COM-PRO-000001"


def test_validity_cannot_precede_issue_date(customer: Any, commercial: Any, actor: Any) -> None:
    proforma = make_proforma(customer, commercial, actor)
    from datetime import date

    _fails(pk=proforma.pk, **issued_values(actor, valid_until=date(2026, 10, 5)))


def test_number_is_unique(customer: Any, commercial: Any, actor: Any) -> None:
    first = make_proforma(customer, commercial, actor)
    second = make_proforma(customer, commercial, actor)
    Proforma.objects.filter(pk=first.pk).update(**issued_values(actor))
    _fails(pk=second.pk, **issued_values(actor))


def test_state_version_and_snapshot_are_validated(
    customer: Any, commercial: Any, actor: Any
) -> None:
    proforma = make_proforma(customer, commercial, actor)
    _fails(pk=proforma.pk, state="EXPIRED")
    _fails(pk=proforma.pk, version=0)
    _fails(pk=proforma.pk, **issued_values(actor, header_snapshot={"sin": "version"}))
    with pytest.raises(ValidationError):
        Proforma(
            customer=customer,
            fiscal_entity=commercial["entity"],
            created_by=actor,
            header_snapshot={"schema_version": 2},
        ).full_clean()


def test_converted_and_voided_keep_their_metadata(
    customer: Any, commercial: Any, actor: Any
) -> None:
    proforma = make_proforma(customer, commercial, actor)
    Proforma.objects.filter(pk=proforma.pk).update(**issued_values(actor))
    _fails(pk=proforma.pk, state="CONVERTED")
    _fails(pk=proforma.pk, state="VOIDED")


def test_line_quantity_is_a_positive_whole_number(
    customer: Any, commercial: Any, actor: Any, product: Any
) -> None:
    proforma = make_proforma(customer, commercial, actor)
    for quantity in (D(0), D(-1), D("1.5")):
        with pytest.raises(IntegrityError), transaction.atomic():
            make_line(proforma, product, quantity=quantity)


def test_line_position_is_unique_per_document(
    customer: Any, commercial: Any, actor: Any, product: Any
) -> None:
    proforma = make_proforma(customer, commercial, actor)
    make_line(proforma, product, position=1)
    with pytest.raises(IntegrityError), transaction.atomic():
        make_line(proforma, product, position=1)
    other = make_proforma(customer, commercial, actor)
    make_line(other, product, position=1)


def test_line_amounts_are_all_or_nothing_and_versioned(
    customer: Any, commercial: Any, actor: Any, product: Any
) -> None:
    proforma = make_proforma(customer, commercial, actor)
    line = make_line(proforma, product)
    with pytest.raises(IntegrityError), transaction.atomic():
        ProformaLine.objects.filter(pk=line.pk).update(unit_price=D("1.00"))
    with pytest.raises(IntegrityError), transaction.atomic():
        ProformaLine.objects.filter(pk=line.pk).update(
            **line_amounts(product_snapshot={"sin": "version"})
        )
    with pytest.raises(IntegrityError), transaction.atomic():
        ProformaLine.objects.filter(pk=line.pk).update(**line_amounts(total_amount=D(-1)))
    ProformaLine.objects.filter(pk=line.pk).update(**line_amounts())


def test_references_are_protected(customer: Any, commercial: Any, actor: Any, product: Any) -> None:
    origin = make_proforma(customer, commercial, actor)
    derived = make_proforma(customer, commercial, actor, origin=origin)
    make_line(derived, product)
    for protected in (customer, product, origin, derived):
        with pytest.raises(ProtectedError):
            protected.delete()


def test_command_receipt_is_unique_per_actor_action_and_key(actor: Any, seller: Any) -> None:
    ProformaCommand.objects.create(
        actor=actor, action="a", idempotency_key="clave-0001", input_fingerprint="f" * 64
    )
    ProformaCommand.objects.create(
        actor=seller, action="a", idempotency_key="clave-0001", input_fingerprint="f" * 64
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        ProformaCommand.objects.create(
            actor=actor, action="a", idempotency_key="clave-0001", input_fingerprint="0" * 64
        )
    with pytest.raises(IntegrityError), transaction.atomic():
        ProformaCommand.objects.create(
            actor=actor, action="a", idempotency_key="corta", input_fingerprint="0" * 64
        )


def test_brand_asset_is_deduplicated_by_hash_and_bounded(
    customer: Any, commercial: Any, actor: Any
) -> None:
    content = b"\x89PNG-logo"
    digest = hashlib.sha256(content).hexdigest()
    asset = ProformaBrandAsset.objects.create(
        content=content, mime_type="image/png", size=len(content), sha256=digest
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        ProformaBrandAsset.objects.create(
            content=content, mime_type="image/png", size=len(content), sha256=digest
        )
    with pytest.raises(IntegrityError), transaction.atomic():
        ProformaBrandAsset.objects.create(
            content=b"x", mime_type="image/png", size=2 * 1024 * 1024 + 1, sha256="b" * 64
        )
    with pytest.raises(IntegrityError), transaction.atomic():
        ProformaBrandAsset.objects.create(
            content=b"x", mime_type="image/gif", size=1, sha256="c" * 64
        )
    proforma = make_proforma(customer, commercial, actor)
    Proforma.objects.filter(pk=proforma.pk).update(**issued_values(actor, brand_asset=asset))
    with pytest.raises(ProtectedError):
        asset.delete()
