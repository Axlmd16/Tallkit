"""Serializadores solo para documentar el contrato OpenAPI de ventas.

La validación, los límites y los permisos viven en los servicios de aplicación; estos
serializadores no aceptan ni descartan campos por su cuenta. Los decimales viajan como
cadenas sin exponente ni coma. Límites publicados: 200 líneas por venta o devolución, una
parte por cada uno de los dos medios (máximo dos partes), notas de hasta 2000 caracteres y
motivos de 1 a 500 caracteres tras recortar espacios.
"""

from rest_framework import serializers

_Base = serializers.Serializer[dict[str, object]]

MAX_LINES = 200
MAX_PARTS = 2
NOTES_MAX = 2000
REASON_MAX = 500
METHODS = ["EFECTIVO", "TRANSFERENCIA"]


class CommandFields(_Base):
    idempotency_key = serializers.RegexField(
        r"^[A-Za-z0-9._:-]{8,128}$", help_text="Clave del intento, 8 a 128 caracteres ASCII."
    )


class OperationFields(_Base):
    operation_id = serializers.UUIDField(
        help_text="Identidad estable del hecho de dinero; se conserva al reintentar."
    )


class SaleLineWriteSerializer(_Base):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.CharField(help_text="Entero positivo de presentaciones, como cadena.")


class SaleWriteSerializer(CommandFields):
    customer_id = serializers.IntegerField(min_value=1)
    condition = serializers.CharField(help_text="Valores: CONTADO, CREDITO.")
    notes = serializers.CharField(max_length=NOTES_MAX, required=False, allow_blank=True)
    lines = serializers.ListField(
        child=SaleLineWriteSerializer(), required=False, max_length=MAX_LINES
    )


class SalePatchSerializer(SaleWriteSerializer):
    """Omitir un campo lo conserva; enviarlo vacío lo vacía; ``lines`` reemplaza la colección."""

    expected_version = serializers.IntegerField(min_value=1)


class DraftPreviewSerializer(_Base):
    customer_id = serializers.IntegerField(min_value=1, required=False)
    condition = serializers.CharField(required=False, help_text="Valores: CONTADO, CREDITO.")
    notes = serializers.CharField(max_length=NOTES_MAX, required=False, allow_blank=True)
    lines = serializers.ListField(
        child=SaleLineWriteSerializer(), required=False, max_length=MAX_LINES
    )


class SaleConfirmSerializer(CommandFields):
    expected_version = serializers.IntegerField(min_value=1)
    review_token = serializers.CharField()


class PartSerializer(_Base):
    method = serializers.CharField(help_text="Valores: EFECTIVO, TRANSFERENCIA.")
    amount = serializers.CharField(help_text="USD positivo, hasta 2 decimales, como cadena.")


class PaymentPreviewSerializer(OperationFields):
    parts = serializers.ListField(child=PartSerializer(), min_length=1, max_length=MAX_PARTS)


class PaymentWriteSerializer(CommandFields, PaymentPreviewSerializer):
    review_token = serializers.CharField()


class CorrectionReplacementSerializer(OperationFields):
    parts = serializers.ListField(child=PartSerializer(), min_length=1, max_length=MAX_PARTS)


class CorrectionPreviewSerializer(OperationFields):
    reason = serializers.CharField(min_length=1, max_length=REASON_MAX)
    replacement = CorrectionReplacementSerializer(required=False, allow_null=True)


class CorrectionWriteSerializer(CommandFields, CorrectionPreviewSerializer):
    review_token = serializers.CharField()


class ReturnLineSerializer(_Base):
    sale_line_id = serializers.IntegerField(min_value=1)
    fit_quantity = serializers.CharField(help_text="Unidades aptas para reventa, entero >= 0.")
    unfit_quantity = serializers.CharField(help_text="Unidades no aptas, entero >= 0.")


class ReturnPreviewSerializer(OperationFields):
    reason = serializers.CharField(min_length=1, max_length=REASON_MAX)
    lines = serializers.ListField(child=ReturnLineSerializer(), min_length=1, max_length=MAX_LINES)


class ReturnWriteSerializer(CommandFields, ReturnPreviewSerializer):
    review_token = serializers.CharField()


class RefundPreviewSerializer(OperationFields):
    sale_return_id = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(min_length=1, max_length=REASON_MAX)
    parts = serializers.ListField(child=PartSerializer(), min_length=1, max_length=MAX_PARTS)


class RefundWriteSerializer(CommandFields, RefundPreviewSerializer):
    review_token = serializers.CharField()


class VoidRefundSerializer(OperationFields):
    parts = serializers.ListField(child=PartSerializer(), min_length=1, max_length=MAX_PARTS)


class VoidPreviewSerializer(_Base):
    reason = serializers.CharField(min_length=1, max_length=REASON_MAX)
    refund = VoidRefundSerializer(
        required=False,
        allow_null=True,
        help_text="Desembolso ya realizado cuando la venta tiene dinero aplicado.",
    )


class VoidWriteSerializer(CommandFields, VoidPreviewSerializer):
    expected_version = serializers.IntegerField(min_value=1)
    review_token = serializers.CharField()


class SaleSerializer(_Base):
    id = serializers.IntegerField()
    state = serializers.CharField(help_text="Valores: DRAFT, CONFIRMED, VOIDED.")
    version = serializers.IntegerField()
    condition = serializers.CharField()
    notes = serializers.CharField()
    internal_number = serializers.CharField(allow_null=True)
    origin = serializers.DictField()
    customer = serializers.DictField()
    operational_date = serializers.DateField(allow_null=True)
    base_total = serializers.CharField(allow_null=True)
    tax_total = serializers.CharField(allow_null=True)
    grand_total = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()
    confirmed_at = serializers.DateTimeField(allow_null=True)
    voided_at = serializers.DateTimeField(allow_null=True)
    void_reason = serializers.CharField()
    fiscal_scope = serializers.CharField()
    lines = serializers.ListField(child=serializers.DictField())
    money = serializers.DictField()


class SaleSummarySerializer(_Base):
    id = serializers.IntegerField()
    state = serializers.CharField()
    internal_number = serializers.CharField(allow_null=True)
    customer = serializers.DictField()
    origin = serializers.DictField()
    sale_date = serializers.DateField()
    grand_total = serializers.CharField(allow_null=True)
    money = serializers.DictField()


class SalePageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = SaleSummarySerializer(many=True)


class ReceivablesPageSerializer(SalePageSerializer):
    receivable_total = serializers.CharField(help_text="Deuda cobrable de todas las coincidencias.")
    refund_due_total = serializers.CharField(help_text="Exceso por reembolsar, no restado.")


class SaleReviewSerializer(_Base):
    sale_id = serializers.IntegerField()
    state = serializers.CharField()
    version = serializers.IntegerField()
    can_confirm = serializers.BooleanField()
    issues = serializers.ListField(child=serializers.DictField())
    review_token = serializers.CharField(allow_null=True)
    expires_in_seconds = serializers.IntegerField()
    totals = serializers.DictField(allow_null=True)
    effects = serializers.ListField(child=serializers.DictField())
    lines = serializers.ListField(child=serializers.DictField())


class DraftPreviewResultSerializer(_Base):
    status = serializers.CharField()
    internal_number = serializers.CharField(allow_null=True)
    number_pending = serializers.BooleanField()
    notice = serializers.CharField()
    condition = serializers.CharField(allow_null=True)
    customer = serializers.DictField(allow_null=True)
    fiscal_entity = serializers.DictField(allow_null=True)
    issues = serializers.ListField(child=serializers.DictField())
    can_confirm = serializers.BooleanField()
    lines = serializers.ListField(child=serializers.DictField())
    totals = serializers.DictField(allow_null=True)
    operational_date = serializers.DateField()


class MoneyReviewSerializer(_Base):
    sale_id = serializers.IntegerField()
    version = serializers.IntegerField()
    issues = serializers.ListField(child=serializers.DictField())
    review_token = serializers.CharField(allow_null=True)
    expires_in_seconds = serializers.IntegerField()


class PaymentSerializer(_Base):
    id = serializers.IntegerField()
    operation_id = serializers.UUIDField()
    sale_id = serializers.IntegerField()
    amount = serializers.CharField()
    parts = serializers.ListField(child=PartSerializer())
    effective_at = serializers.DateTimeField()
    effective_date = serializers.DateField()
    state = serializers.CharField(help_text="Valores: ACTIVE, CORRECTED.")
    correction = serializers.DictField(allow_null=True)
    money = serializers.DictField()


class ReturnSerializer(_Base):
    id = serializers.IntegerField()
    operation_id = serializers.UUIDField()
    sale_id = serializers.IntegerField()
    reason = serializers.CharField()
    grand_total = serializers.CharField()
    restocked = serializers.BooleanField()
    lines = serializers.ListField(child=serializers.DictField())
    money = serializers.DictField()


class RefundSerializer(_Base):
    id = serializers.IntegerField()
    operation_id = serializers.UUIDField()
    sale_id = serializers.IntegerField()
    origin = serializers.CharField(help_text="Valores: RETURN, VOID.")
    sale_return_id = serializers.IntegerField(allow_null=True)
    amount = serializers.CharField()
    reason = serializers.CharField()
    parts = serializers.ListField(child=PartSerializer())
    money = serializers.DictField()


class DocumentSerializer(_Base):
    notice = serializers.CharField(help_text="Documento interno no autorizado por el SRI.")
    number = serializers.CharField(allow_null=True)
    state = serializers.CharField()
    voided = serializers.BooleanField()
    issuer = serializers.DictField(allow_null=True)
    customer = serializers.DictField()
    origin = serializers.DictField()
    lines = serializers.ListField(child=serializers.DictField())
    base_total = serializers.CharField(allow_null=True)
    tax_total = serializers.CharField(allow_null=True)
    grand_total = serializers.CharField(allow_null=True)


class OperationStatusSerializer(_Base):
    kind = serializers.CharField(help_text="Valores: payment, return, refund.")
    id = serializers.IntegerField()
    result = serializers.DictField()


class OptionPageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = serializers.ListField(child=serializers.DictField())
