"""Concurrencia real sobre PostgreSQL: emisión, conversión, anulación, edición y datos maestros.

Cada unidad corre en un hilo con conexión propia. El orden se fija con barreras y bloqueos de
fila explícitos, nunca con esperas temporizadas.
"""

import threading
import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.db import OperationalError, connection, transaction
from tests.workshop_configuration.logo_helpers import image_bytes, upload

from identity.models import AuditEvent
from inventory.application.reservations import read_availability
from inventory.models import InventoryMovement
from proformas.application import conversion, drafts, issuing, reviews
from proformas.application.errors import ProformaApplicationError
from proformas.models import Proforma, ProformaBrandAsset, ProformaCommand
from sales.models import Sale
from shared.transactions import RetryableConflictError
from workshop_configuration.application import entity_logos
from workshop_configuration.models import ConfigurationUse, NumberAllocation, TaxPeriod

from .conftest import key

pytestmark = pytest.mark.django_db(transaction=True)
D = Decimal


def kinds(results: list[tuple[str, Any]]) -> list[str]:
    return sorted("ok" if s == "ok" else getattr(v, "code", type(v).__name__) for s, v in results)


def issue_payload(review: dict[str, Any]) -> dict[str, Any]:
    return {
        "idempotency_key": key("cc-issue"),
        "expected_version": review["version"],
        "review_token": review["review_token"],
    }


def convert_payload(review: dict[str, Any]) -> dict[str, Any]:
    return {
        "idempotency_key": key("cc-conv"),
        "expected_version": review["version"],
        "review_token": review["review_token"],
    }


def no_inventory_effects(product: Any, commercial: dict[str, Any], movements: int) -> None:
    availability = read_availability([product.pk], warehouse_id=commercial["warehouse"].pk)
    assert availability[product.pk].reserved == D(0)
    assert InventoryMovement.objects.count() == movements


def blocked_by_row_lock(proforma_id: int, unit: Any, while_waiting: Any) -> tuple[str, Any]:
    """Ejecuta ``unit`` en otro hilo mientras este retiene el bloqueo de la proforma.

    ``while_waiting`` cambia datos después de que la unidad anuncia que va a bloquear y antes de
    liberar la fila: la unidad solo puede continuar con el estado ya cambiado.
    """
    about_to_lock = threading.Event()
    original = drafts.lock_proforma
    result: list[tuple[str, Any]] = []

    def announcing(pk: int) -> Proforma:
        about_to_lock.set()
        return original(pk)

    def work() -> None:
        try:
            result.append(("ok", unit()))
        except BaseException as error:
            result.append(("error", error))
        finally:
            connection.close()

    for module in (drafts, issuing, conversion):
        module.lock_proforma = announcing  # type: ignore[attr-defined]
    try:
        with transaction.atomic():
            Proforma.objects.select_for_update().get(pk=proforma_id)
            thread = threading.Thread(target=work)
            thread.start()
            assert about_to_lock.wait(15), "la unidad no llegó al bloqueo"
            while_waiting()
        thread.join(60)
        assert not thread.is_alive()
    finally:
        for module in (drafts, issuing, conversion):
            module.lock_proforma = original  # type: ignore[attr-defined]
    return result[0]


def test_double_issue_of_the_same_draft_assigns_one_number(
    new_draft: Any, seller: Any, product: Any, commercial: Any, run_parallel: Any, at: Any
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 2))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])

    def unit() -> Any:
        return issuing.issue_proforma(
            actor=seller, proforma_id=body["id"], payload=issue_payload(review)
        ).body["internal_number"]

    results = run_parallel(unit, unit)
    assert results == [("ok", "COM-PRO-000001"), ("ok", "COM-PRO-000001")]
    assert NumberAllocation.objects.count() == 1
    assert ConfigurationUse.objects.count() == 1
    commercial["series"].refresh_from_db()
    assert commercial["series"].last_number == 1
    assert (
        AuditEvent.objects.filter(action="proformas.proforma_issued", result="SUCCESS").count() == 1
    )


def test_simultaneous_issues_of_different_offers_get_distinct_consecutive_numbers(
    new_draft: Any,
    seller: Any,
    admin: Any,
    product: Any,
    commercial: Any,
    run_parallel: Any,
    at: Any,
) -> None:
    at(2026, 10, 6)
    movements = InventoryMovement.objects.count()
    units = []
    for actor in (seller, admin, seller, admin):
        body = new_draft((product, 1), actor=actor)
        review = reviews.preview_issue(actor=actor, proforma_id=body["id"])

        def unit(actor: Any = actor, body: Any = body, review: Any = review) -> Any:
            return issuing.issue_proforma(
                actor=actor, proforma_id=body["id"], payload=issue_payload(review)
            ).body["internal_number"]

        units.append(unit)
    results = run_parallel(*units)
    assert sorted(value for _, value in results) == [f"COM-PRO-{n:06d}" for n in range(1, 5)], (
        results
    )
    commercial["series"].refresh_from_db()
    commercial["sale_series"].refresh_from_db()
    assert (commercial["series"].last_number, commercial["sale_series"].last_number) == (4, 0)
    assert Proforma.objects.filter(state="ISSUED").count() == 4
    no_inventory_effects(product, commercial, movements)


def test_double_conversion_creates_a_single_sale(
    issued: dict[str, Any],
    seller: Any,
    admin: Any,
    product: Any,
    commercial: Any,
    run_parallel: Any,
) -> None:
    movements = InventoryMovement.objects.count()
    reviews_by_actor = {
        actor.pk: conversion.preview_conversion(actor=actor, proforma_id=issued["id"])
        for actor in (seller, admin)
    }

    def unit(actor: Any) -> Any:
        return lambda: conversion.convert_proforma(
            actor=actor,
            proforma_id=issued["id"],
            payload=convert_payload(reviews_by_actor[actor.pk]),
        ).body["sale"]["id"]

    results = run_parallel(unit(seller), unit(admin))
    assert kinds(results) == ["ok", "proforma_converted"]
    sale = Sale.objects.get()
    loser = next(value for status, value in results if status == "error")
    assert loser.conflict == {"sale": {"id": sale.pk, "internal_number": None, "state": "DRAFT"}}
    assert next(value for status, value in results if status == "ok") == sale.pk
    assert Proforma.objects.get(pk=issued["id"]).state == "CONVERTED"
    assert (
        AuditEvent.objects.filter(action="proformas.proforma_converted", result="SUCCESS").count()
        == 1
    )
    no_inventory_effects(product, commercial, movements)


def test_conversion_competes_with_void_without_partial_effects(
    issued: dict[str, Any], seller: Any, admin: Any, run_parallel: Any
) -> None:
    review = conversion.preview_conversion(actor=seller, proforma_id=issued["id"])

    def convert() -> Any:
        return conversion.convert_proforma(
            actor=seller, proforma_id=issued["id"], payload=convert_payload(review)
        ).body["state"]

    def void() -> Any:
        return issuing.void_proforma(
            actor=admin,
            proforma_id=issued["id"],
            payload={"idempotency_key": key("cc-void"), "expected_version": issued["version"]},
        ).body["state"]

    results = run_parallel(convert, void)
    state = Proforma.objects.get(pk=issued["id"]).state
    if state == "CONVERTED":
        assert kinds(results) == ["ok", "proforma_converted"]
        assert Sale.objects.filter(origin_proforma_id=issued["id"]).count() == 1
    else:
        assert state == "VOIDED"
        assert kinds(results) == ["ok", "proforma_voided"]
        assert not Sale.objects.exists()
    assert Proforma.objects.get(pk=issued["id"]).internal_number == "COM-PRO-000001"


def test_edit_competes_with_issue_without_partial_effects(
    new_draft: Any,
    seller: Any,
    admin: Any,
    product: Any,
    commercial: Any,
    run_parallel: Any,
    at: Any,
) -> None:
    at(2026, 10, 6)
    body = new_draft((product, 2))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])

    def issue() -> Any:
        return issuing.issue_proforma(
            actor=seller, proforma_id=body["id"], payload=issue_payload(review)
        ).body["state"]

    def edit() -> Any:
        return drafts.update_draft(
            actor=admin,
            proforma_id=body["id"],
            payload={
                "idempotency_key": key("cc-edit"),
                "expected_version": 1,
                "lines": [{"product_id": product.pk, "quantity": "7"}],
            },
        ).body["version"]

    results = run_parallel(issue, edit)
    proforma = Proforma.objects.get(pk=body["id"])
    line = proforma.lines.get()
    if proforma.state == "ISSUED":
        assert kinds(results) == ["ok", "proforma_issued"]
        assert (line.quantity, line.total_amount, proforma.grand_total) == (
            D(2),
            D("23.00"),
            D("23.00"),
        )
        assert NumberAllocation.objects.count() == 1
    else:
        assert kinds(results) == ["ok", "stale_record"]
        assert (proforma.state, proforma.internal_number, line.quantity) == ("DRAFT", None, D(7))
        assert line.unit_price is None
        assert not NumberAllocation.objects.exists()
        commercial["series"].refresh_from_db()
        assert commercial["series"].last_number == 0


@pytest.mark.parametrize("change", ["price", "rate", "logo"])
def test_master_data_changed_while_waiting_for_the_lock_requires_review(
    change: str,
    new_draft: Any,
    seller: Any,
    admin: Any,
    product: Any,
    commercial: Any,
    at: Any,
) -> None:
    at(2026, 10, 6)
    if change == "logo":
        entity_logos.upload_entity_logo(
            actor=admin,
            entity_id=commercial["entity"].pk,
            file=upload(image_bytes()),
            idempotency_key=f"logo-{uuid.uuid4().hex}",
        )
    body = new_draft((product, 2))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    payload = issue_payload(review)

    def while_waiting() -> None:
        if change == "price":
            type(product).objects.filter(pk=product.pk).update(sale_price=D("19.99"))
        elif change == "rate":
            TaxPeriod.objects.filter(pk=commercial["period"].pk).update(rate=D("12"))
        else:
            entity_logos.remove_entity_logo(
                actor=admin,
                entity_id=commercial["entity"].pk,
                idempotency_key=f"logo-{uuid.uuid4().hex}",
            )

    if change == "logo":
        # El retiro bloquea la entidad en su propia transacción: se confirma antes de emitir.
        while_waiting()
        status, value = "error", None
        with pytest.raises(ProformaApplicationError) as raised:
            issuing.issue_proforma(actor=seller, proforma_id=body["id"], payload=payload)
        value = raised.value
    else:
        status, value = blocked_by_row_lock(
            body["id"],
            lambda: issuing.issue_proforma(actor=seller, proforma_id=body["id"], payload=payload),
            while_waiting,
        )
    assert status == "error"
    assert getattr(value, "code", None) == "review_required", value
    proforma = Proforma.objects.get(pk=body["id"])
    assert (proforma.state, proforma.internal_number) == ("DRAFT", None)
    assert not NumberAllocation.objects.exists()
    assert not ConfigurationUse.objects.exists()
    assert not ProformaBrandAsset.objects.exists()
    assert not ProformaCommand.objects.filter(action="proformas.proforma_issued").exists()
    fresh = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    retried = issuing.issue_proforma(
        actor=seller, proforma_id=body["id"], payload=issue_payload(fresh)
    )
    assert retried.body["internal_number"] == "COM-PRO-000001"


def test_logo_replaced_while_the_issue_waits_for_the_lock(
    new_draft: Any, seller: Any, admin: Any, product: Any, commercial: Any, at: Any
) -> None:
    """Los bytes ya se leyeron antes de la transacción; bajo bloqueo se detecta el cambio."""
    at(2026, 10, 6)
    entity_logos.upload_entity_logo(
        actor=admin,
        entity_id=commercial["entity"].pk,
        file=upload(image_bytes()),
        idempotency_key=f"logo-{uuid.uuid4().hex}",
    )
    body = new_draft((product, 1))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    replaced = threading.Event()

    def replace_in_another_connection() -> None:
        try:
            entity_logos.upload_entity_logo(
                actor=admin,
                entity_id=commercial["entity"].pk,
                file=upload(image_bytes(size=(60, 60))),
                idempotency_key=f"logo-{uuid.uuid4().hex}",
            )
        finally:
            replaced.set()
            connection.close()

    def while_waiting() -> None:
        thread = threading.Thread(target=replace_in_another_connection)
        thread.start()
        assert replaced.wait(30)
        thread.join(30)

    status, value = blocked_by_row_lock(
        body["id"],
        lambda: issuing.issue_proforma(
            actor=seller, proforma_id=body["id"], payload=issue_payload(review)
        ),
        while_waiting,
    )
    assert (status, getattr(value, "code", None)) == ("error", "review_required")
    assert Proforma.objects.get(pk=body["id"]).state == "DRAFT"
    assert not ProformaBrandAsset.objects.exists()
    assert not NumberAllocation.objects.exists()


def test_day_changes_while_the_conversion_waits_for_the_lock(
    issued: dict[str, Any], seller: Any, at: Any
) -> None:
    at(2026, 10, 13, 23, 59)
    review = conversion.preview_conversion(actor=seller, proforma_id=issued["id"])
    assert review["can_convert"] is True
    status, value = blocked_by_row_lock(
        issued["id"],
        lambda: conversion.convert_proforma(
            actor=seller, proforma_id=issued["id"], payload=convert_payload(review)
        ),
        lambda: at(2026, 10, 14, 0, 0),
    )
    assert (status, getattr(value, "code", None)) == ("error", "proforma_expired")
    assert not Sale.objects.exists()
    assert Proforma.objects.get(pk=issued["id"]).state == "ISSUED"


def test_day_changes_while_the_issue_waits_for_the_lock(
    new_draft: Any, seller: Any, product: Any, at: Any
) -> None:
    at(2026, 10, 6, 23, 59)
    body = new_draft((product, 1))
    review = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    status, value = blocked_by_row_lock(
        body["id"],
        lambda: issuing.issue_proforma(
            actor=seller, proforma_id=body["id"], payload=issue_payload(review)
        ),
        lambda: at(2026, 10, 7, 0, 0),
    )
    assert (status, getattr(value, "code", None)) == ("error", "review_required")
    assert Proforma.objects.get(pk=body["id"]).internal_number is None
    fresh = reviews.preview_issue(actor=seller, proforma_id=body["id"])
    assert (fresh["issue_date"], fresh["valid_until"]) == ("2026-10-07", "2026-10-14")


def test_transient_conflict_rolls_back_and_the_whole_unit_is_retried(
    issued: dict[str, Any], seller: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    import sales.application.proforma_links as proforma_links

    class DeadlockError(Exception):
        sqlstate = "40P01"

    original = proforma_links.create_draft_from_proforma
    calls: list[int] = []

    def flaky(**kwargs: Any) -> Any:
        link = original(**kwargs)
        calls.append(link.sale_id)
        if len(calls) == 1:
            raise OperationalError("deadlock detected") from DeadlockError()
        return link

    monkeypatch.setattr(proforma_links, "create_draft_from_proforma", flaky)
    review = conversion.preview_conversion(actor=seller, proforma_id=issued["id"])
    payload = convert_payload(review)
    with pytest.raises(RetryableConflictError):
        conversion.convert_proforma(actor=seller, proforma_id=issued["id"], payload=payload)
    assert not Sale.objects.exists()
    assert Proforma.objects.get(pk=issued["id"]).state == "ISSUED"
    assert not ProformaCommand.objects.filter(action="proformas.proforma_converted").exists()
    retried = conversion.convert_proforma(
        actor=seller, proforma_id=issued["id"], payload=dict(payload)
    )
    assert (retried.replayed, retried.body["state"]) == (False, "CONVERTED")
    assert Sale.objects.count() == 1
    assert len(calls) == 2
