from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from customer_registry.application.brands import BrandNotFoundError
from customer_registry.application.customers import CustomerNotFoundError
from customer_registry.domain.validation import (
    validate_vehicle_color,
    validate_vehicle_model,
    validate_vehicle_plate,
    validate_vehicle_vin,
    validate_vehicle_year,
)
from customer_registry.models import Customer, OwnershipPeriod, Vehicle, VehicleBrand
from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User


class VehicleApplicationError(Exception):
    pass


class VehicleNotFoundError(VehicleApplicationError):
    def __init__(self, message: str, vehicle_id: int | None = None) -> None:
        super().__init__(message)
        self.vehicle_id = vehicle_id


class DuplicatePlateError(VehicleApplicationError):
    def __init__(self, message: str, plate: str, vehicle_id: int, is_active: bool) -> None:
        super().__init__(message)
        self.plate = plate
        self.vehicle_id = vehicle_id
        self.is_active = is_active


class DuplicateVinError(VehicleApplicationError):
    def __init__(self, message: str, vin: str, vehicle_id: int, is_active: bool) -> None:
        super().__init__(message)
        self.vin = vin
        self.vehicle_id = vehicle_id
        self.is_active = is_active


class InactiveReferenceError(VehicleApplicationError):
    def __init__(self, message: str, reference_type: str, reference_id: int) -> None:
        super().__init__(message)
        self.reference_type = reference_type
        self.reference_id = reference_id


class StaleVehicleRecordError(VehicleApplicationError):
    def __init__(self, message: str, current_version: int) -> None:
        super().__init__(message)
        self.current_version = current_version


def create_vehicle(
    *,
    actor: User,
    owner_id: int,
    brand_id: int,
    plate: str,
    model: str,
    color: str | None = None,
    year: int | None = None,
    vin: str | None = None,
    request_id: UUID | None = None,
) -> Vehicle:
    require_permission(
        actor=actor,
        permission="vehiculos.gestionar",
        request_id=request_id,
        denial_action="registry.vehicle_created",
        target_type="vehicle",
        target_id="uncreated",
    )

    normalized_plate = validate_vehicle_plate(plate)
    normalized_model = validate_vehicle_model(model)
    normalized_color = validate_vehicle_color(color)
    validated_year = validate_vehicle_year(year)
    normalized_vin = validate_vehicle_vin(vin)

    with transaction.atomic():
        customer = Customer.objects.select_for_update().filter(id=owner_id).first()
        if not customer:
            raise CustomerNotFoundError(f"El cliente con id {owner_id} no existe.")
        if not customer.is_active:
            raise InactiveReferenceError(
                f"El cliente propietario {customer.name} está inactivo.",
                reference_type="customer",
                reference_id=customer.id,
            )

        brand = VehicleBrand.objects.select_for_update().filter(id=brand_id).first()
        if not brand:
            raise BrandNotFoundError(f"La marca con id {brand_id} no existe.")
        if not brand.is_active:
            raise InactiveReferenceError(
                f"La marca {brand.name} está inactiva.",
                reference_type="brand",
                reference_id=brand.id,
            )

        existing_plate = Vehicle.objects.filter(plate=normalized_plate).first()
        if existing_plate:
            raise DuplicatePlateError(
                f"Ya existe un vehículo registrado con la placa {normalized_plate}.",
                plate=normalized_plate,
                vehicle_id=existing_plate.id,
                is_active=existing_plate.is_active,
            )

        if normalized_vin:
            existing_vin = Vehicle.objects.filter(vin=normalized_vin).first()
            if existing_vin:
                raise DuplicateVinError(
                    f"Ya existe un vehículo registrado con el VIN {normalized_vin}.",
                    vin=normalized_vin,
                    vehicle_id=existing_vin.id,
                    is_active=existing_vin.is_active,
                )

        vehicle = Vehicle.objects.create(
            plate=normalized_plate,
            brand=brand,
            model=normalized_model,
            color=normalized_color,
            year=validated_year,
            vin=normalized_vin,
            is_active=True,
            version=1,
        )

        now = timezone.now()
        OwnershipPeriod.objects.create(
            vehicle=vehicle,
            customer=customer,
            started_at=now,
            ended_at=None,
        )

        record_audit_event(
            actor=actor,
            action="registry.vehicle_created",
            target_type="vehicle",
            target_id=str(vehicle.id),
            result=AuditResult.SUCCESS,
            metadata={
                "plate": vehicle.plate,
                "brand_id": brand.id,
                "owner_id": customer.id,
            },
            request_id=request_id,
        )

        return vehicle


def update_vehicle(
    *,
    vehicle_id: int,
    expected_version: int,
    actor: User,
    data: Mapping[str, Any],
    request_id: UUID | None = None,
) -> Vehicle:
    require_permission(
        actor=actor,
        permission="vehiculos.gestionar",
        request_id=request_id,
        denial_action="registry.vehicle_updated",
        target_type="vehicle",
        target_id=str(vehicle_id),
    )

    with transaction.atomic():
        vehicle = Vehicle.objects.select_for_update().filter(id=vehicle_id).first()
        if not vehicle:
            raise VehicleNotFoundError(
                f"El vehículo con id {vehicle_id} no existe.",
                vehicle_id=vehicle_id,
            )

        if vehicle.version != expected_version:
            raise StaleVehicleRecordError(
                "La ficha del vehículo fue modificada por otro usuario.",
                current_version=vehicle.version,
            )

        new_brand = vehicle.brand
        if "brand_id" in data and data["brand_id"] is not None:
            target_brand_id = int(data["brand_id"])
            if target_brand_id != vehicle.brand_id:
                candidate_brand = (
                    VehicleBrand.objects.select_for_update().filter(id=target_brand_id).first()
                )
                if not candidate_brand:
                    raise BrandNotFoundError(f"La marca con id {target_brand_id} no existe.")
                if not candidate_brand.is_active:
                    raise InactiveReferenceError(
                        f"La nueva marca {candidate_brand.name} está inactiva.",
                        reference_type="brand",
                        reference_id=candidate_brand.id,
                    )
                new_brand = candidate_brand

        new_plate = vehicle.plate
        if "plate" in data and data["plate"] is not None:
            new_plate = validate_vehicle_plate(data["plate"])
            if new_plate != vehicle.plate:
                existing_plate = (
                    Vehicle.objects.filter(plate=new_plate).exclude(id=vehicle.id).first()
                )
                if existing_plate:
                    raise DuplicatePlateError(
                        f"Ya existe un vehículo con la placa {new_plate}.",
                        plate=new_plate,
                        vehicle_id=existing_plate.id,
                        is_active=existing_plate.is_active,
                    )

        new_model = vehicle.model
        if "model" in data and data["model"] is not None:
            new_model = validate_vehicle_model(data["model"])

        new_color = vehicle.color
        if "color" in data:
            new_color = validate_vehicle_color(data["color"])

        new_year = vehicle.year
        if "year" in data:
            new_year = validate_vehicle_year(data["year"])

        new_vin = vehicle.vin
        if "vin" in data:
            new_vin = validate_vehicle_vin(data["vin"])
            if new_vin and new_vin != vehicle.vin:
                existing_vin = Vehicle.objects.filter(vin=new_vin).exclude(id=vehicle.id).first()
                if existing_vin:
                    raise DuplicateVinError(
                        f"Ya existe un vehículo con el VIN {new_vin}.",
                        vin=new_vin,
                        vehicle_id=existing_vin.id,
                        is_active=existing_vin.is_active,
                    )

        changed_fields: list[str] = []
        if new_brand.id != vehicle.brand_id:
            changed_fields.append("brand_id")
            vehicle.brand = new_brand
        if new_plate != vehicle.plate:
            changed_fields.append("plate")
            vehicle.plate = new_plate
        if new_model != vehicle.model:
            changed_fields.append("model")
            vehicle.model = new_model
        if new_color != vehicle.color:
            changed_fields.append("color")
            vehicle.color = new_color
        if new_year != vehicle.year:
            changed_fields.append("year")
            vehicle.year = new_year
        if new_vin != vehicle.vin:
            changed_fields.append("vin")
            vehicle.vin = new_vin

        if not changed_fields:
            return vehicle

        vehicle.version += 1
        fields_to_update = [*changed_fields, "version", "updated_at"]
        if "brand_id" in changed_fields:
            fields_to_update[fields_to_update.index("brand_id")] = "brand"
        vehicle.save(update_fields=fields_to_update)

        record_audit_event(
            actor=actor,
            action="registry.vehicle_updated",
            target_type="vehicle",
            target_id=str(vehicle.id),
            result=AuditResult.SUCCESS,
            metadata={"changed_fields": sorted(changed_fields)},
            request_id=request_id,
        )

        return vehicle


def transfer_vehicle_ownership(
    *,
    vehicle_id: int,
    new_owner_id: int,
    expected_version: int,
    actor: User,
    request_id: UUID | None = None,
) -> Vehicle:
    require_permission(
        actor=actor,
        permission="vehiculos.gestionar",
        request_id=request_id,
        denial_action="registry.vehicle_owner_changed",
        target_type="vehicle",
        target_id=str(vehicle_id),
    )

    with transaction.atomic():
        initial_vehicle = Vehicle.objects.filter(id=vehicle_id).first()
        if not initial_vehicle:
            raise VehicleNotFoundError(
                f"El vehículo con id {vehicle_id} no existe.",
                vehicle_id=vehicle_id,
            )
        if not initial_vehicle.is_active:
            raise InactiveReferenceError(
                f"El vehículo {initial_vehicle.plate} está inactivo.",
                reference_type="vehicle",
                reference_id=initial_vehicle.id,
            )
        if initial_vehicle.version != expected_version:
            raise StaleVehicleRecordError(
                "La ficha del vehículo fue modificada por otro usuario.",
                current_version=initial_vehicle.version,
            )

        initial_period = OwnershipPeriod.objects.filter(
            vehicle_id=vehicle_id, ended_at__isnull=True
        ).first()
        if not initial_period:
            raise VehicleApplicationError(
                f"El vehículo con id {vehicle_id} no tiene un período de propiedad vigente."
            )
        initial_owner_id = initial_period.customer_id

        # If new owner is the same as current owner
        if initial_owner_id == new_owner_id:
            customer = Customer.objects.select_for_update().filter(id=new_owner_id).first()
            if not customer:
                raise CustomerNotFoundError(f"El cliente con id {new_owner_id} no existe.")
            vehicle = Vehicle.objects.select_for_update().filter(id=vehicle_id).first()
            if not vehicle:
                raise VehicleNotFoundError(
                    f"El vehículo con id {vehicle_id} no existe.",
                    vehicle_id=vehicle_id,
                )
            if vehicle.version != expected_version:
                raise StaleVehicleRecordError(
                    "La ficha del vehículo fue modificada por otro usuario.",
                    current_version=vehicle.version,
                )
            cur_p = (
                OwnershipPeriod.objects.select_for_update()
                .filter(vehicle=vehicle, ended_at__isnull=True)
                .first()
            )
            if cur_p and cur_p.customer_id == new_owner_id:
                return vehicle

        # Order customer locks deterministically by ascending id
        client_ids = sorted([initial_owner_id, new_owner_id])
        locked_customers = {
            c.id: c
            for c in Customer.objects.select_for_update().filter(id__in=client_ids).order_by("id")
        }

        if new_owner_id not in locked_customers:
            raise CustomerNotFoundError(f"El cliente con id {new_owner_id} no existe.")
        new_customer = locked_customers[new_owner_id]

        if not new_customer.is_active:
            raise InactiveReferenceError(
                f"El nuevo cliente propietario {new_customer.name} está inactivo.",
                reference_type="customer",
                reference_id=new_customer.id,
            )

        vehicle = Vehicle.objects.select_for_update().filter(id=vehicle_id).first()
        if not vehicle:
            raise VehicleNotFoundError(
                f"El vehículo con id {vehicle_id} no existe.",
                vehicle_id=vehicle_id,
            )
        if not vehicle.is_active:
            raise InactiveReferenceError(
                f"El vehículo {vehicle.plate} está inactivo.",
                reference_type="vehicle",
                reference_id=vehicle.id,
            )
        if vehicle.version != expected_version:
            raise StaleVehicleRecordError(
                "La ficha del vehículo fue modificada por otro usuario.",
                current_version=vehicle.version,
            )

        current_period = (
            OwnershipPeriod.objects.select_for_update()
            .filter(vehicle=vehicle, ended_at__isnull=True)
            .first()
        )
        if not current_period:
            raise VehicleApplicationError(
                f"El vehículo con id {vehicle_id} no tiene un período de propiedad vigente."
            )

        if current_period.customer_id != initial_owner_id:
            raise StaleVehicleRecordError(
                "El propietario del vehículo fue modificado por otra operación.",
                current_version=vehicle.version,
            )

        if current_period.customer_id == new_owner_id:
            return vehicle

        now = timezone.now()
        if now < current_period.started_at:
            now = current_period.started_at

        current_period.ended_at = now
        current_period.save(update_fields=["ended_at"])

        OwnershipPeriod.objects.create(
            vehicle=vehicle,
            customer=new_customer,
            started_at=now,
            ended_at=None,
        )

        vehicle.version += 1
        vehicle.save(update_fields=["version", "updated_at"])

        record_audit_event(
            actor=actor,
            action="registry.vehicle_owner_changed",
            target_type="vehicle",
            target_id=str(vehicle.id),
            result=AuditResult.SUCCESS,
            metadata={
                "previous_owner_id": current_period.customer_id,
                "new_owner_id": new_customer.id,
            },
            request_id=request_id,
        )

        return vehicle


@dataclass(frozen=True)
class VehiclePage:
    items: list[Vehicle]
    total_count: int
    page: int
    page_size: int
    total_pages: int


def get_vehicle(
    *,
    vehicle_id: int,
    actor: User,
    request_id: UUID | None = None,
) -> Vehicle:
    require_permission(
        actor=actor,
        permission="vehiculos.ver",
        request_id=request_id,
        denial_action="registry.vehicle_view_denied",
        target_type="vehicle",
        target_id=str(vehicle_id),
    )
    vehicle = (
        Vehicle.objects.filter(id=vehicle_id)
        .select_related("brand")
        .prefetch_related("ownership_periods__customer")
        .first()
    )
    if vehicle is None:
        raise VehicleNotFoundError(f"Vehículo {vehicle_id} no encontrado.", vehicle_id=vehicle_id)
    return vehicle


def search_vehicles(
    *,
    actor: User,
    query: str = "",
    is_active: bool | None = None,
    brand_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> VehiclePage:
    require_permission(
        actor=actor,
        permission="vehiculos.ver",
        request_id=request_id,
        denial_action="registry.vehicle_list_denied",
        target_type="vehicle",
        target_id="list",
    )

    qs = (
        Vehicle.objects.all()
        .select_related("brand")
        .prefetch_related("ownership_periods__customer")
    )
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    if brand_id is not None:
        qs = qs.filter(brand_id=brand_id)

    trimmed = query.strip()
    if trimmed:
        owner_matches = Q(
            ownership_periods__ended_at__isnull=True,
            ownership_periods__customer__name__icontains=trimmed,
        )
        qs = qs.filter(
            Q(plate__icontains=trimmed)
            | Q(vin__icontains=trimmed)
            | Q(model__icontains=trimmed)
            | owner_matches
        ).distinct()

    qs = qs.order_by("plate", "id")
    total_count = qs.count()

    safe_page_size = max(1, min(page_size, 100))
    total_pages = max(1, (total_count + safe_page_size - 1) // safe_page_size)
    safe_page = max(1, min(page, total_pages)) if total_count > 0 else 1
    offset = (safe_page - 1) * safe_page_size

    items = list(qs[offset : offset + safe_page_size]) if total_count > 0 else []

    return VehiclePage(
        items=items,
        total_count=total_count,
        page=safe_page,
        page_size=safe_page_size,
        total_pages=total_pages,
    )


def get_customer_vehicles(
    *,
    actor: User,
    customer_id: int,
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> VehiclePage:
    require_permission(
        actor=actor,
        permission="vehiculos.ver",
        request_id=request_id,
        denial_action="registry.vehicle_list_denied",
        target_type="vehicle",
        target_id=f"customer:{customer_id}",
    )
    require_permission(
        actor=actor,
        permission="clientes.ver",
        request_id=request_id,
        denial_action="registry.customer_view_denied",
        target_type="customer",
        target_id=str(customer_id),
    )

    customer = Customer.objects.filter(id=customer_id).first()
    if not customer:
        raise CustomerNotFoundError(f"El cliente con id {customer_id} no existe.")

    qs = (
        Vehicle.objects.filter(
            ownership_periods__customer_id=customer_id,
            ownership_periods__ended_at__isnull=True,
        )
        .select_related("brand")
        .prefetch_related("ownership_periods__customer")
        .distinct()
        .order_by("plate", "id")
    )
    total_count = qs.count()

    safe_page_size = max(1, min(page_size, 100))
    total_pages = max(1, (total_count + safe_page_size - 1) // safe_page_size)
    safe_page = max(1, min(page, total_pages)) if total_count > 0 else 1
    offset = (safe_page - 1) * safe_page_size

    items = list(qs[offset : offset + safe_page_size]) if total_count > 0 else []

    return VehiclePage(
        items=items,
        total_count=total_count,
        page=safe_page,
        page_size=safe_page_size,
        total_pages=total_pages,
    )


@dataclass(frozen=True)
class OwnershipPeriodPage:
    items: list[OwnershipPeriod]
    total_count: int
    page: int
    page_size: int
    total_pages: int


def get_vehicle_ownership_periods(
    *,
    actor: User,
    vehicle_id: int,
    page: int = 1,
    page_size: int = 20,
    request_id: UUID | None = None,
) -> OwnershipPeriodPage:
    require_permission(
        actor=actor,
        permission="vehiculos.ver",
        request_id=request_id,
        denial_action="registry.vehicle_view_denied",
        target_type="vehicle",
        target_id=str(vehicle_id),
    )

    vehicle = Vehicle.objects.filter(id=vehicle_id).first()
    if not vehicle:
        raise VehicleNotFoundError(
            f"El vehículo con id {vehicle_id} no existe.",
            vehicle_id=vehicle_id,
        )

    qs = (
        OwnershipPeriod.objects.filter(vehicle_id=vehicle_id)
        .select_related("customer")
        .order_by("-started_at", "-id")
    )
    total_count = qs.count()

    safe_page_size = max(1, min(page_size, 100))
    total_pages = max(1, (total_count + safe_page_size - 1) // safe_page_size)
    safe_page = max(1, min(page, total_pages)) if total_count > 0 else 1
    offset = (safe_page - 1) * safe_page_size

    items = list(qs[offset : offset + safe_page_size]) if total_count > 0 else []

    return OwnershipPeriodPage(
        items=items,
        total_count=total_count,
        page=safe_page,
        page_size=safe_page_size,
        total_pages=total_pages,
    )


def deactivate_vehicle(
    *,
    vehicle_id: int,
    expected_version: int,
    actor: User,
    request_id: UUID | None = None,
) -> Vehicle:
    require_permission(
        actor=actor,
        permission="vehiculos.desactivar",
        request_id=request_id,
        denial_action="registry.vehicle_deactivated",
        target_type="vehicle",
        target_id=str(vehicle_id),
    )

    try:
        with transaction.atomic():
            vehicle = Vehicle.objects.select_for_update().filter(id=vehicle_id).first()
            if vehicle is None:
                raise VehicleNotFoundError(
                    f"El vehículo con id {vehicle_id} no existe.",
                    vehicle_id=vehicle_id,
                )

            if vehicle.version != expected_version:
                raise StaleVehicleRecordError(
                    f"Versión obsoleta para el vehículo {vehicle_id}: "
                    f"esperada {expected_version}, actual {vehicle.version}.",
                    current_version=vehicle.version,
                )

            if vehicle.is_active is False:
                return vehicle

            vehicle.is_active = False
            vehicle.version += 1
            vehicle.save()

            record_audit_event(
                actor=actor,
                action="registry.vehicle_deactivated",
                target_type="vehicle",
                target_id=str(vehicle.id),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": ["is_active"]},
            )
            return vehicle
    except StaleVehicleRecordError:
        record_audit_event(
            actor=actor,
            action="registry.vehicle_deactivate_rejected",
            target_type="vehicle",
            target_id=str(vehicle_id),
            result=AuditResult.FAILURE,
            reason="stale_record",
            request_id=request_id,
        )
        raise


def activate_vehicle(
    *,
    vehicle_id: int,
    expected_version: int,
    actor: User,
    request_id: UUID | None = None,
) -> Vehicle:
    require_permission(
        actor=actor,
        permission="vehiculos.desactivar",
        request_id=request_id,
        denial_action="registry.vehicle_activated",
        target_type="vehicle",
        target_id=str(vehicle_id),
    )

    try:
        with transaction.atomic():
            vehicle = Vehicle.objects.select_for_update().filter(id=vehicle_id).first()
            if vehicle is None:
                raise VehicleNotFoundError(
                    f"El vehículo con id {vehicle_id} no existe.",
                    vehicle_id=vehicle_id,
                )

            if vehicle.version != expected_version:
                raise StaleVehicleRecordError(
                    f"Versión obsoleta para el vehículo {vehicle_id}: "
                    f"esperada {expected_version}, actual {vehicle.version}.",
                    current_version=vehicle.version,
                )

            if vehicle.is_active is True:
                return vehicle

            vehicle.is_active = True
            vehicle.version += 1
            vehicle.save()

            record_audit_event(
                actor=actor,
                action="registry.vehicle_activated",
                target_type="vehicle",
                target_id=str(vehicle.id),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": ["is_active"]},
            )
            return vehicle
    except StaleVehicleRecordError:
        record_audit_event(
            actor=actor,
            action="registry.vehicle_activate_rejected",
            target_type="vehicle",
            target_id=str(vehicle_id),
            result=AuditResult.FAILURE,
            reason="stale_record",
            request_id=request_id,
        )
        raise
