from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.db import close_old_connections

from identity.application.users import LastActiveAdministratorError, set_user_active
from identity.domain.authorization import Role
from identity.models import User, UserRole


@pytest.mark.django_db(transaction=True)
def test_two_concurrent_deactivations_leave_one_active_administrator() -> None:
    first = User.objects.create_user(username="admin-1")
    second = User.objects.create_user(username="admin-2")
    UserRole.objects.bulk_create(
        [
            UserRole(user=first, role=Role.ADMINISTRADOR),
            UserRole(user=second, role=Role.ADMINISTRADOR),
        ]
    )
    barrier = Barrier(2)

    def deactivate(user_id: int) -> str:
        close_old_connections()
        barrier.wait()
        try:
            set_user_active(actor=User.objects.get(pk=user_id), user_id=user_id, is_active=False)
        except LastActiveAdministratorError:
            return "rejected"
        finally:
            close_old_connections()
        return "deactivated"

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(deactivate, [first.pk, second.pk]))

    active_administrators = UserRole.objects.filter(
        role=Role.ADMINISTRADOR,
        user__is_active=True,
    ).count()
    assert sorted(results) == ["deactivated", "rejected"]
    assert active_administrators == 1
