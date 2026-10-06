"""Creación, guardado y copia de borradores de proforma.

Un borrador no reserva ni descuenta inventario, no crea deuda ni consume numeración o usos
de configuración. Las escrituras siguen el orden del diseño: recibo, proforma, cliente y
productos por ID ascendente.
"""

from typing import Any
from uuid import UUID

from catalog.application.sales_references import (
    SaleProductReferenceError,
    lock_product_references,
)
from customer_registry.application.sales_references import (
    CustomerReferenceError,
    lock_customer_reference,
)
from identity.models import User
from proformas.application import clock, queries, references
from proformas.application.commands import (
    CommandOutcome,
    CommandResult,
    execute_write,
    reject_unknown_fields,
    transition_error,
    validated_version,
)
from proformas.application.errors import (
    ProformaApplicationError,
    field_error,
    not_found,
    stale_record,
)
from proformas.domain.draft_input import (
    DRAFT_FIELDS,
    DraftInput,
    DraftValidationError,
    LineInput,
    parse_draft,
)
from proformas.domain.validity import TransitionError, ensure_allowed
from proformas.models import Proforma, ProformaLine

PERMISSION = "proformas.gestionar"


def parse(payload: dict[str, Any]) -> DraftInput:
    try:
        return parse_draft(payload)
    except DraftValidationError as error:
        raise ProformaApplicationError(
            error.code,  # type: ignore[arg-type]
            "La solicitud contiene datos inválidos.",
            error.errors,
        ) from None


def lock_proforma(proforma_id: int) -> Proforma:
    """La proforma es la raíz de consistencia: toda acción que la cambie la bloquea primero."""
    proforma = Proforma.objects.select_for_update().filter(pk=proforma_id).first()
    if proforma is None:
        raise not_found()
    return proforma


def ensure(action: str, proforma: Proforma) -> None:
    try:
        ensure_allowed(action, proforma.state, proforma.valid_until, clock.today())
    except TransitionError as error:
        raise transition_error(error) from None


def _lock_customer(customer_id: int, *, require_active: bool) -> None:
    try:
        lock_customer_reference(customer_id, require_active=require_active)
    except CustomerReferenceError as error:
        message = "El cliente no existe." if error.missing else "El cliente está inactivo."
        raise field_error("inactive_reference", "customer_id", message) from None


def _lock_products(lines: tuple[LineInput, ...], *, tolerated: frozenset[int]) -> None:
    """Bloquea los productos; un producto inactivo solo se tolera si ya estaba en el borrador."""
    try:
        locked = lock_product_references({line.product_id for line in lines}, require_active=False)
    except SaleProductReferenceError as error:
        raise ProformaApplicationError(
            "inactive_reference",
            "Hay productos inexistentes.",
            {
                f"lines.{index}.product_id": ["El producto no existe."]
                for index, line in enumerate(lines)
                if line.product_id in error.missing
            },
        ) from None
    errors = {
        f"lines.{index}.product_id": ["El producto está inactivo."]
        for index, line in enumerate(lines)
        if not locked[line.product_id].is_active and line.product_id not in tolerated
    }
    if errors:
        raise ProformaApplicationError("inactive_reference", "Hay productos inactivos.", errors)


def _write_lines(proforma: Proforma, lines: tuple[LineInput, ...]) -> None:
    ProformaLine.objects.bulk_create(
        ProformaLine(
            proforma=proforma, position=index, product_id=line.product_id, quantity=line.quantity
        )
        for index, line in enumerate(lines, start=1)
    )


def create_draft(
    *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Crea un borrador sin número, reserva, movimiento ni saldo."""

    def work() -> CommandResult:
        inp = parse(payload)
        context = references.current_context()
        if context is None:
            raise field_error(
                "configuration_missing", "configuration", "Falta la configuración comercial."
            )
        _lock_customer(inp.customer_id, require_active=True)
        _lock_products(inp.lines, tolerated=frozenset())
        proforma = Proforma.objects.create(
            customer_id=inp.customer_id,
            fiscal_entity_id=context.entity_id,
            valid_until=inp.valid_until,
            created_by=actor,
        )
        _write_lines(proforma, inp.lines)
        return CommandResult(201, proforma.pk, ("customer", "valid_until", "lines"))

    return execute_write(
        actor=actor,
        permissions=(PERMISSION,),
        action="proformas.proforma_created",
        target_id="new",
        request_id=request_id,
        payload=payload,
        work=work,
        project=queries.project(actor),
    )


def _merge(proforma: Proforma, payload: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {
        "customer_id": proforma.customer_id,
        "valid_until": proforma.valid_until.isoformat() if proforma.valid_until else None,
        "lines": [
            {"product_id": line.product_id, "quantity": f"{line.quantity:.0f}"}
            for line in proforma.lines.order_by("position")
        ],
    }
    merged.update({k: v for k, v in payload.items() if k in DRAFT_FIELDS})
    return merged


def update_draft(
    *, actor: User, proforma_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Guarda el borrador con ``expected_version``; sustituye la colección de líneas completa."""

    def work() -> CommandResult:
        reject_unknown_fields(payload, DRAFT_FIELDS | {"idempotency_key", "expected_version"})
        expected = validated_version(payload)
        proforma = lock_proforma(proforma_id)
        ensure("edit", proforma)
        if proforma.version != expected:
            raise stale_record()
        inp = parse(_merge(proforma, payload))
        _lock_customer(inp.customer_id, require_active=inp.customer_id != proforma.customer_id)
        existing = frozenset(proforma.lines.values_list("product_id", flat=True))
        _lock_products(inp.lines, tolerated=existing)
        proforma.customer_id = inp.customer_id
        proforma.valid_until = inp.valid_until
        proforma.version += 1
        proforma.save(update_fields=["customer", "valid_until", "version", "updated_at"])
        proforma.lines.all().delete()
        _write_lines(proforma, inp.lines)
        return CommandResult(200, proforma.pk, ("customer", "valid_until", "lines"))

    return execute_write(
        actor=actor,
        permissions=(PERMISSION,),
        action="proformas.proforma_updated",
        target_id=str(proforma_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=queries.project(actor),
    )


def copy_proforma(
    *, actor: User, proforma_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Nuevo borrador vinculado a una oferta emitida, vencida, convertida o anulada.

    Copia cliente y líneas como punto de partida, con identidad y vigencia propias. Conserva
    los productos aunque alguno esté inactivo para mostrar la corrección necesaria. El original
    no se modifica ni se reactiva.
    """

    def work() -> CommandResult:
        reject_unknown_fields(payload, frozenset({"idempotency_key"}))
        source = lock_proforma(proforma_id)
        ensure("copy", source)
        copy = Proforma.objects.create(
            customer_id=source.customer_id,
            fiscal_entity_id=source.fiscal_entity_id,
            origin=source,
            created_by=actor,
        )
        ProformaLine.objects.bulk_create(
            ProformaLine(
                proforma=copy, position=index, product_id=line.product_id, quantity=line.quantity
            )
            for index, line in enumerate(source.lines.order_by("position"), start=1)
        )
        return CommandResult(201, copy.pk, ("origin", "lines"), link=f"origin:{source.pk}")

    return execute_write(
        actor=actor,
        permissions=(PERMISSION,),
        action="proformas.proforma_copied",
        target_id=str(proforma_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=queries.project(actor),
    )
