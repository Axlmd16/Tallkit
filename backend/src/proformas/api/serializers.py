"""Serializadores solo para documentar el contrato OpenAPI de proformas.

La validación, los límites y los permisos viven en los servicios de aplicación. Los decimales
viajan como cadenas sin exponente; las fechas son ISO y los estados van separados de sus
etiquetas. Ninguna respuesta incluye costos ni valoración de inventario.
"""

from rest_framework import serializers

_Base = serializers.Serializer[dict[str, object]]

MAX_LINES = 200
STATES = ["DRAFT", "VALID", "EXPIRED", "CONVERTED", "VOIDED"]
ACTIONS = ["edit", "issue", "convert", "void", "copy", "print"]
_MONEY = "Importe en USD con dos decimales, como cadena."


class CommandFields(_Base):
    idempotency_key = serializers.RegexField(
        r"^[A-Za-z0-9._:-]{8,128}$",
        help_text="Clave del intento, 8 a 128 caracteres ASCII; se conserva al reintentar.",
    )


class VersionedCommandSerializer(CommandFields):
    expected_version = serializers.IntegerField(min_value=1)


class ReviewedCommandSerializer(VersionedCommandSerializer):
    review_token = serializers.CharField(help_text="Token de la revisión previa (15 minutos).")


class ProformaLineWriteSerializer(_Base):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.CharField(help_text="Entero positivo de presentaciones, como cadena.")


class DraftPreviewSerializer(_Base):
    customer_id = serializers.IntegerField(min_value=1, required=False)
    valid_until = serializers.DateField(required=False, allow_null=True)
    lines = serializers.ListField(
        child=ProformaLineWriteSerializer(), required=False, max_length=MAX_LINES
    )


class ProformaWriteSerializer(CommandFields):
    customer_id = serializers.IntegerField(min_value=1)
    valid_until = serializers.DateField(
        required=False,
        allow_null=True,
        help_text="Omitida o nula: vigencia predeterminada de emisión más 7 días.",
    )
    lines = serializers.ListField(
        child=ProformaLineWriteSerializer(), required=False, max_length=MAX_LINES
    )


class ProformaPatchSerializer(ProformaWriteSerializer):
    """Omitir un campo lo conserva; ``lines`` reemplaza la colección completa."""

    customer_id = serializers.IntegerField(min_value=1, required=False)
    expected_version = serializers.IntegerField(min_value=1)


class CustomerSerializer(_Base):
    id = serializers.IntegerField()
    name = serializers.CharField()
    identification_type = serializers.CharField()
    identification = serializers.CharField()
    phone = serializers.CharField()
    email = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)


class ReferenceSerializer(_Base):
    id = serializers.IntegerField()
    number = serializers.CharField(allow_null=True)
    state = serializers.ChoiceField(choices=STATES)


class LinkedSaleSerializer(_Base):
    id = serializers.IntegerField()
    internal_number = serializers.CharField(allow_null=True)
    state = serializers.CharField(help_text="Valores: DRAFT, CONFIRMED, VOIDED.")
    can_open = serializers.BooleanField(required=False)


class TotalsSerializer(_Base):
    base = serializers.CharField(help_text=_MONEY)
    tax = serializers.CharField(help_text=_MONEY)
    total = serializers.CharField(help_text=_MONEY)


class ProformaLineSerializer(_Base):
    position = serializers.IntegerField()
    product_id = serializers.IntegerField(required=False)
    product_code = serializers.CharField(allow_null=True)
    product_name = serializers.CharField(allow_null=True)
    product_active = serializers.BooleanField(required=False)
    is_kit = serializers.BooleanField()
    quantity = serializers.CharField()
    unit_price = serializers.CharField(allow_null=True, help_text="Precio final de catálogo.")
    tax_rate = serializers.CharField(allow_null=True)
    base_amount = serializers.CharField(allow_null=True, help_text=_MONEY)
    tax_amount = serializers.CharField(allow_null=True, help_text=_MONEY)
    total_amount = serializers.CharField(allow_null=True, help_text=_MONEY)
    availability = serializers.CharField(
        required=False, help_text="Disponibilidad actual informativa (borrador)."
    )
    availability_at_issue = serializers.CharField(
        required=False, help_text="Disponibilidad informativa observada al emitir."
    )
    availability_sufficient = serializers.BooleanField()


class WarningSerializer(_Base):
    code = serializers.CharField()
    product_id = serializers.IntegerField()
    product_code = serializers.CharField(allow_null=True)
    requested = serializers.CharField()
    available = serializers.CharField()
    message = serializers.CharField()


class IssueSerializer(_Base):
    code = serializers.CharField()
    field = serializers.CharField()
    message = serializers.CharField()


class ProformaSummarySerializer(_Base):
    id = serializers.IntegerField()
    state = serializers.ChoiceField(
        choices=STATES, help_text="Estado efectivo; VALID y EXPIRED se calculan con el día local."
    )
    version = serializers.IntegerField()
    internal_number = serializers.CharField(allow_null=True)
    customer = CustomerSerializer()
    issue_date = serializers.DateField(allow_null=True)
    valid_until = serializers.DateField(allow_null=True)
    base_total = serializers.CharField(allow_null=True, help_text=_MONEY)
    tax_total = serializers.CharField(allow_null=True, help_text=_MONEY)
    grand_total = serializers.CharField(allow_null=True, help_text=_MONEY)
    origin = ReferenceSerializer(allow_null=True)
    sale = LinkedSaleSerializer(allow_null=True)
    allowed_actions = serializers.ListField(child=serializers.ChoiceField(choices=ACTIONS))
    created_at = serializers.DateTimeField()
    issued_at = serializers.DateTimeField(allow_null=True)
    converted_at = serializers.DateTimeField(allow_null=True)
    voided_at = serializers.DateTimeField(allow_null=True)
    fiscal_scope = serializers.CharField(help_text="Siempre COMERCIAL.")


class ProformaSerializer(ProformaSummarySerializer):
    derived = ReferenceSerializer(many=True)
    lines = ProformaLineSerializer(many=True)
    totals = TotalsSerializer(allow_null=True)
    suggested_valid_until = serializers.DateField(required=False)
    warnings = WarningSerializer(many=True, required=False)


class ProformaPageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = ProformaSummarySerializer(many=True)


class PreviewBaseSerializer(_Base):
    issues = IssueSerializer(many=True)
    issue_date = serializers.DateField(required=False)
    valid_until = serializers.DateField(required=False, allow_null=True)
    suggested_valid_until = serializers.DateField(required=False)
    lines = ProformaLineSerializer(many=True, required=False)
    totals = TotalsSerializer(required=False, allow_null=True)
    warnings = WarningSerializer(many=True, required=False)
    notice = serializers.CharField(required=False)


class DraftPreviewResultSerializer(PreviewBaseSerializer):
    status = serializers.CharField()
    internal_number = serializers.CharField(allow_null=True)
    customer = CustomerSerializer(allow_null=True)
    can_issue = serializers.BooleanField()


class IssuePreviewSerializer(PreviewBaseSerializer):
    proforma_id = serializers.IntegerField()
    state = serializers.CharField()
    version = serializers.IntegerField()
    can_issue = serializers.BooleanField()
    review_token = serializers.CharField(allow_null=True)
    expires_in_seconds = serializers.IntegerField()


class ComparisonSideSerializer(_Base):
    quantity = serializers.CharField()
    unit_price = serializers.CharField(allow_null=True)
    tax_rate = serializers.CharField(allow_null=True)
    base_amount = serializers.CharField(allow_null=True)
    tax_amount = serializers.CharField(allow_null=True)
    total_amount = serializers.CharField(allow_null=True)


class ComparisonProductSerializer(_Base):
    product_id = serializers.IntegerField()
    product_code = serializers.CharField(allow_null=True)
    product_name = serializers.CharField(allow_null=True)
    status = serializers.ChoiceField(choices=["UNCHANGED", "CHANGED", "REMOVED", "ADDED"])
    changes = serializers.ListField(
        child=serializers.ChoiceField(choices=["quantity", "unit_price", "tax_rate"])
    )
    quoted = ComparisonSideSerializer(allow_null=True)
    current = ComparisonSideSerializer(allow_null=True)


class ComparisonTotalsSerializer(_Base):
    quoted = TotalsSerializer(allow_null=True)
    current = TotalsSerializer(allow_null=True)
    difference = serializers.CharField(allow_null=True)


class ComparisonSerializer(_Base):
    products = ComparisonProductSerializer(many=True)
    totals = ComparisonTotalsSerializer()
    has_differences = serializers.BooleanField()


class BlockedSerializer(_Base):
    code = serializers.CharField()
    message = serializers.CharField()


class ConversionPreviewSerializer(_Base):
    proforma_id = serializers.IntegerField()
    version = serializers.IntegerField()
    can_convert = serializers.BooleanField()
    blocked_by = BlockedSerializer(allow_null=True)
    sale = LinkedSaleSerializer(allow_null=True)
    issues = IssueSerializer(many=True)
    warnings = WarningSerializer(many=True)
    comparison = ComparisonSerializer(allow_null=True)
    review_token = serializers.CharField(allow_null=True)
    expires_in_seconds = serializers.IntegerField()


class IssuerSerializer(_Base):
    id = serializers.IntegerField()
    type = serializers.CharField(help_text="Siempre COMERCIAL.")
    ruc = serializers.CharField()
    legal_name = serializers.CharField()
    trade_name = serializers.CharField(allow_null=True)
    address = serializers.CharField(allow_null=True)
    phone = serializers.CharField(allow_null=True)
    email = serializers.CharField(allow_null=True)


class CurrentAvailabilitySerializer(_Base):
    position = serializers.IntegerField()
    product_code = serializers.CharField(allow_null=True)
    available = serializers.CharField(allow_null=True)


class DocumentSerializer(_Base):
    notice = serializers.CharField()
    number = serializers.CharField()
    state = serializers.ChoiceField(choices=STATES)
    issue_date = serializers.DateField()
    valid_until = serializers.DateField()
    issuer = IssuerSerializer()
    has_logo = serializers.BooleanField(
        help_text="Si es verdadero, el logo histórico se obtiene en `document/logo/`."
    )
    customer = CustomerSerializer()
    lines = ProformaLineSerializer(many=True)
    base_total = serializers.CharField(help_text=_MONEY)
    tax_total = serializers.CharField(help_text=_MONEY)
    grand_total = serializers.CharField(help_text=_MONEY)
    availability_observed_at = serializers.DateTimeField()
    current_availability = CurrentAvailabilitySerializer(
        many=True, help_text="Consulta actual, fuera del cuerpo histórico."
    )
    origin = ReferenceSerializer(allow_null=True)


class CustomerOptionSerializer(_Base):
    id = serializers.IntegerField()
    name = serializers.CharField()
    identification_type = serializers.CharField()
    identification = serializers.CharField()
    phone = serializers.CharField()


class CustomerOptionPageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = CustomerOptionSerializer(many=True)


class ProductOptionSerializer(_Base):
    id = serializers.IntegerField()
    code = serializers.CharField()
    name = serializers.CharField()
    unit_name = serializers.CharField()
    unit_symbol = serializers.CharField()
    content_quantity = serializers.CharField()
    unit_price = serializers.CharField(help_text="Precio final de catálogo; no editable.")
    is_kit = serializers.BooleanField()
    available = serializers.CharField(allow_null=True, help_text="Disponibilidad informativa.")


class ProductOptionPageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = ProductOptionSerializer(many=True)
