"""Serializadores solo para documentar el contrato OpenAPI de entradas y compras.

La validación y los permisos viven en los servicios de aplicación; estos serializadores no
descartan ni aceptan campos por su cuenta. Los decimales viajan como cadenas. Los campos
económicos solo aparecen para quien posee ``productos.ver_costos``.
"""

from rest_framework import serializers

_Base = serializers.Serializer[dict[str, object]]

MAX_LINES = 200
REFERENCE_MAX = 128
TEXT_MAX = 2000


class CommandFields(_Base):
    idempotency_key = serializers.RegexField(
        r"^[A-Za-z0-9._:-]{8,128}$", help_text="Clave del intento, 8 a 128 caracteres ASCII."
    )


class EntryLineWriteSerializer(_Base):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.CharField(help_text="Entero positivo de presentaciones, como cadena.")
    unit_cost = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Opcional. USD por presentación, hasta 6 decimales, como cadena.",
    )


class EntryReviewWriteSerializer(_Base):
    supplier_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    reference = serializers.CharField(max_length=REFERENCE_MAX, required=False, allow_blank=True)
    observation = serializers.CharField(max_length=TEXT_MAX, required=False, allow_blank=True)
    lines = serializers.ListField(child=EntryLineWriteSerializer(), max_length=MAX_LINES)
    acknowledged_entry_ids = serializers.ListField(child=serializers.IntegerField(), required=False)


class EntryWriteSerializer(CommandFields, EntryReviewWriteSerializer):
    """Registra y confirma la entrada en una sola acción."""


class VoidSerializer(CommandFields):
    expected_version = serializers.IntegerField(min_value=1)
    review_token = serializers.CharField()
    reason = serializers.CharField(max_length=TEXT_MAX)


class PurchaseLineSerializer(_Base):
    id = serializers.IntegerField()
    position = serializers.IntegerField()
    product = serializers.DictField()
    quantity = serializers.CharField()
    cost_registered = serializers.BooleanField(required=False)
    unit_cost = serializers.CharField(required=False, allow_null=True)
    tax_recoverability = serializers.CharField(required=False, allow_null=True)
    tax = serializers.DictField(required=False)
    amounts = serializers.DictField(required=False, allow_null=True)


class PurchaseSerializer(_Base):
    id = serializers.IntegerField()
    flow = serializers.ChoiceField(choices=["SIMPLE", "LEGACY"])
    state = serializers.ChoiceField(choices=["DRAFT", "CONFIRMED", "VOIDED"])
    version = serializers.IntegerField()
    internal_number = serializers.CharField(allow_null=True)
    supplier = serializers.DictField(allow_null=True)
    reference = serializers.CharField()
    observation = serializers.CharField()
    registered_by = serializers.DictField(allow_null=True)
    created_at = serializers.DateTimeField()
    confirmed_at = serializers.DateTimeField(allow_null=True)
    voided_at = serializers.DateTimeField(allow_null=True)
    void_reason = serializers.CharField()
    voided_by = serializers.DictField(allow_null=True)
    inventory_operation_id = serializers.IntegerField(allow_null=True)
    void_operation_id = serializers.IntegerField(allow_null=True)
    lines = PurchaseLineSerializer(many=True)
    legacy = serializers.DictField(
        required=False, help_text="Datos de la compra anterior; solo con permiso de costos."
    )


class PurchaseSummarySerializer(_Base):
    id = serializers.IntegerField()
    flow = serializers.ChoiceField(choices=["SIMPLE", "LEGACY"])
    state = serializers.CharField()
    internal_number = serializers.CharField(allow_null=True)
    moment = serializers.DateTimeField()
    registered_by = serializers.DictField(allow_null=True)
    product_count = serializers.IntegerField()
    unit_count = serializers.CharField()
    supplier = serializers.DictField(allow_null=True)
    total = serializers.CharField(required=False)


class PurchasePageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = PurchaseSummarySerializer(many=True)
    registered_by_options = serializers.ListField(
        child=serializers.DictField(), help_text="Usuarios que han registrado entradas."
    )


class EntryReviewSerializer(_Base):
    can_confirm = serializers.BooleanField()
    issues = serializers.ListField(child=serializers.DictField())
    summary = serializers.DictField(help_text="products y units que entran.")
    supplier = serializers.DictField(allow_null=True)
    reference = serializers.CharField()
    observation = serializers.CharField()
    lines = serializers.ListField(child=serializers.DictField())
    duplicates = serializers.ListField(
        child=serializers.DictField(),
        help_text="Entradas vigentes de hoy con los mismos productos y cantidades.",
    )
    requires_acknowledgement = serializers.BooleanField()


class VoidReviewSerializer(_Base):
    purchase_id = serializers.IntegerField()
    state = serializers.CharField()
    version = serializers.IntegerField()
    can_void = serializers.BooleanField()
    issues = serializers.ListField(child=serializers.DictField())
    effects = serializers.ListField(child=serializers.DictField())
    review_token = serializers.CharField(allow_null=True)
    expires_in_seconds = serializers.IntegerField()
