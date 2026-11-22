from rest_framework import serializers

_SCOPES = ("commercial", "artisan")
PENDING_KEYS = (
    "open_orders",
    "cash_sales_unpaid",
    "cash_services_unpaid",
    "proformas_expiring",
    "withholdings_pending",
    "sale_drafts",
    "proforma_drafts",
)


class PendingItemSerializer(serializers.Serializer[dict[str, object]]):
    key = serializers.ChoiceField(choices=PENDING_KEYS)
    scope = serializers.ChoiceField(choices=_SCOPES, allow_null=True)
    count = serializers.IntegerField(min_value=0)


class QualificationNoticeSerializer(serializers.Serializer[dict[str, object]]):
    entity_id = serializers.IntegerField(help_text="Entidad fiscal artesanal del aviso.")
    expires_on = serializers.DateField()
    days_left = serializers.IntegerField()
    expired = serializers.BooleanField()


class PendingSerializer(serializers.Serializer[dict[str, object]]):
    items = PendingItemSerializer(many=True)
    qualification = QualificationNoticeSerializer(allow_null=True)


class ReceivableItemSerializer(serializers.Serializer[dict[str, object]]):
    scope = serializers.ChoiceField(choices=_SCOPES)
    balance = serializers.CharField(help_text="Saldo pendiente con dos decimales.")
    customers = serializers.IntegerField(min_value=0)


class ReceivablesSerializer(serializers.Serializer[dict[str, object]]):
    items = ReceivableItemSerializer(many=True)


class CollectionDaySerializer(serializers.Serializer[dict[str, object]]):
    date = serializers.DateField()
    amount = serializers.CharField(help_text="Dinero cobrado ese día, con dos decimales.")


class CollectionItemSerializer(serializers.Serializer[dict[str, object]]):
    scope = serializers.ChoiceField(choices=_SCOPES)
    total = serializers.CharField(help_text="Suma de los siete días de esa entidad fiscal.")
    days = CollectionDaySerializer(many=True)


class CollectionsSerializer(serializers.Serializer[dict[str, object]]):
    timezone = serializers.CharField()
    items = CollectionItemSerializer(many=True)


class DebtorSerializer(serializers.Serializer[dict[str, object]]):
    customer_id = serializers.IntegerField()
    name = serializers.CharField()
    identification = serializers.CharField()
    person_type = serializers.ChoiceField(choices=("NATURAL", "JURIDICA"))
    commercial = serializers.CharField(
        allow_null=True, help_text="Saldo de repuestos; nulo sin deuda o sin permiso."
    )
    artisan = serializers.CharField(
        allow_null=True, help_text="Saldo de servicios; nulo sin deuda o sin permiso."
    )


class DebtorVisibilitySerializer(serializers.Serializer[dict[str, object]]):
    commercial = serializers.BooleanField()
    artisan = serializers.BooleanField()


class DebtorsSerializer(serializers.Serializer[dict[str, object]]):
    items = DebtorSerializer(many=True)
    visible = DebtorVisibilitySerializer(help_text="Negocios cuya deuda puede ver el usuario.")


class CustomerBusinessSerializer(serializers.Serializer[dict[str, object]]):
    spent_year = serializers.CharField(
        allow_null=True, help_text="Vendido o facturado al cliente este año; nulo sin permiso."
    )
    documents_year = serializers.IntegerField(allow_null=True)
    last_on = serializers.DateField(allow_null=True)
    balance = serializers.CharField(
        allow_null=True, help_text="Saldo por cobrar; nulo sin permiso."
    )


class CustomerVisitsSerializer(serializers.Serializer[dict[str, object]]):
    count_year = serializers.IntegerField()
    last_on = serializers.DateField(allow_null=True)


class CustomerSummarySerializer(serializers.Serializer[dict[str, object]]):
    customer_id = serializers.IntegerField()
    year = serializers.IntegerField()
    visits = CustomerVisitsSerializer(allow_null=True)
    commercial = CustomerBusinessSerializer(allow_null=True)
    artisan = CustomerBusinessSerializer(allow_null=True)


class SearchOpenOrderSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    number = serializers.CharField()
    status = serializers.CharField()


class SearchVehicleItemSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    plate = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]
    owner_id = serializers.IntegerField(allow_null=True)
    owner_name = serializers.CharField()
    open_order = SearchOpenOrderSerializer(allow_null=True)


class SearchVehiclesGroupSerializer(serializers.Serializer[dict[str, object]]):
    total = serializers.IntegerField(min_value=0)
    items = SearchVehicleItemSerializer(many=True)


class SearchCustomerItemSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    identification_type = serializers.CharField()
    identification = serializers.CharField()


class SearchCustomersGroupSerializer(serializers.Serializer[dict[str, object]]):
    total = serializers.IntegerField(min_value=0)
    items = SearchCustomerItemSerializer(many=True)


class SearchInvoiceItemSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.CharField()
    entity = serializers.ChoiceField(choices=("COMERCIAL", "ARTESANAL"))
    number = serializers.CharField(allow_null=True)
    customer_name = serializers.CharField(allow_null=True)
    date = serializers.CharField(allow_null=True)
    state = serializers.ChoiceField(choices=("DRAFT", "PREPARED", "CANCELLED"))
    total = serializers.CharField(allow_null=True)


class SearchInvoicesGroupSerializer(serializers.Serializer[dict[str, object]]):
    total = serializers.IntegerField(min_value=0)
    items = SearchInvoiceItemSerializer(many=True)


class SearchProductItemSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    code = serializers.CharField()
    manufacturer_code = serializers.CharField()
    name = serializers.CharField()
    sale_price = serializers.CharField()
    stock = serializers.CharField(allow_null=True)


class SearchProductsGroupSerializer(serializers.Serializer[dict[str, object]]):
    total = serializers.IntegerField(min_value=0)
    items = SearchProductItemSerializer(many=True)


class GlobalSearchSerializer(serializers.Serializer[dict[str, object]]):
    query = serializers.CharField()
    vehicles = SearchVehiclesGroupSerializer(allow_null=True)
    customers = SearchCustomersGroupSerializer(allow_null=True)
    invoices = SearchInvoicesGroupSerializer(allow_null=True)
    products = SearchProductsGroupSerializer(allow_null=True)


class UnbilledItemSerializer(serializers.Serializer[dict[str, object]]):
    entity = serializers.ChoiceField(choices=["COMERCIAL", "ARTESANAL"])
    source_id = serializers.IntegerField()
    order_id = serializers.IntegerField(allow_null=True)
    number = serializers.CharField()
    customer_name = serializers.CharField()
    date = serializers.CharField()
    total = serializers.CharField()
    fiscal_state = serializers.CharField()


class UnbilledBusinessGroupSerializer(serializers.Serializer[dict[str, object]]):
    count = serializers.IntegerField()
    items = UnbilledItemSerializer(many=True)


class HomeUnbilledSerializer(serializers.Serializer[dict[str, object]]):
    commercial = UnbilledBusinessGroupSerializer(allow_null=True)
    artisan = UnbilledBusinessGroupSerializer(allow_null=True)
