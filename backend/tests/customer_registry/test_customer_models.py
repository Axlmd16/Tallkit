import pytest
from django.db import IntegrityError, transaction

from customer_registry.domain.validation import IdentificationType, PersonType
from customer_registry.models import Customer


@pytest.mark.django_db
def test_create_customer_natural_person_with_defaults() -> None:
    customer = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Carlos Alberto Mendoza",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991234567",
    )

    assert customer.id is not None
    assert customer.is_active is True
    assert customer.version == 1
    assert customer.email == ""
    assert customer.address == ""
    assert customer.created_at is not None
    assert customer.updated_at is not None
    assert str(customer) == "Carlos Alberto Mendoza (CI: 0912345678)"


@pytest.mark.django_db
def test_create_customer_juridical_person_with_optional_fields() -> None:
    customer = Customer.objects.create(
        person_type=PersonType.JURIDICA,
        name="Distribuidora Repuestos S.A.",
        identification_type=IdentificationType.RUC,
        identification="0991234567001",
        phone="042334455",
        email="ventas@distribuidora.com.ec",
        address="Av. Las Américas 405",
    )

    assert customer.person_type == PersonType.JURIDICA
    assert customer.email == "ventas@distribuidora.com.ec"
    assert customer.address == "Av. Las Américas 405"


@pytest.mark.django_db
def test_customer_identification_uniqueness_enforced_for_active_and_inactive() -> None:
    Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Cliente Uno",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991111111",
        is_active=False,  # Inactivo
    )

    # Intentar registrar el mismo tipo e identificación con cliente activo debe violar unicidad
    with pytest.raises(IntegrityError), transaction.atomic():
        Customer.objects.create(
            person_type=PersonType.NATURAL,
            name="Cliente Dos",
            identification_type=IdentificationType.CI,
            identification="0912345678",
            phone="0992222222",
            is_active=True,
        )


@pytest.mark.django_db
def test_customer_identification_uniqueness_allows_same_number_different_type() -> None:
    # Aunque raro en la práctica, la restricción es compuesta: (identification_type, identification)
    c1 = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Cliente CI",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991111111",
    )
    c2 = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Cliente RUC",
        identification_type=IdentificationType.RUC,
        identification="0912345678001",
        phone="0992222222",
    )
    assert c1.id != c2.id


@pytest.mark.django_db
def test_customer_check_constraints_reject_blank_required_fields() -> None:
    # 1. Nombre vacío o solo espacios
    with pytest.raises(IntegrityError), transaction.atomic():
        Customer.objects.create(
            person_type=PersonType.NATURAL,
            name="   ",
            identification_type=IdentificationType.CI,
            identification="0911111111",
            phone="0991111111",
        )

    # 2. Identificación vacía o solo espacios
    with pytest.raises(IntegrityError), transaction.atomic():
        Customer.objects.create(
            person_type=PersonType.NATURAL,
            name="Nombre Válido",
            identification_type=IdentificationType.CI,
            identification="   ",
            phone="0991111111",
        )

    # 3. Teléfono vacío o solo espacios
    with pytest.raises(IntegrityError), transaction.atomic():
        Customer.objects.create(
            person_type=PersonType.NATURAL,
            name="Nombre Válido",
            identification_type=IdentificationType.CI,
            identification="0911111112",
            phone="   ",
        )


@pytest.mark.django_db
def test_customer_check_constraints_reject_invalid_choices() -> None:
    # Tipo de persona inválido
    with pytest.raises(IntegrityError), transaction.atomic():
        Customer.objects.create(
            person_type="INVALID_TYPE",
            name="Nombre Válido",
            identification_type=IdentificationType.CI,
            identification="0911111113",
            phone="0991111111",
        )

    # Tipo de identificación inválido
    with pytest.raises(IntegrityError), transaction.atomic():
        Customer.objects.create(
            person_type=PersonType.NATURAL,
            name="Nombre Válido",
            identification_type="OTRO",
            identification="0911111114",
            phone="0991111111",
        )
