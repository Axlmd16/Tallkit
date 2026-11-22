from __future__ import annotations

from typing import Any

from rest_framework import serializers


class CheckoutPaymentPartSerializer(serializers.Serializer[dict[str, Any]]):
    method = serializers.ChoiceField(choices=["EFECTIVO", "TRANSFERENCIA"])
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class CheckoutWithholdingSerializer(serializers.Serializer[dict[str, Any]]):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class CheckoutBusinessPaymentSerializer(serializers.Serializer[dict[str, Any]]):
    parts = CheckoutPaymentPartSerializer(many=True, required=False)
    withholding = CheckoutWithholdingSerializer(required=False, allow_null=True)


class QuickSaleLineSerializer(serializers.Serializer[dict[str, Any]]):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class CheckoutExecuteInputSerializer(serializers.Serializer[dict[str, Any]]):
    origin_kind = serializers.ChoiceField(choices=["MAINTENANCE", "SALE", "QUICK_SALE"])
    order_id = serializers.IntegerField(required=False, min_value=1)
    sale_id = serializers.IntegerField(required=False, min_value=1)
    customer_id = serializers.IntegerField(required=False, min_value=1)
    lines = QuickSaleLineSerializer(many=True, required=False)
    payment_mode = serializers.ChoiceField(choices=["CASH", "TRANSFER", "MIXED", "CREDIT"])
    partial = serializers.BooleanField(required=False, default=False)  # type: ignore[assignment]
    commercial_payment = CheckoutBusinessPaymentSerializer(required=False, allow_null=True)
    artisan_payment = CheckoutBusinessPaymentSerializer(required=False, allow_null=True)
    include_invoices = serializers.BooleanField(required=False, default=True)
    receiver_mode = serializers.ChoiceField(
        choices=["CUSTOMER", "FINAL_CONSUMER"], required=False, default="CUSTOMER"
    )
    receiver_email = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=254
    )
    save_email_to_customer = serializers.BooleanField(required=False, default=True)
    credit_term_days = serializers.IntegerField(
        required=False, allow_null=True, min_value=1, max_value=9999
    )
    close_order = serializers.BooleanField(required=False, default=False)


class CheckoutPreviewResponseSerializer(serializers.Serializer[dict[str, Any]]):
    origin = serializers.DictField()
    customer = serializers.DictField()
    artisan = serializers.DictField()
    commercial = serializers.DictField()
    closure = serializers.DictField()


class CheckoutExecuteResponseSerializer(serializers.Serializer[dict[str, Any]]):
    overall_status = serializers.ChoiceField(choices=["completed", "partial"])
    origin_kind = serializers.CharField()
    commercial = serializers.DictField()
    artisan = serializers.DictField()
    customer_email_updated = serializers.BooleanField()
    order_closure = serializers.DictField()
    replayed = serializers.BooleanField()
