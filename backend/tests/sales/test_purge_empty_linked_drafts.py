"""Limpieza explícita de borradores vinculados vacíos que quedaron antes del ajuste."""

from io import StringIO
from typing import Any

import pytest
from django.core.management import call_command
from django.utils import timezone

from identity.models import AuditEvent
from sales.application.workshop_links import purge_empty_linked_drafts
from sales.models import Sale, SaleLine

pytestmark = pytest.mark.django_db


def _draft(customer: Any, commercial: Any, warehouse: Any, actor: Any, **extra: Any) -> Sale:
    values: dict[str, Any] = {
        "customer": customer,
        "fiscal_entity": commercial["entity"],
        "warehouse": warehouse,
        "condition": "CONTADO",
        "created_by": actor,
    }
    values.update(extra)
    return Sale.objects.create(**values)


@pytest.fixture
def drafts(actor, customer, commercial, warehouse, maintenance_order, product) -> dict[str, Sale]:  # type: ignore[no-untyped-def]
    empty_linked = _draft(
        customer,
        commercial,
        warehouse,
        actor,
        origin_type="MAINTENANCE",
        origin_order=maintenance_order,
        origin_reference=maintenance_order.number,
    )
    empty_direct = _draft(customer, commercial, warehouse, actor)
    protected: list[Sale] = []
    for state, number in (("CONFIRMED", "COM-VEN-009998"), ("VOIDED", "COM-VEN-009999")):
        protected.append(
            _draft(
                customer,
                commercial,
                warehouse,
                actor,
                origin_type="MAINTENANCE",
                origin_order=maintenance_order,
                origin_reference=maintenance_order.number,
                state=state,
                internal_number=number,
                operational_date=timezone.localdate(),
                base_total="0.00",
                tax_total="0.00",
                grand_total="0.00",
            )
        )
    return {
        "empty_linked": empty_linked,
        "empty_direct": empty_direct,
        "confirmed": protected[0],
        "voided": protected[1],
    }


def test_report_by_default_deletes_nothing(drafts) -> None:  # type: ignore[no-untyped-def]
    found = purge_empty_linked_drafts(confirm=False)
    assert [row["sale_id"] for row in found] == [drafts["empty_linked"].pk]
    assert found[0]["order_number"] == drafts["empty_linked"].origin_reference
    assert Sale.objects.count() == 4
    assert not AuditEvent.objects.filter(action="sales.linked_draft_discarded").exists()


def test_confirmed_purge_deletes_only_empty_linked_drafts_and_is_repeatable(drafts) -> None:  # type: ignore[no-untyped-def]
    deleted = purge_empty_linked_drafts(confirm=True)
    assert [row["sale_id"] for row in deleted] == [drafts["empty_linked"].pk]
    assert not Sale.objects.filter(pk=drafts["empty_linked"].pk).exists()
    # Un borrador directo vacío nunca se elimina.
    assert Sale.objects.filter(pk=drafts["empty_direct"].pk).exists()
    # Las ventas vinculadas confirmadas o anuladas tampoco se eliminan aunque no tengan líneas.
    assert Sale.objects.filter(pk=drafts["confirmed"].pk).exists()
    assert Sale.objects.filter(pk=drafts["voided"].pk).exists()
    assert AuditEvent.objects.filter(action="sales.linked_draft_discarded").count() == 1
    assert purge_empty_linked_drafts(confirm=True) == []


def test_linked_draft_with_lines_is_kept(drafts, product) -> None:  # type: ignore[no-untyped-def]
    SaleLine.objects.create(sale=drafts["empty_linked"], position=1, product=product, quantity=1)
    assert purge_empty_linked_drafts(confirm=True) == []
    assert Sale.objects.filter(pk=drafts["empty_linked"].pk).exists()


def test_command_reports_and_requires_confirm(drafts) -> None:  # type: ignore[no-untyped-def]
    out = StringIO()
    call_command("purge_empty_linked_drafts", stdout=out)
    assert "1 borrador" in out.getvalue()
    assert Sale.objects.filter(pk=drafts["empty_linked"].pk).exists()
    out = StringIO()
    call_command("purge_empty_linked_drafts", "--confirm", stdout=out)
    assert "eliminado" in out.getvalue()
    assert not Sale.objects.filter(pk=drafts["empty_linked"].pk).exists()
