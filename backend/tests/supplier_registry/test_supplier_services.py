from typing import Any
from unittest.mock import patch

import pytest

from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import AuditEvent, AuditResult
from supplier_registry.application import queries, suppliers
from supplier_registry.application.commands import IdempotencyConflictError
from supplier_registry.application.errors import SupplierApplicationError
from supplier_registry.models import Supplier, SupplierCommand

pytestmark = pytest.mark.django_db
_n = iter(range(1, 10_000))


def key() -> str:
    return f"sup-key-{next(_n):06d}"


def create(actor: Any, **fields: Any) -> dict[str, Any]:
    return suppliers.create_supplier(
        actor=actor, payload={"name": "Repuestos SA", **fields, "idempotency_key": key()}
    ).body


def test_minimal_creation_and_multiple_unidentified(role_admin: Any) -> None:
    a = create(role_admin)
    b = create(role_admin)
    assert a["id"] != b["id"]
    assert (a["identification_type"], a["identification"], a["phone"]) == (None, None, "")
    assert (a["is_active"], a["version"]) == (True, 1)


def test_identification_unique_including_inactive_and_leading_zero(role_admin: Any) -> None:
    s = create(role_admin, identification_type="CI", identification="0912345678")
    assert s["identification"] == "0912345678"
    suppliers.set_supplier_active(
        s["id"],
        active=False,
        actor=role_admin,
        payload={"expected_version": 1, "idempotency_key": key()},
    )
    with pytest.raises(SupplierApplicationError) as exc:
        create(role_admin, name="Otro", identification_type="CI", identification="0912345678")
    assert exc.value.code == "duplicate_identification"
    assert Supplier.objects.count() == 1
    create(role_admin, name="Otro", identification_type="RUC", identification="0912345678001")


@pytest.mark.parametrize(
    "bad",
    [
        {"identification_type": "CI"},
        {"identification": "0912345678"},
        {"identification_type": "CI", "identification": "12"},
        {"email": "nope"},
        {"name": " "},
    ],
)
def test_validation_errors(role_admin: Any, bad: dict[str, Any]) -> None:
    with pytest.raises(SupplierApplicationError) as exc:
        create(role_admin, **bad)
    assert exc.value.code == "validation_error"


def test_unknown_fields_rejected(role_admin: Any) -> None:
    for field in ("balance", "person_type", "cost"):
        with pytest.raises(SupplierApplicationError) as exc:
            create(role_admin, **{field: 1})
        assert exc.value.code == "unknown_field"


def test_update_clears_pair_and_versions(role_admin: Any) -> None:
    s = create(role_admin, identification_type="CI", identification="0912345678", phone="099")
    with pytest.raises(SupplierApplicationError):
        suppliers.update_supplier(
            s["id"],
            actor=role_admin,
            payload={"expected_version": 1, "identification": None, "idempotency_key": key()},
        )
    out = suppliers.update_supplier(
        s["id"],
        actor=role_admin,
        payload={
            "expected_version": 1,
            "identification_type": None,
            "identification": None,
            "phone": "",
            "idempotency_key": key(),
        },
    ).body
    assert (out["identification"], out["phone"], out["version"]) == (None, "", 2)
    noop = suppliers.update_supplier(
        s["id"],
        actor=role_admin,
        payload={"expected_version": 2, "name": out["name"], "idempotency_key": key()},
    ).body
    assert noop["version"] == 2
    with pytest.raises(SupplierApplicationError) as exc:
        suppliers.update_supplier(
            s["id"],
            actor=role_admin,
            payload={"expected_version": 1, "name": "X", "idempotency_key": key()},
        )
    assert exc.value.code == "stale_record"


def test_state_changes_noop_and_replay_before_version(role_admin: Any) -> None:
    s = create(role_admin)
    k = key()
    payload = {"expected_version": 1, "idempotency_key": k}
    first = suppliers.set_supplier_active(s["id"], active=False, actor=role_admin, payload=payload)
    replay = suppliers.set_supplier_active(s["id"], active=False, actor=role_admin, payload=payload)
    assert replay.replayed
    assert replay.body == first.body
    # solicitud nueva obsoleta que pide el estado vigente: 409, no oculta cambios
    with pytest.raises(SupplierApplicationError) as exc:
        suppliers.set_supplier_active(
            s["id"],
            active=False,
            actor=role_admin,
            payload={"expected_version": 1, "idempotency_key": key()},
        )
    assert exc.value.code == "stale_record"
    same = suppliers.set_supplier_active(
        s["id"],
        active=False,
        actor=role_admin,
        payload={"expected_version": 2, "idempotency_key": key()},
    ).body
    assert same["version"] == 2
    on = suppliers.set_supplier_active(
        s["id"],
        active=True,
        actor=role_admin,
        payload={"expected_version": 2, "idempotency_key": key()},
    ).body
    assert (on["is_active"], on["version"]) == (True, 3)
    with pytest.raises(IdempotencyConflictError):
        suppliers.set_supplier_active(
            s["id"],
            active=False,
            actor=role_admin,
            payload={"expected_version": 9, "idempotency_key": k},
        )


@pytest.mark.parametrize("fixture", ["role_manager", "role_seller"])
def test_only_admin_manages(fixture: str, request: pytest.FixtureRequest) -> None:
    actor = request.getfixturevalue(fixture)
    with pytest.raises(BusinessPermissionDeniedError):
        create(actor)
    assert Supplier.objects.count() == 0
    assert SupplierCommand.objects.count() == 0
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 1


def test_audit_carries_only_field_names_not_contacts(role_admin: Any) -> None:
    create(role_admin, phone="0999999999", email="secreto@example.com", address="Calle Privada 1")
    event = AuditEvent.objects.get(action="suppliers.supplier_created")
    dump = str(event.metadata) + event.reason + event.target_id
    assert "0999999999" not in dump
    assert "secreto" not in dump
    assert "Privada" not in dump
    assert "phone" in event.metadata["changed_fields"]


def test_failed_audit_rolls_back_supplier_and_receipt(role_admin: Any) -> None:
    payload = {"name": "A", "idempotency_key": key()}
    with (
        patch(
            "supplier_registry.application.commands.record_audit_event", side_effect=RuntimeError
        ),
        pytest.raises(RuntimeError),
    ):
        suppliers.create_supplier(actor=role_admin, payload=payload)
    assert Supplier.objects.count() == 0
    assert SupplierCommand.objects.count() == 0
    assert suppliers.create_supplier(actor=role_admin, payload=payload).status == 201


def test_search_state_pagination_and_matches(role_admin: Any) -> None:
    a = create(
        role_admin, name="Zeta Repuestos", identification_type="RUC", identification="1790012345001"
    )
    create(role_admin, name="alfa Motors")
    inactive = create(role_admin, name="Inactivo SA")
    suppliers.set_supplier_active(
        inactive["id"],
        active=False,
        actor=role_admin,
        payload={"expected_version": 1, "idempotency_key": key()},
    )
    page = queries.list_suppliers({})
    assert [r["name"] for r in page.results] == ["alfa Motors", "Zeta Repuestos"]
    assert queries.list_suppliers({"is_active": "all"}).count == 3
    assert queries.list_suppliers({"search": "1790012"}).results[0]["id"] == a["id"]
    assert queries.list_suppliers({"search": "zeta"}).count == 1
    assert queries.list_suppliers({"page": "5"}).results == []
    assert queries.list_suppliers({"search": "nada"}).as_dict()["total_pages"] == 0
    with pytest.raises(SupplierApplicationError):
        queries.list_suppliers({"page_size": "500"})

    matches = queries.find_name_matches({"name": "  ZETA repuestos "})
    assert [m["id"] for m in matches["results"]] == [a["id"]]
    assert set(matches["results"][0]) == {"id", "name", "is_active"}  # sin contactos
    assert (
        queries.find_name_matches({"name": "zeta repuestos", "exclude_id": a["id"]})["results"]
        == []
    )
    inactive_match = queries.find_name_matches({"name": "inactivo sa"})
    assert inactive_match["results"][0]["is_active"] is False
    assert queries.find_name_matches({"name": "zeta"})["results"] == []  # solo nombre completo
    # una coincidencia no impide guardar un homónimo
    assert create(role_admin, name="Zeta Repuestos")["id"] != a["id"]


def test_matches_limit_and_has_more(role_admin: Any) -> None:
    for _ in range(11):
        create(role_admin, name="Homónimo")
    out = queries.find_name_matches({"name": "homónimo"})
    assert len(out["results"]) == 10
    assert out["has_more"] is True
