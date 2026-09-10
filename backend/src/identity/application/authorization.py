from uuid import UUID

from identity.application.audit import record_audit_event
from identity.domain.authorization import Role, effective_permissions
from identity.models import AuditResult, User


class BusinessPermissionDeniedError(Exception):
    pass


def has_permission(actor: User, permission: str) -> bool:
    if not actor.is_active or actor.must_change_password:
        return False
    try:
        roles = {Role(value) for value in actor.role_assignments.values_list("role", flat=True)}
    except ValueError:
        return False
    return permission in effective_permissions(roles)


def record_permission_denial(
    *,
    actor: User,
    permission: str,
    request_id: UUID | None = None,
    method: str | None = None,
    path: str | None = None,
    action: str = "authorization.permission_denied",
    target_type: str = "permission",
    target_id: str | None = None,
) -> None:
    metadata = {"permission": permission}
    if method is not None:
        metadata["method"] = method
    if path is not None:
        metadata["path"] = path
    record_audit_event(
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=target_id or permission,
        result=AuditResult.DENIED,
        reason="missing_permission",
        request_id=request_id,
        metadata=metadata,
    )


def require_permission(
    *,
    actor: User,
    permission: str,
    request_id: UUID | None = None,
    denial_action: str = "authorization.permission_denied",
    target_type: str = "permission",
    target_id: str | None = None,
) -> None:
    if has_permission(actor, permission):
        return
    record_permission_denial(
        actor=actor,
        permission=permission,
        request_id=request_id,
        action=denial_action,
        target_type=target_type,
        target_id=target_id,
    )
    raise BusinessPermissionDeniedError("No tiene permiso para realizar esta acción.")
