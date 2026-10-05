"""Servicios del ámbito artesanal: precio referencial final y estado."""

from dataclasses import asdict
from typing import Any
from uuid import UUID

from catalog.application.commands import (
    CommandOutcome,
    execute_write,
    reject_unknown_fields,
    save_or_translate,
    translate_validation,
    validated_key,
    validated_version,
)
from catalog.application.errors import field_error, not_found, stale_record
from catalog.application.queries import service_dict
from catalog.application.service_codes import next_service_code
from catalog.domain.errors import CatalogValidationError
from catalog.domain.validation import NormalizedService, validate_service
from catalog.models import Service
from identity.models import User
from workshop_configuration.application.catalog_options import (
    CatalogTaxReferenceError,
    validate_catalog_tax_reference,
)

FIELDS = ("name", "description", "reference_price", "tax_definition_id")
PERMISSION = "servicios.gestionar"


def _normalized(data: dict[str, Any]) -> NormalizedService:
    try:
        return validate_service(data)
    except CatalogValidationError as exc:
        raise translate_validation(exc) from None


def _check_tax(tax_definition_id: int) -> None:
    try:
        validate_catalog_tax_reference(tax_definition_id, "ARTESANAL")
    except CatalogTaxReferenceError as exc:
        if exc.code == "not_found":
            raise field_error(
                "validation_error", "tax_definition_id", "La definición de impuesto no existe."
            ) from None
        raise field_error(
            "invalid_tax_scope",
            "tax_definition_id",
            "El impuesto no pertenece al ámbito artesanal de los servicios.",
        ) from None


def _current_input(service: Service) -> dict[str, Any]:
    return {
        "name": service.name,
        "description": service.description,
        "reference_price": f"{service.reference_price:.2f}",
        "tax_definition_id": service.tax_definition_id,
    }


def create_service(
    *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    reject_unknown_fields(payload, frozenset({*FIELDS, "idempotency_key"}))
    validated_key(payload)

    def work() -> tuple[int, dict[str, Any], list[str]]:
        new = _normalized(payload)
        _check_tax(new.tax_definition_id)
        service = save_or_translate(
            lambda: Service.objects.create(code=next_service_code(), **asdict(new)), {}
        )
        return 201, service_dict(service), list(FIELDS)

    return execute_write(
        actor=actor,
        permission=PERMISSION,
        action="catalog.service_created",
        target_type="service",
        target_id="uncreated",
        request_id=request_id,
        payload=payload,
        work=work,
    )


def update_service(
    pk: int, *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    reject_unknown_fields(payload, frozenset({*FIELDS, "idempotency_key", "expected_version"}))
    validated_key(payload)

    def work() -> tuple[int, dict[str, Any], list[str]]:
        expected = validated_version(payload)
        service = Service.objects.select_for_update().filter(pk=pk).first()
        if service is None:
            raise not_found("El servicio")
        if service.version != expected:
            raise stale_record()
        old_input = _current_input(service)
        old = _normalized(old_input)
        new = _normalized({**old_input, **{k: v for k, v in payload.items() if k in FIELDS}})
        changed = [n for n in FIELDS if getattr(new, n) != getattr(old, n)]
        if not changed:
            return 200, service_dict(service), []
        if "tax_definition_id" in changed:
            _check_tax(new.tax_definition_id)
        for name in changed:
            setattr(service, name, getattr(new, name))
        service.version += 1
        service.save()
        return 200, service_dict(service), changed

    return execute_write(
        actor=actor,
        permission=PERMISSION,
        action="catalog.service_updated",
        target_type="service",
        target_id=str(pk),
        request_id=request_id,
        payload=payload,
        work=work,
    )


def set_service_active(
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
        service = Service.objects.select_for_update().filter(pk=pk).first()
        if service is None:
            raise not_found("El servicio")
        if service.version != expected:
            raise stale_record()
        if service.is_active == active:
            return 200, service_dict(service), []
        service.is_active = active
        service.version += 1
        service.save(update_fields=["is_active", "version", "updated_at"])
        return 200, service_dict(service), ["is_active"]

    verb = "activated" if active else "deactivated"
    return execute_write(
        actor=actor,
        permission=PERMISSION,
        action=f"catalog.service_{verb}",
        target_type="service",
        target_id=str(pk),
        request_id=request_id,
        payload=payload,
        work=work,
    )
