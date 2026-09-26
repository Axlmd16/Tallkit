"""Persistencia propia del módulo fiscal; no representa autorización del SRI."""

import uuid
from typing import Any, ClassVar, NoReturn

from django.conf import settings
from django.db import models

from fiscal.domain.states import PreparationState


class FiscalArchiveImmutableError(RuntimeError):
    pass


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


SEQUENTIAL_MAX = 999_999_999


class FiscalNumberingScope(models.Model):
    """Ámbito de numeración fiscal propio; su contador no reinicia ni se reutiliza."""

    fiscal_entity = models.ForeignKey(
        "workshop_configuration.FiscalEntity", on_delete=models.PROTECT, related_name="+"
    )
    document_type = models.CharField(max_length=2)
    establishment_code = models.CharField(max_length=3)
    emission_point_code = models.CharField(max_length=3)
    environment = models.CharField(max_length=1)
    last_sequential = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=[
                    "fiscal_entity",
                    "document_type",
                    "establishment_code",
                    "emission_point_code",
                    "environment",
                ],
                name="fiscal_numbering_scope_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(document_type__in=["01", "04"]),
                name="fiscal_numbering_scope_doc_type_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(environment__in=["1", "2"]),
                name="fiscal_numbering_scope_environment_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(last_sequential__lte=SEQUENTIAL_MAX),
                name="fiscal_numbering_scope_counter_valid",
            ),
        ]

    def __str__(self) -> str:
        serie = f"{self.establishment_code}-{self.emission_point_code}"
        return f"{self.fiscal_entity_id}:{self.document_type}:{serie}:{self.environment}"


class FiscalDocumentIdentity(models.Model):
    """Identidad fiscal de ensayo asignada; inmutable y no reutilizable."""

    preparation = models.OneToOneField(
        FiscalPreparation, on_delete=models.PROTECT, related_name="identity"
    )
    numbering_scope = models.ForeignKey(
        FiscalNumberingScope, on_delete=models.PROTECT, related_name="identities"
    )
    document_type = models.CharField(max_length=2)
    environment = models.CharField(max_length=1)
    ruc = models.CharField(max_length=13)
    sequential = models.PositiveBigIntegerField()
    numeric_code = models.CharField(max_length=8)
    emission_date = models.DateField()
    access_key = models.CharField(max_length=49, unique=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["numbering_scope", "sequential"],
                name="fiscal_identity_scope_sequential_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(sequential__gte=1, sequential__lte=SEQUENTIAL_MAX),
                name="fiscal_identity_sequential_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(access_key__regex=r"^[0-9]{49}$"),
                name="fiscal_identity_access_key_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(numeric_code__regex=r"^[0-9]{8}$"),
                name="fiscal_identity_numeric_code_valid",
            ),
        ]

    def __str__(self) -> str:
        return self.access_key


class FiscalNumberingAntecedent(models.Model):
    """Antecedente de numeración externa declarado; no es un contador verificado."""

    fiscal_entity = models.ForeignKey(
        "workshop_configuration.FiscalEntity", on_delete=models.PROTECT, related_name="+"
    )
    document_type = models.CharField(max_length=2)
    establishment_code = models.CharField(max_length=3)
    emission_point_code = models.CharField(max_length=3)
    environment = models.CharField(max_length=1)
    last_declared_number = models.PositiveBigIntegerField()
    declared_on = models.DateField()
    source = models.CharField(max_length=500)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(
                    last_declared_number__gte=1, last_declared_number__lte=SEQUENTIAL_MAX
                ),
                name="fiscal_antecedent_number_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(source__regex=r"\S"),
                name="fiscal_antecedent_source_not_blank",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.fiscal_entity_id}:{self.document_type}:{self.last_declared_number}"


class FiscalXmlDossier(models.Model):
    """Identidad y metadatos consultables de un comprobante externo conservado."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fiscal_entity = models.ForeignKey(
        "workshop_configuration.FiscalEntity", on_delete=models.PROTECT, related_name="+"
    )
    document_type = models.CharField(max_length=2)
    schema_version = models.CharField(max_length=16)
    environment = models.CharField(max_length=1)
    issuer_ruc = models.CharField(max_length=13)
    access_key = models.CharField(max_length=49, unique=True)
    establishment_code = models.CharField(max_length=3)
    emission_point_code = models.CharField(max_length=3)
    sequential = models.CharField(max_length=9)
    issue_date = models.DateField()
    total = models.DecimalField(max_digits=24, decimal_places=2)
    tax_total = models.DecimalField(max_digits=24, decimal_places=2)
    receiver_identification = models.CharField(max_length=20)
    currency = models.CharField(max_length=15)
    line_count = models.PositiveIntegerField()
    line_facts = models.JSONField(default=list)
    verification_level = models.CharField(max_length=32, default="EXTERNAL_UNVERIFIED")
    commercial_sale = models.ForeignKey(
        "sales.Sale", on_delete=models.PROTECT, related_name="fiscal_xml_dossiers", null=True
    )
    artisan_operation = models.ForeignKey(
        "workshop.ServiceOperation",
        on_delete=models.PROTECT,
        related_name="fiscal_xml_dossiers",
        null=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=[
                    "fiscal_entity",
                    "document_type",
                    "environment",
                    "establishment_code",
                    "emission_point_code",
                    "sequential",
                ],
                name="fiscal_xml_document_identity_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(document_type__in=["01", "04"]),
                name="fiscal_xml_document_type_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(environment__in=["1", "2"]),
                name="fiscal_xml_environment_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(verification_level="EXTERNAL_UNVERIFIED"),
                name="fiscal_xml_verification_level_local",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(commercial_sale__isnull=True)
                    | models.Q(artisan_operation__isnull=True)
                ),
                name="fiscal_xml_at_most_one_origin",
            ),
        ]
        ordering: ClassVar[list[str]] = ["-issue_date", "-created_at", "-id"]

    def __str__(self) -> str:
        return self.access_key


class FiscalXmlEvidence(models.Model):
    dossier = models.ForeignKey(
        FiscalXmlDossier, on_delete=models.PROTECT, related_name="evidences"
    )
    kind = models.CharField(max_length=16)
    source_label = models.CharField(max_length=500)
    declared_authorization_state = models.CharField(  # noqa: DJ001
        max_length=32, null=True, default=None
    )
    incorporated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    incorporated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(kind__in=["DOCUMENT", "WRAPPER"]),
                name="fiscal_xml_evidence_kind_valid",
            )
        ]
        ordering: ClassVar[list[str]] = ["dossier_id", "incorporated_at", "id"]

    def __str__(self) -> str:
        return f"{self.dossier_id}:{self.kind}:{self.pk}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self._state.adding:
            raise FiscalArchiveImmutableError("La evidencia fiscal no se puede editar.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> NoReturn:
        raise FiscalArchiveImmutableError("La evidencia fiscal no se puede eliminar.")


class FiscalXmlContent(models.Model):
    evidence = models.OneToOneField(
        FiscalXmlEvidence,
        primary_key=True,
        on_delete=models.PROTECT,
        related_name="stored_content",
    )
    content = models.BinaryField()
    size_bytes = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(size_bytes__gte=1, size_bytes__lte=2 * 1024 * 1024),
                name="fiscal_xml_content_size_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(sha256__regex=r"^[0-9a-f]{64}$"),
                name="fiscal_xml_content_sha256_valid",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.evidence_id}:{self.sha256}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self._state.adding:
            raise FiscalArchiveImmutableError("El contenido fiscal no se puede editar.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> NoReturn:
        raise FiscalArchiveImmutableError("El contenido fiscal no se puede eliminar.")


class FiscalXmlLinkHistory(models.Model):
    dossier = models.ForeignKey(
        FiscalXmlDossier, on_delete=models.PROTECT, related_name="link_history"
    )
    sequence = models.PositiveIntegerField()
    previous_commercial_sale = models.ForeignKey(
        "sales.Sale", on_delete=models.PROTECT, related_name="+", null=True
    )
    previous_artisan_operation = models.ForeignKey(
        "workshop.ServiceOperation", on_delete=models.PROTECT, related_name="+", null=True
    )
    commercial_sale = models.ForeignKey(
        "sales.Sale", on_delete=models.PROTECT, related_name="+", null=True
    )
    artisan_operation = models.ForeignKey(
        "workshop.ServiceOperation", on_delete=models.PROTECT, related_name="+", null=True
    )
    reason = models.CharField(max_length=500)
    discrepancies = models.JSONField(default=list)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["dossier", "sequence"], name="fiscal_xml_link_history_sequence_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(sequence__gte=1),
                name="fiscal_xml_link_history_sequence_positive",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(commercial_sale__isnull=False, artisan_operation__isnull=True)
                    | models.Q(commercial_sale__isnull=True, artisan_operation__isnull=False)
                ),
                name="fiscal_xml_link_history_one_target",
            ),
            models.CheckConstraint(
                condition=models.Q(reason__regex=r"\S"), name="fiscal_xml_link_reason_present"
            ),
        ]
        ordering: ClassVar[list[str]] = ["dossier_id", "sequence"]

    def __str__(self) -> str:
        return f"{self.dossier_id}#{self.sequence}"


class FiscalCorrectionRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_dossier = models.ForeignKey(
        FiscalXmlDossier,
        on_delete=models.PROTECT,
        related_name="correction_requests",
        null=True,
    )
    original_identity = models.ForeignKey(
        FiscalDocumentIdentity,
        on_delete=models.PROTECT,
        related_name="correction_requests",
        null=True,
    )
    evidence_dossier = models.OneToOneField(
        FiscalXmlDossier,
        on_delete=models.PROTECT,
        related_name="correction_evidence_for",
        null=True,
    )
    action = models.CharField(max_length=32)
    reason = models.CharField(max_length=500)
    reference_date = models.DateField()
    normative_version = models.CharField(max_length=100)
    facts = models.JSONField()
    evaluation = models.JSONField()
    state = models.CharField(max_length=16, default="DRAFT")
    version = models.PositiveBigIntegerField(default=1)
    affection_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    requested_base = models.DecimalField(max_digits=24, decimal_places=2)
    requested_tax = models.DecimalField(max_digits=24, decimal_places=2)
    requested_total = models.DecimalField(max_digits=24, decimal_places=2)
    reservation_retained = models.BooleanField(default=False)
    officially_executed = models.BooleanField(default=False)
    idempotency_key = models.CharField(max_length=128)
    input_fingerprint = models.CharField(max_length=64)
    replaces = models.ForeignKey(
        "self", on_delete=models.PROTECT, related_name="replacements", null=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", null=True
    )
    prepared_at = models.DateTimeField(null=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", null=True
    )
    cancelled_at = models.DateTimeField(null=True)
    cancellation_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["created_by", "idempotency_key"],
                name="fiscal_correction_idempotency_unique",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(original_dossier__isnull=False, original_identity__isnull=True)
                    | models.Q(original_dossier__isnull=True, original_identity__isnull=False)
                ),
                name="fiscal_correction_exactly_one_original",
            ),
            models.CheckConstraint(
                condition=models.Q(action__in=["ONLINE_CANCELLATION", "CREDIT_NOTE"]),
                name="fiscal_correction_action_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(state__in=["DRAFT", "PREPARED", "CANCELLED"]),
                name="fiscal_correction_state_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(reason__regex=r"\S"), name="fiscal_correction_reason_present"
            ),
            models.CheckConstraint(
                condition=models.Q(version__gte=1), name="fiscal_correction_version_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(
                    requested_base__gte=0,
                    requested_tax__gte=0,
                    requested_total__gt=0,
                ),
                name="fiscal_correction_amounts_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(officially_executed=False),
                name="fiscal_correction_never_officially_executed",
            ),
        ]
        ordering: ClassVar[list[str]] = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.action}:{self.id}:{self.state}"


class FiscalCorrectionLine(models.Model):
    request = models.ForeignKey(
        FiscalCorrectionRequest, on_delete=models.PROTECT, related_name="lines"
    )
    position = models.PositiveIntegerField()
    quantity = models.DecimalField(max_digits=18, decimal_places=6)
    base_amount = models.DecimalField(max_digits=24, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=2)
    total_amount = models.DecimalField(max_digits=24, decimal_places=2)
    tax_treatments = models.JSONField(default=list)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["request", "position"], name="fiscal_correction_line_position_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(
                    quantity__gt=0,
                    base_amount__gte=0,
                    tax_amount__gte=0,
                    total_amount__gt=0,
                ),
                name="fiscal_correction_line_amounts_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(total_amount=models.F("base_amount") + models.F("tax_amount")),
                name="fiscal_correction_line_total_coherent",
            ),
        ]
        ordering: ClassVar[list[str]] = ["request_id", "position"]

    def __str__(self) -> str:
        return f"{self.request_id}:{self.position}"


class FiscalCorrectionReconciliationHold(models.Model):
    original_dossier = models.ForeignKey(
        FiscalXmlDossier, on_delete=models.PROTECT, related_name="correction_holds"
    )
    evidence_dossier = models.OneToOneField(
        FiscalXmlDossier, on_delete=models.PROTECT, related_name="correction_hold"
    )
    reason = models.CharField(max_length=500)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", null=True
    )
    resolved_at = models.DateTimeField(null=True)
    resolution_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(reason__regex=r"\S"),
                name="fiscal_correction_hold_reason_present",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        is_active=True,
                        resolved_by__isnull=True,
                        resolved_at__isnull=True,
                        resolution_reason="",
                    )
                    | models.Q(
                        is_active=False,
                        resolved_by__isnull=False,
                        resolved_at__isnull=False,
                        resolution_reason__regex=r"\S",
                    )
                ),
                name="fiscal_correction_hold_state_coherent",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.original_dossier_id}:{self.evidence_dossier_id}:{self.is_active}"
