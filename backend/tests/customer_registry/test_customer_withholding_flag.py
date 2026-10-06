"""Marca opcional «Agente de retención»: manual, compartida y sin efectos sobre operaciones."""

import pytest
from rest_framework.test import APIClient

from customer_registry.application import sales_references, workshop_references
from customer_registry.application.customers import create_customer, update_customer
from customer_registry.application.queries import search_customers
from customer_registry.domain.validation import CustomerValidationError
from customer_registry.models import Customer
from identity.application.authorization import BusinessPermissionDeniedError
from identity.models import AuditEvent, User

pytestmark = pytest.mark.django_db

DATA = {
    "person_type": "JURIDICA",
    "name": "Transportes Uno",
    "identification_type": "RUC",
    "identification": "1191721175001",
    "phone": "0991112233",
}


def _customer(actor: User, **extra: object) -> Customer:
    return create_customer(actor=actor, data={**DATA, **extra})


def test_customer_starts_without_the_flag(role_seller: User) -> None:
    customer = _customer(role_seller)
    assert customer.is_withholding_agent is False


def test_flag_can_be_declared_on_creation(role_seller: User) -> None:
    assert _customer(role_seller, is_withholding_agent=True).is_withholding_agent is True


@pytest.mark.parametrize("fixture", ["role_admin", "role_seller", "role_manager"])
def test_every_role_that_edits_customers_can_toggle_it(
    fixture: str, request: pytest.FixtureRequest, role_admin: User
) -> None:
    actor: User = request.getfixturevalue(fixture)
    customer = _customer(role_admin)
    updated = update_customer(
        actor=actor,
        customer_id=customer.pk,
        expected_version=customer.version,
        data={"is_withholding_agent": True},
    )
    assert updated.is_withholding_agent is True
    assert updated.version == customer.version + 1
    event = AuditEvent.objects.filter(action="registry.customer_updated").latest("id")
    assert event.metadata["changed_fields"] == ["is_withholding_agent"]
    back = update_customer(
        actor=actor,
        customer_id=customer.pk,
        expected_version=updated.version,
        data={"is_withholding_agent": False},
    )
    assert back.is_withholding_agent is False


def test_user_without_permission_cannot_toggle_it(role_admin: User) -> None:
    customer = _customer(role_admin)
    outsider = User.objects.create_user(username="sin_rol", email="sin@example.com")
    with pytest.raises(BusinessPermissionDeniedError):
        update_customer(
            actor=outsider,
            customer_id=customer.pk,
            expected_version=customer.version,
            data={"is_withholding_agent": True},
        )
    customer.refresh_from_db()
    assert customer.is_withholding_agent is False


@pytest.mark.parametrize("value", ["si", 1, None, "true"])
def test_flag_must_be_a_boolean(role_admin: User, value: object) -> None:
    customer = _customer(role_admin)
    with pytest.raises(CustomerValidationError) as error:
        update_customer(
            actor=role_admin,
            customer_id=customer.pk,
            expected_version=customer.version,
            data={"is_withholding_agent": value},
        )
    assert "is_withholding_agent" in error.value.errors


def test_flag_is_exposed_to_queries_and_other_modules(role_admin: User) -> None:
    customer = _customer(role_admin, is_withholding_agent=True)
    page = search_customers(actor=role_admin)
    assert page.items[0].is_withholding_agent is True
    sales_ref = sales_references.get_customer_reference(customer.pk)
    assert sales_ref is not None
    assert sales_ref.is_withholding_agent is True
    assert workshop_references.customer_withholding_flags([customer.pk, 999999]) == {
        customer.pk: True
    }


def test_api_reads_and_writes_the_flag(role_seller: User) -> None:
    client = APIClient()
    client.force_authenticate(user=role_seller)
    created = client.post("/api/v1/customers/", DATA, format="json")
    assert created.status_code == 201
    assert created.json()["is_withholding_agent"] is False
    customer_id = created.json()["id"]
    patched = client.patch(
        f"/api/v1/customers/{customer_id}/",
        {"expected_version": 1, "is_withholding_agent": True},
        format="json",
    )
    assert patched.status_code == 200
    assert patched.json()["is_withholding_agent"] is True
    listed = client.get("/api/v1/customers/").json()
    assert listed["results"][0]["is_withholding_agent"] is True


@pytest.mark.django_db(transaction=True)
def test_migration_leaves_existing_customers_without_the_flag() -> None:
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor

    before = ("customer_registry", "0003_vehicle_ownershipperiod_and_more")
    after = ("customer_registry", "0004_customer_withholding_agent")
    executor = MigrationExecutor(connection)
    executor.migrate([before])
    old_apps = executor.loader.project_state([before]).apps
    existing = old_apps.get_model("customer_registry", "Customer").objects.create(
        person_type="NATURAL",
        name="Existente",
        identification_type="CI",
        identification="1104018559",
        phone="0990000000",
        version=4,
    )

    executor = MigrationExecutor(connection)
    executor.migrate([after])
    apps = executor.loader.project_state([after]).apps
    migrated = apps.get_model("customer_registry", "Customer").objects.get(pk=existing.pk)
    assert migrated.is_withholding_agent is False
    assert migrated.version == 4

    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())
