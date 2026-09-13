from typing import ClassVar

from django.db import models

from customer_registry.domain.validation import IdentificationType, PersonType


class Customer(models.Model):
    person_type = models.CharField(
        max_length=16,
        choices=[(tag.value, tag.value) for tag in PersonType],
    )
    name = models.CharField(max_length=255)
    identification_type = models.CharField(
        max_length=8,
        choices=[(tag.value, tag.value) for tag in IdentificationType],
    )
    identification = models.CharField(max_length=32)
    phone = models.CharField(max_length=64)
    email = models.CharField(max_length=254, blank=True, default="")
    address = models.CharField(max_length=1024, blank=True, default="")
    is_active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["identification_type", "identification"],
                name="unique_customer_identification",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    person_type__in=[PersonType.NATURAL.value, PersonType.JURIDICA.value]
                ),
                name="customer_person_type_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    identification_type__in=[
                        IdentificationType.CI.value,
                        IdentificationType.RUC.value,
                    ]
                ),
                name="customer_id_type_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(name__regex=r"\S"),
                name="customer_name_not_blank",
            ),
            models.CheckConstraint(
                condition=models.Q(identification__regex=r"\S"),
                name="customer_id_not_blank",
            ),
            models.CheckConstraint(
                condition=models.Q(phone__regex=r"\S"),
                name="customer_phone_not_blank",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["is_active", "name"], name="customer_active_name_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.identification_type}: {self.identification})"


class VehicleBrand(models.Model):
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(name__regex=r"\S"),
                name="vehicle_brand_name_not_blank",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["is_active", "name"], name="brand_active_name_idx"),
        ]
        ordering: ClassVar[list[str]] = ["name", "id"]

    def __str__(self) -> str:
        return self.name


class Vehicle(models.Model):
    plate = models.CharField(max_length=64)
    brand = models.ForeignKey(
        VehicleBrand,
        on_delete=models.PROTECT,
        related_name="vehicles",
    )
    model = models.CharField(max_length=255)
    color = models.CharField(max_length=100, blank=True, default="")
    year = models.PositiveIntegerField(null=True, blank=True, default=None)
    vin = models.CharField(  # noqa: DJ001
        max_length=64,
        null=True,
        blank=True,
        default=None,
    )
    is_active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["plate"],
                name="vehicle_plate_unique",
            ),
            models.UniqueConstraint(
                fields=["vin"],
                condition=models.Q(vin__isnull=False),
                name="vehicle_vin_unique_when_not_null",
            ),
            models.CheckConstraint(
                condition=models.Q(plate__regex=r"\S"),
                name="vehicle_plate_not_blank",
            ),
            models.CheckConstraint(
                condition=models.Q(model__regex=r"\S"),
                name="vehicle_model_not_blank",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["is_active", "plate"], name="vehicle_active_plate_idx"),
            models.Index(fields=["brand"], name="vehicle_brand_idx"),
        ]
        ordering: ClassVar[list[str]] = ["plate", "id"]

    def __str__(self) -> str:
        return f"{self.plate} - {self.brand.name} {self.model}"

    @property
    def current_ownership(self) -> "OwnershipPeriod | None":
        if (
            hasattr(self, "_prefetched_objects_cache")
            and "ownership_periods" in self._prefetched_objects_cache
        ):
            for period in self.ownership_periods.all():
                if period.ended_at is None:
                    return period
            return None
        return self.ownership_periods.filter(ended_at__isnull=True).first()

    @property
    def current_owner(self) -> "Customer | None":
        ownership = self.current_ownership
        return ownership.customer if ownership is not None else None


class OwnershipPeriod(models.Model):
    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.PROTECT,
        related_name="ownership_periods",
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="ownership_periods",
    )
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True, default=None)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["vehicle"],
                condition=models.Q(ended_at__isnull=True),
                name="ownership_unique_open_period",
            ),
            models.CheckConstraint(
                condition=models.Q(ended_at__isnull=True)
                | models.Q(ended_at__gte=models.F("started_at")),
                name="ownership_ended_at_gte_started_at",
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(
                fields=["customer", "ended_at"],
                name="ownership_customer_ended_idx",
            ),
            models.Index(
                fields=["vehicle", "started_at"],
                name="ownership_vehicle_started_idx",
            ),
        ]
        ordering: ClassVar[list[str]] = ["-started_at", "-id"]

    def __str__(self) -> str:
        status = "vigente" if self.ended_at is None else f"hasta {self.ended_at.isoformat()}"
        return f"{self.customer.name} -> {self.vehicle.plate} ({status})"
