import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from customer_registry.application.vehicles import create_vehicle
from customer_registry.domain.validation import IdentificationType, PersonType
from customer_registry.models import Customer, OwnershipPeriod, VehicleBrand
from identity.domain.authorization import Role
from identity.models import User, UserRole


@pytest.fixture
def admin_client(db: None) -> tuple[APIClient, User]:
    user = User.objects.create_user(username="admin_api")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.fixture
def encargado_client(db: None) -> tuple[APIClient, User]:
    user = User.objects.create_user(username="encargado_api")
    UserRole.objects.create(user=user, role=Role.ENCARGADO_TALLER)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.fixture
def vendedor_client(db: None) -> tuple[APIClient, User]:
    user = User.objects.create_user(username="vendedor_api")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.fixture
def brand(db: None) -> VehicleBrand:
    return VehicleBrand.objects.create(name="Toyota")


@pytest.fixture
def inactive_brand(db: None) -> VehicleBrand:
    return VehicleBrand.objects.create(name="Daewoo", is_active=False)


@pytest.fixture
def customer(db: None) -> Customer:
    return Customer.objects.create(
        person_type=PersonType.NATURAL.value,
        name="Carlos Vera",
        identification_type=IdentificationType.CI.value,
        identification="0912345678",
        phone="0991112233",
    )


@pytest.fixture
def other_customer(db: None) -> Customer:
    return Customer.objects.create(
        person_type=PersonType.NATURAL.value,
        name="María López",
        identification_type=IdentificationType.CI.value,
        identification="0923456789",
        phone="0987654321",
    )


@pytest.fixture
def inactive_customer(db: None) -> Customer:
    return Customer.objects.create(
        person_type=PersonType.NATURAL.value,
        name="Cliente Inactivo",
        identification_type=IdentificationType.CI.value,
        identification="0999999999",
        phone="0999999999",
        is_active=False,
    )


@pytest.mark.django_db
def test_vehicle_list_and_search(
    vendedor_client: tuple[APIClient, User],
    admin_client: tuple[APIClient, User],
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    client, _ = vendedor_client
    _admin_c, admin_u = admin_client

    v1 = create_vehicle(
        actor=admin_u,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
        vin="1HGCR2F83HA000001",
    )
    create_vehicle(
        actor=admin_u,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="XYZ-9876",
        model="Yaris",
    )

    # 1. List all vehicles (Vendedor is allowed to view)
    res = client.get("/api/v1/vehicles/")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 2
    assert len(data["results"]) == 2

    # 2. Search by plate fragment
    res_search_plate = client.get("/api/v1/vehicles/?search=ABC")
    assert res_search_plate.status_code == 200
    assert res_search_plate.json()["count"] == 1
    assert res_search_plate.json()["results"][0]["id"] == v1.id

    # 3. Search by VIN fragment
    res_search_vin = client.get("/api/v1/vehicles/?search=000001")
    assert res_search_vin.status_code == 200
    assert res_search_vin.json()["count"] == 1
    assert res_search_vin.json()["results"][0]["id"] == v1.id

    # 4. Search by customer owner name
    res_search_owner = client.get("/api/v1/vehicles/?search=Carlos")
    assert res_search_owner.status_code == 200
    assert res_search_owner.json()["count"] == 2


@pytest.mark.django_db
def test_vehicle_create_and_permissions(
    admin_client: tuple[APIClient, User],
    encargado_client: tuple[APIClient, User],
    vendedor_client: tuple[APIClient, User],
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    _admin_c, _ = admin_client
    encargado_c, _ = encargado_client
    vendedor_c, _ = vendedor_client

    payload = {
        "owner_id": customer.id,
        "brand_id": brand.id,
        "plate": "PBX-1111",
        "model": "Hilux",
        "color": "Blanco",
        "year": 2023,
        "vin": "VIN00000000000001",
    }

    # Encargado creates successfully
    res_encargado = encargado_c.post("/api/v1/vehicles/", data=payload, format="json")
    assert res_encargado.status_code == 201
    created = res_encargado.json()
    assert created["plate"] == "PBX-1111"
    assert created["model"] == "Hilux"
    assert created["color"] == "Blanco"
    assert created["year"] == 2023
    assert created["vin"] == "VIN00000000000001"
    assert created["brand"]["id"] == brand.id
    assert created["current_owner"]["id"] == customer.id
    assert created["version"] == 1

    # Vendedor is denied
    vendedor_payload = {
        "owner_id": customer.id,
        "brand_id": brand.id,
        "plate": "PBX-2222",
        "model": "Yaris",
    }
    res_vendedor = vendedor_c.post("/api/v1/vehicles/", data=vendedor_payload, format="json")
    assert res_vendedor.status_code == 403


@pytest.mark.django_db
def test_vehicle_create_validation_and_duplicate_errors(
    admin_client: tuple[APIClient, User],
    brand: VehicleBrand,
    inactive_brand: VehicleBrand,
    customer: Customer,
) -> None:
    client, admin_u = admin_client

    # 1. Blank plate
    res_blank = client.post(
        "/api/v1/vehicles/",
        data={"owner_id": customer.id, "brand_id": brand.id, "plate": "  ", "model": "Test"},
        format="json",
    )
    assert res_blank.status_code == 400
    assert res_blank.json()["code"] == "validation_error"

    # 2. Inactive brand
    res_inactive_brand = client.post(
        "/api/v1/vehicles/",
        data={
            "owner_id": customer.id,
            "brand_id": inactive_brand.id,
            "plate": "ABC-1234",
            "model": "Test",
        },
        format="json",
    )
    assert res_inactive_brand.status_code == 400
    assert res_inactive_brand.json()["code"] == "inactive_reference"

    # 3. Duplicate plate
    create_vehicle(
        actor=admin_u,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="DUP-1234",
        model="Existing",
    )
    res_dup_plate = client.post(
        "/api/v1/vehicles/",
        data={
            "owner_id": customer.id,
            "brand_id": brand.id,
            "plate": "dup-1234",
            "model": "Another",
        },
        format="json",
    )
    assert res_dup_plate.status_code == 409
    assert res_dup_plate.json()["code"] == "duplicate_plate"
    assert res_dup_plate.json()["conflict"]["type"] == "vehicle"


@pytest.mark.django_db
def test_vehicle_detail_and_patch(
    admin_client: tuple[APIClient, User],
    vendedor_client: tuple[APIClient, User],
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    admin_c, admin_u = admin_client
    vendedor_c, _ = vendedor_client

    vehicle = create_vehicle(
        actor=admin_u,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="ABC-1234",
        model="Corolla",
        color="Rojo",
    )

    # 1. GET detail by Vendedor
    res_get = vendedor_c.get(f"/api/v1/vehicles/{vehicle.id}/")
    assert res_get.status_code == 200
    detail = res_get.json()
    assert detail["id"] == vehicle.id
    assert detail["plate"] == "ABC-1234"
    assert detail["brand"]["name"] == "Toyota"
    assert detail["current_owner"]["name"] == "Carlos Vera"

    # 2. PATCH rejected if owner_id or is_active sent
    res_patch_invalid = admin_c.patch(
        f"/api/v1/vehicles/{vehicle.id}/",
        data={"expected_version": 1, "is_active": False},
        format="json",
    )
    assert res_patch_invalid.status_code == 400

    # 3. PATCH denied to Vendedor
    res_patch_vendedor = vendedor_c.patch(
        f"/api/v1/vehicles/{vehicle.id}/",
        data={"expected_version": 1, "color": "Azul"},
        format="json",
    )
    assert res_patch_vendedor.status_code == 403

    # 4. PATCH stale version
    res_patch_stale = admin_c.patch(
        f"/api/v1/vehicles/{vehicle.id}/",
        data={"expected_version": 99, "color": "Azul"},
        format="json",
    )
    assert res_patch_stale.status_code == 409
    assert res_patch_stale.json()["code"] == "stale_record"

    # 5. Successful PATCH by Admin
    res_patch_ok = admin_c.patch(
        f"/api/v1/vehicles/{vehicle.id}/",
        data={"expected_version": 1, "color": "Negro", "model": "Corolla XLI"},
        format="json",
    )
    assert res_patch_ok.status_code == 200
    updated = res_patch_ok.json()
    assert updated["color"] == "Negro"
    assert updated["model"] == "Corolla XLI"
    assert updated["version"] == 2

    # 6. DELETE rejected with 405 Method Not Allowed
    res_del = admin_c.delete(f"/api/v1/vehicles/{vehicle.id}/")
    assert res_del.status_code == 405


@pytest.mark.django_db
def test_customer_vehicles_endpoint(
    vendedor_client: tuple[APIClient, User],
    admin_client: tuple[APIClient, User],
    brand: VehicleBrand,
    customer: Customer,
    other_customer: Customer,
) -> None:
    client, _ = vendedor_client
    _, admin_u = admin_client

    # Vehicle currently owned by customer
    v1 = create_vehicle(
        actor=admin_u,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="CAR-0001",
        model="Prius",
    )

    # Vehicle previously owned by customer, but ownership was closed
    v2 = create_vehicle(
        actor=admin_u,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="CAR-0002",
        model="Camry",
    )
    # Close v2's ownership period for customer
    open_p = v2.current_ownership
    assert open_p is not None
    open_p.ended_at = timezone.now()
    open_p.save(update_fields=["ended_at"])
    # Give v2 to other_customer
    OwnershipPeriod.objects.create(
        vehicle=v2,
        customer=other_customer,
        started_at=timezone.now(),
        ended_at=None,
    )

    # Query customer's vehicles: only v1 should appear, NOT v2
    res = client.get(f"/api/v1/customers/{customer.id}/vehicles/")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == v1.id
    assert data["results"][0]["plate"] == "CAR-0001"


@pytest.mark.django_db
def test_vehicle_change_owner_api_success_by_encargado(
    encargado_client: tuple[APIClient, User],
    admin_client: tuple[APIClient, User],
    brand: VehicleBrand,
    customer: Customer,
    other_customer: Customer,
) -> None:
    client, _ = encargado_client
    _, admin_u = admin_client

    v = create_vehicle(
        actor=admin_u,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="TRF-0001",
        model="Corolla",
    )

    res = client.post(
        f"/api/v1/vehicles/{v.id}/change-owner/",
        {"owner_id": other_customer.id, "expected_version": 1},
        format="json",
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == v.id
    assert data["version"] == 2
    assert data["current_owner"]["id"] == other_customer.id
    assert data["current_owner"]["name"] == other_customer.name


@pytest.mark.django_db
def test_vehicle_change_owner_api_same_owner_idempotent(
    encargado_client: tuple[APIClient, User],
    admin_client: tuple[APIClient, User],
    brand: VehicleBrand,
    customer: Customer,
) -> None:
    client, _ = encargado_client
    _, admin_u = admin_client

    v = create_vehicle(
        actor=admin_u,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="TRF-0002",
        model="Corolla",
    )

    res = client.post(
        f"/api/v1/vehicles/{v.id}/change-owner/",
        {"owner_id": customer.id, "expected_version": 1},
        format="json",
    )
    assert res.status_code == 200
    data = res.json()
    assert data["version"] == 1
    assert data["current_owner"]["id"] == customer.id


@pytest.mark.django_db
def test_vehicle_change_owner_api_stale_record_conflict(
    encargado_client: tuple[APIClient, User],
    admin_client: tuple[APIClient, User],
    brand: VehicleBrand,
    customer: Customer,
    other_customer: Customer,
) -> None:
    client, _ = encargado_client
    _, admin_u = admin_client

    v = create_vehicle(
        actor=admin_u,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="TRF-0003",
        model="Corolla",
    )

    res = client.post(
        f"/api/v1/vehicles/{v.id}/change-owner/",
        {"owner_id": other_customer.id, "expected_version": 99},
        format="json",
    )
    assert res.status_code == 409
    assert res.json()["code"] == "stale_record"


@pytest.mark.django_db
def test_vehicle_change_owner_api_inactive_owner_bad_request(
    encargado_client: tuple[APIClient, User],
    admin_client: tuple[APIClient, User],
    brand: VehicleBrand,
    customer: Customer,
    inactive_customer: Customer,
) -> None:
    client, _ = encargado_client
    _, admin_u = admin_client

    v = create_vehicle(
        actor=admin_u,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="TRF-0004",
        model="Corolla",
    )

    res = client.post(
        f"/api/v1/vehicles/{v.id}/change-owner/",
        {"owner_id": inactive_customer.id, "expected_version": 1},
        format="json",
    )
    assert res.status_code == 400
    assert res.json()["code"] == "inactive_reference"


@pytest.mark.django_db
def test_vehicle_change_owner_api_vendedor_denied(
    vendedor_client: tuple[APIClient, User],
    admin_client: tuple[APIClient, User],
    brand: VehicleBrand,
    customer: Customer,
    other_customer: Customer,
) -> None:
    client, _ = vendedor_client
    _, admin_u = admin_client

    v = create_vehicle(
        actor=admin_u,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="TRF-0005",
        model="Corolla",
    )

    res = client.post(
        f"/api/v1/vehicles/{v.id}/change-owner/",
        {"owner_id": other_customer.id, "expected_version": 1},
        format="json",
    )
    assert res.status_code == 403
    assert res.json()["code"] == "permission_denied"


@pytest.mark.django_db
def test_vehicle_ownership_history_api_consultation_by_vendedor(
    vendedor_client: tuple[APIClient, User],
    admin_client: tuple[APIClient, User],
    brand: VehicleBrand,
    customer: Customer,
    other_customer: Customer,
) -> None:
    client, _ = vendedor_client
    _, admin_u = admin_client

    v = create_vehicle(
        actor=admin_u,
        owner_id=customer.id,
        brand_id=brand.id,
        plate="TRF-0006",
        model="Corolla",
    )

    # Initial period consultation
    res = client.get(f"/api/v1/vehicles/{v.id}/ownership/")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 1
    assert data["results"][0]["customer"]["id"] == customer.id
    assert data["results"][0]["is_current"] is True
    assert data["results"][0]["ended_at"] is None
