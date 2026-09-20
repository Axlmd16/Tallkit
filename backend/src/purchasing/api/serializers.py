"""Serializadores solo para documentar el contrato OpenAPI de compras.

La validación y los permisos viven en los servicios de aplicación; estos serializadores no
descartan ni aceptan campos por su cuenta. Los decimales viajan como cadenas.
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


class PurchaseLineWriteSerializer(_Base):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.CharField(help_text="Entero positivo de presentaciones, como cadena.")
    unit_cost = serializers.CharField(help_text="USD sin impuesto, hasta 6 decimales, como cadena.")
    tax_definition_id = serializers.IntegerField(min_value=1)
    tax_recoverability = serializers.ChoiceField(choices=["RECOVERABLE", "NON_RECOVERABLE"])


class PurchaseWriteSerializer(CommandFields):
    supplier_id = serializers.IntegerField(min_value=1)
    document_type = serializers.ChoiceField(
        choices=["FACTURA", "NOTA_DE_VENTA", "OTRO", "SIN_DOCUMENTO"]
    )
    supplier_reference = serializers.CharField(
        max_length=REFERENCE_MAX, required=False, allow_blank=True
    )
    document_date = serializers.DateField(help_text="ISO; no posterior al día local.")
    notes = serializers.CharField(max_length=TEXT_MAX, required=False, allow_blank=True)
    no_document_reason = serializers.CharField(
        max_length=TEXT_MAX, required=False, allow_blank=True
    )
    lines = serializers.ListField(
        child=PurchaseLineWriteSerializer(), required=False, max_length=MAX_LINES
    )


class PurchasePatchSerializer(PurchaseWriteSerializer):
    """Omitir un campo lo conserva; enviarlo vacío lo vacía; ``lines`` reemplaza la colección."""

    expected_version = serializers.IntegerField(min_value=1)


class ConfirmSerializer(CommandFields):
    expected_version = serializers.IntegerField(min_value=1)
    review_token = serializers.CharField()
    acknowledged_matches = serializers.ListField(child=serializers.IntegerField(), required=False)


class VoidSerializer(CommandFields):
    expected_version = serializers.IntegerField(min_value=1)
    review_token = serializers.CharField()
    reason = serializers.CharField(max_length=TEXT_MAX)


class ReplacementSerializer(CommandFields):
    pass


class MoneyBlockSerializer(_Base):
    base = serializers.CharField()
    tax = serializers.CharField()
    total = serializers.CharField()
    inventory_value = serializers.CharField()


class PurchaseLineSerializer(_Base):
    id = serializers.IntegerField()
    position = serializers.IntegerField()
    product = serializers.DictField()
    quantity = serializers.CharField()
    unit_cost = serializers.CharField()
    tax_recoverability = serializers.CharField()
    tax = serializers.DictField()
    amounts = MoneyBlockSerializer(allow_null=True)


class PurchaseSerializer(_Base):
    id = serializers.IntegerField()
    state = serializers.ChoiceField(choices=["DRAFT", "CONFIRMED", "VOIDED"])
    version = serializers.IntegerField()
    internal_number = serializers.CharField(allow_null=True)
    supplier = serializers.DictField()
    document = serializers.DictField()
    document_date = serializers.DateField()
    notes = serializers.CharField()
    replaces_id = serializers.IntegerField(allow_null=True)
    replacements = serializers.ListField(child=serializers.DictField())
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    confirmed_at = serializers.DateTimeField(allow_null=True)
    voided_at = serializers.DateTimeField(allow_null=True)
    void_reason = serializers.CharField()
    inventory_operation_id = serializers.IntegerField(allow_null=True)
    void_operation_id = serializers.IntegerField(allow_null=True)
    totals = MoneyBlockSerializer(allow_null=True)
    totals_status = serializers.ChoiceField(choices=["calculated", "not_calculable"])
    lines = PurchaseLineSerializer(many=True)


class PurchaseSummarySerializer(_Base):
    id = serializers.IntegerField()
    state = serializers.CharField()
    version = serializers.IntegerField()
    internal_number = serializers.CharField(allow_null=True)
    supplier = serializers.DictField()
    document = serializers.DictField()
    document_date = serializers.DateField()
    total = serializers.CharField(allow_null=True)


class PurchasePageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = PurchaseSummarySerializer(many=True)


class ReviewSerializer(_Base):
    purchase_id = serializers.IntegerField()
    state = serializers.CharField()
    version = serializers.IntegerField()
    can_confirm = serializers.BooleanField()
    issues = serializers.ListField(child=serializers.DictField())
    review_token = serializers.CharField(allow_null=True)
    expires_in_seconds = serializers.IntegerField()
    totals = MoneyBlockSerializer(allow_null=True)
    effects = serializers.ListField(child=serializers.DictField())
    matches = serializers.ListField(child=serializers.DictField())
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


class TaxOptionSerializer(_Base):
    id = serializers.IntegerField()
    code = serializers.CharField()
    name = serializers.CharField()
    entity_type = serializers.CharField()
    rate = serializers.CharField(allow_null=True)
    tax_status = serializers.ChoiceField(choices=["applicable", "missing", "ambiguous"])


class TaxOptionPageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = TaxOptionSerializer(many=True)
