from collections.abc import Mapping
from uuid import UUID

from identity.models import AuditEvent, AuditResult, User

SAFE_METADATA_KEYS = frozenset(
    {
        "attempts",
        "changed_fields",
        "method",
        "new_owner_id",
        "path",
        "permission",
        "previous_owner_id",
        "roles_added",
        "roles_removed",
    }
)


def record_audit_event(
    *,
    actor: User | None,
    action: str,
    target_type: str,
    target_id: str,
    result: AuditResult,
    reason: str = "",
    request_id: UUID | None = None,
    operation_id: UUID | None = None,
    metadata: Mapping[str, object] | None = None,
) -> AuditEvent:
    safe_metadata: dict[str, object] = {}
    for key, value in (metadata or {}).items():
        if key not in SAFE_METADATA_KEYS:
            continue
        if key in ("previous_owner_id", "new_owner_id"):
            if isinstance(value, int) and not isinstance(value, bool):
                safe_metadata[key] = value
        elif key == "path" and isinstance(value, str):
            safe_metadata[key] = value.split("?")[0]
        else:
            safe_metadata[key] = value
    return AuditEvent.objects.create(
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=target_id,
        result=result,
        reason=reason,
        request_id=request_id,
        operation_id=operation_id,
        metadata=safe_metadata,
    )
