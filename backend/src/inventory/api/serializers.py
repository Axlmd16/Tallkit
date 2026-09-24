"""Serializadores solo para documentar el contrato OpenAPI de inventario.

La validación y los permisos viven en los servicios de aplicación. La proyección operativa
no contiene costos ni valores; los campos económicos solo existen con
``inventario.ver_valorizacion``. Los decimales viajan como cadenas.
"""

from rest_framework import serializers

_Base = serializers.Serializer[dict[str, object]]
TEXT_MAX = 2000
REFERENCE_MAX = 128


class CommandFields(_Base):
    idempotency_key = serializers.RegexField(
        r"^[A-Za-z0-9._:-]{8,128}$", help_text="Clave del intento, 8 a 128 caracteres ASCII."
    )


class OperationWriteSerializer(CommandFields):
    kind = serializers.ChoiceField(
        choices=["INITIAL_LOAD", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"],
        help_text="No se aceptan PURCHASE_RECEIPT ni REVERSAL.",
    )
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.CharField(help_text="Entero positivo de presentaciones, como cadena.")
    unit_cost = serializers.CharField(
        required=False, help_text="Solo entradas: USD hasta 6 decimales, como cadena."
    )
    reason = serializers.CharField(max_length=TEXT_MAX, required=False)
    reference = serializers.CharField(max_length=REFERENCE_MAX, required=False, allow_blank=True)
    notes = serializers.CharField(max_length=TEXT_MAX, required=False, allow_blank=True)
    corrects_operation_id = serializers.IntegerField(min_value=1, required=False)


class OperationPatchSerializer(CommandFields):
    expected_version = serializers.IntegerField(min_value=1)
    quantity = serializers.CharField(required=False)
    unit_cost = serializers.CharField(required=False)
    reason = serializers.CharField(max_length=TEXT_MAX, required=False)
    reference = serializers.CharField(max_length=REFERENCE_MAX, required=False, allow_blank=True)
    notes = serializers.CharField(max_length=TEXT_MAX, required=False, allow_blank=True)


class OperationConfirmSerializer(CommandFields):
    expected_version = serializers.IntegerField(min_value=1)
    review_token = serializers.CharField()


class OperationReverseSerializer(OperationConfirmSerializer):
    reason = serializers.CharField(max_length=TEXT_MAX)


class AdminOperationSerializer(_Base):
    id = serializers.IntegerField()
    reference = serializers.CharField()
    kind = serializers.CharField()
    state = serializers.CharField()
    version = serializers.IntegerField()
    product = serializers.DictField(allow_null=True)
    quantity = serializers.CharField(allow_null=True)
    unit_cost = serializers.CharField(allow_null=True)
    entry_value = serializers.CharField(allow_null=True)
    reason = serializers.CharField()
    notes = serializers.CharField()
    external_reference = serializers.CharField()
    corrects_operation_id = serializers.IntegerField(allow_null=True)
    reverses_id = serializers.IntegerField(allow_null=True)
    created_at = serializers.DateTimeField()
    posted_at = serializers.DateTimeField(allow_null=True)


class OperationPageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = AdminOperationSerializer(many=True)


class OperationProjectionSerializer(_Base):
    id = serializers.IntegerField()
    reference = serializers.CharField()
    kind = serializers.CharField()
    state = serializers.CharField()
    version = serializers.IntegerField()
    product = serializers.DictField(allow_null=True)
    quantity = serializers.CharField(allow_null=True)
    origin = serializers.DictField()
    reverses_reference = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()
    posted_at = serializers.DateTimeField(allow_null=True)
    reason = serializers.CharField(required=False)
    entry_value = serializers.CharField(required=False)
    unit_cost = serializers.CharField(required=False)
    movements = serializers.ListField(child=serializers.DictField(), required=False)


class OperationReviewSerializer(_Base):
    operation_id = serializers.IntegerField()
    state = serializers.CharField()
    version = serializers.IntegerField()
    can_confirm = serializers.BooleanField(required=False)
    can_reverse = serializers.BooleanField(required=False)
    issues = serializers.ListField(child=serializers.DictField())
    effects = serializers.ListField(child=serializers.DictField(), required=False)
    review_token = serializers.CharField(allow_null=True)
    expires_in_seconds = serializers.IntegerField()


class StockRowSerializer(_Base):
    product = serializers.DictField()
    quantity = serializers.CharField()
    reserved = serializers.CharField(help_text="Reservado por ventas vinculadas abiertas.")
    available = serializers.CharField(help_text="Existencia menos reservas vigentes.")
    version = serializers.IntegerField()
    last_ordinal = serializers.IntegerField()
    average_cost = serializers.CharField(required=False)
    inventory_value = serializers.CharField(required=False)


class StockReservationSerializer(_Base):
    quantity = serializers.CharField()
    sale_id = serializers.IntegerField(allow_null=True)
    order_id = serializers.IntegerField(allow_null=True)
    order_number = serializers.CharField(allow_null=True)


class StockItemSerializer(StockRowSerializer):
    reservations = StockReservationSerializer(many=True)


class StockPageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = StockRowSerializer(many=True)


class KardexSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = serializers.ListField(child=serializers.DictField())
    cut = serializers.DictField()
    opening_quantity = serializers.CharField()
    closing_quantity = serializers.CharField()
    period_totals = serializers.DictField()
    matching_totals = serializers.DictField()
    page_opening_quantity = serializers.CharField(allow_null=True)
    opening_value = serializers.CharField(required=False)
    closing_value = serializers.CharField(required=False)
