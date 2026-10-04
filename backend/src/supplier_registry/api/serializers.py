"""Serializadores solo para documentar el contrato OpenAPI de proveedores."""

from rest_framework import serializers

_Base = serializers.Serializer[dict[str, object]]


class SupplierWriteSerializer(_Base):
    idempotency_key = serializers.RegexField(r"^[A-Za-z0-9._:-]{8,128}$")
    name = serializers.CharField(max_length=255, help_text="Nombre o razón social; obligatorio.")
    identification_type = serializers.ChoiceField(
        choices=["CI", "RUC"],
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Opcional; se informa junto con identification o ambos quedan vacíos.",
    )
    identification = serializers.CharField(
        max_length=32,
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="CI de 10 caracteres o RUC de 13; se conservan los ceros iniciales.",
    )
    phone = serializers.CharField(max_length=64, required=False, allow_blank=True)
    email = serializers.CharField(max_length=254, required=False, allow_blank=True)
    address = serializers.CharField(max_length=1024, required=False, allow_blank=True)


class SupplierPatchSerializer(SupplierWriteSerializer):
    expected_version = serializers.IntegerField(min_value=1)
    name = serializers.CharField(max_length=255, required=False)


class SupplierStateSerializer(_Base):
    idempotency_key = serializers.RegexField(r"^[A-Za-z0-9._:-]{8,128}$")
    expected_version = serializers.IntegerField(min_value=1)


class SupplierSerializer(_Base):
    id = serializers.IntegerField()
    name = serializers.CharField()
    identification_type = serializers.CharField(allow_null=True)
    identification = serializers.CharField(allow_null=True)
    phone = serializers.CharField()
    email = serializers.CharField()
    address = serializers.CharField()
    is_active = serializers.BooleanField()
    version = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class SupplierPageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = SupplierSerializer(many=True)


class SupplierMatchQuerySerializer(_Base):
    name = serializers.CharField()
    exclude_id = serializers.IntegerField(required=False)


class SupplierMatchSerializer(_Base):
    id = serializers.IntegerField()
    name = serializers.CharField()
    is_active = serializers.BooleanField()


class SupplierMatchesSerializer(_Base):
    results = SupplierMatchSerializer(many=True)
    has_more = serializers.BooleanField()


class SupplierOptionSerializer(_Base):
    id = serializers.IntegerField()
    name = serializers.CharField()


class SupplierOptionPageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = SupplierOptionSerializer(many=True)
