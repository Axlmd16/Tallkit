"""Categorías, unidades de medida y marcas de producto."""

from collections.abc import Callable
from dataclasses import asdict, dataclass
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
from catalog.application.queries import brand_dict, category_dict, unit_dict
from catalog.domain.errors import CatalogValidationError
from catalog.domain.validation import validate_brand, validate_category, validate_unit
from catalog.models import MeasurementUnit, Product, ProductBrand, ProductCategory
from identity.models import User


@dataclass(frozen=True)
class AuxSpec:
    model: type[Any]
    validate: Callable[[dict[str, Any]], Any]
    to_dict: Callable[[Any], dict[str, Any]]
    fields: tuple[str, ...]
    action_prefix: str
    target_type: str
    duplicate_constraint: str
    label: str


SPECS: dict[str, AuxSpec] = {
    "category": AuxSpec(
        ProductCategory,
        validate_category,
        category_dict,
        ("name", "description"),
        "catalog.category",
        "product_category",
        "product_category_name_unique",
        "categoría",
    ),
    "unit": AuxSpec(
        MeasurementUnit,
        validate_unit,
        unit_dict,
        ("name", "symbol"),
        "catalog.unit",
        "measurement_unit",
        "measurement_unit_name_unique",
        "unidad",
    ),
    "brand": AuxSpec(
        ProductBrand,
        validate_brand,
        brand_dict,
        ("name",),
        "catalog.brand",
        "product_brand",
        "product_brand_name_unique",
        "marca",
    ),
}

PERMISSION = "productos.gestionar"


def _duplicate(spec: AuxSpec) -> dict[str, tuple[str, str, str]]:
    return {
        spec.duplicate_constraint: (
            "duplicate_name",
            "name",
            f"Ya existe una {spec.label} con ese nombre, activa o inactiva."
            if spec.label != "unidad"
            else "Ya existe una unidad con ese nombre, activa o inactiva.",
        )
    }


def _validate(spec: AuxSpec, data: dict[str, Any]) -> dict[str, Any]:
    try:
        return asdict(spec.validate(data))
    except CatalogValidationError as exc:
        raise translate_validation(exc) from None


def create_auxiliary(
    kind: str, *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    spec = SPECS[kind]
    allowed = frozenset({*spec.fields, "idempotency_key"})

    def work() -> tuple[int, dict[str, Any], list[str]]:
        values = _validate(spec, payload)
        obj = save_or_translate(lambda: spec.model.objects.create(**values), _duplicate(spec))
        return 201, spec.to_dict(obj), list(spec.fields)

    return _write(spec, "created", actor, "uncreated", payload, allowed, request_id, work)


def _write(
    spec: AuxSpec,
    verb: str,
    actor: User,
    target_id: str,
    payload: dict[str, Any],
    allowed: frozenset[str],
    request_id: UUID | None,
    work: Callable[[], tuple[int, dict[str, Any], list[str]]],
) -> CommandOutcome:
    # Forma de la entrada antes de reclamar el recibo.
    reject_unknown_fields(payload, allowed)
    validated_key(payload)
    return execute_write(
        actor=actor,
        permission=PERMISSION,
        action=f"{spec.action_prefix}_{verb}",
        target_type=spec.target_type,
        target_id=target_id,
        request_id=request_id,
        payload=payload,
        work=work,
    )


def update_auxiliary(
    kind: str,
    pk: int,
    *,
    actor: User,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    spec = SPECS[kind]
    allowed = frozenset({*spec.fields, "idempotency_key", "expected_version"})

    def work() -> tuple[int, dict[str, Any], list[str]]:
        expected = validated_version(payload)
        obj = spec.model.objects.select_for_update().filter(pk=pk).first()
        if obj is None:
            raise not_found("El registro")
        if obj.version != expected:
            raise stale_record()
        current = {name: getattr(obj, name) for name in spec.fields}
        provided = {k: v for k, v in payload.items() if k in spec.fields}
        values = _validate(spec, {**current, **provided})
        changed = [name for name in spec.fields if values[name] != current[name]]
        if not changed:
            return 200, spec.to_dict(obj), []
        for name in changed:
            setattr(obj, name, values[name])
        obj.version += 1
        save_or_translate(obj.save, _duplicate(spec))
        return 200, spec.to_dict(obj), changed

    return _write(spec, "updated", actor, str(pk), payload, allowed, request_id, work)


def set_auxiliary_active(
    kind: str,
    pk: int,
    *,
    active: bool,
    actor: User,
    payload: dict[str, Any],
    request_id: UUID | None = None,
) -> CommandOutcome:
    spec = SPECS[kind]
    allowed = frozenset({"idempotency_key", "expected_version"})

    def work() -> tuple[int, dict[str, Any], list[str]]:
        expected = validated_version(payload)
        obj = spec.model.objects.select_for_update().filter(pk=pk).first()
        if obj is None:
            raise not_found("El registro")
        if obj.version != expected:
            raise stale_record()
        if obj.is_active == active:
            return 200, spec.to_dict(obj), []
        # La fila de la categoría ya está bloqueada: altas, reclasificaciones y
        # reactivaciones de producto esperan este bloqueo antes de validar.
        if (
            not active
            and spec.model is ProductCategory
            and Product.objects.filter(category=obj, is_active=True).exists()
        ):
            raise field_error(
                "category_has_active_products",
                "category_id",
                "La categoría tiene productos activos; reclasifíquelos o desactívelos antes.",
            )
        obj.is_active = active
        obj.version += 1
        obj.save(update_fields=["is_active", "version", "updated_at"])
        return 200, spec.to_dict(obj), ["is_active"]

    verb = "activated" if active else "deactivated"
    return _write(spec, verb, actor, str(pk), payload, allowed, request_id, work)
