from typing import Any

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from identity.api.request_context import request_id_from
from identity.application.authorization import has_permission, record_permission_denial
from identity.models import User


class PasswordChangeCompleted(BasePermission):
    message = "Debe cambiar su contraseña temporal antes de continuar."

    def has_permission(self, request: Request, view: Any) -> bool:
        user = request.user
        return isinstance(user, User) and not user.must_change_password


class HasBusinessPermission(BasePermission):
    message = "No tiene permiso para realizar esta acción."

    def has_permission(self, request: Request, view: Any) -> bool:
        required_permission = getattr(view, "required_business_permission", None)
        permission_map = getattr(view, "business_permissions", None)
        if isinstance(permission_map, dict):
            required_permission = permission_map.get(request.method)
        user = request.user
        if (
            not isinstance(required_permission, str)
            or not isinstance(user, User)
            or not user.is_authenticated
            or not user.is_active
            or user.must_change_password
        ):
            return False

        allowed = has_permission(user, required_permission)
        audited_methods: frozenset[str] = getattr(
            view, "audited_permission_denial_methods", frozenset()
        )
        if not allowed and request.method in audited_methods:
            record_permission_denial(
                actor=user,
                permission=required_permission,
                request_id=request_id_from(request),
                method=request.method,
                path=request.path,
            )
        return allowed
