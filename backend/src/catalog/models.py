from typing import TYPE_CHECKING, ClassVar

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower, Trim, Upper

if TYPE_CHECKING:
    from customer_registry.models import VehicleBrand


def _unique_name(name: str) -> models.UniqueConstraint:
    return models.UniqueConstraint(Lower(Trim("name")), name=name)


def _name_not_blank(name: str) -> models.CheckConstraint:
    return models.CheckConstraint(condition=models.Q(name__regex=r"\S"), name=name)


class _Auditable(models.Model):
    is_active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ProductCategory(_Auditable):
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=2000, blank=True, default="")

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            _unique_name("product_category_name_unique"),
            _name_not_blank("product_category_name_not_blank"),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["is_active", "name"], name="pcategory_active_name_idx"),
        ]
        ordering: ClassVar[list[str]] = ["name", "id"]

    def __str__(self) -> str:
        return self.name


class MeasurementUnit(_Auditable):
    name = models.CharField(max_length=255)
    symbol = models.CharField(max_length=32, blank=True, default="")

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            _unique_name("measurement_unit_name_unique"),
            _name_not_blank("measurement_unit_name_not_blank"),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["is_active", "name"], name="munit_active_name_idx"),
        ]
        ordering: ClassVar[list[str]] = ["name", "id"]

    def __str__(self) -> str:
        return self.name


class ProductBrand(_Auditable):
    name = models.CharField(max_length=255)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            _unique_name("product_brand_name_unique"),
            _name_not_blank("product_brand_name_not_blank"),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["is_active", "name"], name="pbrand_active_name_idx"),
        ]
        ordering: ClassVar[list[str]] = ["name", "id"]

    def __str__(self) -> str:
        return self.name


class Product(_Auditable):
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=2000, blank=True, default="")
    category = models.ForeignKey(ProductCategory, on_delete=models.PROTECT, related_name="products")
    unit = models.ForeignKey(MeasurementUnit, on_delete=models.PROTECT, related_name="products")
    product_brand = models.ForeignKey(
        ProductBrand, on_delete=models.PROTECT, null=True, blank=True, related_name="products"
    )
    content_quantity = models.DecimalField(max_digits=18, decimal_places=6)
    sale_price = models.DecimalField(max_digits=14, decimal_places=2)
    is_kit = models.BooleanField(default=False)
    tax_definition = models.ForeignKey(
        "workshop_configuration.TaxDefinition",
        on_delete=models.PROTECT,
        related_name="catalog_products",
    )
    vehicle_brands: "models.ManyToManyField[VehicleBrand, ProductCompatibility]" = (
        models.ManyToManyField(
            "customer_registry.VehicleBrand",
            through="ProductCompatibility",
            related_name="compatible_products",
        )
    )

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(Upper(Trim("code")), name="product_code_unique"),
            models.CheckConstraint(
                condition=models.Q(code__regex=r"\S"), name="product_code_not_blank"
            ),
            _name_not_blank("product_name_not_blank"),
            models.CheckConstraint(
                condition=models.Q(content_quantity__gt=0), name="product_content_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(sale_price__gte=0), name="product_price_not_negative"
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["is_active", "name"], name="product_active_name_idx"),
            models.Index(fields=["category", "is_active"], name="product_category_active_idx"),
        ]
        ordering: ClassVar[list[str]] = ["name", "id"]

    def __str__(self) -> str:
        return f"{self.code} {self.name}"


class ProductCompatibility(models.Model):
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="compatibilities")
    vehicle_brand = models.ForeignKey(
        "customer_registry.VehicleBrand",
        on_delete=models.PROTECT,
        related_name="product_compatibilities",
    )

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["product", "vehicle_brand"], name="product_compatibility_unique"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product_id}:{self.vehicle_brand_id}"


class Service(_Auditable):
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=2000, blank=True, default="")
    reference_price = models.DecimalField(max_digits=14, decimal_places=2)
    tax_definition = models.ForeignKey(
        "workshop_configuration.TaxDefinition",
        on_delete=models.PROTECT,
        related_name="catalog_services",
    )

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            _name_not_blank("service_name_not_blank"),
            models.CheckConstraint(
                condition=models.Q(reference_price__gte=0), name="service_price_not_negative"
            ),
        ]
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["is_active", "name"], name="service_active_name_idx"),
        ]
        ordering: ClassVar[list[str]] = ["name", "id"]

    def __str__(self) -> str:
        return self.name


class CatalogCommand(models.Model):
    """Recibo idempotente interno; no se expone ni se edita administrativamente."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="catalog_commands"
    )
    action = models.CharField(max_length=64)
    idempotency_key = models.CharField(max_length=128)
    input_fingerprint = models.CharField(max_length=64)
    response_status = models.PositiveSmallIntegerField(null=True)
    result = models.JSONField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["actor", "action", "idempotency_key"], name="catalog_command_key_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(idempotency_key__regex=r"^[A-Za-z0-9._:-]{8,128}$"),
                name="catalog_command_key_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(input_fingerprint__regex=r"^[0-9a-f]{64}$"),
                name="catalog_command_fingerprint_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(response_status__isnull=True)
                | models.Q(response_status__gte=100, response_status__lte=599),
                name="catalog_command_status_valid",
            ),
        ]
        ordering: ClassVar[list[str]] = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.action}:{self.idempotency_key}"
