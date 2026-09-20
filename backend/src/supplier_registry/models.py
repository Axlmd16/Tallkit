from typing import ClassVar

from django.conf import settings
from django.db import models


class Supplier(models.Model):
    name = models.CharField(max_length=255)
    identification_type = models.CharField(  # noqa: DJ001
        max_length=8, null=True, blank=True
    )
    identification = models.CharField(  # noqa: DJ001
        max_length=32, null=True, blank=True
    )
    phone = models.CharField(max_length=64, blank=True, default="")
    email = models.CharField(max_length=254, blank=True, default="")
    address = models.CharField(max_length=1024, blank=True, default="")
    is_active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(name__regex=r"\S"), name="supplier_name_not_blank"
            ),
            models.UniqueConstraint(
                fields=["identification_type", "identification"],
                condition=models.Q(identification__isnull=False),
                name="supplier_identification_unique",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(identification_type__isnull=True, identification__isnull=True)
                    | models.Q(
                        identification_type__isnull=False,
                        identification_type="CI",
                        identification__isnull=False,
                        identification__regex=r"^.{10}$",
                    )
                    | models.Q(
                        identification_type__isnull=False,
                        identification_type="RUC",
                        identification__isnull=False,
                        identification__regex=r"^.{13}$",
                    )
                ),
                name="supplier_identification_valid",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["is_active", "name"], name="supplier_active_name_idx"),
        ]
        ordering: ClassVar[list[str]] = ["name", "id"]

    def __str__(self) -> str:
        return self.name


class SupplierCommand(models.Model):
    """Recibo idempotente interno; conserva respuestas con contacto y no se expone."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="supplier_commands"
    )
    action = models.CharField(max_length=64)
    idempotency_key = models.CharField(max_length=128)
    input_fingerprint = models.CharField(max_length=64)
    response_status = models.PositiveSmallIntegerField(null=True)
    result = models.JSONField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["actor", "action", "idempotency_key"], name="supplier_command_key_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(idempotency_key__regex=r"^[A-Za-z0-9._:-]{8,128}$"),
                name="supplier_command_key_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(input_fingerprint__regex=r"^[0-9a-f]{64}$"),
                name="supplier_command_fingerprint_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(response_status__isnull=True)
                | models.Q(response_status__gte=100, response_status__lte=599),
                name="supplier_command_status_valid",
            ),
        ]
        ordering: ClassVar[list[str]] = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.action}:{self.idempotency_key}"
