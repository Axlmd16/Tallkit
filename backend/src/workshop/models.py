"""Persistencia del taller: órdenes de mantenimiento, intervenciones, servicios y fotografías.

Las FK hacia clientes, catálogo, configuración e identidad usan ``PROTECT`` y
``related_name="+"`` para no añadir campos inversos a contratos ajenos. Los subtotales y
totales no se almacenan: se calculan desde las líneas. Los snapshots históricos son JSON con
clave ``schema_version``. No existe eliminación ordinaria de órdenes.
"""

from typing import Any, ClassVar

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

SNAPSHOT_SCHEMA_VERSION = 1
PHOTO_CONTENT_TYPES = ("image/jpeg", "image/png", "image/webp")


def validate_snapshot(value: Any) -> None:
    if not isinstance(value, dict) or value.get("schema_version") != SNAPSHOT_SCHEMA_VERSION:
        raise ValidationError("El snapshot debe incluir schema_version válido.")


class OrderStateChoice(models.TextChoices):
    REGISTERED = "REGISTERED"
    FINALIZED = "FINALIZED"
    REOPENED = "REOPENED"


class InterventionKindChoice(models.TextChoices):
    INITIAL = "INITIAL"
    CORRECTIVE = "CORRECTIVE"


OPEN_STATE_VALUES = [OrderStateChoice.REGISTERED.value, OrderStateChoice.REOPENED.value]


def _user_fk(**extra: Any) -> models.ForeignKey[Any, Any]:
    return models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", **extra
    )


def _not_blank(field: str, name: str) -> models.CheckConstraint:
    return models.CheckConstraint(condition=models.Q(**{f"{field}__regex": r"\S"}), name=name)


class MaintenanceCounter(models.Model):
    """Contador único del número interno ART-OT; se bloquea en la transacción de creación."""

    last_number = models.PositiveBigIntegerField(default=0)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(condition=models.Q(id=1), name="wk_counter_single_row"),
        ]

    def __str__(self) -> str:
        return f"ART-OT {self.last_number}"


class MaintenanceOrder(models.Model):
    """Mantenimiento artesanal: registrado → finalizado ↔ reabierto."""

    sequence = models.PositiveBigIntegerField(unique=True)
    number = models.CharField(max_length=32, unique=True)
    fiscal_entity = models.ForeignKey(
        "workshop_configuration.FiscalEntity", on_delete=models.PROTECT, related_name="+"
    )
    customer = models.ForeignKey(
        "customer_registry.Customer", on_delete=models.PROTECT, related_name="+"
    )
    vehicle = models.ForeignKey(
        "customer_registry.Vehicle", on_delete=models.PROTECT, related_name="+"
    )
    customer_snapshot = models.JSONField(validators=[validate_snapshot])
    vehicle_snapshot = models.JSONField(validators=[validate_snapshot])
    opened_on = models.DateField()
    odometer_km = models.PositiveIntegerField()
    odometer_confirmed_by = _user_fk(null=True, blank=True)
    odometer_confirmed_at = models.DateTimeField(null=True, blank=True)
    diagnosis = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    state = models.CharField(
        max_length=12, choices=OrderStateChoice.choices, default=OrderStateChoice.REGISTERED
    )
    version = models.PositiveBigIntegerField(default=1)
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = _user_fk()
    updated_at = models.DateTimeField(auto_now=True)
    last_finalized_at = models.DateTimeField(null=True, blank=True)
    last_finalized_by = _user_fk(null=True, blank=True)
    # Órdenes registradas antes de la documentación económica: su confirmación advierte
    # verificar cobros hechos fuera del sistema. Nunca se generan documentos por migración.
    predates_billing = models.BooleanField(default=False)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["vehicle"],
                condition=models.Q(state__in=OPEN_STATE_VALUES),
                name="wk_one_open_order_per_vehicle",
            ),
            models.CheckConstraint(
                condition=models.Q(state__in=OrderStateChoice.values), name="wk_order_state_valid"
            ),
            models.CheckConstraint(
                condition=models.Q(number__regex=r"^ART-OT-[0-9]{6,}$"),
                name="wk_order_number_format",
            ),
            models.CheckConstraint(
                condition=models.Q(odometer_km__lte=9_999_999), name="wk_order_odometer_max"
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["-opened_on", "-sequence"], name="wk_order_opened_idx"),
            models.Index(fields=["customer", "-opened_on"], name="wk_order_customer_idx"),
            models.Index(fields=["vehicle", "-opened_on"], name="wk_order_vehicle_idx"),
            models.Index(fields=["state", "-opened_on"], name="wk_order_state_idx"),
        ]

    def __str__(self) -> str:
        return self.number


class Intervention(models.Model):
    """Intervención inicial o correctiva; solo una puede estar abierta por orden."""

    order = models.ForeignKey(
        MaintenanceOrder, on_delete=models.PROTECT, related_name="interventions"
    )
    kind = models.CharField(max_length=12, choices=InterventionKindChoice.choices)
    ordinal = models.PositiveSmallIntegerField()
    cause = models.TextField(blank=True, default="")
    work_performed = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    opened_by = _user_fk()
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_by = _user_fk(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["order", "ordinal"], name="wk_intervention_ordinal_unique"
            ),
            models.UniqueConstraint(
                fields=["order"],
                condition=models.Q(kind=InterventionKindChoice.INITIAL),
                name="wk_one_initial_intervention",
            ),
            models.UniqueConstraint(
                fields=["order"],
                condition=models.Q(closed_at__isnull=True),
                name="wk_one_open_intervention",
            ),
            models.CheckConstraint(
                condition=models.Q(kind__in=InterventionKindChoice.values),
                name="wk_intervention_kind_valid",
            ),
            models.CheckConstraint(
                condition=~models.Q(kind=InterventionKindChoice.CORRECTIVE)
                | models.Q(cause__regex=r"\S"),
                name="wk_corrective_requires_cause",
            ),
        ]
        ordering: ClassVar[list[str]] = ["order_id", "ordinal"]

    def __str__(self) -> str:
        return f"{self.kind} {self.ordinal}"


class ServiceLine(models.Model):
    """Servicio aplicado con copia histórica de nombre, precio referencial e impuesto."""

    intervention = models.ForeignKey(
        Intervention, on_delete=models.PROTECT, related_name="service_lines"
    )
    service = models.ForeignKey("catalog.Service", on_delete=models.PROTECT, related_name="+")
    # Copia histórica del código del servicio; vacío solo si no pudo determinarse.
    service_code = models.CharField(max_length=25, blank=True, default="")
    service_name = models.CharField(max_length=255)
    reference_price = models.DecimalField(max_digits=14, decimal_places=2)
    applied_price = models.DecimalField(max_digits=14, decimal_places=2)
    quantity = models.PositiveIntegerField()
    tax_definition = models.ForeignKey(
        "workshop_configuration.TaxDefinition", on_delete=models.PROTECT, related_name="+"
    )
    tax_name = models.CharField(max_length=200)
    position = models.PositiveIntegerField()
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = _user_fk()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1, quantity__lte=9999),
                name="wk_line_quantity_range",
            ),
            models.CheckConstraint(
                condition=models.Q(applied_price__gte=0, reference_price__gte=0),
                name="wk_line_prices_not_negative",
            ),
            _not_blank("service_name", "wk_line_service_name_not_blank"),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["intervention", "position"], name="wk_line_position_idx"),
        ]
        ordering: ClassVar[list[str]] = ["intervention_id", "position", "id"]

    def __str__(self) -> str:
        return f"{self.service_name} x{self.quantity}"


class OrderPhoto(models.Model):
    """Fotografía privada de una intervención; el retiro conserva el registro sin archivo."""

    order = models.ForeignKey(MaintenanceOrder, on_delete=models.PROTECT, related_name="photos")
    intervention = models.ForeignKey(Intervention, on_delete=models.PROTECT, related_name="photos")
    storage_name = models.CharField(max_length=255, unique=True)
    thumbnail_name = models.CharField(max_length=255, unique=True)
    content_type = models.CharField(max_length=32)
    size_bytes = models.PositiveIntegerField()
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    description = models.CharField(max_length=200, blank=True, default="")
    uploaded_by = _user_fk()
    uploaded_at = models.DateTimeField(auto_now_add=True)
    removed_by = _user_fk(null=True, blank=True)
    removed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(content_type__in=PHOTO_CONTENT_TYPES),
                name="wk_photo_content_type_valid",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["order", "removed_at"], name="wk_photo_order_idx"),
        ]
        ordering: ClassVar[list[str]] = ["uploaded_at", "id"]

    def __str__(self) -> str:
        return self.storage_name


class StateTransition(models.Model):
    """Finalización o reapertura inmutable, con causa en la reapertura."""

    order = models.ForeignKey(
        MaintenanceOrder, on_delete=models.PROTECT, related_name="transitions"
    )
    intervention = models.ForeignKey(Intervention, on_delete=models.PROTECT, related_name="+")
    from_state = models.CharField(max_length=12, choices=OrderStateChoice.choices)
    to_state = models.CharField(max_length=12, choices=OrderStateChoice.choices)
    reason = models.TextField(blank=True, default="")
    actor = _user_fk()
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(from_state="REGISTERED", to_state="FINALIZED")
                | models.Q(from_state="REOPENED", to_state="FINALIZED")
                | models.Q(from_state="FINALIZED", to_state="REOPENED"),
                name="wk_transition_pair_valid",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["order", "occurred_at"], name="wk_transition_order_idx"),
        ]
        ordering: ClassVar[list[str]] = ["occurred_at", "id"]

    def __str__(self) -> str:
        return f"{self.from_state} → {self.to_state}"


class WorkshopCommand(models.Model):
    """Recibo idempotente interno; sin endpoint público ni purga automática."""

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
                fields=["actor", "action", "idempotency_key"], name="wk_command_key_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(idempotency_key__regex=r"^[A-Za-z0-9._:-]{8,128}$"),
                name="wk_command_key_format",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.action}:{self.idempotency_key}"


class ConditionChoice(models.TextChoices):
    CONTADO = "CONTADO"
    CREDITO = "CREDITO"


class OperationStateChoice(models.TextChoices):
    CONFIRMED = "CONFIRMED"
    VOIDED = "VOIDED"


class PaymentMethodChoice(models.TextChoices):
    EFECTIVO = "EFECTIVO"
    TRANSFERENCIA = "TRANSFERENCIA"


class ServiceOperation(models.Model):
    """Operación económica del RUC artesanal (ART-SER); nace confirmada y solo se anula.

    Documenta líneas de servicio concretas de una orden con valores congelados. No produce
    efectos de inventario. ``replaces`` conserva la cadena tras una anulación.
    """

    order = models.ForeignKey(
        MaintenanceOrder, on_delete=models.PROTECT, related_name="service_operations"
    )
    fiscal_entity = models.ForeignKey(
        "workshop_configuration.FiscalEntity", on_delete=models.PROTECT, related_name="+"
    )
    customer = models.ForeignKey(
        "customer_registry.Customer", on_delete=models.PROTECT, related_name="+"
    )
    customer_snapshot = models.JSONField(validators=[validate_snapshot])
    vehicle_snapshot = models.JSONField(validators=[validate_snapshot])
    fiscal_snapshot = models.JSONField(validators=[validate_snapshot])
    number_allocation = models.ForeignKey(
        "workshop_configuration.NumberAllocation",
        on_delete=models.PROTECT,
        related_name="+",
        null=True,
        blank=True,
    )
    internal_number = models.CharField(max_length=64, unique=True)
    condition = models.CharField(max_length=10, choices=ConditionChoice.choices)
    operational_date = models.DateField()
    base_total = models.DecimalField(max_digits=24, decimal_places=2)
    tax_total = models.DecimalField(max_digits=24, decimal_places=2)
    grand_total = models.DecimalField(max_digits=24, decimal_places=2)
    state = models.CharField(
        max_length=10, choices=OperationStateChoice.choices, default=OperationStateChoice.CONFIRMED
    )
    replaces = models.ForeignKey(
        "self", on_delete=models.PROTECT, related_name="replaced_by", null=True, blank=True
    )
    applied_review = models.CharField(max_length=64, blank=True, default="")
    void_reason = models.CharField(max_length=500, blank=True, default="")
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = _user_fk(null=True, blank=True)
    version = models.PositiveBigIntegerField(default=1)
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(state__in=OperationStateChoice.values),
                name="wk_srvop_state_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(condition__in=ConditionChoice.values),
                name="wk_srvop_condition_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(base_total__gte=0, tax_total__gte=0, grand_total__gt=0)
                & models.Q(grand_total=models.F("base_total") + models.F("tax_total")),
                name="wk_srvop_totals_consistent",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(state=OperationStateChoice.CONFIRMED, voided_at__isnull=True)
                    | models.Q(
                        state=OperationStateChoice.VOIDED,
                        voided_at__isnull=False,
                        void_reason__regex=r"\S",
                    )
                ),
                name="wk_srvop_void_consistent",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["order", "created_at"], name="wk_srvop_order_idx"),
            models.Index(fields=["customer", "state"], name="wk_srvop_customer_idx"),
            models.Index(fields=["state", "operational_date"], name="wk_srvop_state_idx"),
        ]

    def __str__(self) -> str:
        return self.internal_number


class ServiceOperationLine(models.Model):
    """Copia histórica de una línea de servicio documentada; ``is_current`` evita duplicarla."""

    operation = models.ForeignKey(ServiceOperation, on_delete=models.PROTECT, related_name="lines")
    service_line = models.ForeignKey(
        ServiceLine,
        on_delete=models.SET_NULL,
        related_name="documentations",
        null=True,
        blank=True,
    )
    position = models.PositiveIntegerField()
    service_id = models.PositiveBigIntegerField()
    service_code = models.CharField(max_length=25, blank=True, default="")
    service_name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField()
    reference_price = models.DecimalField(max_digits=14, decimal_places=2)
    applied_price = models.DecimalField(max_digits=14, decimal_places=2)
    tax_definition = models.ForeignKey(
        "workshop_configuration.TaxDefinition", on_delete=models.PROTECT, related_name="+"
    )
    tax_snapshot = models.JSONField(validators=[validate_snapshot])
    tax_rate = models.DecimalField(max_digits=9, decimal_places=4)
    base_amount = models.DecimalField(max_digits=24, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=2)
    total_amount = models.DecimalField(max_digits=24, decimal_places=2)
    is_current = models.BooleanField(default=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["operation", "position"], name="wk_srvop_line_position_unique"
            ),
            models.UniqueConstraint(
                fields=["service_line"],
                condition=models.Q(is_current=True, service_line__isnull=False),
                name="wk_srvop_line_documented_once",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1)
                & models.Q(applied_price__gte=0, reference_price__gte=0)
                & models.Q(base_amount__gte=0, tax_amount__gte=0, total_amount__gte=0)
                & models.Q(total_amount=models.F("base_amount") + models.F("tax_amount")),
                name="wk_srvop_line_amounts_consistent",
            ),
        ]
        ordering: ClassVar[list[str]] = ["operation_id", "position"]

    def __str__(self) -> str:
        return f"{self.service_name} x{self.quantity}"


class ArtisanPayment(models.Model):
    """Cobro de una sola operación artesanal; ``operation_id`` es su identidad estable."""

    operation_id = models.UUIDField(unique=True)
    service_operation = models.ForeignKey(
        ServiceOperation, on_delete=models.PROTECT, related_name="payments"
    )
    amount = models.DecimalField(max_digits=24, decimal_places=2)
    effective_at = models.DateTimeField()
    effective_date = models.DateField()
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="wk_payment_positive"),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(
                fields=["service_operation", "effective_at", "id"], name="wk_payment_op_idx"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.amount}"


class ArtisanPaymentPart(models.Model):
    payment = models.ForeignKey(ArtisanPayment, on_delete=models.PROTECT, related_name="parts")
    method = models.CharField(max_length=16, choices=PaymentMethodChoice.choices)
    amount = models.DecimalField(max_digits=24, decimal_places=2)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(fields=["payment", "method"], name="wk_part_method_unique"),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="wk_part_positive"),
            models.CheckConstraint(
                condition=models.Q(method__in=PaymentMethodChoice.values),
                name="wk_part_method_valid",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.method} {self.amount}"


class ArtisanPaymentCorrection(models.Model):
    """Anulación o sustitución administrativa de un pago; conserva el original."""

    operation_id = models.UUIDField(unique=True)
    service_operation = models.ForeignKey(
        ServiceOperation, on_delete=models.PROTECT, related_name="payment_corrections"
    )
    original_payment = models.OneToOneField(
        ArtisanPayment, on_delete=models.PROTECT, related_name="correction"
    )
    replacement_payment = models.OneToOneField(
        ArtisanPayment,
        on_delete=models.PROTECT,
        related_name="replaces_correction",
        null=True,
        blank=True,
    )
    reason = models.CharField(max_length=500)
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            _not_blank("reason", "wk_correction_reason_present"),
        ]

    def __str__(self) -> str:
        return f"Corrección {self.original_payment_id}"


class ArtisanWithholding(models.Model):
    """Retención recibida del RUC artesanal: reduce el saldo sin ser dinero ni medio de pago.

    ``operation_id`` identifica la acción completa (cobro, retención o ambos). El comprobante
    se completa después; anular es terminal y conserva el registro.
    """

    operation_id = models.UUIDField(unique=True)
    service_operation = models.ForeignKey(
        ServiceOperation, on_delete=models.PROTECT, related_name="withholdings"
    )
    customer = models.ForeignKey(
        "customer_registry.Customer", on_delete=models.PROTECT, related_name="+"
    )
    payment = models.OneToOneField(
        ArtisanPayment,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="withholding",
    )
    amount = models.DecimalField(max_digits=24, decimal_places=2)
    effective_at = models.DateTimeField()
    effective_date = models.DateField()
    voucher_number = models.CharField(max_length=17, null=True, blank=True)  # noqa: DJ001
    voucher_date = models.DateField(null=True, blank=True)
    income_tax_amount = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    vat_amount = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = _user_fk(null=True, blank=True)
    void_reason = models.CharField(max_length=500, blank=True, default="")
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0), name="wk_withholding_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(voucher_number__isnull=True, voucher_date__isnull=True)
                | models.Q(
                    voucher_number__regex=r"^[0-9]{3}-[0-9]{3}-[0-9]{9}$",
                    voucher_date__isnull=False,
                ),
                name="wk_withholding_voucher_complete",
            ),
            models.CheckConstraint(
                condition=models.Q(income_tax_amount__isnull=True, vat_amount__isnull=True)
                | models.Q(
                    income_tax_amount__isnull=False,
                    vat_amount__isnull=False,
                    income_tax_amount__gte=0,
                    vat_amount__gte=0,
                    amount=models.F("income_tax_amount") + models.F("vat_amount"),
                ),
                name="wk_withholding_breakdown_coherent",
            ),
            models.CheckConstraint(
                condition=models.Q(voided_at__isnull=True, voided_by__isnull=True, void_reason="")
                | models.Q(
                    voided_at__isnull=False, voided_by__isnull=False, void_reason__regex=r"\S"
                ),
                name="wk_withholding_void_complete",
            ),
            models.UniqueConstraint(
                fields=["customer", "voucher_number"],
                condition=models.Q(voided_at__isnull=True, voucher_number__isnull=False),
                name="wk_withholding_voucher_unique",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(
                fields=["service_operation", "effective_at", "id"], name="wk_withholding_op_idx"
            ),
        ]

    def __str__(self) -> str:
        return f"Retención {self.amount}"


class ArtisanWithholdingVoucherChange(models.Model):
    """Corrección administrativa de un comprobante ya completado; conserva lo anterior."""

    operation_id = models.UUIDField(unique=True)
    withholding = models.ForeignKey(
        ArtisanWithholding, on_delete=models.PROTECT, related_name="voucher_changes"
    )
    previous_voucher_number = models.CharField(max_length=17)
    previous_voucher_date = models.DateField()
    previous_income_tax_amount = models.DecimalField(
        max_digits=24, decimal_places=2, null=True, blank=True
    )
    previous_vat_amount = models.DecimalField(
        max_digits=24, decimal_places=2, null=True, blank=True
    )
    reason = models.CharField(max_length=500)
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            _not_blank("reason", "wk_withholding_change_reason_present"),
        ]

    def __str__(self) -> str:
        return f"Corrección de comprobante {self.withholding_id}"
