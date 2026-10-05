"""Listado paginado y filtrado del archivo, y exportación sin ZIP completo en memoria."""

from __future__ import annotations

import io
import zipfile
from collections.abc import Iterable
from datetime import date
from decimal import Decimal
from typing import Any, cast
from uuid import uuid4

import pytest
from django.http import FileResponse
from rest_framework.test import APIClient

from fiscal.application.xml_archive import (
    ExportEntry,
    FiscalArchiveError,
    list_archived_documents,
)
from fiscal.models import FiscalXmlDossier
from workshop_configuration.models import FiscalEntity

pytestmark = pytest.mark.django_db
BASE = "/api/v1/fiscal"


@pytest.fixture
def entity() -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc="9999999999001", legal_name="Entidad sintética"
    )


def _dossier(
    entity: FiscalEntity,
    actor: Any,
    sequential: int,
    *,
    issue_date: date,
    environment: str = "1",
    document_type: str = "01",
) -> FiscalXmlDossier:
    return FiscalXmlDossier.objects.create(
        fiscal_entity=entity,
        document_type=document_type,
        schema_version="2.1.0",
        environment=environment,
        issuer_ruc=entity.ruc,
        access_key=f"{sequential:049d}",
        establishment_code="001",
        emission_point_code="001",
        sequential=f"{sequential:09d}",
        issue_date=issue_date,
        total=Decimal("10.00"),
        tax_total=Decimal("0.00"),
        receiver_identification="9999999999999",
        currency="DOLAR",
        line_count=1,
        created_by=actor,
    )


def test_listing_is_paginated_and_ordered_by_issue_date(
    role_admin: Any, entity: FiscalEntity
) -> None:
    for day in range(1, 6):
        _dossier(entity, role_admin, day, issue_date=date(2026, 9, day))

    page = list_archived_documents(actor=role_admin, page=2, page_size=2)

    assert (page.count, page.page, page.page_size, page.total_pages) == (5, 2, 2, 3)
    assert [item.issue_date for item in page.results] == ["2026-09-03", "2026-09-02"]


def test_listing_filters_by_environment_type_and_date_range(
    role_admin: Any, entity: FiscalEntity
) -> None:
    _dossier(entity, role_admin, 1, issue_date=date(2026, 9, 1))
    _dossier(entity, role_admin, 2, issue_date=date(2026, 9, 10), environment="2")
    _dossier(entity, role_admin, 3, issue_date=date(2026, 9, 12), document_type="04")
    _dossier(entity, role_admin, 4, issue_date=date(2026, 9, 20))

    by_environment = list_archived_documents(actor=role_admin, environment="2")
    by_type = list_archived_documents(actor=role_admin, document_type="04")
    by_dates = list_archived_documents(
        actor=role_admin, issued_from=date(2026, 9, 5), issued_to=date(2026, 9, 15)
    )

    assert [item.access_key[-1] for item in by_environment.results] == ["2"]
    assert [item.access_key[-1] for item in by_type.results] == ["3"]
    assert sorted(item.access_key[-1] for item in by_dates.results) == ["2", "3"]


@pytest.mark.parametrize(
    "arguments",
    [
        {"page": 0},
        {"page_size": 0},
        {"page_size": 101},
        {"environment": "3"},
        {"document_type": "18"},
        {"issued_from": date(2026, 9, 2), "issued_to": date(2026, 9, 1)},
    ],
)
def test_listing_rejects_invalid_filters(role_admin: Any, arguments: dict[str, Any]) -> None:
    with pytest.raises(FiscalArchiveError):
        list_archived_documents(actor=role_admin, **arguments)


def test_list_endpoint_returns_page_and_rejects_invalid_parameters(
    role_admin: Any, entity: FiscalEntity
) -> None:
    for day in range(1, 4):
        _dossier(entity, role_admin, day, issue_date=date(2026, 9, day))
    client = APIClient()
    client.force_authenticate(user=role_admin)

    listed = client.get(f"{BASE}/archive/?page_size=2&issued_from=2026-09-01")
    invalid = client.get(f"{BASE}/archive/?page_size=500")
    bad_date = client.get(f"{BASE}/archive/?issued_from=01/09/2026")
    bad_page = client.get(f"{BASE}/archive/?page=abc")

    assert listed.status_code == 200
    assert (listed.data["count"], listed.data["total_pages"]) == (3, 2)
    assert len(listed.data["results"]) == 2
    assert (invalid.status_code, bad_date.status_code, bad_page.status_code) == (400, 400, 400)


def test_export_streams_from_temporary_file_with_private_headers(
    role_admin: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "fiscal.api.views.xml_archive.iter_export_entries",
        lambda **_: iter((ExportEntry("factura.xml", b"<factura/>", "a" * 64, "DOCUMENT"),)),
    )
    client = APIClient()
    client.force_authenticate(user=role_admin)

    response = client.post(
        f"{BASE}/archive/export/", {"dossier_ids": [str(uuid4())]}, format="json"
    )

    assert response.status_code == 200
    assert response["Cache-Control"] == "private, no-store"
    assert response["Content-Disposition"].startswith("attachment;")
    streamed = cast(FileResponse, response)
    assert not isinstance(streamed.file_to_stream, io.BytesIO)
    body = b"".join(cast(Iterable[bytes], streamed.streaming_content))
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        assert archive.read("factura.xml") == b"<factura/>"


def test_export_failure_closes_temporary_file_and_reports_problem(
    role_admin: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    import tempfile

    opened: list[Any] = []
    real_temporary_file = tempfile.TemporaryFile

    def tracking_temporary_file(*args: Any, **kwargs: Any) -> Any:
        handle = real_temporary_file(*args, **kwargs)
        opened.append(handle)
        return handle

    def failing_entries(**_: Any) -> Any:
        yield ExportEntry("factura.xml", b"<factura/>", "a" * 64, "DOCUMENT")
        raise FiscalArchiveError("Integridad comprometida.")

    monkeypatch.setattr("fiscal.api.views.tempfile.TemporaryFile", tracking_temporary_file)
    monkeypatch.setattr("fiscal.api.views.xml_archive.iter_export_entries", failing_entries)
    client = APIClient()
    client.force_authenticate(user=role_admin)

    response = client.post(
        f"{BASE}/archive/export/", {"dossier_ids": [str(uuid4())]}, format="json"
    )

    assert response.status_code == 400
    assert response.data["code"] == "fiscal_invalid_request"
    assert len(opened) == 1
    assert opened[0].closed
