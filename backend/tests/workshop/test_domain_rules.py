"""Reglas puras del taller: estados, edición, finalización, kilometraje y entradas."""

from datetime import date

import pytest

from workshop.domain.finalization import FinalizationFacts, pending_requirements
from workshop.domain.input import (
    InputError,
    parse_create,
    parse_intervention_update,
    parse_line_create,
    parse_line_update,
    parse_photo_description,
    parse_reopen,
    parse_update,
)
from workshop.domain.odometer import OdometerError, needs_confirmation, parse_odometer
from workshop.domain.states import (
    InterventionKind,
    OrderState,
    TransitionError,
    allowed_actions,
    ensure_transition,
    open_intervention_kind,
)

REG, FIN, REO = OrderState.REGISTERED, OrderState.FINALIZED, OrderState.REOPENED
ALL = frozenset(
    {
        "mantenimientos.ver",
        "mantenimientos.gestionar",
        "mantenimientos.cambiar_precio_servicio",
        "mantenimientos.gestionar_fotos",
        "mantenimientos.finalizar",
        "mantenimientos.reabrir",
    }
)


@pytest.mark.parametrize(("source", "target"), [(REG, FIN), (REO, FIN), (FIN, REO)])
def test_allowed_transitions(source: OrderState, target: OrderState) -> None:
    ensure_transition(source, target)


@pytest.mark.parametrize(
    ("source", "target"), [(REG, REO), (FIN, FIN), (REO, REG), (FIN, REG), (REG, REG)]
)
def test_rejected_transitions(source: OrderState, target: OrderState) -> None:
    with pytest.raises(TransitionError):
        ensure_transition(source, target)


def test_open_intervention_kind_per_state() -> None:
    assert open_intervention_kind(REG) is InterventionKind.INITIAL
    assert open_intervention_kind(REO) is InterventionKind.CORRECTIVE
    assert open_intervention_kind(FIN) is None


def test_allowed_actions_follow_state_and_permissions() -> None:
    assert allowed_actions(REG, ALL) == (
        "edit",
        "manage_services",
        "change_price",
        "manage_photos",
        "finalize",
    )
    assert allowed_actions(REO, ALL) == (
        "edit_intervention",
        "manage_services",
        "manage_photos",
        "finalize",
    )
    assert allowed_actions(FIN, ALL) == ("reopen",)
    assert allowed_actions(REG, frozenset({"mantenimientos.ver"})) == ()
    assert allowed_actions(FIN, frozenset({"mantenimientos.ver", "mantenimientos.gestionar"})) == ()


def test_initial_finalization_requirements() -> None:
    facts = FinalizationFacts(
        kind=InterventionKind.INITIAL, diagnosis="  ", line_count=0, work_performed=""
    )
    assert [r.code for r in pending_requirements(facts)] == ["diagnosis", "service_lines"]
    done = FinalizationFacts(
        kind=InterventionKind.INITIAL, diagnosis="Frenos", line_count=1, work_performed=""
    )
    assert pending_requirements(done) == ()


def test_corrective_finalization_requires_work_only() -> None:
    facts = FinalizationFacts(
        kind=InterventionKind.CORRECTIVE, diagnosis="", line_count=0, work_performed=" "
    )
    assert [r.code for r in pending_requirements(facts)] == ["work_performed"]
    done = FinalizationFacts(
        kind=InterventionKind.CORRECTIVE, diagnosis="", line_count=0, work_performed="Ajuste"
    )
    assert pending_requirements(done) == ()


def test_finalization_checks_are_extensible() -> None:
    def extra(_: FinalizationFacts):  # type: ignore[no-untyped-def]
        from workshop.domain.finalization import Requirement

        return (Requirement("linked_sale", "Venta pendiente."),)

    done = FinalizationFacts(
        kind=InterventionKind.INITIAL, diagnosis="x", line_count=1, work_performed=""
    )
    assert [r.code for r in pending_requirements(done, extra_checks=(extra,))] == ["linked_sale"]


@pytest.mark.parametrize(("raw", "expected"), [(0, 0), (85000, 85000), ("120", 120)])
def test_valid_odometer(raw: object, expected: int) -> None:
    assert parse_odometer(raw) == expected


@pytest.mark.parametrize("raw", [-5, 1200.5, "1200,5", None, True, 10_000_000, "x"])
def test_invalid_odometer(raw: object) -> None:
    with pytest.raises(OdometerError):
        parse_odometer(raw)


def test_lower_odometer_requires_confirmation() -> None:
    assert needs_confirmation(80000, 90000) is True
    assert needs_confirmation(90000, 90000) is False
    assert needs_confirmation(95000, 90000) is False
    assert needs_confirmation(10, None) is False


TODAY = date(2026, 9, 24)


def test_parse_create_minimal_and_defaults() -> None:
    data = parse_create(
        {"customer_id": 1, "vehicle_id": 2, "odometer_km": 85000, "idempotency_key": "k" * 8},
        today=TODAY,
    )
    assert (data.customer_id, data.vehicle_id, data.opened_on, data.odometer_km) == (
        1,
        2,
        TODAY,
        85000,
    )
    assert (data.diagnosis, data.notes, data.odometer_confirmed) == ("", "", False)


def test_parse_create_reports_field_errors() -> None:
    with pytest.raises(InputError) as error:
        parse_create({"opened_on": "2026-09-25", "odometer_km": -1}, today=TODAY)
    assert set(error.value.errors) == {"customer_id", "vehicle_id", "opened_on", "odometer_km"}


@pytest.mark.parametrize(
    "field", ["state", "number", "created_by", "subtotal", "total", "discount", "created_at"]
)
def test_unknown_fields_are_rejected(field: str) -> None:
    with pytest.raises(InputError) as error:
        parse_update({field: "x", "expected_version": 1}, today=TODAY)
    assert error.value.code == "unknown_field"


def test_parse_update_is_partial_and_strips_text() -> None:
    data = parse_update(
        {"diagnosis": "  Ruido  ", "expected_version": 3, "idempotency_key": "k" * 8}, today=TODAY
    )
    assert data.fields == {"diagnosis": "Ruido"}
    assert data.expected_version == 3


def test_text_length_limits() -> None:
    with pytest.raises(InputError):
        parse_update({"notes": "x" * 5001, "expected_version": 1}, today=TODAY)
    with pytest.raises(InputError):
        parse_photo_description("x" * 201)
    assert parse_photo_description(None) == ""


def test_reopen_requires_reason() -> None:
    with pytest.raises(InputError) as error:
        parse_reopen({"reason": "   ", "expected_version": 1})
    assert "reason" in error.value.errors
    assert parse_reopen({"reason": " Ruido ", "expected_version": 2}).reason == "Ruido"


def test_line_and_intervention_payloads() -> None:
    line = parse_line_create({"service_id": 4, "expected_version": 1})
    assert (line.service_id, line.quantity, line.applied_price) == (4, 1, None)
    update = parse_line_update({"quantity": 3, "applied_price": "0", "expected_version": 1})
    assert (update.quantity, str(update.applied_price)) == (3, "0.00")
    with pytest.raises(InputError):
        parse_line_update({"discount": 1, "expected_version": 1})
    with pytest.raises(InputError):
        parse_line_create({"service_name": "Libre", "expected_version": 1})
    intervention = parse_intervention_update({"work_performed": " Ajuste ", "expected_version": 5})
    assert intervention.fields == {"work_performed": "Ajuste"}


def test_pending_parts_block_finalization_for_any_intervention() -> None:
    from workshop.domain.finalization import FinalizationFacts, pending_requirements
    from workshop.domain.states import InterventionKind

    ready = FinalizationFacts(InterventionKind.INITIAL, "Frenos", 1, "", pending_part_lines=0)
    blocked = FinalizationFacts(InterventionKind.INITIAL, "Frenos", 1, "", pending_part_lines=1)
    assert pending_requirements(ready) == ()
    [requirement] = pending_requirements(blocked)
    assert requirement.code == "pending_parts"
    assert "1 línea" in requirement.message


def test_billing_actions_follow_state_permissions_and_pending_services() -> None:
    from workshop.domain.states import OrderState, billing_actions

    manager = frozenset(
        {
            "mantenimientos.ver",
            "mantenimientos.gestionar_repuestos",
            "ventas.preparar_vinculada",
            "servicios_economicos.ver",
            "servicios_economicos.confirmar",
            "pagos_artesanales.registrar",
        }
    )
    assert billing_actions(OrderState.REGISTERED, manager, pending_services=True) == (
        "manage_parts",
        "document_services",
        "view_service_operations",
    )
    assert billing_actions(OrderState.REOPENED, manager, pending_services=False) == (
        "view_service_operations",
    )
    assert billing_actions(OrderState.FINALIZED, manager, pending_services=True) == (
        "document_services",
        "view_service_operations",
    )
    only_parts = frozenset({"mantenimientos.gestionar_repuestos"})
    assert billing_actions(OrderState.REGISTERED, only_parts, pending_services=True) == ()
