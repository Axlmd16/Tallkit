"""El código de servicio lo asigna el sistema, es único, visible e inmutable."""

from typing import Any
from unittest.mock import patch

import pytest

from catalog.application import queries, services
from catalog.application.errors import CatalogApplicationError
from catalog.models import Service, ServiceCodeCounter
from workshop_configuration.models import TaxDefinition

pytestmark = pytest.mark.django_db
_keys = iter(range(1, 10_000))


def _key() -> str:
    return f"service-code-{next(_keys):06d}"


def _create(actor: Any, tax: TaxDefinition, name: str = "Alineación", **extra: Any) -> Any:
    return services.create_service(
        actor=actor,
        payload={
            "name": name,
            "reference_price": "20",
            "tax_definition_id": tax.pk,
            "idempotency_key": _key(),
            **extra,
        },
    ).body


def _last_number() -> int:
    return (
        ServiceCodeCounter.objects.filter(pk=1).values_list("last_number", flat=True).first() or 0
    )


def test_first_service_receives_the_first_code(
    role_admin: Any, artisanal_tax: TaxDefinition
) -> None:
    created = _create(role_admin, artisanal_tax)
    assert created["code"] == "SRV-000001"
    assert Service.objects.get(pk=created["id"]).code == "SRV-000001"


def test_next_code_follows_the_counter(role_admin: Any, artisanal_tax: TaxDefinition) -> None:
    ServiceCodeCounter.objects.update_or_create(pk=1, defaults={"last_number": 11})
    assert _create(role_admin, artisanal_tax)["code"] == "SRV-000012"


def test_code_fits_the_invoice_limit_even_for_large_counters(
    role_admin: Any, artisanal_tax: TaxDefinition
) -> None:
    ServiceCodeCounter.objects.update_or_create(pk=1, defaults={"last_number": 9_999_999})
    code = _create(role_admin, artisanal_tax)["code"]
    assert code == "SRV-10000000"
    assert len(code) <= 25


def test_code_is_visible_in_detail_and_list(role_admin: Any, artisanal_tax: TaxDefinition) -> None:
    created = _create(role_admin, artisanal_tax)
    assert queries.get_service(created["id"])["code"] == "SRV-000001"
    assert [row["code"] for row in queries.list_services({}).results] == ["SRV-000001"]


def test_rejected_create_does_not_consume_a_code(
    role_admin: Any, commercial_tax: TaxDefinition
) -> None:
    with pytest.raises(CatalogApplicationError):
        _create(role_admin, commercial_tax)
    assert Service.objects.count() == 0
    assert _last_number() == 0


def test_failed_persistence_leaves_no_service_and_does_not_consume_a_code(
    role_admin: Any, artisanal_tax: TaxDefinition
) -> None:
    with (
        patch.object(Service.objects, "create", side_effect=RuntimeError("fallo")),
        pytest.raises(RuntimeError),
    ):
        _create(role_admin, artisanal_tax)
    assert Service.objects.count() == 0
    assert _last_number() == 0
    assert _create(role_admin, artisanal_tax)["code"] == "SRV-000001"


def test_deactivated_service_does_not_free_its_code(
    role_admin: Any, artisanal_tax: TaxDefinition
) -> None:
    first = _create(role_admin, artisanal_tax)
    services.set_service_active(
        first["id"],
        active=False,
        actor=role_admin,
        payload={"expected_version": 1, "idempotency_key": _key()},
    )
    second = _create(role_admin, artisanal_tax, name="Balanceo")
    assert (first["code"], second["code"]) == ("SRV-000001", "SRV-000002")


def test_code_cannot_be_sent_on_create_or_update(
    role_admin: Any, artisanal_tax: TaxDefinition
) -> None:
    with pytest.raises(CatalogApplicationError) as exc:
        _create(role_admin, artisanal_tax, code="MI-CODIGO")
    assert exc.value.code == "unknown_field"
    assert "code" in exc.value.errors
    assert Service.objects.count() == 0
    created = _create(role_admin, artisanal_tax)
    with pytest.raises(CatalogApplicationError) as exc:
        services.update_service(
            created["id"],
            actor=role_admin,
            payload={"expected_version": 1, "code": "OTRO", "idempotency_key": _key()},
        )
    assert exc.value.code == "unknown_field"
    assert Service.objects.get(pk=created["id"]).code == "SRV-000001"


def test_editing_a_service_keeps_its_code(role_admin: Any, artisanal_tax: TaxDefinition) -> None:
    created = _create(role_admin, artisanal_tax)
    updated = services.update_service(
        created["id"],
        actor=role_admin,
        payload={"expected_version": 1, "name": "Alineación 3D", "idempotency_key": _key()},
    ).body
    assert updated["code"] == created["code"] == "SRV-000001"


def test_search_matches_the_service_code_and_still_the_name(
    role_admin: Any, artisanal_tax: TaxDefinition
) -> None:
    _create(role_admin, artisanal_tax, name="Alineación")
    _create(role_admin, artisanal_tax, name="Balanceo")
    by_code = queries.list_services({"search": "srv-000002"})
    assert [row["name"] for row in by_code.results] == ["Balanceo"]
    assert queries.list_services({"search": "000001"}).count == 1
    assert queries.list_services({"search": "alinea"}).count == 1
