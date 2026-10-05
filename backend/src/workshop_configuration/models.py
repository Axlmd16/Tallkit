from typing import ClassVar

from django.conf import settings
from django.db import models

from workshop_configuration.domain.validation import (
    MAX_SEQUENCE_VALUE,
    DocumentType,
    FiscalEntityType,
)


class WorkshopConfiguration(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    is_initialized = models.BooleanField(default=False)
    initialized_at = models.DateTimeField(null=True, blank=True, default=None)
    version = models.PositiveBigIntegerField(default=1)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(id=1),
                name="workshop_configuration_singleton",
            ),
        ]

    def __str__(self) -> str:
        status = "inicializada" if self.is_initialized else "pendiente"
        return f"Configuración del taller ({status})"


class FiscalEntity(models.Model):
    entity_type = models.CharField(
        max_length=16,
        unique=True,
        choices=[(entity_type.value, entity_type.value) for entity_type in FiscalEntityType],
    )
    ruc = models.CharField(max_length=13, unique=True)
    legal_name = models.CharField(max_length=200)
    trade_name = models.CharField(  # noqa: DJ001
        max_length=200, null=True, blank=True, default=None
    )
    address = models.CharField(  # noqa: DJ001
        max_length=300, null=True, blank=True, default=None
    )
    phone = models.CharField(  # noqa: DJ001
        max_length=32, null=True, blank=True, default=None
    )
    email = models.EmailField(  # noqa: DJ001
        max_length=254, null=True, blank=True, default=None
    )
    version = models.PositiveBigIntegerField(default=1)
    # Contador de revisiones del logotipo; no altera `version` ni versiona el logotipo.
    logo_revision = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(
                    entity_type__in=[
                        FiscalEntityType.COMERCIAL.value,
                        FiscalEntityType.ARTESANAL.value,
                    ]
                ),
                name="fiscal_entity_type_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(ruc__regex=r"^[0-9]{13}$"),
                name="fiscal_entity_ruc_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(legal_name__regex=r"\S"),
                name="fiscal_entity_legal_name_not_blank",
            ),
        ]
        ordering: ClassVar[list[str]] = ["entity_type", "id"]

    def __str__(self) -> str:
        return f"{self.entity_type}: {self.legal_name}"


class Warehouse(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    version = models.PositiveBigIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(id=1),
                name="warehouse_singleton",
            ),
            models.CheckConstraint(
                condition=models.Q(is_active=True),
                name="warehouse_always_active",
            ),
            models.CheckConstraint(
                condition=models.Q(name__regex=r"\S"),
                name="warehouse_name_not_blank",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class TaxDefinition(models.Model):
    fiscal_entity = models.ForeignKey(
        FiscalEntity,
        on_delete=models.PROTECT,
        related_name="tax_definitions",
    )
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=120)
    version = models.PositiveBigIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["fiscal_entity", "code"],
                name="tax_definition_entity_code_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(code__regex=r"^[A-Z][A-Z0-9_-]{0,19}$"),
                name="tax_definition_code_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(name__regex=r"\S"),
                name="tax_definition_name_not_blank",
            ),
        ]
        ordering: ClassVar[list[str]] = ["fiscal_entity_id", "code", "id"]

    def __str__(self) -> str:
        return f"{self.fiscal_entity.entity_type}: {self.code}"


class TaxPeriod(models.Model):
    tax_definition = models.ForeignKey(
        TaxDefinition,
        on_delete=models.PROTECT,
        related_name="periods",
    )
    rate = models.DecimalField(max_digits=7, decimal_places=4)
    starts_on = models.DateField()
    ends_on = models.DateField(null=True, blank=True, default=None)
    version = models.PositiveBigIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(rate__gte=0, rate__lte=100),
                name="tax_period_rate_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(ends_on__isnull=True)
                | models.Q(ends_on__gte=models.F("starts_on")),
                name="tax_period_interval_valid",
            ),
        ]
        ordering: ClassVar[list[str]] = ["tax_definition_id", "starts_on", "id"]

    def __str__(self) -> str:
        return f"{self.tax_definition.code} {self.rate}% desde {self.starts_on.isoformat()}"


class ConfigurationUse(models.Model):
    tax_period = models.ForeignKey(
        TaxPeriod,
        on_delete=models.PROTECT,
        related_name="configuration_uses",
    )
    consumer_type = models.CharField(max_length=64)
    consumer_id = models.CharField(max_length=128)
    operation_date = models.DateField()
    entity_type_snapshot = models.CharField(max_length=16)
    ruc_snapshot = models.CharField(max_length=13)
    legal_name_snapshot = models.CharField(max_length=200)
    tax_code_snapshot = models.CharField(max_length=20)
    tax_name_snapshot = models.CharField(max_length=120)
    rate_snapshot = models.DecimalField(max_digits=7, decimal_places=4)
    period_start_snapshot = models.DateField()
    period_end_snapshot = models.DateField(null=True, blank=True, default=None)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["consumer_type", "consumer_id", "tax_code_snapshot"],
                name="configuration_use_consumer_tax_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    entity_type_snapshot__in=[
                        FiscalEntityType.COMERCIAL.value,
                        FiscalEntityType.ARTESANAL.value,
                    ]
                ),
                name="configuration_use_entity_type_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(ruc_snapshot__regex=r"^[0-9]{13}$"),
                name="configuration_use_ruc_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(rate_snapshot__gte=0, rate_snapshot__lte=100),
                name="configuration_use_rate_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(period_end_snapshot__isnull=True)
                | models.Q(period_end_snapshot__gte=models.F("period_start_snapshot")),
                name="configuration_use_interval_valid",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(
                fields=["consumer_type", "consumer_id"],
                name="configuration_use_consumer_idx",
            ),
            models.Index(
                fields=["tax_period", "operation_date"],
                name="config_use_period_date_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.consumer_type}:{self.consumer_id} ({self.tax_code_snapshot})"


class NumberingScope(models.Model):
    fiscal_entity = models.ForeignKey(
        FiscalEntity,
        on_delete=models.PROTECT,
        related_name="numbering_scopes",
    )
    document_type = models.CharField(
        max_length=16,
        choices=[(document_type.value, document_type.value) for document_type in DocumentType],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["fiscal_entity", "document_type"],
                name="numbering_scope_entity_doc_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    document_type__in=[document_type.value for document_type in DocumentType]
                ),
                name="numbering_scope_doc_type_valid",
            ),
        ]
        ordering: ClassVar[list[str]] = ["fiscal_entity_id", "document_type", "id"]

    def __str__(self) -> str:
        return f"{self.fiscal_entity.entity_type}: {self.document_type}"


class DocumentSeries(models.Model):
    numbering_scope = models.ForeignKey(
        NumberingScope,
        on_delete=models.PROTECT,
        related_name="series",
    )
    code = models.CharField(max_length=20, unique=True)
    is_active = models.BooleanField(default=True)
    last_number = models.PositiveBigIntegerField(default=0)
    version = models.PositiveBigIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["numbering_scope"],
                condition=models.Q(is_active=True),
                name="document_series_one_active_scope",
            ),
            models.CheckConstraint(
                condition=models.Q(code__regex=r"^[A-Z][A-Z0-9-]{2,19}$"),
                name="document_series_code_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(last_number__lte=MAX_SEQUENCE_VALUE),
                name="document_series_counter_valid",
            ),
        ]
        ordering: ClassVar[list[str]] = ["numbering_scope_id", "-is_active", "id"]

    def __str__(self) -> str:
        return self.code


class NumberAllocation(models.Model):
    numbering_scope = models.ForeignKey(
        NumberingScope,
        on_delete=models.PROTECT,
        related_name="allocations",
    )
    series = models.ForeignKey(
        DocumentSeries,
        on_delete=models.PROTECT,
        related_name="allocations",
    )
    number = models.PositiveBigIntegerField()
    consumer_type = models.CharField(max_length=64)
    consumer_id = models.CharField(max_length=128)
    request_key = models.CharField(max_length=128)
    request_fingerprint = models.CharField(max_length=64)
    visible_number = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["series", "number"],
                name="number_allocation_series_number_unique",
            ),
            models.UniqueConstraint(
                fields=["numbering_scope", "consumer_type", "consumer_id"],
                name="number_allocation_scope_document_unique",
            ),
            models.UniqueConstraint(
                fields=["numbering_scope", "request_key"],
                name="number_allocation_scope_request_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(number__gte=1),
                name="number_allocation_positive_number",
            ),
            models.CheckConstraint(
                condition=models.Q(request_fingerprint__regex=r"^[0-9a-f]{64}$"),
                name="number_allocation_fingerprint_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(visible_number__regex=r"\S"),
                name="number_allocation_visible_not_blank",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(
                fields=["consumer_type", "consumer_id"],
                name="number_allocation_consumer_idx",
            ),
        ]

    def __str__(self) -> str:
        return self.visible_number


class ConfigurationCommand(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="configuration_commands",
    )
    action = models.CharField(max_length=64)
    idempotency_key = models.CharField(max_length=128)
    input_fingerprint = models.CharField(max_length=64)
    response_status = models.PositiveSmallIntegerField()
    result = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["actor", "action", "idempotency_key"],
                name="configuration_command_key_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(idempotency_key__regex=r"^[A-Za-z0-9._:-]{8,128}$"),
                name="configuration_command_key_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(input_fingerprint__regex=r"^[0-9a-f]{64}$"),
                name="configuration_command_fingerprint_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(response_status__gte=100, response_status__lte=599),
                name="configuration_command_status_valid",
            ),
        ]
        ordering: ClassVar[list[str]] = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.action}:{self.idempotency_key}"


class ElectronicProfileRevision(models.Model):
    """Revisión declarada e inmutable por servicios; no acredita habilitación SRI."""

    fiscal_entity = models.ForeignKey(
        FiscalEntity, on_delete=models.PROTECT, related_name="electronic_profiles"
    )
    revision = models.PositiveBigIntegerField()
    conditions = models.JSONField()
    # 1: condiciones en texto libre (historia, solo lectura); 2: valores cerrados.
    conditions_format = models.PositiveSmallIntegerField(default=1)
    certificate = models.JSONField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["fiscal_entity", "revision"], name="electronic_profile_revision_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(revision__gte=1), name="electronic_profile_revision_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(conditions_format__in=[1, 2]),
                name="electronic_profile_revision_format_known",
            ),
        ]
        ordering: ClassVar[list[str]] = ["fiscal_entity_id", "revision"]

    def __str__(self) -> str:
        return f"Perfil electrónico {self.fiscal_entity_id}, revisión {self.revision}"


class FiscalEstablishment(models.Model):
    fiscal_entity = models.ForeignKey(
        FiscalEntity, on_delete=models.PROTECT, related_name="establishments"
    )
    code = models.CharField(max_length=3)
    address = models.CharField(max_length=300)
    is_active = models.BooleanField(default=True)
    version = models.PositiveBigIntegerField(default=1)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["fiscal_entity", "code"], name="fiscal_establishment_code_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(code__regex=r"^[0-9]{3}$") & ~models.Q(code="000"),
                name="fiscal_establishment_code_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(address__regex=r"\S"), name="fiscal_establishment_address"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.fiscal_entity_id}:{self.code}"


class FiscalEmissionPoint(models.Model):
    establishment = models.ForeignKey(
        FiscalEstablishment, on_delete=models.PROTECT, related_name="emission_points"
    )
    code = models.CharField(max_length=3)
    is_active = models.BooleanField(default=True)
    version = models.PositiveBigIntegerField(default=1)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["establishment", "code"], name="fiscal_point_code_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(code__regex=r"^[0-9]{3}$") & ~models.Q(code="000"),
                name="fiscal_point_code_valid",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.establishment_id}:{self.code}"


class FiscalTaxMapping(models.Model):
    tax_definition = models.ForeignKey(
        TaxDefinition, on_delete=models.PROTECT, related_name="fiscal_mappings"
    )
    catalog_version = models.CharField(max_length=64)
    percentage_code = models.CharField(max_length=4)
    catalog_entry = models.ForeignKey(
        "OfficialCatalogEntry",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="tax_mappings",
    )
    starts_on = models.DateField()
    ends_on = models.DateField(null=True, blank=True)
    source = models.CharField(max_length=500)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(ends_on__isnull=True)
                | models.Q(ends_on__gte=models.F("starts_on")),
                name="fiscal_tax_mapping_interval",
            ),
            models.CheckConstraint(
                condition=models.Q(source__regex=r"\S"), name="fiscal_tax_mapping_source"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.tax_definition_id}:{self.catalog_version}:{self.percentage_code}"


class CatalogKind(models.TextChoices):
    TAX_RATE = "TAX_RATE", "Tarifa de impuesto"
    PAYMENT_FORM = "PAYMENT_FORM", "Forma de pago"


class OfficialCatalogEntry(models.Model):
    """Código oficial del SRI con su procedencia; nunca se reinterpreta en el código."""

    kind = models.CharField(max_length=16, choices=CatalogKind.choices)
    catalog_version = models.CharField(max_length=64)
    code = models.CharField(max_length=8)
    description = models.CharField(max_length=300)
    display_name = models.CharField(max_length=120)
    tax_code = models.CharField(max_length=4, null=True, blank=True)  # noqa: DJ001
    rate = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    treatment = models.CharField(max_length=16, null=True, blank=True)  # noqa: DJ001
    source_document = models.CharField(max_length=200)
    source_version = models.CharField(max_length=32)
    source_reference = models.CharField(max_length=120)
    source_url = models.URLField(max_length=500)
    downloaded_on = models.DateField()
    source_file_sha256 = models.CharField(max_length=64)
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    validity_note = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True)
    is_selectable = models.BooleanField(default=True)
    incorporated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["kind", "catalog_version", "code"], name="official_catalog_code_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(kind__in=[choice.value for choice in CatalogKind]),
                name="official_catalog_kind_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(valid_to__isnull=True)
                | models.Q(valid_from__isnull=True)
                | models.Q(valid_to__gte=models.F("valid_from")),
                name="official_catalog_interval",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(kind="TAX_RATE")
                    & models.Q(rate__isnull=False)
                    & models.Q(treatment__isnull=False)
                    & models.Q(tax_code__isnull=False)
                )
                | (
                    models.Q(kind="PAYMENT_FORM")
                    & models.Q(rate__isnull=True)
                    & models.Q(treatment__isnull=True)
                    & models.Q(tax_code__isnull=True)
                ),
                name="official_catalog_tax_fields",
            ),
            models.CheckConstraint(
                condition=models.Q(source_version__regex=r"\S")
                & models.Q(source_url__regex=r"\S")
                & models.Q(source_file_sha256__regex=r"^[0-9a-f]{64}$")
                & models.Q(description__regex=r"\S")
                & models.Q(display_name__regex=r"\S"),
                name="official_catalog_provenance",
            ),
        ]
        ordering: ClassVar[list[str]] = ["kind", "catalog_version", "code"]

    def __str__(self) -> str:
        return f"{self.kind}:{self.catalog_version}:{self.code}"


class FiscalPaymentFormSetting(models.Model):
    """Decisión explícita del Administrador; sin registro aplica la política V1."""

    fiscal_entity = models.ForeignKey(
        FiscalEntity, on_delete=models.PROTECT, related_name="payment_form_settings"
    )
    code = models.CharField(max_length=8)
    enabled = models.BooleanField()
    version = models.PositiveBigIntegerField(default=1)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["fiscal_entity", "code"], name="fiscal_payment_form_setting_unique"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.fiscal_entity_id}:{self.code}:{self.enabled}"


class FiscalPreparationDefaults(models.Model):
    """Punto y forma de pago predeterminados de una entidad para preparar."""

    fiscal_entity = models.OneToOneField(
        FiscalEntity, on_delete=models.PROTECT, related_name="preparation_defaults"
    )
    default_point = models.ForeignKey(
        FiscalEmissionPoint,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    default_payment_code = models.CharField(  # noqa: DJ001
        max_length=8, null=True, blank=True, default=None
    )
    version = models.PositiveBigIntegerField(default=1)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Predeterminados {self.fiscal_entity_id}"


class FiscalEntityLogo(models.Model):
    """Logotipo vigente de una entidad fiscal; la fila existe solo mientras hay logotipo."""

    fiscal_entity = models.OneToOneField(
        FiscalEntity, on_delete=models.PROTECT, related_name="logo"
    )
    storage_name = models.CharField(max_length=255, unique=True)
    content_type = models.CharField(max_length=32)
    extension = models.CharField(max_length=8)
    size_bytes = models.PositiveIntegerField()
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    revision = models.PositiveBigIntegerField()
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(content_type__in=["image/png", "image/jpeg", "image/webp"]),
                name="fiscal_entity_logo_content_type_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(revision__gte=1),
                name="fiscal_entity_logo_revision_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"Logo {self.fiscal_entity_id} r{self.revision}"
