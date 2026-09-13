import pytest

from customer_registry.application.customers import CustomerNotFoundError
from customer_registry.application.queries import (
    find_matching_customers,
    get_customer,
    search_customers,
)
from customer_registry.domain.validation import IdentificationType, PersonType
from customer_registry.models import Customer
from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import Role
from identity.models import User, UserRole


@pytest.fixture
def authorized_user(db: None) -> User:
    user = User.objects.create_user(
        username="seller_viewer",
        email="viewer@example.com",
    )
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    return user


@pytest.fixture
def unauthorized_user(db: None) -> User:
    user = User.objects.create_user(
        username="no_permission_user",
        email="noperm@example.com",
    )
    return user


@pytest.mark.django_db
def test_get_customer_success_and_permissions(
    authorized_user: User, unauthorized_user: User
) -> None:
    customer = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Juan Pérez",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991234567",
    )

    retrieved = get_customer(actor=authorized_user, customer_id=customer.id)
    assert retrieved.id == customer.id

    with pytest.raises(BusinessPermissionDeniedError):
        get_customer(actor=unauthorized_user, customer_id=customer.id)

    with pytest.raises(CustomerNotFoundError):
        get_customer(actor=authorized_user, customer_id=999999)


@pytest.mark.django_db
def test_search_customers_or_search_and_filter(authorized_user: User) -> None:
    Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Ana Lucía Morales",
        identification_type=IdentificationType.CI,
        identification="0911111111",
        phone="0991112222",
        is_active=True,
    )
    Customer.objects.create(
        person_type=PersonType.JURIDICA,
        name="Transportes Morales S.A.",
        identification_type=IdentificationType.RUC,
        identification="0992222222001",
        phone="042333444",
        is_active=False,
    )
    Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Carlos Vera",
        identification_type=IdentificationType.CI,
        identification="0933333333",
        phone="0991119999",
        is_active=True,
    )

    # 1. Búsqueda por coincidencia de nombre (OR)
    res_name = search_customers(actor=authorized_user, query="Morales")
    assert res_name.total == 2
    assert {c.name for c in res_name.items} == {"Ana Lucía Morales", "Transportes Morales S.A."}

    # 2. Búsqueda por fragmento de identificación (OR)
    res_id = search_customers(actor=authorized_user, query="222222")
    assert res_id.total == 1
    assert res_id.items[0].name == "Transportes Morales S.A."

    # 3. Búsqueda por fragmento de teléfono (OR)
    res_phone = search_customers(actor=authorized_user, query="099111")
    assert res_phone.total == 2
    assert {c.name for c in res_phone.items} == {"Ana Lucía Morales", "Carlos Vera"}

    # 4. Filtro AND por estado
    res_active = search_customers(actor=authorized_user, query="Morales", is_active=True)
    assert res_active.total == 1
    assert res_active.items[0].name == "Ana Lucía Morales"

    res_inactive = search_customers(actor=authorized_user, is_active=False)
    assert res_inactive.total == 1
    assert res_inactive.items[0].name == "Transportes Morales S.A."

    # 5. Paginación y orden estable (name, id)
    page1 = search_customers(actor=authorized_user, page=1, page_size=2)
    assert page1.total == 3
    assert page1.total_pages == 2
    assert len(page1.items) == 2
    assert page1.items[0].name == "Ana Lucía Morales"
    assert page1.items[1].name == "Carlos Vera"


@pytest.mark.django_db
def test_find_matching_customers(authorized_user: User) -> None:
    c1 = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Pedro Fernández",
        identification_type=IdentificationType.CI,
        identification="0911111111",
        phone="0995555555",
    )
    Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Pedro Javier Fernández",
        identification_type=IdentificationType.CI,
        identification="0922222222",
        phone="0996666666",
    )

    # Coincidencia por nombre
    matches_name = find_matching_customers(actor=authorized_user, name="Pedro Fernández")
    assert len(matches_name) >= 1
    assert any(c.id == c1.id for c in matches_name)

    # Coincidencia por teléfono excluyendo c1
    matches_phone = find_matching_customers(
        actor=authorized_user, phone="0995555555", exclude_customer_id=c1.id
    )
    assert len(matches_phone) == 0

    matches_phone_no_excl = find_matching_customers(actor=authorized_user, phone="0995555555")
    assert len(matches_phone_no_excl) == 1
    assert matches_phone_no_excl[0].id == c1.id

    # Sin datos de búsqueda
    assert find_matching_customers(actor=authorized_user, name="", phone="") == []


@pytest.mark.django_db
def test_search_customers_invalid_page_or_size(authorized_user: User) -> None:
    with pytest.raises(ValueError, match="positivos"):
        search_customers(actor=authorized_user, page=0)

    with pytest.raises(ValueError, match="positivos"):
        search_customers(actor=authorized_user, page_size=0)
