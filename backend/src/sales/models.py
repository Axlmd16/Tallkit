"""Persistencia comercial: ventas, cobros, devoluciones, reembolsos y recibos idempotentes.

Las FK hacia clientes, catálogo, inventario, configuración e identidad usan ``PROTECT`` y
``related_name="+"`` para no añadir campos inversos a contratos ajenos. Ningún saldo, exceso
ni estado de pago se almacena: se derivan de los hechos registrados aquí. Los snapshots
históricos son JSON con clave ``schema_version``.
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


class SaleState(models.TextChoices):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    VOIDED = "VOIDED"


class SaleCondition(models.TextChoices):
    CONTADO = "CONTADO"
    CREDITO = "CREDITO"


class SaleOriginType(models.TextChoices):
    DIRECT = "DIRECT"
    MAINTENANCE = "MAINTENANCE"


class PaymentMethodChoice(models.TextChoices):
    EFECTIVO = "EFECTIVO"
    TRANSFERENCIA = "TRANSFERENCIA"


class RefundOrigin(models.TextChoices):
    RETURN = "RETURN"
    VOID = "VOID"


def _in(field: str, choices: type[models.TextChoices]) -> models.Q:
    return models.Q(**{f"{field}__in": [value for value, _ in choices.choices]})


def _snapshot_ok(field: str) -> models.Q:
    return models.Q(**{f"{field}__isnull": True}) | models.Q(
        **{f"{field}__has_key": "schema_version"}
    )


def _user_fk(**extra: Any) -> models.ForeignKey[Any, Any]:
    return models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", **extra
    )


class Record(models.Model):
    """Base abstracta con representación textual común de los hechos comerciales."""

    class Meta:
        abstract = True

    def __str__(self) -> str:
        return f"{type(self).__name__} {self.pk}"


class Sale(models.Model):
    """Venta directa de repuestos: borrador → confirmada → anulada."""

    customer = models.ForeignKey(
        "customer_registry.Customer", on_delete=models.PROTECT, related_name="+"
    )
    fiscal_entity = models.ForeignKey(
        "workshop_configuration.FiscalEntity", on_delete=models.PROTECT, related_name="+"
    )
    warehouse = models.ForeignKey(
        "workshop_configuration.Warehouse", on_delete=models.PROTECT, related_name="+"
    )
    origin_type = models.CharField(
        max_length=12, choices=SaleOriginType.choices, default=SaleOriginType.DIRECT
    )
    origin_order = models.ForeignKey(
        "workshop.MaintenanceOrder",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    origin_reference = models.CharField(max_length=64, blank=True, default="")
    condition = models.CharField(max_length=10, choices=SaleCondition.choices)
    notes = models.CharField(max_length=2000, blank=True, default="")
    state = models.CharField(max_length=10, choices=SaleState.choices, default=SaleState.DRAFT)
    version = models.PositiveBigIntegerField(default=1)
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    operational_date = models.DateField(null=True, blank=True)
    base_total = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    tax_total = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    grand_total = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    customer_snapshot = models.JSONField(null=True, blank=True, validators=[validate_snapshot])
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
    confirmed_by = _user_fk(null=True, blank=True)

    void_reason = models.CharField(max_length=500, blank=True, default="")
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = _user_fk(null=True, blank=True)
    void_operation = models.ForeignKey(
        "inventory.InventoryOperation",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(condition=_in("state", SaleState), name="sal_sale_state_valid"),
            models.CheckConstraint(
                condition=_in("condition", SaleCondition), name="sal_sale_condition_valid"
            ),
            models.CheckConstraint(
                condition=_in("origin_type", SaleOriginType), name="sal_sale_origin_type_valid"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        origin_type=SaleOriginType.DIRECT,
                        origin_order__isnull=True,
                        origin_reference="",
                    )
                    | models.Q(
                        origin_type=SaleOriginType.MAINTENANCE,
                        origin_order__isnull=False,
                        origin_reference__regex=r"\S",
                    )
                ),
                name="sal_sale_origin_coherent",
            ),
            models.CheckConstraint(
                condition=models.Q(version__gte=1), name="sal_sale_version_positive"
            ),
            models.UniqueConstraint(
                fields=["internal_number"],
                condition=models.Q(internal_number__isnull=False),
                name="sal_sale_internal_number_unique",
            ),
            models.UniqueConstraint(
                fields=["origin_order"],
                condition=models.Q(
                    state=SaleState.DRAFT,
                    origin_order__isnull=False,
                ),
                name="sal_sale_draft_origin_unique",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(state=SaleState.DRAFT, internal_number__isnull=True)
                    | (~models.Q(state=SaleState.DRAFT) & models.Q(internal_number__isnull=False))
                ),
                name="sal_sale_number_matches_state",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(state=SaleState.DRAFT)
                    | models.Q(
                        base_total__gte=0,
                        tax_total__gte=0,
                        grand_total__gte=0,
                        base_total__isnull=False,
                        tax_total__isnull=False,
                        grand_total__isnull=False,
                        operational_date__isnull=False,
                    )
                ),
                name="sal_sale_confirmed_amounts",
            ),
            models.CheckConstraint(
                condition=_snapshot_ok("customer_snapshot") & _snapshot_ok("fiscal_snapshot"),
                name="sal_sale_snapshot_versioned",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["customer", "created_at", "id"], name="sal_sale_customer_idx"),
            models.Index(fields=["state", "created_at", "id"], name="sal_sale_state_idx"),
            models.Index(fields=["origin_order", "state"], name="sal_sale_origin_state_idx"),
        ]

    def __str__(self) -> str:
        return self.internal_number or f"Borrador {self.pk}"


class SaleLine(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="lines")
    position = models.PositiveIntegerField()
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="+")
    quantity = models.DecimalField(max_digits=18, decimal_places=6)
    tax_definition = models.ForeignKey(
        "workshop_configuration.TaxDefinition",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    product_snapshot = models.JSONField(null=True, blank=True, validators=[validate_snapshot])
    tax_snapshot = models.JSONField(null=True, blank=True, validators=[validate_snapshot])
    unit_price = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    tax_rate = models.DecimalField(max_digits=9, decimal_places=4, null=True, blank=True)
    base_amount = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["sale", "position"], name="sal_line_sale_position_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="sal_line_quantity_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity=Floor("quantity")), name="sal_line_quantity_whole"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        unit_price__isnull=True,
                        tax_rate__isnull=True,
                        base_amount__isnull=True,
                        tax_amount__isnull=True,
                        total_amount__isnull=True,
                    )
                    | models.Q(
                        unit_price__gte=0,
                        tax_rate__gte=0,
                        base_amount__gte=0,
                        tax_amount__gte=0,
                        total_amount__gte=0,
                        unit_price__isnull=False,
                        tax_rate__isnull=False,
                        base_amount__isnull=False,
                        tax_amount__isnull=False,
                        total_amount__isnull=False,
                    )
                ),
                name="sal_line_amounts_coherent",
            ),
            models.CheckConstraint(
                condition=_snapshot_ok("product_snapshot") & _snapshot_ok("tax_snapshot"),
                name="sal_line_snapshot_versioned",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["product", "sale"], name="sal_line_product_sale_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.sale_id}:{self.position}"


class SaleCostAllocation(Record):
    """Valor de salida realmente aplicado a una línea; inmutable."""

    sale_line = models.ForeignKey(SaleLine, on_delete=models.PROTECT, related_name="allocations")
    movement = models.ForeignKey(
        "inventory.InventoryMovement", on_delete=models.PROTECT, related_name="+"
    )
    quantity = models.DecimalField(max_digits=18, decimal_places=6)
    published_unit_cost = models.DecimalField(max_digits=24, decimal_places=6)
    applied_value = models.DecimalField(max_digits=38, decimal_places=6)
    # Falso cuando el producto no tenía costo registrado: el valor cero no es un costo conocido.
    cost_known = models.BooleanField(default=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["sale_line", "movement"], name="sal_allocation_line_movement_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0, quantity=Floor("quantity")),
                name="sal_allocation_quantity_whole",
            ),
            models.CheckConstraint(
                condition=models.Q(published_unit_cost__gte=0, applied_value__gte=0),
                name="sal_allocation_values_not_negative",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["movement"], name="sal_allocation_movement_idx"),
        ]


class CommercialPayment(Record):
    """Hecho de cobro; ``operation_id`` es su identidad estable ante reintentos."""

    operation_id = models.UUIDField(unique=True)
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=24, decimal_places=2)
    effective_at = models.DateTimeField()
    effective_date = models.DateField()
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="sal_payment_positive"),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["sale", "effective_at", "id"], name="sal_payment_sale_idx"),
        ]


class PaymentPart(Record):
    payment = models.ForeignKey(CommercialPayment, on_delete=models.PROTECT, related_name="parts")
    method = models.CharField(max_length=16, choices=PaymentMethodChoice.choices)
    amount = models.DecimalField(max_digits=24, decimal_places=2)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(fields=["payment", "method"], name="sal_part_method_unique"),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="sal_part_positive"),
            models.CheckConstraint(
                condition=_in("method", PaymentMethodChoice), name="sal_part_method_valid"
            ),
        ]


class PaymentCorrection(Record):
    """Anulación lógica de un pago, con reemplazo opcional; el original no se modifica."""

    operation_id = models.UUIDField(unique=True)
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="payment_corrections")
    original_payment = models.OneToOneField(
        CommercialPayment, on_delete=models.PROTECT, related_name="correction"
    )
    replacement_payment = models.OneToOneField(
        CommercialPayment,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="replaces_correction",
    )
    reason = models.CharField(max_length=500)
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(reason__regex=r"\S"), name="sal_correction_reason_present"
            ),
        ]


class SaleReturn(Record):
    operation_id = models.UUIDField(unique=True)
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="returns")
    reason = models.CharField(max_length=500)
    effective_at = models.DateTimeField()
    effective_date = models.DateField()
    base_total = models.DecimalField(max_digits=24, decimal_places=2)
    tax_total = models.DecimalField(max_digits=24, decimal_places=2)
    grand_total = models.DecimalField(max_digits=24, decimal_places=2)
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(reason__regex=r"\S"), name="sal_return_reason_present"
            ),
            models.CheckConstraint(
                condition=models.Q(base_total__gte=0, tax_total__gte=0, grand_total__gte=0),
                name="sal_return_amounts_not_negative",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["sale", "effective_at", "id"], name="sal_return_sale_idx"),
        ]


class SaleReturnLine(Record):
    sale_return = models.ForeignKey(SaleReturn, on_delete=models.PROTECT, related_name="lines")
    sale_line = models.ForeignKey(SaleLine, on_delete=models.PROTECT, related_name="return_lines")
    fit_quantity = models.DecimalField(max_digits=18, decimal_places=6)
    unfit_quantity = models.DecimalField(max_digits=18, decimal_places=6)
    base_amount = models.DecimalField(max_digits=24, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=2)
    total_amount = models.DecimalField(max_digits=24, decimal_places=2)
    fit_value = models.DecimalField(max_digits=38, decimal_places=6, default=0)
    unfit_value = models.DecimalField(max_digits=38, decimal_places=6, default=0)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["sale_return", "sale_line"], name="sal_return_line_unique"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(fit_quantity__gte=0, unfit_quantity__gte=0)
                    & models.Q(fit_quantity=Floor("fit_quantity"))
                    & models.Q(unfit_quantity=Floor("unfit_quantity"))
                    & ~models.Q(fit_quantity=0, unfit_quantity=0)
                ),
                name="sal_return_line_quantities",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    base_amount__gte=0,
                    tax_amount__gte=0,
                    total_amount__gte=0,
                    fit_value__gte=0,
                    unfit_value__gte=0,
                ),
                name="sal_return_line_amounts_not_negative",
            ),
        ]


class CommercialRefund(Record):
    """Desembolso efectivo registrado; no representa una orden a un banco."""

    operation_id = models.UUIDField(unique=True)
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="refunds")
    origin = models.CharField(max_length=8, choices=RefundOrigin.choices)
    sale_return = models.ForeignKey(
        SaleReturn, on_delete=models.PROTECT, null=True, blank=True, related_name="refunds"
    )
    amount = models.DecimalField(max_digits=24, decimal_places=2)
    reason = models.CharField(max_length=500, blank=True, default="")
    effective_at = models.DateTimeField()
    effective_date = models.DateField()
    created_by = _user_fk()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="sal_refund_positive"),
            models.CheckConstraint(
                condition=_in("origin", RefundOrigin), name="sal_refund_origin_valid"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(origin=RefundOrigin.RETURN, sale_return__isnull=False)
                    | models.Q(origin=RefundOrigin.VOID, sale_return__isnull=True)
                ),
                name="sal_refund_origin_coherent",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["sale", "effective_at", "id"], name="sal_refund_sale_idx"),
        ]


class RefundPart(Record):
    refund = models.ForeignKey(CommercialRefund, on_delete=models.PROTECT, related_name="parts")
    method = models.CharField(max_length=16, choices=PaymentMethodChoice.choices)
    amount = models.DecimalField(max_digits=24, decimal_places=2)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(fields=["refund", "method"], name="sal_refund_part_unique"),
            models.CheckConstraint(
                condition=models.Q(amount__gt=0), name="sal_refund_part_positive"
            ),
            models.CheckConstraint(
                condition=_in("method", PaymentMethodChoice), name="sal_refund_part_method_valid"
            ),
        ]


class SaleVoid(Record):
    """Anulación de venta: única por venta."""

    sale = models.OneToOneField(Sale, on_delete=models.PROTECT, related_name="void_record")
    reason = models.CharField(max_length=500)
    voided_at = models.DateTimeField()
    voided_by = _user_fk()
    reversal_operation = models.ForeignKey(
        "inventory.InventoryOperation", on_delete=models.PROTECT, related_name="+"
    )
    refund = models.OneToOneField(
        CommercialRefund,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="void_record",
    )

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(reason__regex=r"\S"), name="sal_void_reason_present"
            ),
        ]


class SalesCommand(models.Model):
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
                fields=["actor", "action", "idempotency_key"], name="sal_command_key_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(idempotency_key__regex=r"^[A-Za-z0-9._:-]{8,128}$"),
                name="sal_command_key_format",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.action}:{self.idempotency_key}"
