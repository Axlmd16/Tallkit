"""Alta, edición y estado de productos con bloqueos en el orden del diseño §4.

Orden: recibo → categorías → unidades → marcas de producto → marcas de vehículo →
producto y compatibilidades. Las lecturas previas solo preparan el conjunto de
bloqueos y se revalidan una vez bloqueado el producto.
"""

from collections.abc import Iterable
from dataclasses import asdict
from typing import Any
from uuid import UUID

from catalog.application.commands import (
    CommandOutcome,
    PermissionDeniedInWorkError,
    execute_write,
    reject_unknown_fields,
    save_or_translate,
    translate_validation,
    validated_key,
    validated_version,
)
from catalog.application.errors import (
    CatalogApplicationError,
    ErrorCode,
    field_error,
    not_found,
    stale_record,
)
from catalog.application.queries import product_dict
from catalog.domain.errors import CatalogValidationError
from catalog.domain.validation import NormalizedProduct, validate_product
from catalog.models import (
    MeasurementUnit,
    Product,
    ProductBrand,
    ProductCategory,
    ProductCompatibility,
)
from customer_registry.application.catalog_references import (
    VehicleBrandReferenceError,
    lock_vehicle_brands_for_association,
)
from identity.application.authorization import has_permission
from identity.models import User
from workshop_configuration.application.catalog_options import (
    CatalogTaxReferenceError,
    validate_catalog_tax_reference,
)

FIELDS = (
    "code",
    "manufacturer_code",
    "name",
    "description",
    "category_id",
    "unit_id",
    "product_brand_id",
    "vehicle_brand_ids",
    "tax_definition_id",
    "content_quantity",
    "sale_price",
    "is_kit",
)
SET_FIELDS = frozenset({"vehicle_brand_ids"})
_DUPLICATE_MANUFACTURER_CODE = (
    "duplicate_manufacturer_code",
    "manufacturer_code",
    "Ya existe un producto con ese código de fabricante para la misma marca.",
)
DUPLICATE_CODE = {
    "product_code_unique": ("duplicate_code", "code", "Ya existe un producto con ese código."),
    "product_mfr_code_brand_unique": _DUPLICATE_MANUFACTURER_CODE,
    "product_mfr_code_nobrand_unique": _DUPLICATE_MANUFACTURER_CODE,
}


def _lock_simple(
    model: type[Any],
    ids: Iterable[int],
    new_ids: set[int],
    field: str,
    label: str,
) -> None:
    rows = {
        o.pk: o for o in model.objects.select_for_update().filter(pk__in=set(ids)).order_by("pk")
    }
    for pk in sorted(set(ids)):
        row = rows.get(pk)
        if row is None:
            raise field_error("validation_error", field, f"La {label} indicada no existe.")
        if pk in new_ids and not row.is_active:
            raise field_error(
                "inactive_reference",
                field,
                f"La {label} está inactiva y no admite nuevas selecciones.",
            )


def _lock_references(old: NormalizedProduct | None, new: NormalizedProduct) -> None:
    """Bloquea en el orden común; solo las asociaciones nuevas exigen estado activo."""

    def pair(attr: str) -> tuple[set[int], set[int]]:
        new_v = getattr(new, attr)
        old_v = None if old is None else getattr(old, attr)
        news = {new_v} - {old_v} if new_v is not None else set()
        everything = {v for v in (new_v, old_v) if v is not None}
        return everything, news

    all_c, new_c = pair("category_id")
    _lock_simple(ProductCategory, all_c, new_c, "category_id", "categoría")
    all_u, new_u = pair("unit_id")
    _lock_simple(MeasurementUnit, all_u, new_u, "unit_id", "unidad")
    all_b, new_b = pair("product_brand_id")
    _lock_simple(ProductBrand, all_b, new_b, "product_brand_id", "marca de producto")
    old_v = set() if old is None else set(old.vehicle_brand_ids)
    new_v = set(new.vehicle_brand_ids)
    try:
        lock_vehicle_brands_for_association(old_v | new_v, new_ids=new_v - old_v)
    except VehicleBrandReferenceError as exc:
        code: ErrorCode = "validation_error" if exc.missing else "inactive_reference"
        raise field_error(
            code, "vehicle_brand_ids", "Alguna marca de vehículo no existe o está inactiva."
        ) from None


def _check_tax(tax_definition_id: int) -> None:
    try:
        validate_catalog_tax_reference(tax_definition_id, "COMERCIAL")
    except CatalogTaxReferenceError as exc:
        if exc.code == "not_found":
            raise field_error(
                "validation_error", "tax_definition_id", "La definición de impuesto no existe."
            ) from None
        raise field_error(
            "invalid_tax_scope",
            "tax_definition_id",
            "El impuesto no pertenece al ámbito comercial de los productos.",
        ) from None


def _normalized(data: dict[str, Any], current_code: str | None = None) -> NormalizedProduct:
    try:
        return validate_product(data, current_code=current_code)
    except CatalogValidationError as exc:
        raise translate_validation(exc) from None


def _current_input(product: Product) -> dict[str, Any]:
    return {
        "code": product.code,
        "manufacturer_code": product.manufacturer_code,
        "name": product.name,
        "description": product.description,
        "category_id": product.category_id,
        "unit_id": product.unit_id,
        "product_brand_id": product.product_brand_id,
        "vehicle_brand_ids": list(
            product.compatibilities.values_list("vehicle_brand_id", flat=True)
        ),
        "tax_definition_id": product.tax_definition_id,
        "content_quantity": f"{product.content_quantity:f}",
        "sale_price": f"{product.sale_price:.2f}",
        "is_kit": product.is_kit,
    }


def create_product(
    *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    reject_unknown_fields(payload, frozenset({*FIELDS, "idempotency_key"}))
    validated_key(payload)

    def work() -> tuple[int, dict[str, Any], list[str]]:
        new = _normalized(payload)
        _lock_references(None, new)
        _check_tax(new.tax_definition_id)
        values = asdict(new)
        vehicle_ids = values.pop("vehicle_brand_ids")
        product = save_or_translate(
            lambda: Product.objects.create(
                code=new.code,
                manufacturer_code=new.manufacturer_code,
                name=new.name,
                description=new.description,
                category_id=new.category_id,
                unit_id=new.unit_id,
                product_brand_id=new.product_brand_id,
                tax_definition_id=new.tax_definition_id,
                content_quantity=new.content_quantity,
                sale_price=new.sale_price,
                is_kit=new.is_kit,
            ),
            DUPLICATE_CODE,
        )
        ProductCompatibility.objects.bulk_create(
            ProductCompatibility(product=product, vehicle_brand_id=i) for i in vehicle_ids
        )
        return (
            201,
            product_dict(product),
            [f for f in FIELDS if f != "vehicle_brand_ids" or vehicle_ids],
        )

    return execute_write(
        actor=actor,
        permission="productos.gestionar",
        action="catalog.product_created",
        target_type="product",
        target_id="uncreated",
        request_id=request_id,
        payload=payload,
        work=work,
        set_fields=SET_FIELDS,
    )


def update_product(
    pk: int, *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    reject_unknown_fields(payload, frozenset({*FIELDS, "idempotency_key", "expected_version"}))
    validated_key(payload)

    def work() -> tuple[int, dict[str, Any], list[str]]:
        expected = validated_version(payload)
        preliminary = Product.objects.filter(pk=pk).first()
        if preliminary is None:
            raise not_found("El producto")
        old_input = _current_input(preliminary)
        # El código vigente se conserva aunque exceda el límite actual; solo uno nuevo debe caber.
        old = _normalized(old_input, current_code=preliminary.code)
        new = _normalized(
            {**old_input, **{k: v for k, v in payload.items() if k in FIELDS}},
            current_code=preliminary.code,
        )

        _lock_references(old, new)
        product = Product.objects.select_for_update().filter(pk=pk).first()
        if product is None:
            raise not_found("El producto")
        if product.version != expected or _current_input(product) != old_input:
            raise stale_record()

        if new.tax_definition_id != old.tax_definition_id:
            _check_tax(new.tax_definition_id)

        changed = [name for name in FIELDS if getattr(new, name) != getattr(old, name)]
        if not changed:
            return 200, product_dict(product), []
        if "sale_price" in changed and not has_permission(actor, "productos.cambiar_precio"):
            raise PermissionDeniedInWorkError("productos.cambiar_precio")

        scalars = [c for c in changed if c != "vehicle_brand_ids"]
        for name in scalars:
            setattr(product, name, getattr(new, name))
        product.version += 1
        save_or_translate(product.save, DUPLICATE_CODE)
        if "vehicle_brand_ids" in changed:
            removed = set(old.vehicle_brand_ids) - set(new.vehicle_brand_ids)
            added = set(new.vehicle_brand_ids) - set(old.vehicle_brand_ids)
            ProductCompatibility.objects.filter(
                product=product, vehicle_brand_id__in=removed
            ).delete()
            ProductCompatibility.objects.bulk_create(
                ProductCompatibility(product=product, vehicle_brand_id=i) for i in sorted(added)
            )
        return 200, product_dict(product), changed

    return execute_write(
        actor=actor,
        permission="productos.gestionar",
        action="catalog.product_updated",
        target_type="product",
        target_id=str(pk),
        request_id=request_id,
        payload=payload,
        work=work,
        set_fields=SET_FIELDS,
    )


def set_product_active(
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
        preliminary = Product.objects.filter(pk=pk).values_list("category_id", flat=True).first()
        if preliminary is None:
            raise not_found("El producto")
        category = ProductCategory.objects.select_for_update().get(pk=preliminary)
        product = Product.objects.select_for_update().filter(pk=pk).first()
        if product is None:
            raise not_found("El producto")
        if product.category_id != category.pk:
            raise stale_record()
        if product.version != expected:
            raise stale_record()
        if product.is_active == active:
            return 200, product_dict(product), []
        if active and not category.is_active:
            raise CatalogApplicationError(
                "inactive_reference",
                "La categoría está inactiva; actívela o reclasifique el producto.",
                {"category_id": ["La categoría está inactiva."]},
            )
        product.is_active = active
        product.version += 1
        product.save(update_fields=["is_active", "version", "updated_at"])
        return 200, product_dict(product), ["is_active"]

    verb = "activated" if active else "deactivated"
    return execute_write(
        actor=actor,
        permission="productos.desactivar",
        action=f"catalog.product_{verb}",
        target_type="product",
        target_id=str(pk),
        request_id=request_id,
        payload=payload,
        work=work,
    )
