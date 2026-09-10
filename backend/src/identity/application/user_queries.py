from dataclasses import dataclass
from math import ceil

from django.db.models import Q

from identity.domain.authorization import Role
from identity.models import User


@dataclass(frozen=True)
class UserSummary:
    id: int
    username: str
    first_name: str
    last_name: str
    email: str
    is_active: bool
    roles: tuple[Role, ...]


@dataclass(frozen=True)
class UserPage:
    items: tuple[UserSummary, ...]
    page: int
    page_size: int
    total: int
    total_pages: int


def list_users(
    *,
    search: str = "",
    is_active: bool | None = None,
    role: Role | str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> UserPage:
    if page < 1 or page_size < 1:
        raise ValueError("La página y su tamaño deben ser positivos.")

    users = User.objects.prefetch_related("role_assignments").order_by("username", "pk")
    if search:
        users = users.filter(
            Q(username__icontains=search)
            | Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(email__icontains=search)
        )
    if is_active is not None:
        users = users.filter(is_active=is_active)
    if role is not None:
        users = users.filter(role_assignments__role=Role(role)).distinct()

    total = users.count()
    start = (page - 1) * page_size
    page_users = users[start : start + page_size]
    items = tuple(
        UserSummary(
            id=user.pk,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            is_active=user.is_active,
            roles=tuple(
                sorted(
                    (Role(assignment.role) for assignment in user.role_assignments.all()),
                    key=lambda assigned_role: assigned_role.value,
                )
            ),
        )
        for user in page_users
    )
    return UserPage(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=ceil(total / page_size),
    )
