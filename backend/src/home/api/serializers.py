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
