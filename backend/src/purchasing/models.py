"""Persistencia de compras: identidad documental externa, ingresos, líneas y recibos.

Las FK hacia proveedor, catálogo, configuración, inventario e identidad usan ``PROTECT`` y
``related_name="+"`` para no añadir campos inversos a contratos ajenos. Inventario nunca
referencia compras. Los snapshots históricos son JSON con clave ``schema_version``.
"""

from typing import Any, ClassVar

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Floor

SNAPSHOT_SCHEMA_VERSION = 1


def validate_snapshot(value: Any) -> None:
    """Un snapshot es un objeto con la clave de versión soportada."""
    if not isinstance(value, dict) or value.get("schema_version") != SNAPSHOT_SCHEMA_VERSION:
        raise ValidationError("El snapshot debe incluir schema_version válido.")


class DocumentType(models.TextChoices):
    FACTURA = "FACTURA"
    NOTA_DE_VENTA = "NOTA_DE_VENTA"
    OTRO = "OTRO"
    SIN_DOCUMENTO = "SIN_DOCUMENTO"


class PurchaseState(models.TextChoices):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    VOIDED = "VOIDED"


class TaxTreatment(models.TextChoices):
    RECOVERABLE = "RECOVERABLE"
    NON_RECOVERABLE = "NON_RECOVERABLE"


def _in(field: str, choices: type[models.TextChoices]) -> models.Q:
    return models.Q(**{f"{field}__in": [value for value, _ in choices.choices]})


def _snapshot_ok(field: str) -> models.Q:
    return models.Q(**{f"{field}__isnull": True}) | models.Q(
        **{f"{field}__has_key": "schema_version"}
    )


class PurchaseDocumentIdentity(models.Model):
    """Identidad externa del documento; se conserva a lo largo de toda una cadena."""

    supplier = models.ForeignKey(
        "supplier_registry.Supplier", on_delete=models.PROTECT, related_name="+"
    )
    document_type = models.CharField(max_length=16, choices=DocumentType.choices)
    reference = models.CharField(max_length=128, blank=True, default="")
    normalized_reference = models.CharField(max_length=128, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=_in("document_type", DocumentType), name="pur_identity_type_valid"
            ),
            models.UniqueConstraint(
                fields=["supplier", "document_type", "normalized_reference"],
                condition=~models.Q(document_type=DocumentType.SIN_DOCUMENTO),
                name="pur_identity_external_unique",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        document_type=DocumentType.SIN_DOCUMENTO,
                        reference="",
                        normalized_reference="",
                    )
                    | (
                        ~models.Q(document_type=DocumentType.SIN_DOCUMENTO)
                        & models.Q(normalized_reference__regex=r"\S")
                    )
                ),
                name="pur_identity_reference_coherent",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.document_type} {self.normalized_reference}".strip()


class Purchase(models.Model):
    """Ingreso de mercadería: borrador → confirmado → anulado."""

    document_identity = models.ForeignKey(
        PurchaseDocumentIdentity, on_delete=models.PROTECT, related_name="purchases"
    )
    document_date = models.DateField()
    observation = models.CharField(max_length=2000, blank=True, default="")
    no_document_explanation = models.CharField(max_length=500, blank=True, default="")
    state = models.CharField(
        max_length=10, choices=PurchaseState.choices, default=PurchaseState.DRAFT
    )
    version = models.PositiveBigIntegerField(default=1)
    replaces = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="replacements"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    base_total = models.DecimalField(max_digits=38, decimal_places=2, null=True, blank=True)
    tax_total = models.DecimalField(max_digits=38, decimal_places=2, null=True, blank=True)
    grand_total = models.DecimalField(max_digits=38, decimal_places=2, null=True, blank=True)
    inventory_value_total = models.DecimalField(
        max_digits=38, decimal_places=2, null=True, blank=True
    )
    supplier_snapshot = models.JSONField(null=True, blank=True, validators=[validate_snapshot])
    fiscal_snapshot = models.JSONField(null=True, blank=True, validators=[validate_snapshot])

    internal_number = models.CharField(max_length=64, null=True, blank=True)  # noqa: DJ001
    number_allocation = models.ForeignKey(
        "workshop_configuration.NumberAllocation",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    inventory_operation = models.ForeignKey(
        "inventory.InventoryOperation",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    confirmation_fingerprint = models.CharField(max_length=64, blank=True, default="")
    applied_review = models.CharField(max_length=64, blank=True, default="")
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    void_reason = models.CharField(max_length=500, blank=True, default="")
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    void_operation = models.ForeignKey(
        "inventory.InventoryOperation",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=_in("state", PurchaseState), name="pur_purchase_state_valid"
            ),
            models.CheckConstraint(
                condition=models.Q(version__gte=1), name="pur_purchase_version_positive"
            ),
            models.UniqueConstraint(
                fields=["document_identity"],
                condition=models.Q(state=PurchaseState.CONFIRMED),
                name="pur_purchase_one_confirmed_per_identity",
            ),
            models.UniqueConstraint(
                fields=["document_identity"],
                condition=models.Q(replaces__isnull=True),
                name="pur_purchase_one_root_per_identity",
            ),
            models.UniqueConstraint(
                fields=["internal_number"],
                condition=models.Q(internal_number__isnull=False),
                name="pur_purchase_internal_number_unique",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(state=PurchaseState.DRAFT, internal_number__isnull=True)
                    | (
                        ~models.Q(state=PurchaseState.DRAFT)
                        & models.Q(internal_number__isnull=False)
                    )
                ),
                name="pur_purchase_number_matches_state",
            ),
            models.CheckConstraint(
                condition=_snapshot_ok("supplier_snapshot") & _snapshot_ok("fiscal_snapshot"),
                name="pur_purchase_snapshot_versioned",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(
                fields=["state", "document_date", "id"], name="pur_purchase_state_date_idx"
            ),
            models.Index(fields=["document_identity", "id"], name="pur_purchase_identity_idx"),
            models.Index(fields=["document_date", "id"], name="pur_purchase_date_idx"),
        ]

    def __str__(self) -> str:
        return self.internal_number or f"Borrador {self.pk}"


class PurchaseLine(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.PROTECT, related_name="lines")
    position = models.PositiveIntegerField()
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="+")
    quantity = models.DecimalField(max_digits=18, decimal_places=6)
    unit_cost = models.DecimalField(max_digits=24, decimal_places=6)
    tax_definition = models.ForeignKey(
        "workshop_configuration.TaxDefinition", on_delete=models.PROTECT, related_name="+"
    )
    tax_treatment = models.CharField(max_length=16, choices=TaxTreatment.choices)
    product_snapshot = models.JSONField(null=True, blank=True, validators=[validate_snapshot])
    tax_snapshot = models.JSONField(null=True, blank=True, validators=[validate_snapshot])
    base_amount = models.DecimalField(max_digits=38, decimal_places=2, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=38, decimal_places=2, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=38, decimal_places=2, null=True, blank=True)
    inventory_value = models.DecimalField(max_digits=38, decimal_places=2, null=True, blank=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["purchase", "position"], name="pur_line_purchase_position_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="pur_line_quantity_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity=Floor("quantity")), name="pur_line_quantity_whole"
            ),
            models.CheckConstraint(
                condition=models.Q(unit_cost__gte=0), name="pur_line_cost_not_negative"
            ),
            models.CheckConstraint(
                condition=_in("tax_treatment", TaxTreatment), name="pur_line_treatment_valid"
            ),
            models.CheckConstraint(
                condition=_snapshot_ok("product_snapshot") & _snapshot_ok("tax_snapshot"),
                name="pur_line_snapshot_versioned",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["product", "purchase"], name="pur_line_product_purchase_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.purchase_id}:{self.position}"


class PurchaseCommand(models.Model):
    """Recibo idempotente interno; sin endpoint público ni purga automática."""

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    action = models.CharField(max_length=64)
    idempotency_key = models.CharField(max_length=128)
    input_fingerprint = models.CharField(max_length=64)
    response_status = models.PositiveSmallIntegerField(null=True)
    result = models.JSONField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["actor", "action", "idempotency_key"], name="pur_command_key_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(idempotency_key__regex=r"^[A-Za-z0-9._:-]{8,128}$"),
                name="pur_command_key_format",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.action}:{self.idempotency_key}"
