from collections.abc import Mapping
from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction

from customer_registry.domain.validation import (
    CustomerValidationError,
    IdentificationType,
    PersonType,
    validate_address,
    validate_and_normalize_customer,
    validate_email,
    validate_identification,
    validate_identification_type,
    validate_name,
    validate_person_type,
    validate_phone,
)
from customer_registry.models import Customer
from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User


class CustomerApplicationError(Exception):
    pass


class CustomerNotFoundError(CustomerApplicationError):
    pass


class DuplicateCustomerError(CustomerApplicationError):
    def __init__(self, message: str, customer_id: int, is_active: bool) -> None:
        super().__init__(message)
        self.customer_id = customer_id
        self.is_active = is_active


class StaleCustomerRecordError(CustomerApplicationError):
    pass


def create_customer(
    *,
    actor: User,
    data: Mapping[str, Any],
    request_id: UUID | None = None,
) -> Customer:
    require_permission(
        actor=actor,
        permission="clientes.gestionar",
        request_id=request_id,
        denial_action="registry.customer_created",
        target_type="customer",
        target_id="uncreated",
    )

    try:
        norm = validate_and_normalize_customer(data)
    except CustomerValidationError:
        record_audit_event(
            actor=actor,
            action="registry.customer_create_rejected",
            target_type="customer",
            target_id="uncreated",
            result=AuditResult.FAILURE,
            reason="validation_error",
            request_id=request_id,
        )
        raise

    existing = Customer.objects.filter(
        identification_type=norm.identification_type,
        identification=norm.identification,
    ).first()
    if existing is not None:
        record_audit_event(
            actor=actor,
            action="registry.customer_create_rejected",
            target_type="customer",
            target_id="uncreated",
            result=AuditResult.FAILURE,
            reason="duplicate_identification",
            request_id=request_id,
        )
        raise DuplicateCustomerError(
            f"Ya existe un cliente con {norm.identification_type}: {norm.identification}.",
            customer_id=existing.id,
            is_active=existing.is_active,
        )

    try:
        with transaction.atomic():
            customer = Customer.objects.create(
                person_type=norm.person_type,
                name=norm.name,
                identification_type=norm.identification_type,
                identification=norm.identification,
                phone=norm.phone,
                email=norm.email,
                address=norm.address,
                is_active=True,
                version=1,
            )
            record_audit_event(
                actor=actor,
                action="registry.customer_created",
                target_type="customer",
                target_id=str(customer.id),
                result=AuditResult.SUCCESS,
                request_id=request_id,
            )
            return customer
    except IntegrityError:
        conflict = Customer.objects.filter(
            identification_type=norm.identification_type,
            identification=norm.identification,
        ).first()
        record_audit_event(
            actor=actor,
            action="registry.customer_create_rejected",
            target_type="customer",
            target_id="uncreated",
            result=AuditResult.FAILURE,
            reason="duplicate_identification",
            request_id=request_id,
        )
        if conflict is not None:
            raise DuplicateCustomerError(
                f"Ya existe un cliente con {norm.identification_type}: {norm.identification}.",
                customer_id=conflict.id,
                is_active=conflict.is_active,
            ) from None
        raise


def update_customer(
    *,
    actor: User,
    customer_id: int,
    expected_version: int,
    data: Mapping[str, Any],
    request_id: UUID | None = None,
) -> Customer:
    require_permission(
        actor=actor,
        permission="clientes.gestionar",
        request_id=request_id,
        denial_action="registry.customer_updated",
        target_type="customer",
        target_id=str(customer_id),
    )

    try:
        with transaction.atomic():
            try:
                customer = Customer.objects.select_for_update().get(id=customer_id)
            except Customer.DoesNotExist as exc:
                raise CustomerNotFoundError(f"No existe el cliente con ID {customer_id}.") from exc

            if customer.version != expected_version:
                raise StaleCustomerRecordError(
                    "La ficha de cliente ha sido modificada por otro usuario. "
                    "Recargue la información."
                )

            changed_fields: list[str] = []
            new_person_type = customer.person_type
            new_name = customer.name
            new_id_type = customer.identification_type
            new_id = customer.identification
            new_phone = customer.phone
            new_email = customer.email
            new_address = customer.address

            if "person_type" in data and data["person_type"] is not None:
                parsed_pt = validate_person_type(data["person_type"])
                if parsed_pt != customer.person_type:
                    new_person_type = parsed_pt
                    changed_fields.append("person_type")

            if "name" in data and data["name"] is not None:
                parsed_name = validate_name(data["name"])
                if parsed_name != customer.name:
                    new_name = parsed_name
                    changed_fields.append("name")

            if "identification_type" in data and data["identification_type"] is not None:
                parsed_it = validate_identification_type(data["identification_type"])
                if parsed_it != customer.identification_type:
                    new_id_type = parsed_it
                    changed_fields.append("identification_type")

            if "identification" in data and data["identification"] is not None:
                parsed_id = validate_identification(data["identification"], new_id_type)
                if parsed_id != customer.identification:
                    new_id = parsed_id
                    changed_fields.append("identification")
            elif "identification_type" in changed_fields:
                new_id = validate_identification(customer.identification, new_id_type)

            if "phone" in data and data["phone"] is not None:
                parsed_phone = validate_phone(data["phone"])
                if parsed_phone != customer.phone:
                    new_phone = parsed_phone
                    changed_fields.append("phone")

            if "email" in data:
                parsed_email = validate_email(data["email"])
                if parsed_email != customer.email:
                    new_email = parsed_email
                    changed_fields.append("email")

            if "address" in data:
                parsed_address = validate_address(data["address"])
                if parsed_address != customer.address:
                    new_address = parsed_address
                    changed_fields.append("address")

            if not changed_fields:
                return customer

            if "identification" in changed_fields or "identification_type" in changed_fields:
                conflict = (
                    Customer.objects.filter(
                        identification_type=new_id_type,
                        identification=new_id,
                    )
                    .exclude(id=customer.id)
                    .first()
                )
                if conflict is not None:
                    raise DuplicateCustomerError(
                        f"Ya existe un cliente con {new_id_type}: {new_id}.",
                        customer_id=conflict.id,
                        is_active=conflict.is_active,
                    )

            customer.person_type = (
                new_person_type.value
                if isinstance(new_person_type, PersonType)
                else new_person_type
            )
            customer.name = new_name
            customer.identification_type = (
                new_id_type.value if isinstance(new_id_type, IdentificationType) else new_id_type
            )
            customer.identification = new_id
            customer.phone = new_phone
            customer.email = new_email
            customer.address = new_address
            customer.version += 1
            customer.save()

            record_audit_event(
                actor=actor,
                action="registry.customer_updated",
                target_type="customer",
                target_id=str(customer.id),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": sorted(changed_fields)},
            )

            return customer
    except StaleCustomerRecordError:
        record_audit_event(
            actor=actor,
            action="registry.customer_update_rejected",
            target_type="customer",
            target_id=str(customer_id),
            result=AuditResult.FAILURE,
            reason="stale_record",
            request_id=request_id,
        )
        raise
    except DuplicateCustomerError:
        record_audit_event(
            actor=actor,
            action="registry.customer_update_rejected",
            target_type="customer",
            target_id=str(customer_id),
            result=AuditResult.FAILURE,
            reason="duplicate_identification",
            request_id=request_id,
        )
        raise
    except CustomerValidationError:
        record_audit_event(
            actor=actor,
            action="registry.customer_update_rejected",
            target_type="customer",
            target_id=str(customer_id),
            result=AuditResult.FAILURE,
            reason="validation_error",
            request_id=request_id,
        )
        raise


def deactivate_customer(
    *,
    customer_id: int,
    expected_version: int,
    actor: User,
    request_id: UUID | None = None,
) -> Customer:
    require_permission(
        actor=actor,
        permission="clientes.desactivar",
        request_id=request_id,
        denial_action="registry.customer_deactivated",
        target_type="customer",
        target_id=str(customer_id),
    )

    try:
        with transaction.atomic():
            customer = Customer.objects.select_for_update().filter(id=customer_id).first()
            if customer is None:
                raise CustomerNotFoundError(f"No existe el cliente con ID {customer_id}.")

            if customer.version != expected_version:
                raise StaleCustomerRecordError(
                    f"Versión obsoleta para el cliente {customer_id}: "
                    f"esperada {expected_version}, actual {customer.version}."
                )

            if customer.is_active is False:
                return customer

            customer.is_active = False
            customer.version += 1
            customer.save()

            record_audit_event(
                actor=actor,
                action="registry.customer_deactivated",
                target_type="customer",
                target_id=str(customer.id),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": ["is_active"]},
            )
            return customer
    except StaleCustomerRecordError:
        record_audit_event(
            actor=actor,
            action="registry.customer_deactivate_rejected",
            target_type="customer",
            target_id=str(customer_id),
            result=AuditResult.FAILURE,
            reason="stale_record",
            request_id=request_id,
        )
        raise


def activate_customer(
    *,
    customer_id: int,
    expected_version: int,
    actor: User,
    request_id: UUID | None = None,
) -> Customer:
    require_permission(
        actor=actor,
        permission="clientes.desactivar",
        request_id=request_id,
        denial_action="registry.customer_activated",
        target_type="customer",
        target_id=str(customer_id),
    )

    try:
        with transaction.atomic():
            customer = Customer.objects.select_for_update().filter(id=customer_id).first()
            if customer is None:
                raise CustomerNotFoundError(f"No existe el cliente con ID {customer_id}.")

            if customer.version != expected_version:
                raise StaleCustomerRecordError(
                    f"Versión obsoleta para el cliente {customer_id}: "
                    f"esperada {expected_version}, actual {customer.version}."
                )

            if customer.is_active is True:
                return customer

            customer.is_active = True
            customer.version += 1
            customer.save()

            record_audit_event(
                actor=actor,
                action="registry.customer_activated",
                target_type="customer",
                target_id=str(customer.id),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": ["is_active"]},
            )
            return customer
    except StaleCustomerRecordError:
        record_audit_event(
            actor=actor,
            action="registry.customer_activate_rejected",
            target_type="customer",
            target_id=str(customer_id),
            result=AuditResult.FAILURE,
            reason="stale_record",
            request_id=request_id,
        )
        raise
