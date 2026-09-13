from rest_framework import serializers


class CustomerCreateSerializer(serializers.Serializer[dict[str, object]]):
    person_type = serializers.CharField(allow_blank=True, required=False, default="")
    name = serializers.CharField(allow_blank=True, required=False, default="")
    identification_type = serializers.CharField(allow_blank=True, required=False, default="")
    identification = serializers.CharField(allow_blank=True, required=False, default="")
    phone = serializers.CharField(allow_blank=True, required=False, default="")
    email = serializers.CharField(allow_blank=True, required=False, default="")
    address = serializers.CharField(allow_blank=True, required=False, default="")


class CustomerUpdateSerializer(serializers.Serializer[dict[str, object]]):
    expected_version = serializers.IntegerField(min_value=1, required=True)
    person_type = serializers.CharField(allow_blank=True, required=False)
    name = serializers.CharField(allow_blank=True, required=False)
    identification_type = serializers.CharField(allow_blank=True, required=False)
    identification = serializers.CharField(allow_blank=True, required=False)
    phone = serializers.CharField(allow_blank=True, required=False)
    email = serializers.CharField(allow_blank=True, required=False)
    address = serializers.CharField(allow_blank=True, required=False)


class CustomerReadSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    person_type = serializers.CharField()
    name = serializers.CharField()
    identification_type = serializers.CharField()
    identification = serializers.CharField()
    phone = serializers.CharField()
    email = serializers.CharField()
    address = serializers.CharField()
    is_active = serializers.BooleanField()
    version = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class CustomerStateSerializer(serializers.Serializer[dict[str, object]]):
    expected_version = serializers.IntegerField(min_value=1, required=True)


class CustomerPageSerializer(serializers.Serializer[dict[str, object]]):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = CustomerReadSerializer(many=True)


class CustomerMatchQuerySerializer(serializers.Serializer[dict[str, object]]):
    name = serializers.CharField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(required=False, allow_blank=True, default="")
    exclude_customer_id = serializers.IntegerField(required=False, allow_null=True, default=None)


class VehicleBrandCreateSerializer(serializers.Serializer[dict[str, object]]):
    name = serializers.CharField(allow_blank=True, required=True)


class VehicleBrandUpdateSerializer(serializers.Serializer[dict[str, object]]):
    name = serializers.CharField(allow_blank=True, required=True)
    expected_version = serializers.IntegerField(min_value=1, required=True)


class VehicleBrandStateSerializer(serializers.Serializer[dict[str, object]]):
    expected_version = serializers.IntegerField(min_value=1, required=True)


class VehicleBrandReadSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    name = serializers.CharField()
    is_active = serializers.BooleanField()
    version = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class VehicleBrandPageSerializer(serializers.Serializer[dict[str, object]]):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = VehicleBrandReadSerializer(many=True)


class VehicleBrandSummarySerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    name = serializers.CharField()
    is_active = serializers.BooleanField()


class VehicleOwnerSummarySerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    name = serializers.CharField()
    identification = serializers.CharField()
    is_active = serializers.BooleanField()


class VehicleReadSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    plate = serializers.CharField()
    model = serializers.CharField()
    color = serializers.CharField(allow_blank=True)
    year = serializers.IntegerField(allow_null=True)
    vin = serializers.CharField(allow_null=True)
    is_active = serializers.BooleanField()
    version = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    brand = VehicleBrandSummarySerializer()
    current_owner = VehicleOwnerSummarySerializer(allow_null=True)


class VehicleCreateSerializer(serializers.Serializer[dict[str, object]]):
    owner_id = serializers.IntegerField(required=True)
    brand_id = serializers.IntegerField(required=True)
    plate = serializers.CharField(required=True, allow_blank=True)
    model = serializers.CharField(required=True, allow_blank=True)
    color = serializers.CharField(required=False, allow_blank=True, default="")
    year = serializers.IntegerField(required=False, allow_null=True, default=None)
    vin = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)


class VehicleUpdateSerializer(serializers.Serializer[dict[str, object]]):
    expected_version = serializers.IntegerField(min_value=1, required=True)
    brand_id = serializers.IntegerField(required=False)
    plate = serializers.CharField(required=False, allow_blank=True)
    model = serializers.CharField(required=False, allow_blank=True)
    color = serializers.CharField(required=False, allow_blank=True)
    year = serializers.IntegerField(required=False, allow_null=True)
    vin = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class VehicleStateSerializer(serializers.Serializer[dict[str, object]]):
    expected_version = serializers.IntegerField(min_value=1, required=True)


class VehiclePageSerializer(serializers.Serializer[dict[str, object]]):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = VehicleReadSerializer(many=True)


class VehicleChangeOwnerSerializer(serializers.Serializer[dict[str, object]]):
    owner_id = serializers.IntegerField(required=True)
    expected_version = serializers.IntegerField(min_value=1, required=False)
    version = serializers.IntegerField(min_value=1, required=False)

    def validate(self, attrs: dict[str, object]) -> dict[str, object]:
        if "expected_version" not in attrs and "version" not in attrs:
            raise serializers.ValidationError({"expected_version": ["Este campo es requerido."]})
        if "expected_version" not in attrs:
            attrs["expected_version"] = attrs["version"]
        return attrs


class OwnershipPeriodReadSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    vehicle_id = serializers.IntegerField()
    customer = VehicleOwnerSummarySerializer()
    started_at = serializers.DateTimeField()
    ended_at = serializers.DateTimeField(allow_null=True)
    is_current = serializers.BooleanField()


class OwnershipPeriodPageSerializer(serializers.Serializer[dict[str, object]]):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = OwnershipPeriodReadSerializer(many=True)
