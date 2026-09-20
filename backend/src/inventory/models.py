"""Persistencia de inventario: posiciones, operaciones y movimientos inmutables.

Las FK hacia catálogo, configuración e identidad se declaran por nombre, con ``PROTECT`` y
``related_name="+"`` para no añadir campos inversos de stock a esos contratos. La historia
(movimientos y líneas contabilizadas) se protege además mediante triggers PostgreSQL.
"""

from typing import Any, ClassVar

from django.conf import settings
from django.db import models
from django.db.models.functions import Floor


class ImmutableHistoryError(RuntimeError):
    """Intento de alterar historia de inventario ya contabilizada."""


class ImmutableQuerySet(models.QuerySet["Any"]):
    """QuerySet sin mutadores públicos: la historia solo se inserta."""

    def update(self, **kwargs: Any) -> int:
        raise ImmutableHistoryError("La historia de inventario no se actualiza.")

    def bulk_update(self, objs: Any, fields: Any, batch_size: int | None = None) -> int:
        raise ImmutableHistoryError("La historia de inventario no se actualiza.")

    def delete(self) -> tuple[int, dict[str, int]]:
        raise ImmutableHistoryError("La historia de inventario no se elimina.")


class OperationKind(models.TextChoices):
    PURCHASE_RECEIPT = "PURCHASE_RECEIPT"
    INITIAL_LOAD = "INITIAL_LOAD"
    ADJUSTMENT_IN = "ADJUSTMENT_IN"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT"
    REVERSAL = "REVERSAL"


class OperationState(models.TextChoices):
    PREPARED = "PREPARED"
    POSTED = "POSTED"
    REVERSED = "REVERSED"


def _in(field: str, choices: type[models.TextChoices]) -> models.Q:
    return models.Q(**{f"{field}__in": [value for value, _ in choices.choices]})


class InventoryPosition(models.Model):
    """Proyección operativa conciliable de existencia y valor por producto y bodega."""

    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="+")
    warehouse = models.ForeignKey(
        "workshop_configuration.Warehouse", on_delete=models.PROTECT, related_name="+"
    )
    quantity = models.DecimalField(max_digits=18, decimal_places=6, default=0)
    value = models.DecimalField(max_digits=38, decimal_places=6, default=0)
    average = models.DecimalField(max_digits=24, decimal_places=6, default=0)
    version = models.PositiveBigIntegerField(default=1)
    last_ordinal = models.PositiveBigIntegerField(default=0)
    last_effective_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["product", "warehouse"], name="inv_position_product_warehouse_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=0), name="inv_position_quantity_not_negative"
            ),
            models.CheckConstraint(
                condition=models.Q(value__gte=0), name="inv_position_value_not_negative"
            ),
            models.CheckConstraint(
                condition=models.Q(average__gte=0), name="inv_position_average_not_negative"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity=Floor("quantity")),
                name="inv_position_quantity_whole",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0) | models.Q(value=0, average=0),
                name="inv_position_zero_quantity_zero_value",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product_id}@{self.warehouse_id}"


class InventoryOperation(models.Model):
    kind = models.CharField(max_length=20, choices=OperationKind.choices)
    state = models.CharField(
        max_length=10, choices=OperationState.choices, default=OperationState.PREPARED
    )
    source_type = models.CharField(max_length=32, blank=True, default="")
    source_id = models.PositiveBigIntegerField(null=True, blank=True)
    reason = models.CharField(max_length=500, blank=True, default="")
    observation = models.CharField(max_length=2000, blank=True, default="")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    fingerprint = models.CharField(max_length=64, blank=True, default="")
    reverses = models.OneToOneField(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="reversal"
    )
    version = models.PositiveBigIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=_in("kind", OperationKind), name="inv_operation_kind_valid"
            ),
            models.CheckConstraint(
                condition=_in("state", OperationState), name="inv_operation_state_valid"
            ),
            models.UniqueConstraint(
                fields=["source_type", "source_id"],
                condition=models.Q(source_id__isnull=False),
                name="inv_operation_source_unique",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(kind=OperationKind.REVERSAL, reverses__isnull=False)
                    | (~models.Q(kind=OperationKind.REVERSAL) & models.Q(reverses__isnull=True))
                ),
                name="inv_operation_reversal_link_coherent",
            ),
            models.CheckConstraint(
                condition=~(models.Q(kind=OperationKind.REVERSAL) & models.Q(state="REVERSED")),
                name="inv_operation_reversal_not_reversed",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(
                fields=["kind", "state", "created_at", "id"], name="inv_op_kind_state_idx"
            ),
        ]

    def __str__(self) -> str:
        return self.public_reference

    @property
    def public_reference(self) -> str:
        return f"INV-{self.pk}"


class InventoryOperationLine(models.Model):
    operation = models.ForeignKey(
        InventoryOperation, on_delete=models.PROTECT, related_name="lines"
    )
    position = models.PositiveIntegerField()
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="+")
    quantity = models.DecimalField(max_digits=18, decimal_places=6)
    entry_value = models.DecimalField(max_digits=38, decimal_places=6, null=True, blank=True)
    source_line_id = models.PositiveBigIntegerField(null=True, blank=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["operation", "position"], name="inv_line_operation_position_unique"
            ),
            models.UniqueConstraint(
                fields=["operation", "product"], name="inv_line_operation_product_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="inv_line_quantity_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity=Floor("quantity")), name="inv_line_quantity_whole"
            ),
            models.CheckConstraint(
                condition=models.Q(entry_value__isnull=True) | models.Q(entry_value__gte=0),
                name="inv_line_entry_value_not_negative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.operation_id}:{self.position}"


class InventoryMovement(models.Model):
    """Hecho inmutable: un movimiento por producto y operación, ordenado por posición."""

    operation = models.ForeignKey(
        InventoryOperation, on_delete=models.PROTECT, related_name="movements"
    )
    position = models.ForeignKey(
        InventoryPosition, on_delete=models.PROTECT, related_name="movements"
    )
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="+")
    warehouse = models.ForeignKey(
        "workshop_configuration.Warehouse", on_delete=models.PROTECT, related_name="+"
    )
    ordinal = models.PositiveBigIntegerField()
    movement_type = models.CharField(max_length=20, choices=OperationKind.choices)
    effective_at = models.DateTimeField()
    quantity_in = models.DecimalField(max_digits=18, decimal_places=6, default=0)
    quantity_out = models.DecimalField(max_digits=18, decimal_places=6, default=0)
    value_delta = models.DecimalField(max_digits=38, decimal_places=6)
    applied_unit_cost = models.DecimalField(max_digits=24, decimal_places=6)
    rounding_adjustment = models.DecimalField(max_digits=38, decimal_places=6, default=0)
    quantity_before = models.DecimalField(max_digits=18, decimal_places=6)
    value_before = models.DecimalField(max_digits=38, decimal_places=6)
    average_before = models.DecimalField(max_digits=24, decimal_places=6)
    quantity_after = models.DecimalField(max_digits=18, decimal_places=6)
    value_after = models.DecimalField(max_digits=38, decimal_places=6)
    average_after = models.DecimalField(max_digits=24, decimal_places=6)
    product_snapshot = models.JSONField(default=dict)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    reverses_movement = models.OneToOneField(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="reversal"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects: ClassVar[Any] = ImmutableQuerySet.as_manager()

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["position", "ordinal"], name="inv_movement_position_ordinal_unique"
            ),
            models.UniqueConstraint(
                fields=["operation", "product"], name="inv_movement_operation_product_unique"
            ),
            models.CheckConstraint(
                condition=_in("movement_type", OperationKind), name="inv_movement_type_valid"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(quantity_in__gt=0, quantity_out=0)
                    | models.Q(quantity_in=0, quantity_out__gt=0)
                ),
                name="inv_movement_single_direction",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity_in=Floor("quantity_in"))
                & models.Q(quantity_out=Floor("quantity_out")),
                name="inv_movement_quantities_whole",
            ),
            models.UniqueConstraint(
                fields=["product", "warehouse"],
                condition=models.Q(movement_type=OperationKind.INITIAL_LOAD),
                name="inv_movement_initial_load_unique",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(
                fields=["product", "effective_at", "ordinal"], name="inv_mov_product_time_idx"
            ),
            models.Index(
                fields=["product", "movement_type", "ordinal"], name="inv_mov_product_type_idx"
            ),
            models.Index(fields=["actor", "effective_at", "id"], name="inv_mov_actor_time_idx"),
            models.Index(fields=["operation"], name="inv_mov_operation_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.position_id}#{self.ordinal}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self._state.adding:
            raise ImmutableHistoryError("Un movimiento de inventario no se modifica.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise ImmutableHistoryError("Un movimiento de inventario no se elimina.")
