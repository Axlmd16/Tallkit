"""Alta, edición y estado de proveedores: solo el nombre es obligatorio."""

from dataclasses import asdict
from typing import Any
from uuid import UUID

from identity.models import User
from supplier_registry.application.commands import (
    CommandOutcome,
    execute_write,
    reject_unknown_fields,
    save_or_translate,
    translate_validation,
    validated_key,
    validated_version,
)
from supplier_registry.application.errors import not_found, stale_record
from supplier_registry.application.queries import supplier_dict
from supplier_registry.domain.errors import SupplierValidationError
from supplier_registry.domain.validation import NormalizedSupplier, validate_supplier
from supplier_registry.models import Supplier

FIELDS = ("name", "identification_type", "identification", "phone", "email", "address")
PERMISSION = "proveedores.gestionar"
DUPLICATE = {
    "supplier_identification_unique": (
        "duplicate_identification",
        "identification",
        "Ya existe un proveedor con ese tipo y número de identificación.",
    )
}


def _normalized(data: dict[str, Any]) -> NormalizedSupplier:
    try:
        return validate_supplier(data)
    except SupplierValidationError as exc:
        raise translate_validation(exc) from None


def _current(supplier: Supplier) -> dict[str, Any]:
    return {name: getattr(supplier, name) for name in FIELDS}


def create_supplier(
    *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    reject_unknown_fields(payload, frozenset({*FIELDS, "idempotency_key"}))
    validated_key(payload)

    def work() -> tuple[int, dict[str, Any], list[str]]:
        new = _normalized(payload)
        supplier = save_or_translate(lambda: Supplier.objects.create(**asdict(new)), DUPLICATE)
        return 201, supplier_dict(supplier), list(FIELDS)

    return execute_write(
        actor=actor,
        permission=PERMISSION,
        action="suppliers.supplier_created",
        target_type="supplier",
        target_id="uncreated",
        request_id=request_id,
        payload=payload,
        work=work,
    )


def update_supplier(
    pk: int, *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    reject_unknown_fields(payload, frozenset({*FIELDS, "idempotency_key", "expected_version"}))
    validated_key(payload)

    def work() -> tuple[int, dict[str, Any], list[str]]:
        expected = validated_version(payload)
        supplier = Supplier.objects.select_for_update().filter(pk=pk).first()
        if supplier is None:
            raise not_found("El proveedor")
        if supplier.version != expected:
            raise stale_record()
        old = _normalized(_current(supplier))
        provided = {k: v for k, v in payload.items() if k in FIELDS}
        new = _normalized({**_current(supplier), **provided})
        changed = [n for n in FIELDS if getattr(new, n) != getattr(old, n)]
        if not changed:
            return 200, supplier_dict(supplier), []
        for name in changed:
            setattr(supplier, name, getattr(new, name))
        supplier.version += 1
        save_or_translate(supplier.save, DUPLICATE)
        return 200, supplier_dict(supplier), changed

    return execute_write(
        actor=actor,
        permission=PERMISSION,
        action="suppliers.supplier_updated",
        target_type="supplier",
        target_id=str(pk),
        request_id=request_id,
        payload=payload,
        work=work,
    )


def set_supplier_active(
    pk: int,
    *,
    active: bool,
    actor: User,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    reject_unknown_fields(payload, frozenset({"idempotency_key", "expected_version"}))
    validated_key(payload)

    def work() -> tuple[int, dict[str, Any], list[str]]:
        expected = validated_version(payload)
        supplier = Supplier.objects.select_for_update().filter(pk=pk).first()
        if supplier is None:
            raise not_found("El proveedor")
        if supplier.version != expected:
            raise stale_record()
        if supplier.is_active == active:
            return 200, supplier_dict(supplier), []
        supplier.is_active = active
        supplier.version += 1
        supplier.save(update_fields=["is_active", "version", "updated_at"])
        return 200, supplier_dict(supplier), ["is_active"]

    verb = "activated" if active else "deactivated"
    return execute_write(
        actor=actor,
        permission=PERMISSION,
        action=f"suppliers.supplier_{verb}",
        target_type="supplier",
        target_id=str(pk),
        request_id=request_id,
        payload=payload,
        work=work,
    )
