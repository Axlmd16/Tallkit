"""Serializadores solo para documentar el contrato OpenAPI del taller.

La validación, los límites y los permisos viven en los servicios de aplicación. Los importes
viajan como cadenas decimales con dos decimales. Límites publicados: diagnóstico, observaciones
y trabajo realizado hasta 5000 caracteres; causa de reapertura de 1 a 1000; descripción de
fotografía hasta 200; imágenes JPEG, PNG o WebP estáticas de hasta 10 MiB y 25 megapíxeles, 20
vigentes por orden.
"""

from rest_framework import serializers

_Base = serializers.Serializer[dict[str, object]]


class MaintenanceCommandFields(_Base):
    idempotency_key = serializers.RegexField(
        r"^[A-Za-z0-9._:-]{8,128}$", help_text="Clave del intento, 8 a 128 caracteres ASCII."
    )


class MaintenanceVersionedCommandFields(MaintenanceCommandFields):
    expected_version = serializers.IntegerField(min_value=1)


class MaintenanceOrderCreateSerializer(MaintenanceCommandFields):
    customer_id = serializers.IntegerField(min_value=1)
    vehicle_id = serializers.IntegerField(min_value=1)
    opened_on = serializers.DateField(required=False, help_text="Hoy por omisión; no futura.")
    odometer_km = serializers.IntegerField(min_value=0, max_value=9_999_999)
    odometer_confirmed = serializers.BooleanField(
        required=False, help_text="Confirma un kilometraje menor al último conocido."
    )
    diagnosis = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=5000)


class MaintenanceOrderUpdateSerializer(MaintenanceVersionedCommandFields):
    customer_id = serializers.IntegerField(min_value=1, required=False)
    vehicle_id = serializers.IntegerField(min_value=1, required=False)
    opened_on = serializers.DateField(required=False)
    odometer_km = serializers.IntegerField(min_value=0, max_value=9_999_999, required=False)
    odometer_confirmed = serializers.BooleanField(required=False)
    diagnosis = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=5000)


class MaintenanceInterventionUpdateSerializer(MaintenanceVersionedCommandFields):
    work_performed = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=5000)


class MaintenanceLineCreateSerializer(MaintenanceVersionedCommandFields):
    service_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=9999, required=False)
    applied_price = serializers.CharField(
        required=False, help_text="USD con hasta dos decimales; por omisión el referencial."
    )


class MaintenanceLineUpdateSerializer(MaintenanceVersionedCommandFields):
    quantity = serializers.IntegerField(min_value=1, max_value=9999, required=False)
    applied_price = serializers.CharField(required=False)


class MaintenanceReopenSerializer(MaintenanceVersionedCommandFields):
    reason = serializers.CharField(max_length=1000, help_text="Causa atribuible al trabajo.")


class MaintenancePhotoUploadSerializer(MaintenanceCommandFields):
    file = serializers.ImageField(help_text="JPEG, PNG o WebP estático, máximo 10 MiB.")
    description = serializers.CharField(required=False, allow_blank=True, max_length=200)


class MaintenanceUserLabelSerializer(_Base):
    id = serializers.IntegerField()
    name = serializers.CharField()


class MaintenanceCustomerSnapshotSerializer(_Base):
    id = serializers.IntegerField()
    name = serializers.CharField()
    identification_type = serializers.CharField(required=False)
    identification = serializers.CharField()
    is_active = serializers.BooleanField()


class MaintenanceVehicleSnapshotSerializer(_Base):
    id = serializers.IntegerField()
    plate = serializers.CharField()
    brand = serializers.CharField()
    model = serializers.CharField()
    is_active = serializers.BooleanField()


class MaintenanceLineSerializer(_Base):
    id = serializers.IntegerField()
    service_id = serializers.IntegerField()
    service_code = serializers.CharField(allow_blank=True)
    service_name = serializers.CharField()
    service_is_active = serializers.BooleanField()
    reference_price = serializers.CharField()
    applied_price = serializers.CharField()
    quantity = serializers.IntegerField()
    subtotal = serializers.CharField()
    tax_name = serializers.CharField()
    no_charge = serializers.BooleanField()
    documented_by = serializers.DictField(
        allow_null=True, help_text="Operación ART-SER vigente que documenta la línea."
    )


class MaintenanceInterventionSerializer(_Base):
    id = serializers.IntegerField()
    kind = serializers.ChoiceField(choices=["INITIAL", "CORRECTIVE"])
    ordinal = serializers.IntegerField()
    cause = serializers.CharField()
    work_performed = serializers.CharField()
    notes = serializers.CharField()
    is_open = serializers.BooleanField()
    opened_by = MaintenanceUserLabelSerializer()
    opened_at = serializers.DateTimeField()
    closed_by = MaintenanceUserLabelSerializer(allow_null=True)
    closed_at = serializers.DateTimeField(allow_null=True)
    lines = MaintenanceLineSerializer(many=True)
    subtotal = serializers.CharField()


class MaintenancePhotoSerializer(_Base):
    id = serializers.IntegerField()
    intervention_id = serializers.IntegerField()
    description = serializers.CharField()
    content_type = serializers.CharField()
    size_bytes = serializers.IntegerField()
    width = serializers.IntegerField()
    height = serializers.IntegerField()
    uploaded_by = MaintenanceUserLabelSerializer()
    uploaded_at = serializers.DateTimeField()
    file_url = serializers.CharField()
    thumbnail_url = serializers.CharField()


class MaintenanceTransitionSerializer(_Base):
    id = serializers.IntegerField()
    from_state = serializers.CharField()
    to_state = serializers.CharField()
    reason = serializers.CharField()
    actor = MaintenanceUserLabelSerializer()
    occurred_at = serializers.DateTimeField()
    intervention_id = serializers.IntegerField()


class MaintenanceRequirementSerializer(_Base):
    code = serializers.CharField()
    message = serializers.CharField()


class MaintenanceOdometerConfirmationSerializer(_Base):
    by = MaintenanceUserLabelSerializer()
    at = serializers.DateTimeField()


class MaintenanceFiscalEntitySerializer(_Base):
    ruc = serializers.CharField()
    legal_name = serializers.CharField()


class MaintenanceOrderSerializer(_Base):
    id = serializers.IntegerField()
    number = serializers.CharField()
    state = serializers.ChoiceField(choices=["REGISTERED", "FINALIZED", "REOPENED"])
    version = serializers.IntegerField()
    fiscal_entity = MaintenanceFiscalEntitySerializer()
    customer = MaintenanceCustomerSnapshotSerializer()
    vehicle = MaintenanceVehicleSnapshotSerializer()
    opened_on = serializers.DateField()
    odometer_km = serializers.IntegerField()
    odometer_confirmation = MaintenanceOdometerConfirmationSerializer(allow_null=True)
    diagnosis = serializers.CharField()
    notes = serializers.CharField()
    created_by = MaintenanceUserLabelSerializer()
    created_at = serializers.DateTimeField()
    updated_by = MaintenanceUserLabelSerializer()
    updated_at = serializers.DateTimeField()
    last_finalized_by = MaintenanceUserLabelSerializer(allow_null=True)
    last_finalized_at = serializers.DateTimeField(allow_null=True)
    services_total = serializers.CharField(help_text="Total de servicios de la orden (USD).")
    interventions = MaintenanceInterventionSerializer(many=True)
    photos = MaintenancePhotoSerializer(many=True)
    transitions = MaintenanceTransitionSerializer(many=True)
    pending_requirements = MaintenanceRequirementSerializer(many=True)
    allowed_actions = serializers.ListField(child=serializers.CharField())
    billing_actions = serializers.ListField(
        child=serializers.CharField(),
        help_text="manage_parts, document_services o view_service_operations.",
    )


class MaintenanceServiceSummarySerializer(_Base):
    names = serializers.ListField(child=serializers.CharField())
    line_count = serializers.IntegerField()


class MaintenanceOrderListItemSerializer(_Base):
    id = serializers.IntegerField()
    number = serializers.CharField()
    state = serializers.CharField()
    opened_on = serializers.DateField()
    odometer_km = serializers.IntegerField()
    customer = MaintenanceCustomerSnapshotSerializer()
    vehicle = MaintenanceVehicleSnapshotSerializer()
    services_total = serializers.CharField()
    service_summary = MaintenanceServiceSummarySerializer()


class MaintenancePageFields(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()


class MaintenanceOrderPageSerializer(MaintenancePageFields):
    results = MaintenanceOrderListItemSerializer(many=True)


class MaintenanceCustomerOptionSerializer(_Base):
    id = serializers.IntegerField()
    name = serializers.CharField()
    identification_type = serializers.CharField()
    identification = serializers.CharField()
    phone = serializers.CharField()


class MaintenanceCustomerOptionPageSerializer(MaintenancePageFields):
    results = MaintenanceCustomerOptionSerializer(many=True)


class MaintenanceOpenOrderSerializer(_Base):
    id = serializers.IntegerField()
    number = serializers.CharField()


class MaintenanceVehicleOptionSerializer(_Base):
    id = serializers.IntegerField()
    plate = serializers.CharField()
    brand = serializers.CharField()
    model = serializers.CharField()
    year = serializers.IntegerField(allow_null=True)
    color = serializers.CharField()
    open_order = MaintenanceOpenOrderSerializer(allow_null=True)


class MaintenanceVehicleOptionPageSerializer(MaintenancePageFields):
    results = MaintenanceVehicleOptionSerializer(many=True)


class MaintenanceServiceOptionSerializer(_Base):
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField()
    reference_price = serializers.CharField()


class MaintenanceServiceOptionPageSerializer(MaintenancePageFields):
    results = MaintenanceServiceOptionSerializer(many=True)


# --- Integración económica: repuestos, operación artesanal, pagos y resumen -----------------


class MaintenancePartCreateSerializer(MaintenanceVersionedCommandFields):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.CharField(help_text="Entero positivo de presentaciones completas.")


class MaintenancePartUpdateSerializer(MaintenanceVersionedCommandFields):
    quantity = serializers.CharField(help_text="Entero positivo de presentaciones completas.")


class LinkedSaleSerializer(_Base):
    id = serializers.IntegerField()
    state = serializers.CharField()
    internal_number = serializers.CharField(allow_null=True)
    condition = serializers.CharField()
    origin = serializers.DictField()
    lines = serializers.ListField(child=serializers.DictField())
    money = serializers.DictField()
    estimate = serializers.DictField(required=False, help_text="Solo en el borrador abierto.")


class PartProductOptionsSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    results = serializers.ListField(
        child=serializers.DictField(),
        help_text="Producto con existencia, reservado y disponible; sin costos.",
    )


class EconomicSummarySerializer(_Base):
    order_id = serializers.IntegerField()
    order_number = serializers.CharField()
    commercial = serializers.DictField()
    artisan = serializers.DictField()
    combined = serializers.DictField(
        allow_null=True, help_text="Solo informativo; no es una deuda única ni una factura."
    )
    notice = serializers.CharField()


class CommercialOrderViewSerializer(_Base):
    id = serializers.IntegerField()
    number = serializers.CharField()
    state = serializers.CharField()
    opened_on = serializers.DateField()
    customer = serializers.DictField()
    vehicle = serializers.DictField()
    parts = LinkedSaleSerializer(many=True)


class ServiceOperationPreviewRequestSerializer(_Base):
    condition = serializers.ChoiceField(choices=["CONTADO", "CREDITO"])


class ServiceOperationPreviewSerializer(_Base):
    order_id = serializers.IntegerField()
    order_number = serializers.CharField()
    condition = serializers.CharField()
    operational_date = serializers.DateField()
    lines = serializers.ListField(child=serializers.DictField())
    totals = serializers.DictField(allow_null=True)
    effects = serializers.DictField()
    issues = serializers.ListField(child=serializers.DictField())
    warnings = serializers.ListField(child=serializers.DictField())
    review_digest = serializers.CharField()


class ServiceOperationConfirmSerializer(MaintenanceVersionedCommandFields):
    condition = serializers.ChoiceField(choices=["CONTADO", "CREDITO"])
    review_digest = serializers.CharField(help_text="Huella devuelta por la vista previa.")


class ServiceOperationSerializer(_Base):
    id = serializers.IntegerField()
    internal_number = serializers.CharField()
    order_id = serializers.IntegerField()
    order_number = serializers.CharField(required=False)
    state = serializers.ChoiceField(choices=["CONFIRMED", "VOIDED"])
    condition = serializers.CharField()
    operational_date = serializers.DateField()
    grand_total = serializers.CharField()
    paid = serializers.CharField()
    balance = serializers.CharField()
    payment_state = serializers.CharField()
    replaces = serializers.DictField(allow_null=True)
    replaced_by = serializers.ListField(child=serializers.DictField())
    lines = serializers.ListField(child=serializers.DictField(), required=False)
    payments = serializers.ListField(child=serializers.DictField(), required=False)
    allowed_actions = serializers.ListField(child=serializers.CharField(), required=False)
    fiscal_notice = serializers.CharField(required=False)


class ServiceOperationVoidPreviewSerializer(_Base):
    id = serializers.IntegerField()
    internal_number = serializers.CharField()
    grand_total = serializers.CharField()
    paid = serializers.CharField()
    can_void = serializers.BooleanField()
    blockers = serializers.ListField(child=serializers.CharField())
    effects = serializers.DictField()
    version = serializers.IntegerField()


class ServiceOperationVoidSerializer(MaintenanceVersionedCommandFields):
    reason = serializers.CharField(max_length=500)


class ArtisanPaymentPartSerializer(_Base):
    method = serializers.ChoiceField(choices=["EFECTIVO", "TRANSFERENCIA"])
    amount = serializers.CharField(help_text="USD con hasta dos decimales.")


class ArtisanWithholdingInputSerializer(_Base):
    amount = serializers.CharField(help_text="USD positivo con hasta dos decimales.")
    acknowledged = serializers.BooleanField(
        required=False, help_text="Confirma una retención que supera el umbral de advertencia."
    )


class ArtisanPaymentCreateSerializer(MaintenanceCommandFields):
    operation_id = serializers.UUIDField(help_text="Identidad estable de la acción de cobro.")
    parts = ArtisanPaymentPartSerializer(
        many=True,
        required=False,
        help_text="Dinero recibido; opcional cuando solo se registra una retención.",
    )
    withholding = ArtisanWithholdingInputSerializer(
        required=False,
        allow_null=True,
        help_text="Retención recibida: reduce el saldo sin ser dinero ni medio de pago.",
    )


class ArtisanWithholdingVoucherSerializer(MaintenanceCommandFields):
    voucher_number = serializers.CharField(help_text="Formato NNN-NNN-NNNNNNNNN.")
    voucher_date = serializers.DateField(help_text="No posterior a la fecha actual.")
    income_tax_amount = serializers.CharField(required=False, allow_null=True)
    vat_amount = serializers.CharField(required=False, allow_null=True)


class ArtisanWithholdingVoucherCorrectionSerializer(ArtisanWithholdingVoucherSerializer):
    operation_id = serializers.UUIDField()
    reason = serializers.CharField(max_length=500)


class ArtisanWithholdingVoidSerializer(MaintenanceCommandFields):
    reason = serializers.CharField(max_length=500)


class ArtisanPendingWithholdingsPageSerializer(_Base):
    items = serializers.ListField(child=serializers.DictField())
    total_count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    pending_total = serializers.CharField(help_text="Suma de todas las coincidencias.")


class ArtisanPaymentReplacementSerializer(_Base):
    operation_id = serializers.UUIDField()
    parts = ArtisanPaymentPartSerializer(many=True)


class ArtisanPaymentCorrectionSerializer(MaintenanceCommandFields):
    operation_id = serializers.UUIDField()
    reason = serializers.CharField(max_length=500)
    replacement = ArtisanPaymentReplacementSerializer(required=False)


class ArtisanReceivablePageSerializer(_Base):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    totals = serializers.DictField(help_text="Sumas de todas las coincidencias.")
    results = serializers.ListField(child=serializers.DictField())
