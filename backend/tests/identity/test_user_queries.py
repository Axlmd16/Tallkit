import pytest

from identity.application.user_queries import list_users
from identity.domain.authorization import Role
from identity.models import User, UserRole

pytestmark = pytest.mark.django_db


def add_user(username: str, *, active: bool, roles: list[Role]) -> User:
    user = User.objects.create_user(
        username=username,
        first_name=username.title(),
        is_active=active,
    )
    UserRole.objects.bulk_create([UserRole(user=user, role=role) for role in roles])
    return user


def test_filters_users_by_search_state_and_role() -> None:
    add_user("ana", active=True, roles=[Role.VENDEDOR])
    add_user("anabel", active=False, roles=[Role.VENDEDOR])
    add_user("bruno", active=True, roles=[Role.ENCARGADO_TALLER])

    page = list_users(search="ana", is_active=True, role=Role.VENDEDOR)

    assert page.total == 1
    assert [item.username for item in page.items] == ["ana"]
    assert page.items[0].roles == (Role.VENDEDOR,)


def test_paginates_in_a_stable_order() -> None:
    for username in ["diana", "carlos", "bruno", "ana"]:
        add_user(username, active=True, roles=[Role.VENDEDOR])

    first_page = list_users(page=1, page_size=2)
    second_page = list_users(page=2, page_size=2)

    assert first_page.total == 4
    assert first_page.total_pages == 2
    assert [item.username for item in first_page.items] == ["ana", "bruno"]
    assert [item.username for item in second_page.items] == ["carlos", "diana"]


def test_query_result_does_not_expose_credentials_or_internal_flags() -> None:
    add_user("ana", active=True, roles=[Role.VENDEDOR])

    item = list_users().items[0]

    assert not hasattr(item, "password")
    assert not hasattr(item, "authorization_version")
    assert not hasattr(item, "is_superuser")
