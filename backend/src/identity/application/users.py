from collections.abc import Iterable
from uuid import UUID

from django.db import IntegrityError, connection, transaction

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.domain.authorization import Role
from identity.models import AuditResult, User, UserRole


class UserAdministrationError(Exception):
    pass


class InvalidRolesError(UserAdministrationError):
    pass


class DuplicateUsernameError(UserAdministrationError):
    pass


class LastActiveAdministratorError(UserAdministrationError):
    pass


_ADMINISTRATOR_GUARD_LOCK_ID = 8_391_104_221


def _lock_administrator_guard() -> None:
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [_ADMINISTRATOR_GUARD_LOCK_ID])


def _would_remove_last_active_administrator(user: User, normalized_roles: frozenset[Role]) -> bool:
    current_roles = {Role(value) for value in user.role_assignments.values_list("role", flat=True)}
    if (
        not user.is_active
        or Role.ADMINISTRADOR not in current_roles
        or Role.ADMINISTRADOR in normalized_roles
    ):
        return False
    return UserRole.objects.filter(role=Role.ADMINISTRADOR, user__is_active=True).count() <= 1


def _normalize_roles(roles: Iterable[Role | str]) -> frozenset[Role]:
    try:
        normalized = frozenset(Role(role) for role in roles)
    except ValueError as exc:
        raise InvalidRolesError("Solo se permiten los tres roles definidos para V1.") from exc
    if not normalized:
        raise InvalidRolesError("El usuario debe conservar al menos un rol.")
    return normalized


def create_user(
    *,
    actor: User,
    username: str,
    roles: Iterable[Role | str],
    first_name: str = "",
    last_name: str = "",
    email: str = "",
    is_active: bool = True,
    request_id: UUID | None = None,
) -> User:
    require_permission(
        actor=actor,
        permission="usuarios.crear",
        request_id=request_id,
        target_type="user",
        target_id="uncreated",
    )
    try:
        normalized_roles = _normalize_roles(roles)
    except InvalidRolesError:
        record_audit_event(
            actor=actor,
            action="identity.user_create_rejected",
            target_type="user",
            target_id="uncreated",
            result=AuditResult.FAILURE,
            reason="invalid_roles",
            request_id=request_id,
        )
        raise

    if User.objects.filter(username=username).exists():
        record_audit_event(
            actor=actor,
            action="identity.user_create_rejected",
            target_type="user",
            target_id="uncreated",
            result=AuditResult.FAILURE,
            reason="duplicate_username",
            request_id=request_id,
        )
        raise DuplicateUsernameError("La identificación de acceso ya está en uso.")

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                first_name=first_name,
                last_name=last_name,
                email=email,
                is_active=is_active,
            )
            UserRole.objects.bulk_create(
                [UserRole(user=user, role=role) for role in normalized_roles]
            )
            record_audit_event(
                actor=actor,
                action="identity.user_created",
                target_type="user",
                target_id=str(user.pk),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"roles_added": sorted(role.value for role in normalized_roles)},
            )
        return user
    except IntegrityError as exc:
        record_audit_event(
            actor=actor,
            action="identity.user_create_rejected",
            target_type="user",
            target_id="uncreated",
            result=AuditResult.FAILURE,
            reason="duplicate_username",
            request_id=request_id,
        )
        raise DuplicateUsernameError("La identificación de acceso ya está en uso.") from exc


def _update_user(
    *,
    actor: User,
    user_id: int,
    username: str,
    roles: Iterable[Role | str],
    first_name: str = "",
    last_name: str = "",
    email: str = "",
    request_id: UUID | None = None,
) -> User:
    require_permission(
        actor=actor,
        permission="usuarios.editar",
        request_id=request_id,
        target_type="user",
        target_id=str(user_id),
    )
    try:
        normalized_roles = _normalize_roles(roles)
    except InvalidRolesError:
        record_audit_event(
            actor=actor,
            action="identity.user_update_rejected",
            target_type="user",
            target_id=str(user_id),
            result=AuditResult.FAILURE,
            reason="invalid_roles",
            request_id=request_id,
        )
        raise

    if User.objects.exclude(pk=user_id).filter(username=username).exists():
        record_audit_event(
            actor=actor,
            action="identity.user_update_rejected",
            target_type="user",
            target_id=str(user_id),
            result=AuditResult.FAILURE,
            reason="duplicate_username",
            request_id=request_id,
        )
        raise DuplicateUsernameError("La identificación de acceso ya está en uso.")

    with transaction.atomic():
        _lock_administrator_guard()
        user = User.objects.select_for_update().get(pk=user_id)
        if _would_remove_last_active_administrator(user, normalized_roles):
            raise LastActiveAdministratorError(
                "Debe existir al menos otro Administrador activo antes de retirar este rol."
            )
        current_roles = {
            Role(value) for value in user.role_assignments.values_list("role", flat=True)
        }
        roles_added = normalized_roles - current_roles
        roles_removed = current_roles - normalized_roles

        new_fields = {
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
        }
        changed_fields = [
            field_name
            for field_name, value in new_fields.items()
            if getattr(user, field_name) != value
        ]
        if not changed_fields and not roles_added and not roles_removed:
            return user

        for field_name, value in new_fields.items():
            setattr(user, field_name, value)
        if roles_removed:
            user.authorization_version += 1
            changed_fields.append("authorization_version")
        if changed_fields:
            user.save(update_fields=changed_fields)

        if roles_removed:
            UserRole.objects.filter(
                user=user,
                role__in=[role.value for role in roles_removed],
            ).delete()
        if roles_added:
            UserRole.objects.bulk_create([UserRole(user=user, role=role) for role in roles_added])

        record_audit_event(
            actor=actor,
            action="identity.user_updated",
            target_type="user",
            target_id=str(user.pk),
            result=AuditResult.SUCCESS,
            request_id=request_id,
            metadata={
                "changed_fields": changed_fields,
                "roles_added": sorted(role.value for role in roles_added),
                "roles_removed": sorted(role.value for role in roles_removed),
            },
        )
    return user


def update_user(
    *,
    actor: User,
    user_id: int,
    username: str,
    roles: Iterable[Role | str],
    first_name: str = "",
    last_name: str = "",
    email: str = "",
    request_id: UUID | None = None,
) -> User:
    try:
        return _update_user(
            actor=actor,
            user_id=user_id,
            username=username,
            roles=roles,
            first_name=first_name,
            last_name=last_name,
            email=email,
            request_id=request_id,
        )
    except LastActiveAdministratorError:
        record_audit_event(
            actor=actor,
            action="identity.user_update_rejected",
            target_type="user",
            target_id=str(user_id),
            result=AuditResult.FAILURE,
            reason="last_active_administrator",
            request_id=request_id,
        )
        raise


def _set_user_active(
    *,
    actor: User,
    user_id: int,
    is_active: bool,
    request_id: UUID | None = None,
) -> User:
    with transaction.atomic():
        _lock_administrator_guard()
        user = User.objects.select_for_update().get(pk=user_id)
        if user.is_active == is_active:
            return user
        if (
            not is_active
            and user.role_assignments.filter(role=Role.ADMINISTRADOR).exists()
            and UserRole.objects.filter(
                role=Role.ADMINISTRADOR,
                user__is_active=True,
            ).count()
            <= 1
        ):
            raise LastActiveAdministratorError(
                "Debe existir al menos otro Administrador activo antes de desactivar esta cuenta."
            )

        user.is_active = is_active
        user.authorization_version += 1
        user.save(update_fields=["is_active", "authorization_version"])
        record_audit_event(
            actor=actor,
            action=("identity.user_activated" if is_active else "identity.user_deactivated"),
            target_type="user",
            target_id=str(user.pk),
            result=AuditResult.SUCCESS,
            request_id=request_id,
            metadata={"changed_fields": ["is_active", "authorization_version"]},
        )
    return user


def set_user_active(
    *,
    actor: User,
    user_id: int,
    is_active: bool,
    request_id: UUID | None = None,
) -> User:
    require_permission(
        actor=actor,
        permission="usuarios.desactivar",
        request_id=request_id,
        target_type="user",
        target_id=str(user_id),
    )
    try:
        return _set_user_active(
            actor=actor,
            user_id=user_id,
            is_active=is_active,
            request_id=request_id,
        )
    except LastActiveAdministratorError:
        record_audit_event(
            actor=actor,
            action="identity.user_state_change_rejected",
            target_type="user",
            target_id=str(user_id),
            result=AuditResult.FAILURE,
            reason="last_active_administrator",
            request_id=request_id,
        )
        raise
