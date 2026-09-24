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
