"""Resumen de proformas del inicio: por vencer y borradores, iguales a su lista."""

from typing import Any

import pytest

from identity.models import AuditEvent
from proformas.application import home_summary, queries
from proformas.application.errors import ProformaApplicationError

pytestmark = pytest.mark.django_db


@pytest.fixture
def offers(new_draft: Any, issue: Any, make_product: Any, at: Any) -> None:
    """Emitidas con siete días de vigencia: vencen el 19, 20, 21 y 23 de octubre de 2026."""
    for day in (12, 13, 14, 16):
        at(2026, 10, day)
        issue(new_draft((make_product(), 1)))


def test_offers_expiring_today_or_tomorrow(offers: None, seller: Any, at: Any) -> None:
    at(2026, 10, 20)
    assert home_summary.proformas_expiring(seller) == 2
    listing = queries.list_proformas(actor=seller, state="VALID", expires_within_days=1)
    assert listing["total_count"] == 2
    assert queries.list_proformas(actor=seller, state="VALID")["total_count"] == 3
    assert queries.list_proformas(actor=seller, state="EXPIRED")["total_count"] == 1


def test_last_valid_minute_still_counts(offers: None, seller: Any, at: Any) -> None:
    at(2026, 10, 19, 23, 59)
    assert home_summary.proformas_expiring(seller) == 2
    at(2026, 10, 22, 0, 0)
    assert home_summary.proformas_expiring(seller) == 1


def test_filter_without_state_only_returns_valid_offers(offers: None, seller: Any, at: Any) -> None:
    at(2026, 10, 20)
    assert queries.list_proformas(actor=seller, expires_within_days=0)["total_count"] == 1
    assert queries.list_proformas(actor=seller, expires_within_days=30)["total_count"] == 3


def test_negative_window_is_rejected(seller: Any) -> None:
    with pytest.raises(ProformaApplicationError) as error:
        queries.list_proformas(actor=seller, expires_within_days=-1)
    assert "expires_within_days" in error.value.errors


def test_drafts_match_the_list(
    offers: None, new_draft: Any, make_product: Any, seller: Any
) -> None:
    new_draft((make_product(), 1))
    new_draft((make_product(), 2))
    assert home_summary.proforma_drafts(seller) == 2
    assert queries.list_proformas(actor=seller, state="DRAFT")["total_count"] == 2


def test_without_permission_nothing_is_computed_nor_audited(offers: None, manager: Any) -> None:
    before = AuditEvent.objects.count()
    assert home_summary.proformas_expiring(manager) is None
    assert home_summary.proforma_drafts(manager) is None
    assert AuditEvent.objects.count() == before
