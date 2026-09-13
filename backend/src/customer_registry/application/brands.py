from dataclasses import dataclass
from uuid import UUID

from django.db import transaction

from customer_registry.domain.validation import (
    BrandValidationError as BrandValidationError,
)
from customer_registry.domain.validation import (
    validate_brand_name,
)
from customer_registry.models import VehicleBrand
from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User


class BrandApplicationError(Exception):
    pass


class BrandNotFoundError(BrandApplicationError):
    pass


class StaleBrandRecordError(BrandApplicationError):
    pass


@dataclass(frozen=True)
class BrandPage:
    items: list[VehicleBrand]
    total_count: int
    page: int
    page_size: int
    total_pages: int


def create_brand(
    *,
    name: str,
    actor: User,
    request_id: UUID | None = None,
) -> VehicleBrand:
    require_permission(
        actor=actor,
        permission="marcas_vehiculo.gestionar",
        request_id=request_id,
        denial_action="registry.brand_created",
        target_type="vehicle_brand",
        target_id="uncreated",
    )

    try:
        norm_name = validate_brand_name(name)
    except BrandValidationError:
        record_audit_event(
            actor=actor,
            action="registry.brand_create_rejected",
            target_type="vehicle_brand",
            target_id="uncreated",
            result=AuditResult.FAILURE,
            reason="validation_error",
            request_id=request_id,
        )
        raise

    with transaction.atomic():
        brand = VehicleBrand.objects.create(
            name=norm_name,
            is_active=True,
            version=1,
        )
        record_audit_event(
            actor=actor,
            action="registry.brand_created",
            target_type="vehicle_brand",
            target_id=str(brand.id),
            result=AuditResult.SUCCESS,
            request_id=request_id,
            metadata={"changed_fields": ["name"]},
        )
        return brand


def update_brand(
    *,
    brand_id: int,
    name: str,
    expected_version: int,
    actor: User,
    request_id: UUID | None = None,
) -> VehicleBrand:
    require_permission(
        actor=actor,
        permission="marcas_vehiculo.gestionar",
        request_id=request_id,
        denial_action="registry.brand_updated",
        target_type="vehicle_brand",
        target_id=str(brand_id),
    )

    try:
        norm_name = validate_brand_name(name)
    except BrandValidationError:
        record_audit_event(
            actor=actor,
            action="registry.brand_update_rejected",
            target_type="vehicle_brand",
            target_id=str(brand_id),
            result=AuditResult.FAILURE,
            reason="validation_error",
            request_id=request_id,
        )
        raise

    try:
        with transaction.atomic():
            brand = VehicleBrand.objects.select_for_update().filter(id=brand_id).first()
            if brand is None:
                raise BrandNotFoundError(f"Marca {brand_id} no encontrada.")

            if brand.version != expected_version:
                raise StaleBrandRecordError(
                    f"Versión obsoleta para la marca {brand_id}: "
                    f"esperada {expected_version}, actual {brand.version}."
                )

            if brand.name == norm_name:
                return brand

            brand.name = norm_name
            brand.version += 1
            brand.save()

            record_audit_event(
                actor=actor,
                action="registry.brand_updated",
                target_type="vehicle_brand",
                target_id=str(brand.id),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": ["name"]},
            )
            return brand
    except StaleBrandRecordError:
        record_audit_event(
            actor=actor,
            action="registry.brand_update_rejected",
            target_type="vehicle_brand",
            target_id=str(brand_id),
            result=AuditResult.FAILURE,
            reason="stale_record",
            request_id=request_id,
        )
        raise


def deactivate_brand(
    *,
    brand_id: int,
    expected_version: int,
    actor: User,
    request_id: UUID | None = None,
) -> VehicleBrand:
    require_permission(
        actor=actor,
        permission="marcas_vehiculo.desactivar",
        request_id=request_id,
        denial_action="registry.brand_deactivated",
        target_type="vehicle_brand",
        target_id=str(brand_id),
    )

    try:
        with transaction.atomic():
            brand = VehicleBrand.objects.select_for_update().filter(id=brand_id).first()
            if brand is None:
                raise BrandNotFoundError(f"Marca {brand_id} no encontrada.")

            if brand.version != expected_version:
                raise StaleBrandRecordError(
                    f"Versión obsoleta para la marca {brand_id}: "
                    f"esperada {expected_version}, actual {brand.version}."
                )

            if brand.is_active is False:
                return brand

            brand.is_active = False
            brand.version += 1
            brand.save()

            record_audit_event(
                actor=actor,
                action="registry.brand_deactivated",
                target_type="vehicle_brand",
                target_id=str(brand.id),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": ["is_active"]},
            )
            return brand
    except StaleBrandRecordError:
        record_audit_event(
            actor=actor,
            action="registry.brand_deactivate_rejected",
            target_type="vehicle_brand",
            target_id=str(brand_id),
            result=AuditResult.FAILURE,
            reason="stale_record",
            request_id=request_id,
        )
        raise


def activate_brand(
    *,
    brand_id: int,
    expected_version: int,
    actor: User,
    request_id: UUID | None = None,
) -> VehicleBrand:
    require_permission(
        actor=actor,
        permission="marcas_vehiculo.desactivar",
        request_id=request_id,
        denial_action="registry.brand_activated",
        target_type="vehicle_brand",
        target_id=str(brand_id),
    )

    try:
        with transaction.atomic():
            brand = VehicleBrand.objects.select_for_update().filter(id=brand_id).first()
            if brand is None:
                raise BrandNotFoundError(f"Marca {brand_id} no encontrada.")

            if brand.version != expected_version:
                raise StaleBrandRecordError(
                    f"Versión obsoleta para la marca {brand_id}: "
                    f"esperada {expected_version}, actual {brand.version}."
                )

            if brand.is_active is True:
                return brand

            brand.is_active = True
            brand.version += 1
            brand.save()

            record_audit_event(
                actor=actor,
                action="registry.brand_activated",
                target_type="vehicle_brand",
                target_id=str(brand.id),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": ["is_active"]},
            )
            return brand
    except StaleBrandRecordError:
        record_audit_event(
            actor=actor,
            action="registry.brand_activate_rejected",
            target_type="vehicle_brand",
            target_id=str(brand_id),
            result=AuditResult.FAILURE,
            reason="stale_record",
            request_id=request_id,
        )
        raise


def get_brand(
    *,
    brand_id: int,
    actor: User,
    request_id: UUID | None = None,
) -> VehicleBrand:
    require_permission(
        actor=actor,
        permission="marcas_vehiculo.ver",
        request_id=request_id,
        denial_action="registry.brand_view_denied",
        target_type="vehicle_brand",
        target_id=str(brand_id),
    )
    brand = VehicleBrand.objects.filter(id=brand_id).first()
    if brand is None:
        raise BrandNotFoundError(f"Marca {brand_id} no encontrada.")
    return brand


def search_brands(
    *,
    actor: User,
    query: str = "",
    is_active: bool | None = None,
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> BrandPage:
    require_permission(
        actor=actor,
        permission="marcas_vehiculo.ver",
        request_id=request_id,
        denial_action="registry.brand_list_denied",
        target_type="vehicle_brand",
        target_id="list",
    )

    qs = VehicleBrand.objects.all()
    if is_active is not None:
        qs = qs.filter(is_active=is_active)

    trimmed = query.strip()
    if trimmed:
        qs = qs.filter(name__icontains=trimmed)

    qs = qs.order_by("name", "id")
    total_count = qs.count()

    safe_page_size = max(1, min(page_size, 100))
    total_pages = max(1, (total_count + safe_page_size - 1) // safe_page_size)
    safe_page = max(1, min(page, total_pages)) if total_count > 0 else 1
    offset = (safe_page - 1) * safe_page_size

    items = list(qs[offset : offset + safe_page_size]) if total_count > 0 else []

    return BrandPage(
        items=items,
        total_count=total_count,
        page=safe_page,
        page_size=safe_page_size,
        total_pages=total_pages,
    )
