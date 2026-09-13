import pytest
from rest_framework import status
from rest_framework.test import APIClient

from customer_registry.models import VehicleBrand
from identity.domain.authorization import Role
from identity.models import User, UserRole


@pytest.fixture
def admin_client(db: None) -> APIClient:
    user = User.objects.create_user(username="admin_api", password="password123")
    UserRole.objects.create(user=user, role=Role.ADMINISTRADOR)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def manager_client(db: None) -> APIClient:
    user = User.objects.create_user(username="manager_api", password="password123")
    UserRole.objects.create(user=user, role=Role.ENCARGADO_TALLER)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def seller_client(db: None) -> APIClient:
    user = User.objects.create_user(username="seller_api", password="password123")
    UserRole.objects.create(user=user, role=Role.VENDEDOR)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def unprivileged_client(db: None) -> APIClient:
    user = User.objects.create_user(username="unprivileged_api", password="password123")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_list_and_search_brands(admin_client: APIClient, seller_client: APIClient) -> None:
    VehicleBrand.objects.create(name="Toyota", is_active=True)
    VehicleBrand.objects.create(name="Chevrolet", is_active=True)
    VehicleBrand.objects.create(name="Daewoo", is_active=False)

    # All three roles can list (testing seller)
    response = seller_client.get("/api/v1/vehicle-brands/")
    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == 3

    # Search by term
    search_res = admin_client.get("/api/v1/vehicle-brands/?search=Toy")
    assert search_res.status_code == status.HTTP_200_OK
    assert search_res.data["count"] == 1
    assert search_res.data["results"][0]["name"] == "Toyota"

    # Filter is_active
    active_res = admin_client.get("/api/v1/vehicle-brands/?is_active=true")
    assert active_res.status_code == status.HTTP_200_OK
    assert active_res.data["count"] == 2

    inactive_res = admin_client.get("/api/v1/vehicle-brands/?is_active=false")
    assert inactive_res.status_code == status.HTTP_200_OK
    assert inactive_res.data["count"] == 1
    assert inactive_res.data["results"][0]["name"] == "Daewoo"


@pytest.mark.django_db
def test_create_brand_permissions_and_validation(
    admin_client: APIClient,
    manager_client: APIClient,
    seller_client: APIClient,
) -> None:
    # Seller cannot create brand
    denied_res = seller_client.post("/api/v1/vehicle-brands/", {"name": "Ford"}, format="json")
    assert denied_res.status_code == status.HTTP_403_FORBIDDEN

    # Validation error: empty name
    bad_res = admin_client.post("/api/v1/vehicle-brands/", {"name": "   "}, format="json")
    assert bad_res.status_code == status.HTTP_400_BAD_REQUEST
    assert bad_res.data["code"] == "validation_error"

    # Workshop Manager creates brand
    ok_res = manager_client.post("/api/v1/vehicle-brands/", {"name": "Ford"}, format="json")
    assert ok_res.status_code == status.HTTP_201_CREATED
    assert ok_res.data["name"] == "Ford"
    assert ok_res.data["is_active"] is True
    assert ok_res.data["version"] == 1


@pytest.mark.django_db
def test_get_and_patch_brand(
    admin_client: APIClient,
    manager_client: APIClient,
    seller_client: APIClient,
) -> None:
    brand = VehicleBrand.objects.create(name="Toyo", version=1)

    # Get detail
    get_res = seller_client.get(f"/api/v1/vehicle-brands/{brand.id}/")
    assert get_res.status_code == status.HTTP_200_OK
    assert get_res.data["name"] == "Toyo"

    # Patch with is_active rejected
    reject_res = admin_client.patch(
        f"/api/v1/vehicle-brands/{brand.id}/",
        {"name": "Toyota", "expected_version": 1, "is_active": False},
        format="json",
    )
    assert reject_res.status_code == status.HTTP_400_BAD_REQUEST
    assert "is_active" in reject_res.data["detail"]

    # Patch by seller denied
    seller_patch = seller_client.patch(
        f"/api/v1/vehicle-brands/{brand.id}/",
        {"name": "Toyota", "expected_version": 1},
        format="json",
    )
    assert seller_patch.status_code == status.HTTP_403_FORBIDDEN

    # Patch by workshop manager succeeds
    ok_patch = manager_client.patch(
        f"/api/v1/vehicle-brands/{brand.id}/",
        {"name": "Toyota", "expected_version": 1},
        format="json",
    )
    assert ok_patch.status_code == status.HTTP_200_OK
    assert ok_patch.data["name"] == "Toyota"
    assert ok_patch.data["version"] == 2

    # Stale version rejected
    stale_res = admin_client.patch(
        f"/api/v1/vehicle-brands/{brand.id}/",
        {"name": "Toyota Motor", "expected_version": 1},
        format="json",
    )
    assert stale_res.status_code == status.HTTP_409_CONFLICT
    assert stale_res.data["code"] == "stale_record"


@pytest.mark.django_db
def test_delete_brand_not_allowed(admin_client: APIClient) -> None:
    brand = VehicleBrand.objects.create(name="Suzuki")
    del_res = admin_client.delete(f"/api/v1/vehicle-brands/{brand.id}/")
    assert del_res.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.django_db
def test_activate_and_deactivate_brand_api(
    admin_client: APIClient,
    manager_client: APIClient,
    seller_client: APIClient,
) -> None:
    brand = VehicleBrand.objects.create(name="Renault", is_active=True, version=1)

    # Manager and seller cannot deactivate
    assert (
        manager_client.post(
            f"/api/v1/vehicle-brands/{brand.id}/deactivate/",
            {"expected_version": 1},
            format="json",
        ).status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert (
        seller_client.post(
            f"/api/v1/vehicle-brands/{brand.id}/deactivate/",
            {"expected_version": 1},
            format="json",
        ).status_code
        == status.HTTP_403_FORBIDDEN
    )

    # Admin deactivates
    deact_res = admin_client.post(
        f"/api/v1/vehicle-brands/{brand.id}/deactivate/",
        {"expected_version": 1},
        format="json",
    )
    assert deact_res.status_code == status.HTTP_200_OK
    assert deact_res.data["is_active"] is False
    assert deact_res.data["version"] == 2

    # Admin activates
    act_res = admin_client.post(
        f"/api/v1/vehicle-brands/{brand.id}/activate/",
        {"expected_version": 2},
        format="json",
    )
    assert act_res.status_code == status.HTTP_200_OK
    assert act_res.data["is_active"] is True
    assert act_res.data["version"] == 3

    # Stale version rejected
    stale_act = admin_client.post(
        f"/api/v1/vehicle-brands/{brand.id}/activate/",
        {"expected_version": 2},  # current is 3
        format="json",
    )
    assert stale_act.status_code == status.HTTP_409_CONFLICT
    assert stale_act.data["code"] == "stale_record"
