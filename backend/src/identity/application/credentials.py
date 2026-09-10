import secrets
from uuid import UUID

from django.contrib.auth.password_validation import validate_password
from django.db import transaction

from identity.application.audit import record_audit_event
from identity.application.authorization import (
    BusinessPermissionDeniedError as BusinessPermissionDeniedError,
)
from identity.application.authorization import require_permission
from identity.models import AuditEvent, AuditResult, User


class IncorrectCurrentPasswordError(Exception):
    pass


class OperationAlreadyProcessedError(Exception):
    pass


def change_password(
    *,
    user: User,
    current_password: str,
    new_password: str,
    request_id: UUID | None = None,
) -> User:
    if not user.check_password(current_password):
        record_audit_event(
            actor=user,
            action="identity.password_change_rejected",
            target_type="user",
            target_id=str(user.pk),
            result=AuditResult.FAILURE,
            reason="incorrect_current_password",
            request_id=request_id,
        )
        raise IncorrectCurrentPasswordError("La contraseña actual no es correcta.")

    validate_password(new_password, user=user)
    with transaction.atomic():
        locked_user = User.objects.select_for_update().get(pk=user.pk)
        locked_user.set_password(new_password)
        locked_user.must_change_password = False
        locked_user.save(update_fields=["password", "must_change_password"])
        record_audit_event(
            actor=locked_user,
            action="identity.password_changed",
            target_type="user",
            target_id=str(locked_user.pk),
            result=AuditResult.SUCCESS,
            request_id=request_id,
            metadata={"changed_fields": ["password", "must_change_password"]},
        )
    return locked_user


def reset_password(
    *,
    actor: User,
    user_id: int,
    operation_id: UUID,
    request_id: UUID | None = None,
) -> str:
    require_permission(
        actor=actor,
        permission="usuarios.restablecer_clave",
        request_id=request_id,
        denial_action="identity.password_reset_denied",
        target_type="user",
        target_id=str(user_id),
    )

    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user_id)
        if AuditEvent.objects.filter(
            action="identity.password_reset",
            operation_id=operation_id,
        ).exists():
            raise OperationAlreadyProcessedError(
                "La operación ya fue procesada y la credencial no puede volver a mostrarse."
            )

        temporary_password = secrets.token_urlsafe(18)
        user.set_password(temporary_password)
        user.must_change_password = True
        user.authorization_version += 1
        user.save(update_fields=["password", "must_change_password", "authorization_version"])
        record_audit_event(
            actor=actor,
            action="identity.password_reset",
            target_type="user",
            target_id=str(user.pk),
            result=AuditResult.SUCCESS,
            request_id=request_id,
            operation_id=operation_id,
            metadata={
                "changed_fields": [
                    "password",
                    "must_change_password",
                    "authorization_version",
                ]
            },
        )
    return temporary_password
