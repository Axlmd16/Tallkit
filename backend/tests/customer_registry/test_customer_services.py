from unittest.mock import patch

import pytest
from django.db import IntegrityError

from customer_registry.application.customers import (
    CustomerNotFoundError,
    DuplicateCustomerError,
    StaleCustomerRecordError,
    create_customer,
    update_customer,
)
from customer_registry.domain.validation import (
    CustomerValidationError,
    IdentificationType,
    PersonType,
)
from customer_registry.models import Customer
from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import Role
from identity.models import AuditEvent, AuditResult, User, UserRole


@pytest.fixture
def authorized_user(db: None) -> User:
    user = User.objects.create_user(
        username="seller_user",
        email="seller@example.com",
        first_name="Vendedor",
        last_name="Pruebas",
    )
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    return user


@pytest.fixture
def unauthorized_user(db: None) -> User:
    user = User.objects.create_user(
        username="no_role_user",
        email="norole@example.com",
    )
    return user


@pytest.mark.django_db
def test_create_customer_success_with_audit(authorized_user: User) -> None:
    customer = create_customer(
        actor=authorized_user,
        data={
            "person_type": PersonType.NATURAL,
            "name": "Juan Carlos Pérez",
            "identification_type": IdentificationType.CI,
            "identification": "0912345678",
            "phone": "0991234567",
            "email": "juan@example.com",
            "address": "Guayaquil",
        },
    )

    assert customer.id is not None
    assert customer.version == 1
    assert customer.is_active is True

    audit = AuditEvent.objects.filter(
        action="registry.customer_created",
        target_type="customer",
        target_id=str(customer.id),
    ).first()
    assert audit is not None
    assert audit.actor == authorized_user
    assert audit.result == AuditResult.SUCCESS


@pytest.mark.django_db
def test_create_customer_requires_permission(unauthorized_user: User) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        create_customer(
            actor=unauthorized_user,
            data={
                "person_type": PersonType.NATURAL,
                "name": "Juan Carlos Pérez",
                "identification_type": IdentificationType.CI,
                "identification": "0912345678",
                "phone": "0991234567",
            },
        )

    audit = AuditEvent.objects.filter(
        action="registry.customer_created",
        result=AuditResult.DENIED,
    ).first()
    assert audit is not None
    assert Customer.objects.count() == 0


@pytest.mark.django_db
def test_create_customer_duplicate_identification_raises_error_and_audits_failure(
    authorized_user: User,
) -> None:
    existing = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Cliente Existente",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991111111",
        is_active=False,
    )

    with pytest.raises(DuplicateCustomerError) as exc_info:
        create_customer(
            actor=authorized_user,
            data={
                "person_type": PersonType.NATURAL,
                "name": "Cliente Nuevo",
                "identification_type": IdentificationType.CI,
                "identification": " 0912345678 ",  # Whitespace normalized
                "phone": "0992222222",
            },
        )

    assert exc_info.value.customer_id == existing.id
    assert exc_info.value.is_active is False

    audit = AuditEvent.objects.filter(
        action="registry.customer_create_rejected",
        result=AuditResult.FAILURE,
        reason="duplicate_identification",
    ).first()
    assert audit is not None
    assert Customer.objects.count() == 1


@pytest.mark.django_db
def test_create_customer_validation_error_audits_failure(authorized_user: User) -> None:
    with pytest.raises(CustomerValidationError):
        create_customer(
            actor=authorized_user,
            data={
                "person_type": PersonType.NATURAL,
                "name": "",
                "identification_type": IdentificationType.CI,
                "identification": "123",
                "phone": "",
            },
        )

    audit = AuditEvent.objects.filter(
        action="registry.customer_create_rejected",
        result=AuditResult.FAILURE,
        reason="validation_error",
    ).first()
    assert audit is not None
    assert Customer.objects.count() == 0


@pytest.mark.django_db
def test_create_customer_atomic_rollback_on_audit_failure(authorized_user: User) -> None:
    with (
        patch(
            "customer_registry.application.customers.record_audit_event",
            side_effect=RuntimeError("Audit persistence error"),
        ),
        pytest.raises(RuntimeError, match="Audit persistence error"),
    ):
        create_customer(
            actor=authorized_user,
            data={
                "person_type": PersonType.NATURAL,
                "name": "Cliente Prueba",
                "identification_type": IdentificationType.CI,
                "identification": "0912345678",
                "phone": "0991234567",
            },
        )

    assert Customer.objects.count() == 0


@pytest.mark.django_db
def test_update_customer_partial_success_with_version_increment_and_audit(
    authorized_user: User,
) -> None:
    customer = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Cliente Original",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991111111",
        version=1,
    )

    updated = update_customer(
        actor=authorized_user,
        customer_id=customer.id,
        expected_version=1,
        data={
            "phone": " 0999999999 ",
            "email": "nuevo@example.com",
        },
    )

    assert updated.version == 2
    assert updated.phone == "0999999999"
    assert updated.email == "nuevo@example.com"
    assert updated.name == "Cliente Original"  # Inalterado

    audit = AuditEvent.objects.filter(
        action="registry.customer_updated",
        target_type="customer",
        target_id=str(customer.id),
    ).first()
    assert audit is not None
    assert audit.result == AuditResult.SUCCESS
    assert audit.metadata == {"changed_fields": ["email", "phone"]}


@pytest.mark.django_db
def test_update_customer_noop_does_not_increment_version_or_record_audit(
    authorized_user: User,
) -> None:
    customer = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Cliente Original",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991111111",
        email="cliente@example.com",
        version=1,
    )

    updated = update_customer(
        actor=authorized_user,
        customer_id=customer.id,
        expected_version=1,
        data={
            "name": " Cliente Original ",
            "phone": " 0991111111 ",
            "email": " cliente@example.com ",
        },
    )

    assert updated.version == 1
    audit_count = AuditEvent.objects.filter(action="registry.customer_updated").count()
    assert audit_count == 0


@pytest.mark.django_db
def test_update_customer_stale_record_raises_error(authorized_user: User) -> None:
    customer = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Cliente Original",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991111111",
        version=2,
    )

    with pytest.raises(StaleCustomerRecordError):
        update_customer(
            actor=authorized_user,
            customer_id=customer.id,
            expected_version=1,  # Versión obsoleta
            data={"phone": "0998888888"},
        )

    audit = AuditEvent.objects.filter(
        action="registry.customer_update_rejected",
        result=AuditResult.FAILURE,
        reason="stale_record",
    ).first()
    assert audit is not None


@pytest.mark.django_db
def test_update_customer_duplicate_identification_raises_error(authorized_user: User) -> None:
    c1 = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Cliente Uno",
        identification_type=IdentificationType.CI,
        identification="0911111111",
        phone="0991111111",
        version=1,
    )
    c2 = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Cliente Dos",
        identification_type=IdentificationType.CI,
        identification="0922222222",
        phone="0992222222",
        version=1,
    )

    with pytest.raises(DuplicateCustomerError) as exc_info:
        update_customer(
            actor=authorized_user,
            customer_id=c2.id,
            expected_version=1,
            data={"identification": "0911111111"},
        )

    assert exc_info.value.customer_id == c1.id


@pytest.mark.django_db
def test_update_customer_not_found_raises_error(authorized_user: User) -> None:
    with pytest.raises(CustomerNotFoundError):
        update_customer(
            actor=authorized_user,
            customer_id=999999,
            expected_version=1,
            data={"name": "Inexistente"},
        )


@pytest.mark.django_db
def test_update_customer_validation_error_audits_failure(authorized_user: User) -> None:
    customer = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Cliente Original",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991111111",
        version=1,
    )

    with pytest.raises(CustomerValidationError):
        update_customer(
            actor=authorized_user,
            customer_id=customer.id,
            expected_version=1,
            data={"email": "invalid-email-address"},
        )

    audit = AuditEvent.objects.filter(
        action="registry.customer_update_rejected",
        result=AuditResult.FAILURE,
        reason="validation_error",
    ).first()
    assert audit is not None


@pytest.mark.django_db
def test_create_customer_concurrent_integrity_error_handled(authorized_user: User) -> None:
    # Simular que otra transacción concurrente guardó el cliente justo después del check previo
    existing = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Ganador de la carrera",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991111111",
    )

    with (
        patch.object(
            Customer.objects,
            "create",
            side_effect=IntegrityError("duplicate key value violates unique constraint"),
        ),
        pytest.raises(DuplicateCustomerError) as exc_info,
    ):
        create_customer(
            actor=authorized_user,
            data={
                "person_type": PersonType.NATURAL,
                "name": "Cliente Segundo",
                "identification_type": IdentificationType.CI,
                "identification": "0912345678",
                "phone": "0992222222",
            },
        )

    assert exc_info.value.customer_id == existing.id
    assert exc_info.value.is_active is True
    audit = AuditEvent.objects.filter(
        action="registry.customer_create_rejected",
        result=AuditResult.FAILURE,
        reason="duplicate_identification",
    ).first()
    assert audit is not None
