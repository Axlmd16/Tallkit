"""Preparación artesanal separada y discrepancia por reapertura posterior."""

from typing import Any

import pytest
from tests.workshop.workshop_helpers import (
    add_line,
    confirm_services,
    create,
    finalize,
    key,
    reopen,
    version,
)

from identity.application.authorization import BusinessPermissionDeniedError
from workshop.application import orders
from workshop.models import ServiceOperation

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(manager: Any, artisan_billing: Any, customer: Any, vehicle: Any) -> dict[str, Any]:
    return create(manager, customer_id=customer.pk, vehicle_id=vehicle.pk, odometer_km=100)


def _operation(manager: Any, order: dict[str, Any], make_service: Any) -> ServiceOperation:
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="25.00")
    operation_id = confirm_services(manager, order["id"])["id"]
    return ServiceOperation.objects.get(pk=operation_id)


def test_manager_creates_artisan_draft_but_seller_cannot(
    manager: Any, seller: Any, order: dict[str, Any], make_service: Any
) -> None:
    from fiscal.application.preparations import create_draft

    operation = _operation(manager, order, make_service)
    result = create_draft(
        actor=manager,
        source_kind="ARTISAN",
        source_id=operation.pk,
        idempotency_key="fiscal:artisan:001",
    )
    assert result.preparation_id
    with pytest.raises(BusinessPermissionDeniedError):
        create_draft(
            actor=seller,
            source_kind="ARTISAN",
            source_id=operation.pk,
            idempotency_key="fiscal:artisan:002",
        )


def test_reopening_order_is_visible_without_cancelling_artisan_preparation(
    manager: Any, order: dict[str, Any], make_service: Any
) -> None:
    from fiscal.application.preparations import create_draft, query_discrepancy
    from fiscal.models import FiscalPreparation

    operation = _operation(manager, order, make_service)
    result = create_draft(
        actor=manager,
        source_kind="ARTISAN",
        source_id=operation.pk,
        idempotency_key="fiscal:artisan:001",
    )
    orders.update_order(
        actor=manager,
        order_id=order["id"],
        payload={
            "diagnosis": "Frenos",
            "expected_version": version(order["id"]),
            "idempotency_key": key(),
        },
    )
    finalize(manager, order["id"])
    reopen(manager, order["id"])

    discrepancy = query_discrepancy(actor=manager, preparation_id=result.preparation_id)
    assert discrepancy.source_changed
    assert not discrepancy.state_changed
    assert not discrepancy.corrections_changed
    assert FiscalPreparation.objects.get(pk=result.preparation_id).state == "DRAFT"


def test_later_artisan_void_is_reported_without_cancelling_preparation(
    manager: Any, admin: Any, order: dict[str, Any], make_service: Any
) -> None:
    """Escenario «Anulación artesanal posterior»: se muestra la discrepancia, sin cancelar."""
    from fiscal.application.preparations import create_draft, query_discrepancy
    from fiscal.models import FiscalPreparation
    from workshop.application import service_operations

    operation = _operation(manager, order, make_service)
    result = create_draft(
        actor=manager,
        source_kind="ARTISAN",
        source_id=operation.pk,
        idempotency_key="fiscal:artisan:void",
    )
    service_operations.void_operation(
        actor=admin,
        operation_id=operation.pk,
        payload={
            "reason": "Error de registro",
            "expected_version": operation.version,
            "idempotency_key": key(),
        },
    )

    discrepancy = query_discrepancy(actor=manager, preparation_id=result.preparation_id)
    assert discrepancy.state_changed
    assert (discrepancy.original_state, discrepancy.current_state) == ("CONFIRMED", "VOIDED")
    assert FiscalPreparation.objects.get(pk=result.preparation_id).state == "DRAFT"


def test_manager_draft_is_prefilled_with_cedula_and_services_only(
    manager: Any, order: dict[str, Any], make_service: Any, customer: Any
) -> None:
    from fiscal.application.preparations import create_draft, get_preparation

    operation = _operation(manager, order, make_service)
    result = create_draft(
        actor=manager,
        source_kind="ARTISAN",
        source_id=operation.pk,
        idempotency_key="fiscal:artisan:prefill",
    )
    detail = get_preparation(actor=manager, preparation_id=result.preparation_id)
    assert detail.draft is not None
    receiver = detail.draft["receiver"]
    assert receiver["identification_type"] == "05"
    assert receiver["identification"] == customer.identification
    assert customer.identification_type == "CI"
    assert detail.summary is not None
    assert detail.summary["kind"] == "ARTISAN"
    assert detail.summary["grand_total"] == "25.00"
    assert detail.draft["payments"]["forms"] == [{"payment_code": "01", "amount": "25.00"}]


# --- estructurar-perfil-del-emisor-y-codigos-fiscales -------------------------------------


def _configure_artisan(
    admin: Any,
    artisan: dict[str, Any],
    *,
    rate_code: str,
    qualification_payload: dict[str, str] | None = None,
) -> None:
    from datetime import date

    from tests.workshop_configuration.profile_helpers import not_applicable, profile_conditions

    from workshop_configuration.application import official_catalog
    from workshop_configuration.application.electronic_profiles import save_profile
    from workshop_configuration.application.fiscal_tax_mapping import create_mapping
    from workshop_configuration.models import (
        FiscalEmissionPoint,
        FiscalEstablishment,
        OfficialCatalogEntry,
    )

    official_catalog.ensure_installed()
    entity = artisan["entity"]
    entity.address = "Matriz del taller"
    entity.save(update_fields=["address"])
    save_profile(
        actor=admin,
        entity_id=entity.pk,
        expected_revision=0,
        idempotency_key=f"artisan:profile:{key()}",
        payload={
            "conditions": profile_conditions(
                artisan_qualification=qualification_payload or not_applicable()
            )
        },
    )
    establishment = FiscalEstablishment.objects.create(
        fiscal_entity=entity, code="001", address="Local del taller"
    )
    FiscalEmissionPoint.objects.create(establishment=establishment, code="001")
    entry = OfficialCatalogEntry.objects.get(
        kind="TAX_RATE", catalog_version=official_catalog.SELECTABLE_TAX_VERSION, code=rate_code
    )
    create_mapping(
        actor=admin,
        definition_id=artisan["tax"].pk,
        catalog_entry_id=entry.pk,
        starts_on=date(2025, 1, 1),
        ends_on=None,
        source="Resolución vigente",
    )


def _artisan_review(manager: Any, order: dict[str, Any], make_service: Any, **service: Any) -> Any:
    from fiscal.application.preparations import create_draft, review

    add_line(manager, order["id"], service_id=make_service(**service).pk, applied_price="25.00")
    operation_id = confirm_services(manager, order["id"])["id"]
    draft = create_draft(
        actor=manager,
        source_kind="ARTISAN",
        source_id=operation_id,
        idempotency_key=f"fiscal:artisan:{key()}",
    )
    return draft, review(actor=manager, preparation_id=draft.preparation_id)


def test_artisan_with_qualification_prepares_zero_rate_services_with_their_own_code(
    manager: Any, admin: Any, artisan: dict[str, Any], order: dict[str, Any], make_service: Any
) -> None:
    from decimal import Decimal

    from tests.workshop_configuration.profile_helpers import qualification

    from fiscal.application.preparations import prepare
    from fiscal.models import FiscalPreparation
    from workshop_configuration.models import TaxPeriod

    TaxPeriod.objects.filter(tax_definition=artisan["tax"]).update(rate=Decimal("0"))
    _configure_artisan(admin, artisan, rate_code="0", qualification_payload=qualification())
    draft, result = _artisan_review(manager, order, make_service, code="SRV-000012")
    assert result.impediments == ()
    prepare(
        actor=manager,
        preparation_id=draft.preparation_id,
        review_token=result.token,
        idempotency_key="fiscal:prepare:artisan-zero",
    )
    snapshot = FiscalPreparation.objects.get(pk=draft.preparation_id).snapshot
    assert snapshot is not None
    assert snapshot["lines"][0]["item_code"] == "SRV-000012"
    assert snapshot["lines"][0]["tax_amount"] == "0.00"
    assert snapshot["totals"] == {"base": "25.00", "tax": "0.00", "grand": "25.00"}
    profile = snapshot["issuer"]["tax_profile"]
    assert profile["regime"] == "GENERAL"
    assert profile["artisan_qualification"]["number"] == "JNDA-12345"
    assert snapshot["issuer"]["ruc"] == artisan["entity"].ruc


def test_artisan_with_qualification_blocks_a_service_confirmed_at_fifteen_percent(
    manager: Any, admin: Any, artisan: dict[str, Any], order: dict[str, Any], make_service: Any
) -> None:
    from tests.workshop_configuration.profile_helpers import qualification

    _configure_artisan(admin, artisan, rate_code="4", qualification_payload=qualification())
    _, result = _artisan_review(manager, order, make_service)
    assert result.token is None
    [impediment] = [i for i in result.impediments if i["field"] == "line[1].artisan_rate"]
    assert impediment["audience"] == "ADMINISTRATOR"
    assert "IVA 15 %" in impediment["message"]
    operation = ServiceOperation.objects.get()
    assert str(operation.grand_total) == "25.00"


def test_artisan_without_a_declared_qualification_is_not_forced_to_zero_rate(
    manager: Any, admin: Any, artisan: dict[str, Any], order: dict[str, Any], make_service: Any
) -> None:
    _configure_artisan(admin, artisan, rate_code="4")
    _, result = _artisan_review(manager, order, make_service)
    assert result.impediments == ()
    assert result.token is not None


def test_operation_line_without_a_preserved_service_code_blocks_without_using_the_database_id(
    manager: Any, admin: Any, artisan: dict[str, Any], order: dict[str, Any], make_service: Any
) -> None:
    from fiscal.application.preparations import create_draft, review
    from workshop.models import ServiceOperationLine

    _configure_artisan(admin, artisan, rate_code="4")
    add_line(manager, order["id"], service_id=make_service().pk, applied_price="25.00")
    operation_id = confirm_services(manager, order["id"])["id"]
    ServiceOperationLine.objects.update(service_code="")
    draft = create_draft(
        actor=manager,
        source_kind="ARTISAN",
        source_id=operation_id,
        idempotency_key="fiscal:artisan:nocode",
    )
    result = review(actor=manager, preparation_id=draft.preparation_id)
    assert result.token is None
    [impediment] = [i for i in result.impediments if i["field"] == "line[1].item_code"]
    assert impediment["audience"] == "ADMINISTRATOR"
