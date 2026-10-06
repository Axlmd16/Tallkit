from typing import Any

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from identity.models import UserRole


def _user(username: str, *roles: str):  # type: ignore[no-untyped-def]
    user = get_user_model().objects.create_user(username=username, password="x" * 14)
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def admin(db: None):  # type: ignore[no-untyped-def]
    return _user("home-admin", "ADMINISTRADOR")


@pytest.fixture
def seller(db: None):  # type: ignore[no-untyped-def]
    return _user("home-seller", "VENDEDOR")


@pytest.fixture
def manager(db: None):  # type: ignore[no-untyped-def]
    return _user("home-manager", "ENCARGADO_TALLER")


@pytest.fixture
def seller_manager(db: None):  # type: ignore[no-untyped-def]
    return _user("home-both", "VENDEDOR", "ENCARGADO_TALLER")


@pytest.fixture
def nobody(db: None):  # type: ignore[no-untyped-def]
    return _user("home-nobody")


@pytest.fixture
def client_for():  # type: ignore[no-untyped-def]
    def build(user: Any) -> APIClient:
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    return build
