import pytest
from django.test import Client
from rest_framework.test import APIClient

from customer_registry.application.brands import (
    create_brand,
    deactivate_brand,
    update_brand,
)
from customer_registry.application.customers import (
    activate_customer,
    create_customer,
    deactivate_customer,
)
from customer_registry.application.vehicles import (
    create_vehicle,
    deactivate_vehicle,
    transfer_vehicle_ownership,
)
from customer_registry.domain.validation import IdentificationType, PersonType
from customer_registry.models import Customer, Vehicle, VehicleBrand
from identity.application.authorization import BusinessPermissionDeniedError
from identity.domain.authorization import Role
from identity.models import AuditEvent, AuditResult, User, UserRole

pytestmark = pytest.mark.django_db


def make_user(
    username: str,
    *roles: Role,
    is_active: bool = True,
    must_change_password: bool = False,
) -> User:
    user = User.objects.create_user(
        username=username,
        password="Password123!",
        is_active=is_active,
        must_change_password=must_change_password,
    )
    if roles:
        UserRole.objects.bulk_create([UserRole(user=user, role=role) for role in roles])
    return user


def api_client_for(user: User | None) -> APIClient:
    client = APIClient()
    if user is not None:
        client.force_authenticate(user=user)
    return client


# Fixtures for test instances
@pytest.fixture
def admin_user() -> User:
    return make_user("admin_user", Role.ADMINISTRADOR)


@pytest.fixture
def encargado_user() -> User:
    return make_user("encargado_user", Role.ENCARGADO_TALLER)


@pytest.fixture
def vendedor_user() -> User:
    return make_user("vendedor_user", Role.VENDEDOR)


@pytest.fixture
def dual_role_user() -> User:
    return make_user("dual_user", Role.ENCARGADO_TALLER, Role.VENDEDOR)


@pytest.fixture
def customer(admin_user: User) -> Customer:
    return create_customer(
        actor=admin_user,
        data={
            "person_type": PersonType.NATURAL,
            "identification_type": IdentificationType.CI,
            "name": "Cliente Matrix",
            "identification": "0912345678",
            "phone": "0911223344",
        },
    )


@pytest.fixture
def brand(admin_user: User) -> VehicleBrand:
    return create_brand(name="Marca Matrix", actor=admin_user)


@pytest.fixture
def vehicle(admin_user: User, customer: Customer, brand: VehicleBrand) -> Vehicle:
    return create_vehicle(
        owner_id=customer.pk,
        brand_id=brand.pk,
        plate="MTX-1234",
        model="Matrix Model",
        actor=admin_user,
    )


# ==============================================================================
# 1. Matriz de permisos de clientes: tres roles y permisos negativos
# ==============================================================================


def test_customers_permission_matrix_for_three_roles(
    admin_user: User,
    encargado_user: User,
    vendedor_user: User,
    customer: Customer,
) -> None:
    # All three roles can list, retrieve and matches
    for user in (admin_user, encargado_user, vendedor_user):
        client = api_client_for(user)
        assert client.get("/api/v1/customers/").status_code == 200
        assert client.get(f"/api/v1/customers/{customer.pk}/").status_code == 200
        assert (
            client.post(
                "/api/v1/customers/matches/", {"name": "Cliente"}, format="json"
            ).status_code
            == 200
        )

    # Deactivation: Only Administrador is authorized
    AuditEvent.objects.all().delete()
    vendedor_client = api_client_for(vendedor_user)
    res_vendedor = vendedor_client.post(
        f"/api/v1/customers/{customer.pk}/deactivate/",
        {"expected_version": customer.version},
        format="json",
    )
    assert res_vendedor.status_code == 403
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 1

    encargado_client = api_client_for(encargado_user)
    res_encargado = encargado_client.post(
        f"/api/v1/customers/{customer.pk}/deactivate/",
        {"expected_version": customer.version},
        format="json",
    )
    assert res_encargado.status_code == 403
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 2

    # Admin successfully deactivates
    admin_client = api_client_for(admin_user)
    res_admin = admin_client.post(
        f"/api/v1/customers/{customer.pk}/deactivate/",
        {"expected_version": customer.version},
        format="json",
    )
    assert res_admin.status_code == 200
    customer.refresh_from_db()
    assert not customer.is_active

    # Reactivation: Only Administrador is authorized
    res_vendedor_act = vendedor_client.post(
        f"/api/v1/customers/{customer.pk}/activate/",
        {"expected_version": customer.version},
        format="json",
    )
    assert res_vendedor_act.status_code == 403

    res_admin_act = admin_client.post(
        f"/api/v1/customers/{customer.pk}/activate/",
        {"expected_version": customer.version},
        format="json",
    )
    assert res_admin_act.status_code == 200
    customer.refresh_from_db()
    assert customer.is_active


# ==============================================================================
# 2. Matriz de permisos de marcas: tres roles y permisos negativos
# ==============================================================================


def test_brands_permission_matrix_for_three_roles(
    admin_user: User,
    encargado_user: User,
    vendedor_user: User,
    brand: VehicleBrand,
) -> None:
    # All three roles can list and retrieve brands
    for user in (admin_user, encargado_user, vendedor_user):
        client = api_client_for(user)
        assert client.get("/api/v1/vehicle-brands/").status_code == 200
        assert client.get(f"/api/v1/vehicle-brands/{brand.pk}/").status_code == 200

    # Creation and update: Encargado and Admin allowed; Vendedor denied
    AuditEvent.objects.all().delete()
    vendedor_client = api_client_for(vendedor_user)
    create_res = vendedor_client.post(
        "/api/v1/vehicle-brands/", {"name": "Marca Denegada"}, format="json"
    )
    assert create_res.status_code == 403
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 1

    patch_res = vendedor_client.patch(
        f"/api/v1/vehicle-brands/{brand.pk}/",
        {"name": "Nombre Cambiado", "expected_version": brand.version},
        format="json",
    )
    assert patch_res.status_code == 403
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 2

    # Encargado can create and edit
    encargado_client = api_client_for(encargado_user)
    enc_create = encargado_client.post(
        "/api/v1/vehicle-brands/", {"name": "Marca Encargado"}, format="json"
    )
    assert enc_create.status_code == 201

    # Deactivation: Only Administrador is allowed
    enc_deact = encargado_client.post(
        f"/api/v1/vehicle-brands/{brand.pk}/deactivate/",
        {"expected_version": brand.version},
        format="json",
    )
    assert enc_deact.status_code == 403
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 3

    admin_client = api_client_for(admin_user)
    admin_deact = admin_client.post(
        f"/api/v1/vehicle-brands/{brand.pk}/deactivate/",
        {"expected_version": brand.version},
        format="json",
    )
    assert admin_deact.status_code == 200
    brand.refresh_from_db()
    assert not brand.is_active

    # Reactivation: Only Administrador is allowed
    enc_act = encargado_client.post(
        f"/api/v1/vehicle-brands/{brand.pk}/activate/",
        {"expected_version": brand.version},
        format="json",
    )
    assert enc_act.status_code == 403

    admin_act = admin_client.post(
        f"/api/v1/vehicle-brands/{brand.pk}/activate/",
        {"expected_version": brand.version},
        format="json",
    )
    assert admin_act.status_code == 200
    brand.refresh_from_db()
    assert brand.is_active


# ==============================================================================
# 3. Matriz de permisos de vehículos y propiedad: tres roles y permisos negativos
# ==============================================================================


def test_vehicles_permission_matrix_for_three_roles(
    admin_user: User,
    encargado_user: User,
    vendedor_user: User,
    customer: Customer,
    brand: VehicleBrand,
    vehicle: Vehicle,
) -> None:
    # All three roles can consult vehicles, ownership history, and customer vehicles
    for user in (admin_user, encargado_user, vendedor_user):
        client = api_client_for(user)
        assert client.get("/api/v1/vehicles/").status_code == 200
        assert client.get(f"/api/v1/vehicles/{vehicle.pk}/").status_code == 200
        assert client.get(f"/api/v1/vehicles/{vehicle.pk}/ownership/").status_code == 200
        assert client.get(f"/api/v1/customers/{customer.pk}/vehicles/").status_code == 200

    # Vendedor is denied write/edit/transfer/deactivate
    AuditEvent.objects.all().delete()
    vendedor_client = api_client_for(vendedor_user)

    # 1. Create vehicle denied
    res_create = vendedor_client.post(
        "/api/v1/vehicles/",
        {
            "owner_id": customer.pk,
            "brand_id": brand.pk,
            "plate": "VND-0001",
            "model": "Deny",
        },
        format="json",
    )
    assert res_create.status_code == 403

    # 2. Patch vehicle denied
    res_patch = vendedor_client.patch(
        f"/api/v1/vehicles/{vehicle.pk}/",
        {"model": "Patched Denied", "expected_version": vehicle.version},
        format="json",
    )
    assert res_patch.status_code == 403

    # 3. Transfer vehicle ownership denied
    buyer = create_customer(
        actor=admin_user,
        data={
            "person_type": PersonType.NATURAL,
            "identification_type": IdentificationType.CI,
            "name": "Comprador Matrix",
            "identification": "0922334455",
            "phone": "0922334455",
        },
    )
    res_transfer = vendedor_client.post(
        f"/api/v1/vehicles/{vehicle.pk}/change-owner/",
        {"owner_id": buyer.pk, "expected_version": vehicle.version},
        format="json",
    )
    assert res_transfer.status_code == 403

    # 4. Deactivate vehicle denied
    res_deact = vendedor_client.post(
        f"/api/v1/vehicles/{vehicle.pk}/deactivate/",
        {"expected_version": vehicle.version},
        format="json",
    )
    assert res_deact.status_code == 403

    # Exactly 4 DENIED audit events recorded for Vendedor's 4 attempts
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 4

    # Encargado can transfer ownership
    encargado_client = api_client_for(encargado_user)
    res_enc_trans = encargado_client.post(
        f"/api/v1/vehicles/{vehicle.pk}/change-owner/",
        {"owner_id": buyer.pk, "expected_version": vehicle.version},
        format="json",
    )
    assert res_enc_trans.status_code == 200

    # Encargado is denied vehicle deactivation
    vehicle.refresh_from_db()
    res_enc_deact = encargado_client.post(
        f"/api/v1/vehicles/{vehicle.pk}/deactivate/",
        {"expected_version": vehicle.version},
        format="json",
    )
    assert res_enc_deact.status_code == 403

    # Admin successfully deactivates and reactivates vehicle
    admin_client = api_client_for(admin_user)
    res_adm_deact = admin_client.post(
        f"/api/v1/vehicles/{vehicle.pk}/deactivate/",
        {"expected_version": vehicle.version},
        format="json",
    )
    assert res_adm_deact.status_code == 200
    vehicle.refresh_from_db()
    assert not vehicle.is_active

    res_adm_act = admin_client.post(
        f"/api/v1/vehicles/{vehicle.pk}/activate/",
        {"expected_version": vehicle.version},
        format="json",
    )
    assert res_adm_act.status_code == 200
    vehicle.refresh_from_db()
    assert vehicle.is_active


# ==============================================================================
# 4. Combinaciones de roles: unión de permisos
# ==============================================================================


def test_union_of_roles_permissions(
    dual_role_user: User,
    customer: Customer,
    brand: VehicleBrand,
    vehicle: Vehicle,
) -> None:
    # Dual role (Vendedor + Encargado) inherits permissions from both
    client = api_client_for(dual_role_user)

    # Can create brand (from Encargado role)
    brand_res = client.post(
        "/api/v1/vehicle-brands/",
        {"name": "Marca Dual"},
        format="json",
    )
    assert brand_res.status_code == 201

    # Can create vehicle (from Encargado role)
    veh_res = client.post(
        "/api/v1/vehicles/",
        {
            "owner_id": customer.pk,
            "brand_id": brand.pk,
            "plate": "DUL-1111",
            "model": "Dual Model",
        },
        format="json",
    )
    assert veh_res.status_code == 201

    # Still CANNOT deactivate vehicle or customer (neither role has .desactivar)
    deact_res = client.post(
        f"/api/v1/vehicles/{vehicle.pk}/deactivate/",
        {"expected_version": vehicle.version},
        format="json",
    )
    assert deact_res.status_code == 403


# ==============================================================================
# 5. Seguridad: Anónimo, cuenta inactiva, contraseña temporal, sesión y CSRF
# ==============================================================================


def test_security_matrix_anonymous_inactive_temp_pwd_csrf(
    admin_user: User,
    customer: Customer,
    brand: VehicleBrand,
) -> None:
    # 1. Anonymous user cannot perform actions
    anon_client = api_client_for(None)
    assert anon_client.get("/api/v1/customers/").status_code == 403
    assert anon_client.get("/api/v1/vehicle-brands/").status_code == 403
    assert anon_client.get("/api/v1/vehicles/").status_code == 403
    assert anon_client.post("/api/v1/customers/", {}, format="json").status_code == 403

    # 2. Inactive account cannot access API
    inactive_user = make_user("inactivo", Role.ADMINISTRADOR, is_active=False)
    inact_client = api_client_for(inactive_user)
    assert inact_client.get("/api/v1/customers/").status_code == 403
    assert inact_client.post("/api/v1/customers/", {}, format="json").status_code == 403

    # 3. Temporary password user must change password before performing actions
    temp_pwd_user = make_user("temporal", Role.ADMINISTRADOR, must_change_password=True)
    temp_client = api_client_for(temp_pwd_user)
    temp_res = temp_client.get("/api/v1/customers/")
    assert temp_res.status_code == 403

    # 4. CSRF protection on mutative endpoints
    django_client = Client(enforce_csrf_checks=True)
    # Login as admin to obtain authenticated session
    login_user = User.objects.create_user(
        username="csrf_admin",
        password="ValidPassword123!",
    )
    UserRole.objects.create(user=login_user, role=Role.ADMINISTRADOR)

    # Get CSRF token
    django_client.get("/api/v1/auth/csrf/")
    csrf_token = django_client.cookies["csrftoken"].value

    # Login with CSRF token
    login_res = django_client.post(
        "/api/v1/auth/login/",
        {"username": "csrf_admin", "password": "ValidPassword123!"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )
    assert login_res.status_code == 200

    # Attempt mutation WITHOUT CSRF token -> Rejected 403 CSRF failure
    csrf_fail = django_client.post(
        "/api/v1/customers/",
        {
            "person_type": "NATURAL",
            "identification_type": "CI",
            "name": "No CSRF",
            "identification": "0999887766",
            "phone": "0999887766",
        },
        content_type="application/json",
    )
    assert csrf_fail.status_code == 403


# ==============================================================================
# 6. Denegación en capa de servicio y evento único de auditoría
# ==============================================================================


def test_service_layer_denials_and_single_rejection_event(
    admin_user: User,
    vendedor_user: User,
    encargado_user: User,
    customer: Customer,
    brand: VehicleBrand,
    vehicle: Vehicle,
) -> None:
    # 1. Direct service call raises BusinessPermissionDeniedError and records exactly 1 DENIED event
    AuditEvent.objects.all().delete()
    with pytest.raises(BusinessPermissionDeniedError):
        create_brand(name="Marca Ilegal", actor=vendedor_user)
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 1

    with pytest.raises(BusinessPermissionDeniedError):
        update_brand(
            brand_id=brand.pk,
            name="Mod Ilegal",
            expected_version=brand.version,
            actor=vendedor_user,
        )
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 2

    with pytest.raises(BusinessPermissionDeniedError):
        deactivate_brand(brand_id=brand.pk, expected_version=brand.version, actor=encargado_user)
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 3

    with pytest.raises(BusinessPermissionDeniedError):
        create_vehicle(
            owner_id=customer.pk,
            brand_id=brand.pk,
            plate="ILE-0001",
            model="Ilegal",
            actor=vendedor_user,
        )
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 4

    with pytest.raises(BusinessPermissionDeniedError):
        transfer_vehicle_ownership(
            vehicle_id=vehicle.pk,
            new_owner_id=customer.pk,
            expected_version=vehicle.version,
            actor=vendedor_user,
        )
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 5

    with pytest.raises(BusinessPermissionDeniedError):
        deactivate_vehicle(
            vehicle_id=vehicle.pk, expected_version=vehicle.version, actor=encargado_user
        )
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 6

    with pytest.raises(BusinessPermissionDeniedError):
        deactivate_customer(
            customer_id=customer.pk, expected_version=customer.version, actor=encargado_user
        )
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 7

    with pytest.raises(BusinessPermissionDeniedError):
        activate_customer(
            customer_id=customer.pk, expected_version=customer.version, actor=vendedor_user
        )
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 8

    # 2. Via API, exactly ONE denial event per attempt (not duplicated between view & service)
    AuditEvent.objects.all().delete()
    client = api_client_for(vendedor_user)
    api_res = client.post(
        "/api/v1/vehicle-brands/",
        {"name": "No Duplicado"},
        format="json",
    )
    assert api_res.status_code == 403
    # Verify ONLY 1 audit event was created
    assert AuditEvent.objects.filter(result=AuditResult.DENIED).count() == 1
