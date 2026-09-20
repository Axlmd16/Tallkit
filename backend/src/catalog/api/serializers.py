"""Serializadores solo para documentar el contrato OpenAPI.

La validación de entrada y los permisos viven en los servicios de aplicación; estos
serializadores no descartan ni aceptan campos por su cuenta.
"""

from rest_framework import serializers

_Base = serializers.Serializer[dict[str, object]]


class RefSerializer(_Base):
    id = serializers.IntegerField()
    name = serializers.CharField()
    is_active = serializers.BooleanField()


class TaxProjectionSerializer(_Base):
    id = serializers.IntegerField()
    code = serializers.CharField()
    name = serializers.CharField()
    entity_type = serializers.CharField()
    rate = serializers.CharField(allow_null=True)
    tax_status = serializers.ChoiceField(choices=["applicable", "missing", "ambiguous"])


class _Record(_Base):
    id = serializers.IntegerField()
    is_active = serializers.BooleanField()
    version = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class CommandFields(_Base):
    idempotency_key = serializers.RegexField(
        r"^[A-Za-z0-9._:-]{8,128}$", help_text="Clave del intento, 8 a 128 caracteres ASCII."
    )


class StateCommandSerializer(CommandFields):
    expected_version = serializers.IntegerField(min_value=1)


class CategoryWriteSerializer(CommandFields):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)


class CategoryPatchSerializer(CategoryWriteSerializer):
    expected_version = serializers.IntegerField(min_value=1)
    name = serializers.CharField(max_length=255, required=False)


class CategorySerializer(_Record):
    name = serializers.CharField()
    description = serializers.CharField()


class UnitWriteSerializer(CommandFields):
    name = serializers.CharField(max_length=255)
    symbol = serializers.CharField(max_length=32, required=False, allow_blank=True)


class UnitPatchSerializer(UnitWriteSerializer):
    expected_version = serializers.IntegerField(min_value=1)
    name = serializers.CharField(max_length=255, required=False)


class UnitSerializer(_Record):
    name = serializers.CharField()
    symbol = serializers.CharField()


class BrandWriteSerializer(CommandFields):
    name = serializers.CharField(max_length=255)


class BrandPatchSerializer(BrandWriteSerializer):
    expected_version = serializers.IntegerField(min_value=1)
    name = serializers.CharField(max_length=255, required=False)


class BrandSerializer(_Record):
    name = serializers.CharField()


_DECIMAL_HELP = "Cadena decimal ordinaria; sin exponentes ni redondeo."


class ProductWriteSerializer(CommandFields):
    code = serializers.CharField(max_length=64)
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    category_id = serializers.IntegerField()
    unit_id = serializers.IntegerField()
    product_brand_id = serializers.IntegerField(required=False, allow_null=True)
    vehicle_brand_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    tax_definition_id = serializers.IntegerField()
    content_quantity = serializers.CharField(
        help_text=f"Mayor que cero, hasta 6 decimales, máximo 999999999999.999999. {_DECIMAL_HELP}"
    )
    sale_price = serializers.CharField(
        help_text=f"Precio final USD, 0 a 999999999999.99, hasta 2 decimales. {_DECIMAL_HELP}"
    )
    is_kit = serializers.BooleanField(required=False)


class ProductPatchSerializer(ProductWriteSerializer):
    expected_version = serializers.IntegerField(min_value=1)
    code = serializers.CharField(max_length=64, required=False)
    name = serializers.CharField(max_length=255, required=False)
    category_id = serializers.IntegerField(required=False)
    unit_id = serializers.IntegerField(required=False)
    tax_definition_id = serializers.IntegerField(required=False)
    content_quantity = serializers.CharField(required=False)
    sale_price = serializers.CharField(required=False)


class ProductSerializer(_Record):
    code = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    category = RefSerializer()
    unit = RefSerializer()
    product_brand = RefSerializer(allow_null=True)
    vehicle_brands = RefSerializer(many=True)
    content_quantity = serializers.CharField()
    sale_price = serializers.CharField()
    is_kit = serializers.BooleanField()
    tax = TaxProjectionSerializer(allow_null=True)


class ServiceWriteSerializer(CommandFields):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    reference_price = serializers.CharField(
        help_text=f"Precio referencial final USD, hasta 2 decimales. {_DECIMAL_HELP}"
    )
    tax_definition_id = serializers.IntegerField()


class ServicePatchSerializer(ServiceWriteSerializer):
    expected_version = serializers.IntegerField(min_value=1)
    name = serializers.CharField(max_length=255, required=False)
    reference_price = serializers.CharField(required=False)
    tax_definition_id = serializers.IntegerField(required=False)


class ServiceSerializer(_Record):
    name = serializers.CharField()
    description = serializers.CharField()
    reference_price = serializers.CharField()
    tax = TaxProjectionSerializer(allow_null=True)


class PageMeta(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()


def page_of(item: type[_Base], name: str) -> type[_Base]:
    return type(name, (PageMeta,), {"results": item(many=True)})


CategoryPageSerializer = page_of(CategorySerializer, "CategoryPage")
UnitPageSerializer = page_of(UnitSerializer, "UnitPage")
BrandPageSerializer = page_of(BrandSerializer, "ProductBrandPage")
ProductPageSerializer = page_of(ProductSerializer, "ProductPage")
ServicePageSerializer = page_of(ServiceSerializer, "ServicePage")
TaxOptionPageSerializer = page_of(TaxProjectionSerializer, "CatalogTaxOptionPage")
