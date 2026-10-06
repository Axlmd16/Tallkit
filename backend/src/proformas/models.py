"""Persistencia de proformas comerciales: oferta, líneas, recibos y marca histórica.

La proforma es una raíz distinta de la venta: no guarda pagos, saldos, condición de venta ni
reservas. Las FK hacia clientes, catálogo, configuración e identidad usan ``PROTECT`` y
``related_name="+"``. VIGENTE y VENCIDA no se almacenan: se proyectan desde ``ISSUED`` y
``valid_until``. El vínculo con la venta generada pertenece a ventas; aquí no se duplica.
"""

from typing import Any, ClassVar

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Floor

SNAPSHOT_SCHEMA_VERSION = 1
BRAND_ASSET_MAX_BYTES = 2 * 1024 * 1024
BRAND_ASSET_MIME_TYPES = ("image/png", "image/jpeg", "image/webp")


def validate_snapshot(value: Any) -> None:
    """Un snapshot es un objeto con la clave de versión soportada."""
    if not isinstance(value, dict) or value.get("schema_version") != SNAPSHOT_SCHEMA_VERSION:
        raise ValidationError("El snapshot debe incluir schema_version válido.")


class ProformaStateChoice(models.TextChoices):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    CONVERTED = "CONVERTED"
    VOIDED = "VOIDED"


def _snapshot_ok(field: str) -> models.Q:
    return models.Q(**{f"{field}__isnull": True}) | models.Q(
        **{f"{field}__has_key": "schema_version"}
    )


def _user_fk(**extra: Any) -> models.ForeignKey[Any, Any]:
    return models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", **extra
    )


_EMITTED_FIELDS = (
    "internal_number",
    "issue_date",
    "valid_until",
    "issued_at",
    "issued_by",
    "base_total",
    "tax_total",
    "grand_total",
    "header_snapshot",
)


def _emitted(present: bool) -> models.Q:
    return models.Q(**{f"{name}__isnull": not present for name in _EMITTED_FIELDS})


class ProformaBrandAsset(models.Model):
    """Bytes normalizados del logo del emisor al emitir; inmutables y deduplicados por hash."""

    content = models.BinaryField()
    mime_type = models.CharField(max_length=32)
    size = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(size__gt=0, size__lte=BRAND_ASSET_MAX_BYTES),
                name="pro_brand_size_bounded",
            ),
            models.CheckConstraint(
                condition=models.Q(mime_type__in=BRAND_ASSET_MIME_TYPES),
                name="pro_brand_mime_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(sha256__regex=r"^[0-9a-f]{64}$"), name="pro_brand_hash_format"
            ),
        ]

    def __str__(self) -> str:
        return self.sha256[:12]


class Proforma(models.Model):
    """Oferta comercial: borrador → emitida → convertida o anulada."""

    # Opcional: se puede cotizar a quien no está registrado. La venta sí exige cliente.
    customer = models.ForeignKey(
        "customer_registry.Customer",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    fiscal_entity = models.ForeignKey(
        "workshop_configuration.FiscalEntity", on_delete=models.PROTECT, related_name="+"
    )
    origin = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="derived"
    )
    state = models.CharField(
        max_length=10, choices=ProformaStateChoice.choices, default=ProformaStateChoice.DRAFT
    )
    version = models.PositiveBigIntegerField(default=1)
    # En borrador: fecha elegida o ``None`` para la vigencia predeterminada (emisión + 7 días).
    valid_until = models.DateField(null=True, blank=True)
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    issue_date = models.DateField(null=True, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    issued_by = _user_fk(null=True, blank=True)
    internal_number = models.CharField(max_length=64, null=True, blank=True)  # noqa: DJ001
    number_allocation = models.ForeignKey(
        "workshop_configuration.NumberAllocation",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    base_total = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    tax_total = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    grand_total = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    header_snapshot = models.JSONField(null=True, blank=True, validators=[validate_snapshot])
    brand_asset = models.ForeignKey(
        ProformaBrandAsset, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    applied_review = models.CharField(max_length=64, blank=True, default="")

    converted_at = models.DateTimeField(null=True, blank=True)
    converted_by = _user_fk(null=True, blank=True)
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = _user_fk(null=True, blank=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(state__in=[v for v, _ in ProformaStateChoice.choices]),
                name="pro_proforma_state_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(version__gte=1), name="pro_proforma_version_positive"
            ),
            models.UniqueConstraint(
                fields=["internal_number"],
                condition=models.Q(internal_number__isnull=False),
                name="pro_proforma_number_unique",
            ),
            # Un borrador, también el anulado sin emitir, no tiene número ni historia emitida.
            models.CheckConstraint(
                condition=(
                    models.Q(state=ProformaStateChoice.DRAFT, internal_number__isnull=True)
                    | (
                        models.Q(
                            state__in=[ProformaStateChoice.ISSUED, ProformaStateChoice.CONVERTED]
                        )
                        & _emitted(True)
                    )
                    | (
                        models.Q(state=ProformaStateChoice.VOIDED)
                        & (_emitted(True) | models.Q(internal_number__isnull=True))
                    )
                ),
                name="pro_proforma_emitted_complete",
            ),
            models.CheckConstraint(
                condition=models.Q(issue_date__isnull=True)
                | models.Q(
                    valid_until__gte=models.F("issue_date"),
                    base_total__gte=0,
                    tax_total__gte=0,
                    grand_total__gte=0,
                ),
                name="pro_proforma_emitted_coherent",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        state=ProformaStateChoice.CONVERTED,
                        converted_at__isnull=False,
                        converted_by__isnull=False,
                    )
                    | (
                        ~models.Q(state=ProformaStateChoice.CONVERTED)
                        & models.Q(converted_at__isnull=True, converted_by__isnull=True)
                    )
                ),
                name="pro_proforma_conversion_complete",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        state=ProformaStateChoice.VOIDED,
                        voided_at__isnull=False,
                        voided_by__isnull=False,
                    )
                    | (
                        ~models.Q(state=ProformaStateChoice.VOIDED)
                        & models.Q(voided_at__isnull=True, voided_by__isnull=True)
                    )
                ),
                name="pro_proforma_void_complete",
            ),
            models.CheckConstraint(
                condition=_snapshot_ok("header_snapshot"), name="pro_proforma_snapshot_versioned"
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["customer", "created_at", "id"], name="pro_proforma_customer_idx"),
            models.Index(fields=["state", "valid_until", "id"], name="pro_proforma_state_idx"),
            models.Index(fields=["origin"], name="pro_proforma_origin_idx"),
        ]

    def __str__(self) -> str:
        return self.internal_number or f"Borrador {self.pk}"


class ProformaLine(models.Model):
    proforma = models.ForeignKey(Proforma, on_delete=models.PROTECT, related_name="lines")
    position = models.PositiveIntegerField()
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="+")
    quantity = models.DecimalField(max_digits=18, decimal_places=6)

    product_snapshot = models.JSONField(null=True, blank=True, validators=[validate_snapshot])
    tax_snapshot = models.JSONField(null=True, blank=True, validators=[validate_snapshot])
    unit_price = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    tax_rate = models.DecimalField(max_digits=9, decimal_places=4, null=True, blank=True)
    base_amount = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    # Disponibilidad informativa observada al emitir; nunca es una reserva.
    availability_at_issue = models.DecimalField(
        max_digits=18, decimal_places=6, null=True, blank=True
    )

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["proforma", "position"], name="pro_line_position_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="pro_line_quantity_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity=Floor("quantity")), name="pro_line_quantity_whole"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        unit_price__isnull=True,
                        tax_rate__isnull=True,
                        base_amount__isnull=True,
                        tax_amount__isnull=True,
                        total_amount__isnull=True,
                        availability_at_issue__isnull=True,
                        product_snapshot__isnull=True,
                        tax_snapshot__isnull=True,
                    )
                    | models.Q(
                        unit_price__gte=0,
                        tax_rate__gte=0,
                        base_amount__gte=0,
                        tax_amount__gte=0,
                        total_amount__gte=0,
                        availability_at_issue__isnull=False,
                        product_snapshot__isnull=False,
                        tax_snapshot__isnull=False,
                    )
                ),
                name="pro_line_amounts_coherent",
            ),
            models.CheckConstraint(
                condition=_snapshot_ok("product_snapshot") & _snapshot_ok("tax_snapshot"),
                name="pro_line_snapshot_versioned",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["product", "proforma"], name="pro_line_product_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.proforma_id}:{self.position}"


class ProformaCommand(models.Model):
    """Recibo idempotente interno; conserva la identidad del resultado, no su contenido."""

    actor = _user_fk()
    action = models.CharField(max_length=64)
    idempotency_key = models.CharField(max_length=128)
    input_fingerprint = models.CharField(max_length=64)
    result_kind = models.CharField(max_length=32, blank=True, default="")
    result_id = models.PositiveBigIntegerField(null=True)
    response_status = models.PositiveSmallIntegerField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["actor", "action", "idempotency_key"], name="pro_command_key_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(idempotency_key__regex=r"^[A-Za-z0-9._:-]{8,128}$"),
                name="pro_command_key_format",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.action}:{self.idempotency_key}"
