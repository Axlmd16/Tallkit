"""Pruebas TDD de actualización auditada del correo del cliente (DP-036 regla 4)."""

import pytest

from customer_registry.application.customers import (
    CustomerNotFoundError,
    update_customer_email,
)
from customer_registry.domain.validation import (
    CustomerValidationError,
    IdentificationType,
    PersonType,
)
from customer_registry.models import Customer
from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import Role
from identity.models import AuditEvent, User, UserRole


def _user(username: str, *roles: Role) -> User:
    user = User.objects.create_user(username=username, email=f"{username}@example.com")
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    return user


def _customer(email: str = "") -> Customer:
    return Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Carlos Mendoza",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991234567",
        email=email,
    )


@pytest.mark.django_db
def test_updates_customer_email_and_records_audit() -> None:
    seller = _user("seller_email", Role.VENDEDOR)
    customer = _customer(email="")

    result = update_customer_email(
        actor=seller,
        customer_id=customer.id,
        email="  carlos@example.com  ",
        source_reference="COM-VEN-000001",
    )

    customer.refresh_from_db()
    assert result.updated is True
    assert result.previous_email == ""
    assert result.new_email == "carlos@example.com"
    assert customer.email == "carlos@example.com"
    assert customer.version == 2

    event = AuditEvent.objects.get(
        action="registry.customer_email_updated",
        target_id=str(customer.id),
    )
    assert event.actor == seller
    assert event.reason == "COM-VEN-000001"
    assert event.metadata == {"changed_fields": ["email"]}


@pytest.mark.django_db
def test_replaces_existing_email_preserving_previous_in_audit() -> None:
    admin = _user("admin_email", Role.ADMINISTRADOR)
    customer = _customer(email="viejo@example.com")

    result = update_customer_email(
        actor=admin,
        customer_id=customer.id,
        email="nuevo@example.com",
        source_reference="ART-SER-000002",
    )

    customer.refresh_from_db()
    assert result.updated is True
    assert result.previous_email == "viejo@example.com"
    assert result.new_email == "nuevo@example.com"
    assert customer.email == "nuevo@example.com"
    event = AuditEvent.objects.get(action="registry.customer_email_updated")
    assert event.reason == "ART-SER-000002"
    assert event.metadata == {"changed_fields": ["email"]}


@pytest.mark.django_db
def test_noop_when_email_unchanged() -> None:
    seller = _user("seller_noop", Role.VENDEDOR)
    customer = _customer(email="igual@example.com")

    result = update_customer_email(
        actor=seller,
        customer_id=customer.id,
        email="  igual@example.com ",
    )

    customer.refresh_from_db()
    assert result.updated is False
    assert customer.version == 1
    assert not AuditEvent.objects.filter(action="registry.customer_email_updated").exists()


@pytest.mark.django_db
def test_rejects_invalid_or_empty_email() -> None:
    seller = _user("seller_bad_email", Role.VENDEDOR)
    customer = _customer(email="previo@example.com")

    with pytest.raises(CustomerValidationError):
        update_customer_email(actor=seller, customer_id=customer.id, email="sin-dominio")
    with pytest.raises(CustomerValidationError):
        update_customer_email(actor=seller, customer_id=customer.id, email="   ")

    customer.refresh_from_db()
    assert customer.email == "previo@example.com"
    assert customer.version == 1


@pytest.mark.django_db
def test_requires_customer_manage_permission() -> None:
    no_role = _user("no_role_email")
    customer = _customer(email="")

    with pytest.raises(BusinessPermissionDeniedError):
        update_customer_email(actor=no_role, customer_id=customer.id, email="x@example.com")

    customer.refresh_from_db()
    assert customer.email == ""


@pytest.mark.django_db
def test_not_found_raises() -> None:
    seller = _user("seller_missing_cust", Role.VENDEDOR)

    with pytest.raises(CustomerNotFoundError):
        update_customer_email(actor=seller, customer_id=999999, email="x@example.com")
