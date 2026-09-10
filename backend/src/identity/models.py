from typing import Any, ClassVar, NoReturn

from django.conf import settings
from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models, transaction

from identity.domain.authorization import Role


class IdentityUserManager(UserManager["User"]):
    def create_superuser(
        self,
        username: str,
        email: str | None = None,
        password: str | None = None,
        **extra_fields: Any,
    ) -> "User":
        with transaction.atomic(using=self.db):
            user = super().create_superuser(username, email, password, **extra_fields)
            UserRole.objects.get_or_create(user=user, role=Role.ADMINISTRADOR)
        return user


class User(AbstractUser):
    must_change_password = models.BooleanField(default=False)
    authorization_version = models.PositiveBigIntegerField(default=1)
    objects: ClassVar[IdentityUserManager] = IdentityUserManager()


class UserRole(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="role_assignments",
    )
    role = models.CharField(
        max_length=32,
        choices=[(role.value, role.value) for role in Role],
    )

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["user", "role"],
                name="identity_unique_role_per_user",
            )
        ]

    def __str__(self) -> str:
        return f"{self.user}: {self.role}"


class AuditResult(models.TextChoices):
    SUCCESS = "SUCCESS", "Exitoso"
    FAILURE = "FAILURE", "Fallido"
    DENIED = "DENIED", "Denegado"


class AuditEventImmutableError(RuntimeError):
    pass


class AuditEvent(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="identity_audit_events",
    )
    action = models.CharField(max_length=100)
    target_type = models.CharField(max_length=100)
    target_id = models.CharField(max_length=150)
    result = models.CharField(max_length=16, choices=AuditResult.choices)
    occurred_at = models.DateTimeField(auto_now_add=True)
    reason = models.CharField(max_length=255, blank=True)
    request_id = models.UUIDField(null=True, blank=True)
    operation_id = models.UUIDField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["action", "operation_id"],
                name="identity_unique_audit_operation_per_action",
            )
        ]
        ordering = ("-occurred_at", "-pk")

    def __str__(self) -> str:
        return f"{self.action}: {self.result}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self._state.adding:
            raise AuditEventImmutableError("Los eventos de auditoría no se pueden editar.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> NoReturn:
        raise AuditEventImmutableError("Los eventos de auditoría no se pueden eliminar.")
