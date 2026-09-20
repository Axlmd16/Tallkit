from collections.abc import Iterator

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_cache() -> Iterator[None]:
    cache.clear()
    yield
    cache.clear()


def _user_with_role(username: str, role: str):  # type: ignore[no-untyped-def]
    from django.contrib.auth import get_user_model

    from identity.models import UserRole

    user = get_user_model().objects.create_user(username=username, password="password123")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def role_admin(db: None):  # type: ignore[no-untyped-def]
    return _user_with_role("role_admin", "ADMINISTRADOR")


@pytest.fixture
def role_manager(db: None):  # type: ignore[no-untyped-def]
    return _user_with_role("role_manager", "ENCARGADO_TALLER")


@pytest.fixture
def role_seller(db: None):  # type: ignore[no-untyped-def]
    return _user_with_role("role_seller", "VENDEDOR")
