from typing import Any

from rest_framework.request import Request
from rest_framework.throttling import ScopedRateThrottle

from identity.api.request_context import request_id_from
from identity.application.audit import record_audit_event
from identity.models import AuditResult


class AuditedLoginRateThrottle(ScopedRateThrottle):
    def allow_request(self, request: Request, view: Any) -> bool:
        allowed = super().allow_request(request, view)
        if not allowed:
            record_audit_event(
                actor=None,
                action="authentication.login_throttled",
                target_type="authentication",
                target_id="unconfirmed",
                result=AuditResult.DENIED,
                reason="rate_limit",
                request_id=request_id_from(request),
            )
        return allowed
