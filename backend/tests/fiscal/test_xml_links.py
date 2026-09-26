from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from tests.fiscal.xml_samples import SYNTHETIC_RUC, synthetic_invoice

from customer_registry.models import Customer
from fiscal.application.preparations import LinkedExternalEvidenceError, create_draft
from fiscal.application.xml_archive import (
    ArchiveLinkConflictError,
    LinkReasonRequiredError,
    archive_xml,
    download_document,
    link_dossier,
    list_archived_documents,
)
from fiscal.models import FiscalXmlDossier, FiscalXmlLinkHistory
from identity.application.authorization import BusinessPermissionDeniedError
from sales.models import Sale
from workshop_configuration.models import FiscalEntity, Warehouse

pytestmark = pytest.mark.django_db


@pytest.fixture
def fiscal_entity() -> FiscalEntity:
    return FiscalEntity.objects.create(
        entity_type="COMERCIAL", ruc=SYNTHETIC_RUC, legal_name="Entidad sintética"
    )


@pytest.fixture
def customer() -> Customer:
    return Customer.objects.create(
        person_type="JURIDICA",
        name="CONSUMIDOR FINAL",
        identification_type="RUC",
        identification="9999999999999",
        phone="0999999999",
    )


@pytest.fixture
def warehouse() -> Warehouse:
    return Warehouse.objects.create(id=1, name="Principal")


def _sale(
    *,
    actor: Any,
    entity: FiscalEntity,
    customer: Customer,
    warehouse: Warehouse,
    number: str,
    total: str = "10.00",
) -> Sale:
    return Sale.objects.create(
        customer=customer,
        fiscal_entity=entity,
        warehouse=warehouse,
        origin_type="DIRECT",
        condition="CONTADO",
        state="CONFIRMED",
        operational_date=date(2026, 9, 25),
        base_total=Decimal(total),
        tax_total=Decimal("0.00"),
        grand_total=Decimal(total),
        customer_snapshot={"schema_version": 1, "identification": customer.identification},
        fiscal_snapshot={"schema_version": 1},
        internal_number=number,
        created_by=actor,
    )


def _archive(role_admin: Any, entity: FiscalEntity) -> Any:
    return archive_xml(
        actor=role_admin,
        fiscal_entity_id=entity.id,
        original_bytes=synthetic_invoice(),
        source_label="ensayo",
    )


def test_link_requires_same_entity_and_total_but_allows_justified_descriptive_gaps(
    role_admin: Any,
    fiscal_entity: FiscalEntity,
    customer: Customer,
    warehouse: Warehouse,
) -> None:
    archived = _archive(role_admin, fiscal_entity)
    sale = _sale(
        actor=role_admin,
        entity=fiscal_entity,
        customer=customer,
        warehouse=warehouse,
        number="COM-VEN-000001",
    )

    result = link_dossier(
        actor=role_admin,
        dossier_id=archived.dossier_id,
        source_kind="COMMERCIAL",
        source_id=sale.id,
        reason="Operación histórica sin desglose comparable.",
    )

    assert result.dossier_id == archived.dossier_id
    assert result.discrepancies == ("line_count",)
    dossier = FiscalXmlDossier.objects.get(pk=archived.dossier_id)
    assert dossier.commercial_sale_id == sale.id
    assert FiscalXmlLinkHistory.objects.filter(dossier=dossier).count() == 1


def test_link_rejects_different_total_even_with_a_reason(
    role_admin: Any,
    fiscal_entity: FiscalEntity,
    customer: Customer,
    warehouse: Warehouse,
) -> None:
    archived = _archive(role_admin, fiscal_entity)
    sale = _sale(
        actor=role_admin,
        entity=fiscal_entity,
        customer=customer,
        warehouse=warehouse,
        number="COM-VEN-000002",
        total="11.00",
    )

    with pytest.raises(ArchiveLinkConflictError, match="total"):
        link_dossier(
            actor=role_admin,
            dossier_id=archived.dossier_id,
            source_kind="COMMERCIAL",
            source_id=sale.id,
            reason="No debe superar una diferencia fiscal.",
        )


def test_correcting_a_link_requires_reason_and_keeps_history(
    role_admin: Any,
    fiscal_entity: FiscalEntity,
    customer: Customer,
    warehouse: Warehouse,
) -> None:
    archived = _archive(role_admin, fiscal_entity)
    first = _sale(
        actor=role_admin,
        entity=fiscal_entity,
        customer=customer,
        warehouse=warehouse,
        number="COM-VEN-000003",
    )
    second = _sale(
        actor=role_admin,
        entity=fiscal_entity,
        customer=customer,
        warehouse=warehouse,
        number="COM-VEN-000004",
    )
    link_dossier(
        actor=role_admin,
        dossier_id=archived.dossier_id,
        source_kind="COMMERCIAL",
        source_id=first.id,
        reason="Sin líneas históricas.",
    )

    with pytest.raises(LinkReasonRequiredError):
        link_dossier(
            actor=role_admin,
            dossier_id=archived.dossier_id,
            source_kind="COMMERCIAL",
            source_id=second.id,
            reason="",
        )
    link_dossier(
        actor=role_admin,
        dossier_id=archived.dossier_id,
        source_kind="COMMERCIAL",
        source_id=second.id,
        reason="Se corrigió la asociación administrativa.",
    )

    history = list(FiscalXmlLinkHistory.objects.order_by("sequence"))
    assert len(history) == 2
    assert history[1].previous_commercial_sale_id == first.id
    assert history[1].commercial_sale_id == second.id


def test_linked_external_evidence_blocks_an_ordinary_preparation(
    role_admin: Any,
    role_seller: Any,
    fiscal_entity: FiscalEntity,
    customer: Customer,
    warehouse: Warehouse,
) -> None:
    archived = _archive(role_admin, fiscal_entity)
    sale = _sale(
        actor=role_admin,
        entity=fiscal_entity,
        customer=customer,
        warehouse=warehouse,
        number="COM-VEN-000005",
    )
    link_dossier(
        actor=role_admin,
        dossier_id=archived.dossier_id,
        source_kind="COMMERCIAL",
        source_id=sale.id,
        reason="Sin líneas históricas.",
    )

    with pytest.raises(LinkedExternalEvidenceError):
        create_draft(
            actor=role_seller,
            source_kind="COMMERCIAL",
            source_id=sale.id,
            idempotency_key="linked-xml-0001",
        )


@pytest.mark.django_db(transaction=True)
def test_link_and_new_preparation_race_leaves_only_one_active_path(
    role_admin: Any,
    role_seller: Any,
    fiscal_entity: FiscalEntity,
    customer: Customer,
    warehouse: Warehouse,
    run_parallel: Any,
) -> None:
    archived = _archive(role_admin, fiscal_entity)
    sale = _sale(
        actor=role_admin,
        entity=fiscal_entity,
        customer=customer,
        warehouse=warehouse,
        number="COM-VEN-000006",
    )

    results = run_parallel(
        lambda: link_dossier(
            actor=role_admin,
            dossier_id=archived.dossier_id,
            source_kind="COMMERCIAL",
            source_id=sale.id,
            reason="Sin líneas históricas.",
        ),
        lambda: create_draft(
            actor=role_seller,
            source_kind="COMMERCIAL",
            source_id=sale.id,
            idempotency_key="race-link-0001",
        ),
    )

    assert [kind for kind, _ in results].count("ok") == 1, results
    dossier = FiscalXmlDossier.objects.get(pk=archived.dossier_id)
    preparation_exists = sale.fiscal_preparations.filter(state__in=["DRAFT", "PREPARED"]).exists()
    assert (dossier.commercial_sale_id is not None) != preparation_exists


def test_commercial_user_can_read_only_evidence_linked_to_a_commercial_sale(
    role_admin: Any,
    role_seller: Any,
    role_manager: Any,
    fiscal_entity: FiscalEntity,
    customer: Customer,
    warehouse: Warehouse,
) -> None:
    archived = _archive(role_admin, fiscal_entity)
    sale = _sale(
        actor=role_admin,
        entity=fiscal_entity,
        customer=customer,
        warehouse=warehouse,
        number="COM-VEN-000007",
    )
    link_dossier(
        actor=role_admin,
        dossier_id=archived.dossier_id,
        source_kind="COMMERCIAL",
        source_id=sale.id,
        reason="Sin líneas históricas.",
    )

    assert download_document(actor=role_seller, dossier_id=archived.dossier_id).content
    assert len(list_archived_documents(actor=role_seller)) == 1
    with pytest.raises(BusinessPermissionDeniedError):
        download_document(actor=role_manager, dossier_id=archived.dossier_id)
