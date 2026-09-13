import pytest
from rest_framework.test import APIClient

from customer_registry.domain.validation import IdentificationType, PersonType
from customer_registry.models import Customer
from identity.domain.authorization import Role
from identity.models import User, UserRole


@pytest.fixture
def seller_client(db: None) -> tuple[APIClient, User]:
    user = User.objects.create_user(
        username="seller_api_user",
        email="seller_api@example.com",
    )
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.fixture
def unauthorized_client(db: None) -> tuple[APIClient, User]:
    user = User.objects.create_user(
        username="no_role_api_user",
        email="norole_api@example.com",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.mark.django_db
def test_customer_list_and_search(seller_client: tuple[APIClient, User]) -> None:
    client, _ = seller_client
    Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Carlos Mendoza",
        identification_type=IdentificationType.CI,
        identification="0911111111",
        phone="0991111111",
        is_active=True,
    )
    Customer.objects.create(
        person_type=PersonType.JURIDICA,
        name="Taller Mendoza S.A.",
        identification_type=IdentificationType.RUC,
        identification="0992222222001",
        phone="042222222",
        is_active=False,
    )

    # Listar todos
    res = client.get("/api/v1/customers/")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 2
    assert len(data["results"]) == 2

    # Filtrar por búsqueda
    res_search = client.get("/api/v1/customers/?query=Taller")
    assert res_search.status_code == 200
    assert res_search.json()["count"] == 1
    assert res_search.json()["results"][0]["name"] == "Taller Mendoza S.A."

    # Filtrar por estado activo
    res_active = client.get("/api/v1/customers/?is_active=true")
    assert res_active.status_code == 200
    assert res_active.json()["count"] == 1
    assert res_active.json()["results"][0]["name"] == "Carlos Mendoza"


@pytest.mark.django_db
def test_customer_list_denied_without_permission(
    unauthorized_client: tuple[APIClient, User],
) -> None:
    client, _ = unauthorized_client
    res = client.get("/api/v1/customers/")
    assert res.status_code == 403


@pytest.mark.django_db
def test_create_customer_success(seller_client: tuple[APIClient, User]) -> None:
    client, _ = seller_client
    payload = {
        "person_type": "NATURAL",
        "name": "Andrea Solís",
        "identification_type": "CI",
        "identification": " 0912345678 ",  # Debe normalizarse
        "phone": " 0998877665 ",
        "email": "",
        "address": "",
    }
    res = client.post("/api/v1/customers/", payload, format="json")
    assert res.status_code == 201
    data = res.json()
    assert data["id"] is not None
    assert data["name"] == "Andrea Solís"
    assert data["identification"] == "0912345678"
    assert data["version"] == 1
    assert data["is_active"] is True


@pytest.mark.django_db
def test_create_customer_validation_error_returns_problem_details(
    seller_client: tuple[APIClient, User],
) -> None:
    client, _ = seller_client
    payload = {
        "person_type": "NATURAL",
        "name": "   ",  # Inválido
        "identification_type": "CI",
        "identification": "12345",  # CI no tiene 10 caracteres
        "phone": "   ",  # Inválido
        "email": "invalid-email",
    }
    res = client.post("/api/v1/customers/", payload, format="json")
    assert res.status_code == 400
    assert res["Content-Type"] == "application/problem+json"
    data = res.json()
    assert data["code"] == "validation_error"
    assert "errors" in data
    assert "name" in data["errors"]
    assert "identification" in data["errors"]
    assert "phone" in data["errors"]
    assert "email" in data["errors"]


@pytest.mark.django_db
def test_create_customer_duplicate_identification_returns_conflict_with_id(
    seller_client: tuple[APIClient, User],
) -> None:
    client, _ = seller_client
    existing = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Cliente Ya Registrado",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991111111",
        is_active=False,
    )

    payload = {
        "person_type": "NATURAL",
        "name": "Otro Nombre",
        "identification_type": "CI",
        "identification": "0912345678",
        "phone": "0992222222",
    }
    res = client.post("/api/v1/customers/", payload, format="json")
    assert res.status_code == 409
    assert res["Content-Type"] == "application/problem+json"
    data = res.json()
    assert data["code"] == "duplicate_identification"
    assert data["conflict"] == {"type": "customer", "id": existing.id}


@pytest.mark.django_db
def test_get_customer_detail_success_and_not_found(
    seller_client: tuple[APIClient, User],
) -> None:
    client, _ = seller_client
    customer = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Lucía Morales",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991234567",
        version=1,
    )

    res = client.get(f"/api/v1/customers/{customer.id}/")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == customer.id
    assert data["version"] == 1
    assert data["name"] == "Lucía Morales"

    res_404 = client.get("/api/v1/customers/999999/")
    assert res_404.status_code == 404
    assert res_404["Content-Type"] == "application/problem+json"


@pytest.mark.django_db
def test_patch_customer_success_and_stale_record_conflict(
    seller_client: tuple[APIClient, User],
) -> None:
    client, _ = seller_client
    customer = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Lucía Morales",
        identification_type=IdentificationType.CI,
        identification="0912345678",
        phone="0991234567",
        version=1,
    )

    # 1. Update exitoso
    res = client.patch(
        f"/api/v1/customers/{customer.id}/",
        {"expected_version": 1, "phone": "0999999999"},
        format="json",
    )
    assert res.status_code == 200
    data = res.json()
    assert data["version"] == 2
    assert data["phone"] == "0999999999"

    # 2. Intento con versión obsoleta
    res_stale = client.patch(
        f"/api/v1/customers/{customer.id}/",
        {"expected_version": 1, "phone": "0998888888"},
        format="json",
    )
    assert res_stale.status_code == 409
    assert res_stale["Content-Type"] == "application/problem+json"
    assert res_stale.json()["code"] == "stale_record"


@pytest.mark.django_db
def test_customer_matches_endpoint(seller_client: tuple[APIClient, User]) -> None:
    client, _ = seller_client
    c1 = Customer.objects.create(
        person_type=PersonType.NATURAL,
        name="Roberto Carlos Castro",
        identification_type=IdentificationType.CI,
        identification="0911111111",
        phone="0995555555",
    )

    # Coincidencia por nombre
    res = client.post(
        "/api/v1/customers/matches/",
        {"name": "Roberto Carlos"},
        format="json",
    )
    assert res.status_code == 200
    matches = res.json()
    assert len(matches) == 1
    assert matches[0]["id"] == c1.id

    # Coincidencia por teléfono excluyendo c1
    res_excl = client.post(
        "/api/v1/customers/matches/",
        {"phone": "0995555555", "exclude_customer_id": c1.id},
        format="json",
    )
    assert res_excl.status_code == 200
    assert len(res_excl.json()) == 0


@pytest.mark.django_db
def test_customer_list_invalid_pagination_parameters(
    seller_client: tuple[APIClient, User],
) -> None:
    client, _ = seller_client
    res_abc = client.get("/api/v1/customers/?page=abc")
    assert res_abc.status_code == 400
    assert res_abc.json()["code"] == "invalid_parameters"

    res_zero = client.get("/api/v1/customers/?page=0")
    assert res_zero.status_code == 400
    assert res_zero.json()["code"] == "invalid_parameters"


@pytest.mark.django_db
def test_patch_customer_validation_and_duplicate_errors(
    seller_client: tuple[APIClient, User],
) -> None:
    client, _ = seller_client
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

    # 1. Error de validación (email inválido)
    res_val = client.patch(
        f"/api/v1/customers/{c2.id}/",
        {"expected_version": 1, "email": "invalid-email"},
        format="json",
    )
    assert res_val.status_code == 400
    assert res_val.json()["code"] == "validation_error"

    # 2. Error de serializer (falta expected_version)
    res_no_ver = client.patch(
        f"/api/v1/customers/{c2.id}/",
        {"phone": "0998888888"},
        format="json",
    )
    assert res_no_ver.status_code == 400
    assert "expected_version" in res_no_ver.json()["errors"]

    # 3. Conflicto de identificación duplicada
    res_dup = client.patch(
        f"/api/v1/customers/{c2.id}/",
        {"expected_version": 1, "identification": "0911111111"},
        format="json",
    )
    assert res_dup.status_code == 409
    assert res_dup.json()["code"] == "duplicate_identification"
    assert res_dup.json()["conflict"] == {"type": "customer", "id": c1.id}


@pytest.mark.django_db
def test_customer_matches_invalid_payload(seller_client: tuple[APIClient, User]) -> None:
    client, _ = seller_client
    res = client.post(
        "/api/v1/customers/matches/",
        {"exclude_customer_id": "not_an_int"},
        format="json",
    )
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"
