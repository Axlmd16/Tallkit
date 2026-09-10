from collections.abc import Mapping
from uuid import UUID

from identity.models import AuditEvent, AuditResult, User

SAFE_METADATA_KEYS = frozenset(
    {
        "attempts",
        "changed_fields",
        "method",
        "path",
        "permission",
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
    safe_metadata = {
        key: value for key, value in (metadata or {}).items() if key in SAFE_METADATA_KEYS
    }
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
