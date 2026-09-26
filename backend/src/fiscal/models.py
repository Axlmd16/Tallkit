"""Persistencia propia del módulo fiscal; no representa autorización del SRI."""

import uuid
from typing import ClassVar

from django.conf import settings
from django.db import models

from fiscal.domain.states import PreparationState


class FiscalPreparation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fiscal_entity = models.ForeignKey(
        "workshop_configuration.FiscalEntity", on_delete=models.PROTECT, related_name="+"
    )
    commercial_sale = models.ForeignKey(
        "sales.Sale",
        on_delete=models.PROTECT,
        related_name="fiscal_preparations",
        null=True,
        blank=True,
    )
    artisan_operation = models.ForeignKey(
        "workshop.ServiceOperation",
        on_delete=models.PROTECT,
        related_name="fiscal_preparations",
        null=True,
        blank=True,
    )
    state = models.CharField(
        max_length=16,
        choices=[(state.value, state.value) for state in PreparationState],
        default=PreparationState.DRAFT,
    )
    version = models.PositiveBigIntegerField(default=1)
    source_version = models.PositiveBigIntegerField()
    # Datos editables del borrador (receptor, punto, pagos, fecha); no es el snapshot.
    draft = models.JSONField(null=True, blank=True)
    snapshot = models.JSONField(null=True, blank=True)
    replaces = models.ForeignKey(
        "self", on_delete=models.PROTECT, related_name="replacements", null=True, blank=True
    )
    prepared_at = models.DateTimeField(null=True, blank=True)
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
        null=True,
        blank=True,
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
        null=True,
        blank=True,
    )
    cancellation_reason = models.CharField(max_length=500, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=(
                    models.Q(commercial_sale__isnull=False, artisan_operation__isnull=True)
                    | models.Q(commercial_sale__isnull=True, artisan_operation__isnull=False)
                ),
                name="fiscal_preparation_exactly_one_origin",
            ),
            models.CheckConstraint(
                condition=models.Q(state__in=[state.value for state in PreparationState]),
                name="fiscal_preparation_state_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(version__gte=1, source_version__gte=1),
                name="fiscal_preparation_versions_positive",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        state=PreparationState.DRAFT,
                        prepared_at__isnull=True,
                        prepared_by__isnull=True,
                        cancelled_at__isnull=True,
                        cancelled_by__isnull=True,
                        cancellation_reason="",
                        snapshot__isnull=True,
                    )
                    | models.Q(
                        state=PreparationState.PREPARED,
                        prepared_at__isnull=False,
                        prepared_by__isnull=False,
                        cancelled_at__isnull=True,
                        cancelled_by__isnull=True,
                        cancellation_reason="",
                        snapshot__has_key="schema_version",
                    )
                    | (
                        models.Q(
                            state=PreparationState.CANCELLED,
                            cancelled_at__isnull=False,
                            cancelled_by__isnull=False,
                            cancellation_reason__regex=r"\S",
                        )
                        & (
                            models.Q(prepared_at__isnull=True, prepared_by__isnull=True)
                            | models.Q(prepared_at__isnull=False, prepared_by__isnull=False)
                        )
                    )
                ),
                name="fiscal_preparation_state_fields_coherent",
            ),
            models.UniqueConstraint(
                fields=["commercial_sale"],
                condition=models.Q(
                    commercial_sale__isnull=False,
                    state__in=[PreparationState.DRAFT, PreparationState.PREPARED],
                ),
                name="fiscal_preparation_active_sale_unique",
            ),
            models.UniqueConstraint(
                fields=["artisan_operation"],
                condition=models.Q(
                    artisan_operation__isnull=False,
                    state__in=[PreparationState.DRAFT, PreparationState.PREPARED],
                ),
                name="fiscal_preparation_active_artisan_unique",
            ),
        ]
        ordering: ClassVar[list[str]] = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.id}:{self.state}"


class FiscalPreparationHistory(models.Model):
    preparation = models.ForeignKey(
        FiscalPreparation, on_delete=models.PROTECT, related_name="history"
    )
    sequence = models.PositiveBigIntegerField()
    event = models.CharField(max_length=32)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    metadata = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["preparation", "sequence"], name="fiscal_history_sequence_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(sequence__gte=1), name="fiscal_history_sequence_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(event__regex=r"^[A-Z][A-Z0-9_]{0,31}$"),
                name="fiscal_history_event_valid",
            ),
        ]
        ordering: ClassVar[list[str]] = ["preparation_id", "sequence"]

    def __str__(self) -> str:
        return f"{self.preparation_id}#{self.sequence}:{self.event}"


class FiscalCommandReceipt(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    action = models.CharField(max_length=64)
    idempotency_key = models.CharField(max_length=128)
    input_fingerprint = models.CharField(max_length=64)
    response_status = models.PositiveSmallIntegerField(null=True, blank=True)
    result_preparation = models.ForeignKey(
        FiscalPreparation, on_delete=models.PROTECT, related_name="+", null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["actor", "action", "idempotency_key"],
                name="fiscal_command_identity_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(idempotency_key__regex=r"^[A-Za-z0-9._:-]{8,128}$"),
                name="fiscal_command_key_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(input_fingerprint__regex=r"^[0-9a-f]{64}$"),
                name="fiscal_command_fingerprint_valid",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(response_status__isnull=True)
                    | models.Q(response_status__gte=100, response_status__lte=599)
                ),
                name="fiscal_command_status_valid",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.action}:{self.idempotency_key}"
